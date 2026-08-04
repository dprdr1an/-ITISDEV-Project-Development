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
        const query = params ? "?" + new URLSearchParams(params).toString() : "";
        const response = await api.get("/api/projects" + query);
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

    const filterSearch         = document.getElementById("filterSearch");
    const filterCommittee      = document.getElementById("filterCommittee");
    const filterAssignedMember = document.getElementById("filterAssignedMember");
    const filterStatus         = document.getElementById("filterStatus");
    const filterDeadlineFrom   = document.getElementById("filterDeadlineFrom");
    const filterDeadlineTo     = document.getElementById("filterDeadlineTo");
    const clearFiltersBtn      = document.getElementById("clearFiltersBtn");

    /** Fills the committee dropdown with whatever committees actually
     *  appear in the data, so it never drifts out of sync with real values. */
    function populateCommitteeOptions(projects) {
        if (!filterCommittee) return;

        const current = filterCommittee.value;
        const committees = Array.from(
            new Set(projects.map((p) => p.committee).filter(Boolean))
        ).sort();

        filterCommittee.innerHTML =
            '<option value="">All Committees</option>' +
            committees
                .map(
                    (c) =>
                        '<option value="' + escapeHtml(c) + '">' +
                        escapeHtml(c) +
                        "</option>"
                )
                .join("");

        if (committees.includes(current)) filterCommittee.value = current;
    }

    function populateStatusOptions() {
        if (!filterStatus) return;

        filterStatus.innerHTML =
            '<option value="">All Statuses</option>' +
            STATUS_OPTIONS.map(
                (s) => '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + "</option>"
            ).join("");
    }

    /** Reads the current filter-bar inputs into a query-param object,
     *  omitting anything left blank so filters combine (AND) cleanly. */
    function buildFilterParams() {
        const params = {};

        if (filterSearch && filterSearch.value.trim())
            params.search = filterSearch.value.trim();
        if (filterCommittee && filterCommittee.value)
            params.committee = filterCommittee.value;
        if (filterAssignedMember && filterAssignedMember.value.trim())
            params.assignedMember = filterAssignedMember.value.trim();
        if (filterStatus && filterStatus.value)
            params.status = filterStatus.value;
        if (filterDeadlineFrom && filterDeadlineFrom.value)
            params.deadlineFrom = filterDeadlineFrom.value;
        if (filterDeadlineTo && filterDeadlineTo.value)
            params.deadlineTo = filterDeadlineTo.value;

        return params;
    }

    /** Re-fetches just the table using the current filters. Counts and
     *  the revision-history feed stay based on the full, unfiltered set —
     *  filtering narrows what you're looking at, not the overall totals. */
    async function refreshTable() {
        try {
            const projects = await fetchProjects(buildFilterParams());
            renderRows(projects);
        } catch (err) {
            console.error(err);
            renderTableNotice("statusBody", "Unable to load projects.", 4);
            showToast(err.message);
        }
    }

    // Debounce free-text inputs so we're not firing a request per
    // keystroke — selects/dates apply immediately since there's no typing.
    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    const debouncedRefresh = debounce(refreshTable, 300);

    if (filterSearch) filterSearch.addEventListener("input", debouncedRefresh);
    if (filterAssignedMember) filterAssignedMember.addEventListener("input", debouncedRefresh);
    if (filterCommittee) filterCommittee.addEventListener("change", refreshTable);
    if (filterStatus) filterStatus.addEventListener("change", refreshTable);
    if (filterDeadlineFrom) filterDeadlineFrom.addEventListener("change", refreshTable);
    if (filterDeadlineTo) filterDeadlineTo.addEventListener("change", refreshTable);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener("click", () => {
            if (filterSearch) filterSearch.value = "";
            if (filterCommittee) filterCommittee.value = "";
            if (filterAssignedMember) filterAssignedMember.value = "";
            if (filterStatus) filterStatus.value = "";
            if (filterDeadlineFrom) filterDeadlineFrom.value = "";
            if (filterDeadlineTo) filterDeadlineTo.value = "";
            refreshTable();
        });
    }

    async function load() {
        try {
            const projects = await fetchProjects();

            renderCounts(projects);
            populateCommitteeOptions(projects);
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
