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
        showToast,
        buildQueryString,
        createFilterController,
        populateSelect,
        populateCommitteeSelect,
        emptyResultMessage
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

    // Revision & Update Log — sourced from each project's persisted
    // `revisions` array (ProjectRequest.revisions), not session state.
    // Rebuilt from the full project list on every load/refresh, and
    // updated in place whenever a status change succeeds.
    let historyLog = [];

    /** Flattens every project's revisions into one feed, newest first. */
    function buildHistoryFromProjects(projects) {
        const entries = [];

        projects.forEach((project) => {
            (project.revisions || []).forEach((rev) => {
                entries.push({
                    projectName: project.projectName,
                    action: rev.action,
                    by: rev.madeBy,
                    note: rev.note,
                    at: rev.timestamp
                });
            });
        });

        entries.sort((a, b) => new Date(b.at) - new Date(a.at));
        return entries;
    }

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
                    '<a class="row-link" href="discussions.html?project=' +
                    escapeHtml(project._id) + '">Discuss</a>' +
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

                    // Reflect the revision the server actually persisted,
                    // not a guess at what it might have logged.
                    const latestRevision =
                        updated && updated.revisions && updated.revisions.length
                            ? updated.revisions[updated.revisions.length - 1]
                            : null;

                    if (latestRevision) {
                        historyLog.unshift({
                            projectName:
                                row.querySelector(".project-name").textContent,
                            action: latestRevision.action,
                            by: latestRevision.madeBy,
                            note: latestRevision.note,
                            at: latestRevision.timestamp
                        });
                    }

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
                "No revisions recorded yet."
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
                    " — " +
                    escapeHtml(entry.action) +
                    "</div>" +
                    '<div class="history-meta">' +
                    escapeHtml(entry.by) +
                    " · " +
                    escapeHtml(formatDateTime(entry.at)) +
                    "</div>" +
                    (entry.note
                        ? '<div class="history-note">' +
                          escapeHtml(entry.note) +
                          "</div>"
                        : "") +
                    "</div></div>"
            )
            .join("");
    }

    /* ---------- Load ---------- */

    async function fetchProjects(params) {
        const response = await api.get(
            "/api/projects" + buildQueryString(params)
        );
        return response.data || [];
    }

    async function refreshCounts() {
        try {
            renderCounts(await fetchProjects());
        } catch (err) {
            console.error(err);
        }
    }

    /* ---------- Search & Filter ---------- */

    /** Committee options come from the data so the dropdown never offers a
     *  value that cannot match anything. */
    function populateCommitteeOptions() {
        // Official structure, not whatever happens to be in the data
        populateCommitteeSelect("filterCommittee", {
            placeholder: "All Committees"
        });
    }

    function populateStatusOptions() {
        populateSelect("filterStatus", STATUS_OPTIONS, "All Statuses");
    }

    /** Re-fetches just the table using the current filters. Counts and the
     *  revision-history feed stay based on the full, unfiltered set —
     *  filtering narrows what you're looking at, not the overall totals. */
    async function refreshTable(params) {
        try {
            const projects = await fetchProjects(params || filters.params());

            if (!projects.length) {
                renderTableNotice(
                    "statusBody",
                    emptyResultMessage(
                        filters.isFiltering(),
                        "No projects to track yet."
                    ),
                    4
                );
                return;
            }

            renderRows(projects);
        } catch (err) {
            console.error(err);
            renderTableNotice("statusBody", "Unable to load projects.", 4);
            showToast(err.message);
        }
    }

    // Every control is read on each refresh, so search and filters always
    // preserve one another. Free-text inputs debounce; selects apply at once.
    const filters = createFilterController({
        controls: {
            search:         { id: "filterSearch", debounce: true },
            committee:      { id: "filterCommittee" },
            assignedMember: { id: "filterAssignedMember", debounce: true },
            status:         { id: "filterStatus" },
            deadlineFrom:   { id: "filterDeadlineFrom" },
            deadlineTo:     { id: "filterDeadlineTo" }
        },
        clearButtonId: "clearFiltersBtn",
        onChange: refreshTable
    });

    async function load() {
        try {
            const projects = await fetchProjects();

            renderCounts(projects);
            populateCommitteeOptions();
            populateStatusOptions();

            historyLog = buildHistoryFromProjects(projects);
            renderHistory();

            // Table respects whatever's currently in the filter bar
            // (empty on first load, so this shows everything).
            await refreshTable();
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

    load();

})();
