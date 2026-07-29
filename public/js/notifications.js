"use strict";

/* ==========================================================
   Notifications & Reminders
   Loads the signed-in user's notifications from the API,
   supports filtering, and persists read state.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        formatRelative,
        formatDateTime,
        renderNotice,
        showToast
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    /* ---------- Type mapping ---------- */

    // Backend notification types → the filter pills on this page
    const TYPE_CATEGORY = {
        DEADLINE_REMINDER: "deadline",
        TASK_OVERDUE: "overdue",
        TASK_ASSIGNED: "update",
        TASK_UPDATED: "update",
        PROJECT_STATUS_CHANGED: "update",
        ROLLOUT_UPDATED: "update",
        APPROVAL_REQUIRED: "approval",
        PROJECT_APPROVED: "approval"
    };

    // Category → icon modifier class, dot colour and human label
    const CATEGORY_STYLE = {
        deadline: {
            icon: "deadline",
            color: "var(--yellow)",
            label: "Deadline Reminder",
            badge: "badge-preso"
        },
        overdue: {
            icon: "overdue",
            color: "var(--red)",
            label: "Overdue Alert",
            badge: "badge-doc"
        },
        update: {
            icon: "update",
            color: "var(--blue)",
            label: "Rollout Update",
            badge: "badge-photo"
        },
        approval: {
            icon: "approval",
            color: "var(--green)",
            label: "Approval",
            badge: "badge-pubmat"
        }
    };

    const ICON_PATHS = {
        deadline:
            '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        overdue:
            '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
            '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        update:
            '<polyline points="23 4 23 10 17 10"/>' +
            '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
        approval:
            '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>' +
            '<polyline points="22 4 12 14.01 9 11.01"/>'
    };

    function categoryOf(notification) {
        return TYPE_CATEGORY[notification.type] || "update";
    }

    function styleOf(category) {
        return CATEGORY_STYLE[category] || CATEGORY_STYLE.update;
    }

    /* ---------- State ---------- */

    let notifications = [];
    let activeFilter = "all";

    /* ---------- Notification cards ---------- */

    function renderCards() {
        const list = document.getElementById("notifList");
        if (!list) return;

        const visible =
            activeFilter === "all"
                ? notifications
                : notifications.filter(
                      (n) => categoryOf(n) === activeFilter
                  );

        if (!visible.length) {
            renderNotice(
                list,
                notifications.length
                    ? "No notifications in this category."
                    : "You have no notifications yet."
            );
            return;
        }

        list.innerHTML = visible
            .map((notification) => {
                const category = categoryOf(notification);
                const style = styleOf(category);

                const actions = notification.isRead
                    ? ""
                    : '<div class="notif-actions">' +
                      '<button class="mini-btn" data-read="' +
                      escapeHtml(notification._id) +
                      '">Mark as Read</button>' +
                      "</div>";

                return (
                    '<article class="notif-card' +
                    (notification.isRead ? "" : " unread") +
                    '" data-type="' +
                    category +
                    '">' +
                    '<div class="notif-icon ' +
                    style.icon +
                    '"><svg viewBox="0 0 24 24">' +
                    ICON_PATHS[style.icon] +
                    "</svg></div>" +
                    '<div class="notif-body">' +
                    '<div class="notif-title">' +
                    escapeHtml(notification.title) +
                    "</div>" +
                    '<div class="notif-message">' +
                    escapeHtml(notification.message) +
                    "</div>" +
                    '<div class="notif-meta">' +
                    '<span><span class="status-dot" style="background:' +
                    style.color +
                    '"></span>' +
                    escapeHtml(style.label) +
                    "</span>" +
                    "<span>" +
                    escapeHtml(formatRelative(notification.createdAt)) +
                    "</span>" +
                    "</div>" +
                    actions +
                    "</div></article>"
                );
            })
            .join("");

        bindCardActions();
    }

    function bindCardActions() {
        document.querySelectorAll("[data-read]").forEach((button) => {
            button.addEventListener("click", async () => {
                const id = button.dataset.read;

                button.disabled = true;

                try {
                    await api.put("/api/notifications/" + id + "/read");

                    const record = notifications.find(
                        (n) => String(n._id) === String(id)
                    );

                    if (record) {
                        record.isRead = true;
                        record.readAt = new Date().toISOString();
                    }

                    renderCards();
                    renderHistory();

                    showToast("Notification marked as read.");
                } catch (err) {
                    console.error(err);
                    showToast(err.message);
                    button.disabled = false;
                }
            });
        });
    }

    /* ---------- History ---------- */

    function renderHistory() {
        const list = document.getElementById("historyList");
        if (!list) return;

        if (!notifications.length) {
            renderNotice(list, "No notification history yet.");
            return;
        }

        list.innerHTML = notifications
            .slice(0, 8)
            .map((notification) => {
                const style = styleOf(categoryOf(notification));

                return (
                    '<div class="history-row">' +
                    '<div class="history-time">' +
                    escapeHtml(formatDateTime(notification.createdAt)) +
                    "</div>" +
                    "<div>" +
                    '<div class="history-label">' +
                    escapeHtml(notification.title) +
                    "</div>" +
                    '<div class="file-meta">' +
                    escapeHtml(notification.message) +
                    "</div>" +
                    "</div>" +
                    '<span class="badge ' +
                    style.badge +
                    '">' +
                    escapeHtml(style.label) +
                    "</span>" +
                    "</div>"
                );
            })
            .join("");
    }

    /* ---------- Upcoming reminders ---------- */

    async function renderReminders() {
        const list = document.getElementById("remindersList");
        if (!list) return;

        try {
            const response = await api.get(
                "/api/tasks?member=" + encodeURIComponent(user.id)
            );

            const now = new Date();

            const upcoming = (response.tasks || [])
                .filter(
                    (task) =>
                        task.status !== "Completed" &&
                        task.deadline &&
                        new Date(task.deadline) >= now
                )
                .sort(
                    (a, b) => new Date(a.deadline) - new Date(b.deadline)
                )
                .slice(0, 5);

            if (!upcoming.length) {
                renderNotice(list, "No upcoming deadlines.");
                return;
            }

            list.innerHTML = upcoming
                .map((task) => {
                    const date = new Date(task.deadline);

                    const day = date.toLocaleDateString("en-US", {
                        day: "2-digit"
                    });
                    const month = date.toLocaleDateString("en-US", {
                        month: "short"
                    });

                    const projectName =
                        (task.project && task.project.projectName) ||
                        "Unassigned project";

                    const time = date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit"
                    });

                    return (
                        '<div class="reminder-item">' +
                        '<div class="reminder-date">' +
                        "<strong>" +
                        escapeHtml(day) +
                        "</strong><span>" +
                        escapeHtml(month) +
                        "</span></div>" +
                        "<div>" +
                        '<div class="reminder-title">' +
                        escapeHtml(task.title) +
                        "</div>" +
                        '<div class="reminder-sub">' +
                        escapeHtml(projectName) +
                        " · " +
                        escapeHtml(time) +
                        "</div>" +
                        "</div></div>"
                    );
                })
                .join("");
        } catch (err) {
            console.error(err);
            renderNotice(list, "Unable to load reminders.");
        }
    }

    /* ---------- Filters ---------- */

    document.querySelectorAll(".filter-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            document
                .querySelectorAll(".filter-pill")
                .forEach((p) => p.classList.remove("active"));

            pill.classList.add("active");

            activeFilter = pill.dataset.filter;

            renderCards();
        });
    });

    /* ---------- Mark all as read ---------- */

    const markAllBtn = document.getElementById("markAllBtn");

    if (markAllBtn) {
        markAllBtn.addEventListener("click", async () => {
            const unread = notifications.filter((n) => !n.isRead);

            if (!unread.length) {
                showToast("No unread notifications.");
                return;
            }

            markAllBtn.disabled = true;

            try {
                await api.put("/api/notifications/read-all", {
                    recipient: user.id
                });

                notifications.forEach((n) => {
                    n.isRead = true;
                });

                renderCards();
                renderHistory();

                showToast("All notifications marked as read.");
            } catch (err) {
                console.error(err);
                showToast(err.message);
            } finally {
                markAllBtn.disabled = false;
            }
        });
    }

    /* ---------- Load ---------- */

    async function load() {
        try {
            const response = await api.get(
                "/api/notifications?recipient=" +
                    encodeURIComponent(user.id)
            );

            notifications = response.notifications || [];

            renderCards();
            renderHistory();
        } catch (err) {
            console.error(err);

            renderNotice("notifList", "Unable to load notifications.");
            renderNotice("historyList", "Unable to load history.");

            showToast(err.message);
        }
    }

    load();
    renderReminders();

})();
