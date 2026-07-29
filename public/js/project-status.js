"use strict";

/* ==========================================================
   Project Status Tracker
   Loads real projects and persists status changes via the API.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        statusClass,
        formatDateTime,
        renderNotice,
        renderTableNotice,
        showToast
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    // Options offered in the "Update Status" dropdown. These are the
    // ProjectRequest statuses accepted by the schema.
    const STATUS_OPTIONS = [
        "Pending",
        "Active",
        "For Review",
        "For Approval",
        "Completed",
        "On Hold"
    ];

    // Local, session-only log of status changes made on this page.
    // Persisting history needs a backend collection — see the notes.
    const historyLog = [];

    /* ---------- Counters ---------- */

    function renderCounts(projects) {
        const count = (status) =>
            projects.filter((p) => p.status === status).length;

        const map = {
            statPending: count("Pending"),
            statOngoing: count("Active"),
            statReview: count("For Review"),
            statApproval: count("For Approval"),
            statCompleted: count("Completed")
        };

        Object.keys(map).forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = map[id];
        });
    }

    /* ---------- Table ---------- */

    function renderRows(projects) {
        const body = document.getElementById("statusBody");
        if (!body) return;

        if (!projects.length) {
            renderTableNotice(body, "No projects to track yet.", 4);
            return;
        }

        body.innerHTML = projects
            .map((project) => {
                const options = STATUS_OPTIONS.map(
                    (status) =>
                        "<option" +
                        (status === project.status ? " selected" : "") +
                        ">" +
                        escapeHtml(status) +
                        "</option>"
                ).join("");

                const meta = [project.committee, project.requestingHead]
                    .filter(Boolean)
                    .map(escapeHtml)
                    .join(" · ");

                return (
                    '<tr data-id="' + escapeHtml(project._id) + '">' +
                    "<td>" +
                    '<div class="project-name">' +
                    escapeHtml(project.projectName) +
                    "</div>" +
                    '<div class="project-meta">' + meta + "</div>" +
                    "</td>" +
                    "<td>" +
                    '<span class="badge ' + statusClass(project.status) + '">' +
                    '<span class="dot"></span>' +
                    escapeHtml(project.status) +
                    "</span>" +
                    "</td>" +
                    '<td><select class="status-select">' + options + "</select></td>" +
                    '<td><div class="project-meta">' +
                    escapeHtml(formatDateTime(project.updatedAt)) +
                    "</div></td>" +
                    "</tr>"
                );
            })
            .join("");

        bindSelects();
    }

    function bindSelects() {
        document.querySelectorAll("#statusBody .status-select").forEach((select) => {
            // Remember the value so a failed save can roll the UI back
            select.dataset.previous = select.value;

            select.addEventListener("change", async () => {
                const row = select.closest("tr");
                const id = row.dataset.id;
                const status = select.value;
                const previous = select.dataset.previous;

                select.disabled = true;

                try {
                    const response = await api.patch(
                        "/api/projects/" + id + "/status",
                        { status }
                    );

                    const updated = response.data;

                    const badge = row.querySelector(".badge");
                    badge.className = "badge " + statusClass(status);
                    badge.innerHTML =
                        '<span class="dot"></span>' + escapeHtml(status);

                    const stamp = row.querySelector("td:last-child .project-meta");
                    if (stamp) {
                        stamp.textContent = formatDateTime(
                            updated ? updated.updatedAt : new Date()
                        );
                    }

                    select.dataset.previous = status;

                    historyLog.unshift({
                        projectName:
                            row.querySelector(".project-name").textContent,
                        status,
                        by: user.name,
                        at: new Date()
                    });

                    renderHistory();
                    await refreshCounts();

                    showToast("Project status updated.");
                } catch (err) {
                    console.error(err);

                    // Roll back so the dropdown never disagrees with the server
                    select.value = previous;
                    showToast(err.message);
                } finally {
                    select.disabled = false;
                }
            });
        });
    }

    /* ---------- History ---------- */

    function renderHistory() {
        const list = document.getElementById("historyList");
        if (!list) return;

        if (!historyLog.length) {
            renderNotice(
                list,
                "No status changes recorded in this session yet."
            );
            return;
        }

        list.innerHTML = historyLog
            .slice(0, 8)
            .map(
                (entry) =>
                    '<div class="history-item">' +
                    '<div class="history-dot-wrap">' +
                    '<span class="history-dot"></span>' +
                    '<span class="history-line"></span>' +
                    "</div>" +
                    "<div>" +
                    '<div class="history-action">' +
                    escapeHtml(entry.projectName) +
                    " moved to " +
                    escapeHtml(entry.status) +
                    "</div>" +
                    '<div class="history-meta">' +
                    escapeHtml(entry.by) +
                    " · " +
                    escapeHtml(formatDateTime(entry.at)) +
                    "</div>" +
                    "</div></div>"
            )
            .join("");
    }

    /* ---------- Load ---------- */

    async function fetchProjects() {
        const response = await api.get("/api/projects");
        return response.data || [];
    }

    async function refreshCounts() {
        try {
            renderCounts(await fetchProjects());
        } catch (err) {
            console.error(err);
        }
    }

    async function load() {
        try {
            const projects = await fetchProjects();

            renderCounts(projects);
            renderRows(projects);
        } catch (err) {
            console.error(err);
            renderTableNotice("statusBody", "Unable to load projects.", 4);
            showToast(err.message);
        }
    }

    const refreshBtn = document.getElementById("refreshBtn");

    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            await load();
            showToast("Project list refreshed.");
        });
    }

    renderHistory();
    load();

})();
