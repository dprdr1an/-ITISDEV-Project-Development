"use strict";

/* ==========================================================
   My Tasks
   Read-only view of the signed-in user's own tasks. The only
   permitted change is advancing their own task status.
   Editing, reassigning and deleting live in Task Assignment.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        badgeClass,
        priorityClass,
        describeDeadline,
        formatLongDate,
        renderNotice,
        showToast,
        buildQueryString,
        createFilterController,
        populateSelect,
        emptyResultMessage
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    // The workflow, in order. Mirrors TASK_STATUSES on the server.
    const STATUSES = [
        "Not Started",
        "In Progress",
        "Ready for Review",
        "Completed"
    ];

    const PRIORITIES = ["High", "Medium", "Low"];

    // `allTasks` drives the counters and stays unfiltered, so the headline
    // numbers describe your whole workload rather than the current view.
    let allTasks = [];
    let tasks = [];

    /* ---------- Counters ---------- */

    function renderCounts() {
        const count = (status) =>
            allTasks.filter((task) => task.status === status).length;

        const overdue = allTasks.filter((task) => {
            if (task.status === "Completed" || !task.deadline) return false;
            return new Date(task.deadline) < new Date();
        }).length;

        const map = {
            countNotStarted: count("Not Started"),
            countInProgress: count("In Progress"),
            countReview: count("Ready for Review"),
            countCompleted: count("Completed"),
            countOverdue: overdue
        };

        Object.keys(map).forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = map[id];
        });
    }

    /* ---------- Task list ---------- */

    function renderTasks() {
        const list = document.getElementById("myTaskList");
        if (!list) return;

        const visible = tasks;

        if (!visible.length) {
            renderNotice(
                list,
                emptyResultMessage(
                    filters.isFiltering(),
                    "You have no assigned tasks right now."
                )
            );
            return;
        }

        list.innerHTML = visible
            .map((task) => {
                const isDone = task.status === "Completed";
                const due = describeDeadline(task.deadline);

                const projectName =
                    (task.project && task.project.projectName) ||
                    "Unassigned project";

                const options = STATUSES.map(
                    (status) =>
                        '<option value="' +
                        escapeHtml(status) +
                        '"' +
                        (status === task.status ? " selected" : "") +
                        ">" +
                        escapeHtml(status) +
                        "</option>"
                ).join("");

                const assignedBy =
                    task.createdBy && task.createdBy.name
                        ? " · Assigned by " + escapeHtml(task.createdBy.name)
                        : "";

                return (
                    '<div class="task-row" data-id="' +
                    escapeHtml(task._id) +
                    '">' +
                    '<div class="task-row-main">' +
                    '<div class="task-name' +
                    (isDone ? " done" : "") +
                    '">' +
                    escapeHtml(task.title) +
                    "</div>" +
                    '<div class="task-desc">' +
                    escapeHtml(task.description || "") +
                    "</div>" +
                    '<div class="task-meta">' +
                    '<span class="task-proj">' +
                    escapeHtml(projectName) +
                    "</span>" +
                    '<span class="task-priority ' +
                    priorityClass(task.priority) +
                    '">' +
                    escapeHtml(task.priority || "Medium") +
                    "</span>" +
                    "<span" +
                    (due.isOverdue && !isDone ? ' class="overdue"' : "") +
                    ">Due " +
                    escapeHtml(formatLongDate(task.deadline)) +
                    (due.isOverdue && !isDone ? " (overdue)" : "") +
                    "</span>" +
                    "<span>" +
                    assignedBy +
                    "</span>" +
                    "</div>" +
                    "</div>" +
                    '<div class="task-row-action">' +
                    '<span class="badge ' +
                    badgeClass(task.status) +
                    '">' +
                    escapeHtml(task.status) +
                    "</span>" +
                    '<select class="status-select" aria-label="Update status">' +
                    options +
                    "</select>" +
                    "</div>" +
                    "</div>"
                );
            })
            .join("");

        bindStatusSelects();
    }

    /**
     * Status is the only field this page may change, and the server
     * enforces the same rule for anyone assigned to the task.
     */
    function bindStatusSelects() {
        document
            .querySelectorAll("#myTaskList .status-select")
            .forEach((select) => {
                select.dataset.previous = select.value;

                select.addEventListener("change", async () => {
                    const row = select.closest(".task-row");
                    const id = row.dataset.id;
                    const status = select.value;
                    const previous = select.dataset.previous;

                    select.disabled = true;

                    try {
                        const response = await api.put("/api/tasks/" + id, {
                            status
                        });

                        const updated = response.task;

                        const record = tasks.find(
                            (task) => String(task._id) === String(id)
                        );

                        if (record && updated) {
                            record.status = updated.status;
                            record.completedAt = updated.completedAt;
                        }

                        select.dataset.previous = status;

                        await load();

                        showToast("Status updated to " + status + ".");
                    } catch (err) {
                        console.error(err);

                        // Roll back so the control never disagrees with the server
                        select.value = previous;
                        select.disabled = false;

                        showToast(err.message);
                    }
                });
            });
    }

    /* ---------- Search & Filter ---------- */

    const statusField = document.getElementById("taskStatus");

    // The existing pills stay the status control; they just write into the
    // hidden field so search, status, priority and dates form one query.
    document.querySelectorAll(".filter-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            document
                .querySelectorAll(".filter-pill")
                .forEach((p) => p.classList.remove("active"));

            pill.classList.add("active");

            if (statusField) {
                statusField.value = pill.dataset.filter || "";
            }

            // Call the controller directly rather than dispatching a
            // synthetic event at our own listener.
            filters.refresh();
        });
    });

    async function refreshList(params) {
        try {
            // mine=true keeps the scope explicit; the server also forces it
            const query = Object.assign({ mine: "true" },
                params || filters.params());

            const response = await api.get(
                "/api/tasks" + buildQueryString(query)
            );

            tasks = response.tasks || [];

            renderTasks();
        } catch (err) {
            console.error(err);
            renderNotice("myTaskList", "Unable to load your tasks.");
            showToast(err.message);
        }
    }

    const filters = createFilterController({
        controls: {
            search:       { id: "taskSearch", debounce: true },
            status:       { id: "taskStatus" },
            priority:     { id: "taskPriority" },
            deadlineFrom: { id: "taskDeadlineFrom" },
            deadlineTo:   { id: "taskDeadlineTo" }
        },
        clearButtonId: "clearTaskFilters",
        onChange: refreshList
    });

    // Clearing must also reset the pills, which live outside the controller
    const clearBtn = document.getElementById("clearTaskFilters");

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            document
                .querySelectorAll(".filter-pill")
                .forEach((p, index) =>
                    p.classList.toggle("active", index === 0)
                );
        });
    }

    /* ---------- Load ---------- */

    async function load() {
        try {
            // Unfiltered fetch backs the counters and the priority dropdown
            const response = await api.get("/api/tasks?mine=true");

            allTasks = response.tasks || [];

            renderCounts();
            populateSelect("taskPriority", PRIORITIES, "All Priorities");

            await refreshList();
        } catch (err) {
            console.error(err);
            renderNotice("myTaskList", "Unable to load your tasks.");
            showToast(err.message);
        }
    }

    const refreshBtn = document.getElementById("refreshBtn");

    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            await load();
            showToast("Tasks refreshed.");
        });
    }

    load();

})();
