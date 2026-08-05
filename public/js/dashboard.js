"use strict";

/* ==========================================================
   Dashboard — renders live data from /api/dashboard/summary
   Relies on helpers exposed by common.js (window.IMC)
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        badgeClass,
        priorityClass,
        describeDeadline,
        formatShortDate,
        formatRelative,
        renderNotice,
        renderTableNotice,
        showToast,
        generateInitials,
        renderUserPlaceholders,
        notificationPresentation,
        notificationIcon
    } = window.IMC;

    const user = window.currentUser;

    // The guard in common.js already redirected if there is no session
    if (!user) return;

    /* ---------- Static header bits ---------- */

    const CALENDAR_ICON =
        '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/>' +
        '<line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>' +
        '<line x1="3" y1="10" x2="21" y2="10"/></svg>';

    function renderGreeting() {
        const hour = new Date().getHours();

        const greeting =
            hour < 12
                ? "Good morning"
                : hour < 18
                ? "Good afternoon"
                : "Good evening";

        const el = document.getElementById("greeting");
        if (el) el.textContent = greeting;

        const today = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });

        const line = document.getElementById("todayLine");
        if (line) {
            line.textContent = today + " — Here's what's happening today.";
        }
    }

    /* ---------- Stat cards ---------- */

    function setStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function setDelta(wrapId, valId, amount) {
        const wrap = document.getElementById(wrapId);
        const val = document.getElementById(valId);

        if (!wrap || !val) return;

        if (!amount) {
            wrap.style.display = "none";
            return;
        }

        wrap.style.display = "";
        val.textContent = "+" + amount;
    }

    function renderStats(stats) {
        setStat("statActive", stats.activeProjects);
        setStat("statPending", stats.pendingApproval);
        setStat("statOverdue", stats.overdueTasks);
        setStat("statCompleted", stats.completed);

        setDelta("statActiveDelta", "statActiveDeltaVal", stats.activeProjectsDelta);
        setDelta("statPendingDelta", "statPendingDeltaVal", stats.pendingApprovalDelta);
        setDelta("statCompletedDelta", "statCompletedDeltaVal", stats.completedDelta);

        // The "Urgent" tag only makes sense when something is actually overdue
        const tag = document.getElementById("statOverdueTag");
        if (tag) tag.style.display = stats.overdueTasks ? "" : "none";
    }

    /* ---------- Projects table ---------- */

    // Reuses the accent colours already present in the stylesheet
    const DOT_COLORS = [
        "var(--orange)",
        "var(--yellow)",
        "var(--blue)",
        "var(--green)",
        "var(--gray-400)"
    ];

    function renderProjects(projects) {
        const body = document.getElementById("projectsBody");
        if (!body) return;

        if (!projects.length) {
            renderTableNotice(
                body,
                "No projects yet. Submit a project request to get started.",
                5
            );
            return;
        }

        body.innerHTML = projects
            .map((project, index) => {
                const color = DOT_COLORS[index % DOT_COLORS.length];
                const due = describeDeadline(
                    project.postingDate || project.eventDate
                );

                const taskLabel =
                    project.taskCount === 1 ? "1 task" : project.taskCount + " tasks";

                const point = project.requestingHead
                    ? "Point: " + escapeHtml(project.requestingHead) + " · "
                    : "";

                return (
                    "<tr>" +
                    '<td><div class="proj-name-cell">' +
                    '<span class="proj-dot" style="background:' + color + ';"></span>' +
                    "<div>" +
                    '<div class="proj-name">' + escapeHtml(project.projectName) + "</div>" +
                    '<div class="proj-meta">' + point + taskLabel + "</div>" +
                    '<a class="row-link" href="discussions.html?project=' +
                    escapeHtml(project._id) + '">Discuss</a>' +
                    "</div></div></td>" +
                    '<td><span class="proj-committee">' +
                    escapeHtml(project.committee || "—") +
                    "</span></td>" +
                    '<td><span class="proj-due' +
                    (due.isOverdue ? " overdue" : "") +
                    '">' +
                    escapeHtml(
                        due.isOverdue
                            ? formatShortDate(project.postingDate || project.eventDate) + " ⚠"
                            : due.label
                    ) +
                    "</span></td>" +
                    '<td><span class="badge ' +
                    badgeClass(project.status) +
                    '">' +
                    escapeHtml(project.status) +
                    "</span></td>" +
                    '<td><div class="proj-progress">' +
                    '<div class="progress-pct">' + project.progress + "%</div>" +
                    '<div class="progress-bar-wrap">' +
                    '<div class="progress-bar-fill" style="width:' +
                    project.progress +
                    "%;background:" +
                    color +
                    ';"></div>' +
                    "</div></div></td>" +
                    "</tr>"
                );
            })
            .join("");
    }

    /* ---------- My tasks ---------- */

    function renderTasks(tasks) {
        const list = document.getElementById("myTasksList");
        if (!list) return;

        if (!tasks.length) {
            renderNotice(list, "You have no assigned tasks right now.");
            return;
        }

        list.innerHTML = tasks
            .map((task) => {
                const isDone = task.status === "Completed";
                const due = describeDeadline(task.deadline);

                const checkbox = isDone
                    ? '<div class="task-checkbox checked" data-task-id="' +
                      escapeHtml(task._id) +
                      '"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>'
                    : '<div class="task-checkbox" data-task-id="' +
                      escapeHtml(task._id) +
                      '"></div>';

                const dueMarkup = isDone
                    ? '<span class="task-due">Completed ' +
                      escapeHtml(formatShortDate(task.deadline)) +
                      "</span>"
                    : '<span class="task-due' +
                      (due.isOverdue ? " overdue" : "") +
                      '">' +
                      CALENDAR_ICON +
                      escapeHtml(due.label) +
                      "</span>";

                const priority =
                    !isDone && task.priority
                        ? '<span class="task-priority ' +
                          priorityClass(task.priority) +
                          '">' +
                          escapeHtml(task.priority) +
                          "</span>"
                        : "";

                return (
                    '<div class="task-item">' +
                    checkbox +
                    '<div class="task-info">' +
                    '<div class="task-name' + (isDone ? " done" : "") + '">' +
                    escapeHtml(task.title) +
                    "</div>" +
                    '<div class="task-meta">' +
                    '<span class="task-proj">' +
                    escapeHtml(task.projectName) +
                    "</span>" +
                    dueMarkup +
                    priority +
                    "</div></div></div>"
                );
            })
            .join("");

        bindTaskToggles();
    }

    /**
     * Toggling a checkbox writes the new status back through the tasks API,
     * then reloads so the counters and progress bars stay in sync.
     */
    function bindTaskToggles() {
        document.querySelectorAll(".task-checkbox[data-task-id]").forEach((box) => {
            box.addEventListener("click", async () => {
                const id = box.dataset.taskId;
                const markDone = !box.classList.contains("checked");

                box.style.pointerEvents = "none";

                try {
                    await api.put("/api/tasks/" + id, {
                        status: markDone ? "Completed" : "In Progress"
                    });

                    showToast(
                        markDone ? "Task marked complete." : "Task reopened."
                    );

                    await load();
                } catch (err) {
                    console.error(err);
                    showToast(err.message);
                    box.style.pointerEvents = "";
                }
            });
        });
    }

    /* ---------- Donut + analytics ---------- */

    const CIRCUMFERENCE = 2 * Math.PI * 38; // r = 38

    function renderBreakdown(breakdown, analytics) {
        const total = breakdown.total || 0;

        const segments = [
            { id: "donutCompleted", value: breakdown.completed },
            { id: "donutActive", value: breakdown.active },
            { id: "donutPending", value: breakdown.pending }
        ];

        let consumed = 0;

        segments.forEach((segment) => {
            const el = document.getElementById(segment.id);
            if (!el) return;

            const length = total
                ? (segment.value / total) * CIRCUMFERENCE
                : 0;

            el.setAttribute(
                "stroke-dasharray",
                length.toFixed(2) + " " + CIRCUMFERENCE.toFixed(2)
            );
            el.setAttribute("stroke-dashoffset", (-consumed).toFixed(2));

            consumed += length;
        });

        const totalEl = document.getElementById("donutTotal");
        if (totalEl) totalEl.textContent = total;

        const legend = {
            legendCompleted: breakdown.completed,
            legendActive: breakdown.active,
            legendPending: breakdown.pending
        };

        Object.keys(legend).forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = legend[id];
        });

        const completion = document.getElementById("completionRate");
        if (completion) completion.textContent = analytics.completionRate + "%";

        const onTime = document.getElementById("onTimeRate");
        if (onTime) onTime.textContent = analytics.onTimeDelivery + "%";
    }

    /* ---------- Notifications ---------- */

    // Icon and colour mapping comes from common.js (shared with the topbar
    // notifications panel and the Notifications page).

    function renderNotifications(notifications) {
        const list = document.getElementById("notifList");
        if (!list) return;

        if (!notifications.length) {
            renderNotice(list, "No notifications yet.");
            return;
        }

        list.innerHTML = notifications
            .map((notification) => {
                const style = notificationPresentation(notification.type);

                const unread = notification.isRead
                    ? ""
                    : '<div class="notif-unread-dot"></div>';

                return (
                    '<div class="notif-item">' +
                    '<div class="notif-icon-wrap" style="background:' +
                    style.bg +
                    ';">' +
                    '<svg viewBox="0 0 24 24" style="stroke:' +
                    style.color +
                    ';">' +
                    notificationIcon(notification.type) +
                    "</svg></div>" +
                    '<div class="notif-text">' +
                    '<div class="notif-msg"><strong>' +
                    escapeHtml(notification.title) +
                    "</strong> " +
                    escapeHtml(notification.message) +
                    "</div>" +
                    '<div class="notif-time">' +
                    escapeHtml(formatRelative(notification.createdAt)) +
                    "</div>" +
                    "</div>" +
                    unread +
                    "</div>"
                );
            })
            .join("");
    }

    /* ---------- Team workload ---------- */

    function renderWorkload(workload) {
        const list = document.getElementById("workloadList");
        if (!list) return;

        if (!workload.length) {
            renderNotice(list, "No members to show yet.");
            return;
        }

        const peak = Math.max.apply(
            null,
            workload.map((m) => m.count).concat([1])
        );

        const BAR_COLORS = [
            "var(--orange)",
            "var(--blue)",
            "var(--green)",
            "var(--yellow)",
            "#8B5CF6"
        ];

        list.innerHTML = workload
            .map((member, index) => {
                const isMe = String(member._id) === String(user.id);
                const pct = Math.round((member.count / peak) * 100);
                const color = BAR_COLORS[index % BAR_COLORS.length];

                // The signed-in member keeps the shared placeholder IDs
                const nameId = isMe ? ' id="workloadUsername"' : "";
                const avatarId = isMe ? ' id="workloadAvatar"' : "";

                return (
                    '<div class="workload-item">' +
                    '<div class="workload-row">' +
                    '<div class="workload-member">' +
                    '<div class="member-avatar"' +
                    avatarId +
                    ' style="background:' +
                    color +
                    ';">' +
                    escapeHtml(generateInitials(member.name)) +
                    "</div>" +
                    '<div class="workload-name"' +
                    nameId +
                    ">" +
                    escapeHtml(member.name) +
                    "</div>" +
                    "</div>" +
                    '<div class="workload-count">' +
                    (member.count === 1 ? "1 task" : member.count + " tasks") +
                    "</div>" +
                    "</div>" +
                    '<div class="workload-bar-track">' +
                    '<div class="workload-bar-fill" style="width:' +
                    pct +
                    "%;background:" +
                    color +
                    ';"></div>' +
                    "</div></div>"
                );
            })
            .join("");

        // Re-apply placeholders now that the current user's row exists
        renderUserPlaceholders(user);

        animateBars();
    }

    function animateBars() {
        document
            .querySelectorAll(".progress-bar-fill, .workload-bar-fill")
            .forEach((bar) => {
                const target = bar.style.width;

                bar.style.width = "0%";
                bar.style.transition = "width 1s cubic-bezier(0.4,0,0.2,1)";

                setTimeout(() => {
                    bar.style.width = target;
                }, 120);
            });
    }

    /* ---------- Load ---------- */

    async function load() {
        try {
            // Scoped server-side to the session user
            const response = await api.get("/api/dashboard/summary");

            const data = response.data;

            renderStats(data.stats);
            renderProjects(data.projects);
            renderTasks(data.myTasks);
            renderBreakdown(data.breakdown, data.analytics);
            renderNotifications(data.notifications);
            renderWorkload(data.workload);
        } catch (err) {
            console.error(err);

            renderTableNotice("projectsBody", "Unable to load projects.", 5);
            renderNotice("myTasksList", "Unable to load tasks.");
            renderNotice("notifList", "Unable to load notifications.");
            renderNotice("workloadList", "Unable to load workload.");

            showToast(err.message);
        }
    }

    /* ---------- Wiring ---------- */

    const refreshBtn = document.getElementById("refreshBtn");

    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            await load();
            showToast("Dashboard refreshed.");
        });
    }

    const markAllBtn = document.getElementById("markAllReadBtn");

    if (markAllBtn) {
        markAllBtn.addEventListener("click", async (event) => {
            event.preventDefault();

            try {
                await api.put("/api/notifications/read-all");

                await load();
                showToast("All notifications marked as read.");
            } catch (err) {
                console.error(err);
                showToast(err.message);
            }
        });
    }

    renderGreeting();
    load();

})();
