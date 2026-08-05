"use strict";

/* ==========================================================
   Task Assignment — Chairperson only

   Create, edit, reassign and delete tasks. The page guard in
   common.js keeps executives out of the UI; the task routes
   enforce the same rule on the API.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        generateInitials,
        priorityClass,
        badgeClass,
        describeDeadline,
        renderNotice,
        showToast,
        ROLES,
        hasRole,
        buildQueryString,
        createFilterController,
        populateSelect,
        emptyResultMessage
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    // Belt and braces: common.js already redirects, but never render
    // chairperson tooling if somehow reached by another role.
    if (!hasRole(ROLES.CHAIRPERSON)) return;

    const taskForm = document.getElementById("taskForm");
    const projectSelect = document.getElementById("taskProject");
    const memberChecks = document.getElementById("memberChecks");
    const taskRecords = document.getElementById("taskRecords");
    const submitBtn = document.getElementById("assignTaskBtn");
    const cancelEditBtn = document.getElementById("cancelEditBtn");
    const formModeTitle = document.getElementById("formModeTitle");

    // Populated when editing an existing task; null while creating
    let editingTaskId = null;
    let cachedTasks = [];

    // Declared up front: loadTaskRecords() reads this and is referenced by
    // handlers defined above the controller's own definition.
    let recordFilters = null;

    const RECORD_STATUSES = [
        "Not Started",
        "In Progress",
        "Ready for Review",
        "Completed"
    ];

    /* ---------- Projects ---------- */

    async function loadProjects() {
        if (!projectSelect) return;

        try {
            const response = await api.get("/api/projects");
            const projects = response.data || [];

            projectSelect.innerHTML =
                '<option value="">Select project</option>';

            if (!projects.length) {
                projectSelect.innerHTML =
                    '<option value="">No projects available</option>';
                return;
            }

            projects.forEach((project) => {
                const option = document.createElement("option");
                option.value = project._id;
                option.textContent = project.projectName || "Unnamed Project";
                projectSelect.appendChild(option);
            });
        } catch (err) {
            console.error(err);

            projectSelect.innerHTML =
                '<option value="">Unable to load projects</option>';

            showToast(err.message);
        }
    }

    /* ---------- Members ---------- */

    async function loadMembers() {
        if (!memberChecks) return;

        try {
            const response = await api.get("/api/users");
            const members = response.users || [];

            if (!members.length) {
                renderNotice(
                    memberChecks,
                    "No registered members to assign yet."
                );
                return;
            }

            // Same fetch also backs the "filter by assignee" dropdown
            populateSelect(
                "recordMember",
                members.map((m) => ({ value: m._id, label: m.name })),
                "All Assignees"
            );

            memberChecks.innerHTML = members
                .map((member) => {
                    const role = [member.position, member.committee]
                        .filter(Boolean)
                        .join(" • ");

                    return (
                        '<label class="member-check">' +
                        '<input type="checkbox" name="assignedMembers" value="' +
                        escapeHtml(member._id) +
                        '">' +
                        "<span>" +
                        escapeHtml(member.name) +
                        (role
                            ? '<br><small class="task-meta">' +
                              escapeHtml(role) +
                              "</small>"
                            : "") +
                        "</span>" +
                        "</label>"
                    );
                })
                .join("");
        } catch (err) {
            console.error(err);
            renderNotice(memberChecks, "Unable to load members.");
            showToast(err.message);
        }
    }

    function setCheckedMembers(ids) {
        const wanted = (ids || []).map(String);

        document
            .querySelectorAll('input[name="assignedMembers"]')
            .forEach((box) => {
                box.checked = wanted.includes(String(box.value));
            });
    }

    function getCheckedMembers() {
        return [
            ...document.querySelectorAll(
                'input[name="assignedMembers"]:checked'
            )
        ].map((box) => box.value);
    }

    /* ---------- Records ---------- */

    async function loadTaskRecords(params) {
        if (!taskRecords) return;

        try {
            const query = params ||
                (recordFilters ? recordFilters.params() : {});

            const response = await api.get(
                "/api/tasks" + buildQueryString(query)
            );

            cachedTasks = response.tasks || [];

            if (!cachedTasks.length) {
                renderNotice(
                    taskRecords,
                    emptyResultMessage(
                        recordFilters && recordFilters.isFiltering(),
                        "No tasks assigned yet."
                    )
                );
                return;
            }

            taskRecords.innerHTML = cachedTasks
                .map((task) => {
                    const due = describeDeadline(task.deadline);

                    const projectName =
                        (task.project && task.project.projectName) ||
                        "Unassigned project";

                    const assignees = (task.assignedMembers || [])
                        .map((member) => member.name)
                        .filter(Boolean);

                    const avatars = (task.assignedMembers || [])
                        .slice(0, 3)
                        .map(
                            (member) =>
                                '<div class="member-avatar">' +
                                escapeHtml(generateInitials(member.name)) +
                                "</div>"
                        )
                        .join("");

                    return (
                        '<div class="task-item' +
                        (String(task._id) === String(editingTaskId)
                            ? " editing"
                            : "") +
                        '" data-id="' +
                        escapeHtml(task._id) +
                        '">' +
                        "<div>" +
                        avatars +
                        "</div>" +
                        "<div>" +
                        '<div class="task-name">' +
                        escapeHtml(task.title) +
                        "</div>" +
                        '<div class="task-meta">' +
                        escapeHtml(projectName) +
                        " · " +
                        escapeHtml(
                            assignees.length
                                ? assignees.join(", ")
                                : "Unassigned"
                        ) +
                        "</div>" +
                        '<div class="task-meta">' +
                        '<span class="badge ' +
                        badgeClass(task.status) +
                        '">' +
                        escapeHtml(task.status) +
                        "</span> " +
                        '<span class="task-priority ' +
                        priorityClass(task.priority) +
                        '">' +
                        escapeHtml(task.priority || "Medium") +
                        "</span> " +
                        "<span" +
                        (due.isOverdue ? ' class="overdue"' : "") +
                        ">" +
                        escapeHtml(due.label) +
                        "</span>" +
                        "</div>" +
                        '<div class="task-actions">' +
                        '<button type="button" class="task-action" data-edit="' +
                        escapeHtml(task._id) +
                        '">Edit / Reassign</button>' +
                        '<button type="button" class="task-action danger" data-delete="' +
                        escapeHtml(task._id) +
                        '">Delete</button>' +
                        "</div>" +
                        "</div></div>"
                    );
                })
                .join("");

            bindRecordActions();
        } catch (err) {
            console.error(err);
            renderNotice(taskRecords, "Unable to load task records.");
        }
    }

    function bindRecordActions() {
        document.querySelectorAll("[data-edit]").forEach((button) => {
            button.addEventListener("click", () =>
                startEditing(button.dataset.edit)
            );
        });

        document.querySelectorAll("[data-delete]").forEach((button) => {
            button.addEventListener("click", () =>
                deleteTask(button.dataset.delete, button)
            );
        });
    }

    /* ---------- Edit mode ---------- */

    function startEditing(id) {
        const task = cachedTasks.find(
            (record) => String(record._id) === String(id)
        );

        if (!task) return;

        editingTaskId = id;

        if (projectSelect) {
            projectSelect.value =
                (task.project && task.project._id) || task.project || "";
        }

        document.getElementById("taskTitle").value = task.title || "";
        document.getElementById("taskDescription").value =
            task.description || "";
        document.getElementById("taskPriority").value =
            task.priority || "Medium";

        const deadline = document.getElementById("taskDeadline");

        if (deadline && task.deadline) {
            // <input type="date"> expects YYYY-MM-DD
            deadline.value = new Date(task.deadline)
                .toISOString()
                .slice(0, 10);
        }

        setCheckedMembers(
            (task.assignedMembers || []).map((member) => member._id || member)
        );

        if (formModeTitle) formModeTitle.textContent = "Edit Task";
        if (submitBtn) submitBtn.textContent = "Save Changes";
        if (cancelEditBtn) cancelEditBtn.style.display = "";

        loadTaskRecords();

        taskForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function stopEditing() {
        editingTaskId = null;

        taskForm.reset();
        setCheckedMembers([]);

        if (formModeTitle) formModeTitle.textContent = "Task Details";
        if (submitBtn) submitBtn.textContent = "Assign Task & Notify Members";
        if (cancelEditBtn) cancelEditBtn.style.display = "none";

        loadTaskRecords();
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener("click", stopEditing);
    }

    const clearBtn = document.getElementById("clearTaskBtn");

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (editingTaskId) stopEditing();
        });
    }

    /* ---------- Delete ---------- */

    async function deleteTask(id, button) {
        if (
            !window.confirm(
                "Delete this task permanently? Assigned members will lose it."
            )
        ) {
            return;
        }

        button.disabled = true;

        try {
            await api.del("/api/tasks/" + id);

            if (String(editingTaskId) === String(id)) {
                stopEditing();
            } else {
                await loadTaskRecords();
            }

            showToast("Task deleted.");
        } catch (err) {
            console.error(err);
            showToast(err.message);
            button.disabled = false;
        }
    }

    /* ---------- Submit (create or update) ---------- */

    if (taskForm) {
        taskForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const assignedMembers = getCheckedMembers();

            const payload = {
                project: projectSelect ? projectSelect.value : "",
                title: document.getElementById("taskTitle").value.trim(),
                description: document
                    .getElementById("taskDescription")
                    .value.trim(),
                deadline: document.getElementById("taskDeadline").value,
                priority: document.getElementById("taskPriority").value,
                assignedMembers
            };

            if (!payload.project) {
                showToast("Please select a project.");
                return;
            }

            if (!payload.title || !payload.description) {
                showToast("Please complete the task title and description.");
                return;
            }

            if (!payload.deadline) {
                showToast("Please set a deadline.");
                return;
            }

            if (!assignedMembers.length) {
                showToast("Please assign at least one member.");
                return;
            }

            const editing = Boolean(editingTaskId);

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = editing ? "Saving…" : "Assigning…";
            }

            try {
                if (editing) {
                    await api.put("/api/tasks/" + editingTaskId, payload);
                    showToast("Task updated.");
                    stopEditing();
                } else {
                    const response = await api.post("/api/tasks", payload);

                    showToast(
                        response.message ||
                            "Task assigned. Assigned members will be notified."
                    );

                    taskForm.reset();
                    setCheckedMembers([]);
                    await loadTaskRecords();
                }
            } catch (err) {
                console.error(err);
                showToast(err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;

                    if (!editingTaskId) {
                        submitBtn.textContent =
                            "Assign Task & Notify Members";
                    }
                }
            }
        });
    }

    /* ---------- Search & Filter ---------- */

    // `search` matches task title/description, `assignee` matches an assigned
    // member's name, `member` is an exact assignee id — all server-side.
    recordFilters = createFilterController({
        controls: {
            search:   { id: "recordSearch", debounce: true },
            assignee: { id: "recordAssignee", debounce: true },
            member:   { id: "recordMember" },
            status:   { id: "recordStatus" }
        },
        clearButtonId: "clearRecordFilters",
        onChange: loadTaskRecords
    });

    /* ---------- Init ---------- */

    populateSelect("recordStatus", RECORD_STATUSES, "All Statuses");

    // Members must exist before an edit can tick the right boxes
    loadProjects();
    loadMembers().then(() => loadTaskRecords());

})();
