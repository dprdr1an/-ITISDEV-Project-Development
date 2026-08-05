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

    // Holds the MongoDB ID of the project whose discussion is currently displayed.
    let selectedDiscussionProject = null;

    // Used for the title above the discussion feed.
    let discussionProjectName = "";

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
                    '<td>' + '<button class="btn-secondary discussion-btn" ' + // Allows the user to open the discussion thread associated with this project
                    'data-project="' + escapeHtml(project._id) + '" ' +
                    'data-name="' + escapeHtml(project.projectName) + '">' +
                    'Discussion' + '</button>' + '</td>' + '<td><div class="project-meta">' +
                    escapeHtml(formatDateTime(project.updatedAt)) +
                    "</div></td>" +
                    "</tr>"
                );
            })
            .join("");

        bindSelects();
        bindDiscussionButtons();
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

    // Every project row contains a Discussion button.
    // Clicking it loads the discussion feed for that project.
    function bindDiscussionButtons() {
        document.querySelectorAll(".discussion-btn")

        .forEach(button => {

            button.addEventListener("click", async () => {
                selectedDiscussionProject =
                    button.dataset.project;
                discussionProjectName =
                    button.dataset.name;

                /*
                Update the title shown above the
                discussion feed.
                */
                document.getElementById(
                    "discussionProjectTitle"
                ).textContent = discussionProjectName;

                /*
                Load every discussion update belonging
                to this project.
                */
                await loadDiscussion();
            });

        });
    }

    /* ---------- Discussion ---------- */

    async function loadDiscussion() {
        if (!selectedDiscussionProject)
            return;
        const container = document.getElementById(
            "discussionContainer"
        );
        container.innerHTML =
            '<div class="notice">Loading discussions...</div>';
        try {
            const response = await api.get(
                "/api/discussions/project/" +
                selectedDiscussionProject
            );
            const discussions = response.data || [];
            renderDiscussion(discussions);
        }
        catch (err) {
            console.error(err);
            container.innerHTML =
                '<div class="notice">Unable to load discussion.</div>';
        }
    }

    function renderDiscussion(discussions) {
        const container =
            document.getElementById("discussionContainer");
        if (!discussions.length) {
            container.innerHTML =
                '<div class="notice">' +
                'No discussion has been posted yet.' +
                '</div>';
            return;
        }
        container.innerHTML = discussions.map(discussion => {
            const comments = (discussion.comments || [])
                .map(comment =>
                    '<div class="discussion-comment">' +
                    '<strong>' +
                    escapeHtml(comment.author?.name || "Unknown") +
                    '</strong><br>' +
                    escapeHtml(comment.message) +
                    '</div>'
                ).join("");
            return `
            <div class="discussion-card">
                <div class="discussion-header">
                    <strong>
                        ${escapeHtml(discussion.author?.name || "Unknown")}
                    </strong>
                    <span>
                        ${escapeHtml(
                            formatDateTime(discussion.createdAt)
                        )}
                    </span>
                </div>
                <div class="discussion-update">
                    ${escapeHtml(discussion.update)}
                </div>
                <hr>
                <div class="discussion-comments">
                    ${comments}
                </div>
                <hr>
                <textarea
                    class="comment-input"
                    rows="2"
                    placeholder="Write a comment..."
                ></textarea>
                <br>
                <button
                    class="btn-secondary comment-btn"
                    data-id="${discussion._id}">
                    Comment
                </button>
            </div>
            `;
        }).join("");
        bindCommentButtons();
    }

    function bindCommentButtons() {
        document
            .querySelectorAll(".comment-btn")
            .forEach(button => {
                button.addEventListener("click", async () => {
                    const card =
                        button.closest(".discussion-card");
                    const textarea =
                        card.querySelector(".comment-input");
                    const message =
                        textarea.value.trim();
                    if (!message.length) {
                        showToast(
                            "Please enter a comment."
                        );
                        return;
                    }
                    button.disabled = true;
                    try {
                        await api.post(
                            "/api/discussions/" +
                            button.dataset.id +
                            "/comments",
                            {
                                message
                            }
                        );
                        textarea.value = "";
                        await loadDiscussion();
                        showToast(
                            "Comment added."
                        );
                    }
                    catch (err) {
                        console.error(err);
                        showToast(err.message);
                    }
                    finally {
                        button.disabled = false;
                    }
                });
            });
    }

    function initializeDiscussionPost() {
        const button = document.getElementById(
            "postDiscussionBtn"
        );
        if (!button)
            return;
        button.addEventListener("click", async () => {
            if (!selectedDiscussionProject) {
                showToast(
                    "Select a project first."
                );
                return;
            }
            const textarea =
                document.getElementById(
                    "discussionInput"
                );
            const update =
                textarea.value.trim();
            if (!update.length) {
                showToast(
                    "Please enter a project update."
                );
                return;
            }
            button.disabled = true;
            try {
                await api.post(
                    "/api/discussions",
                    {
                        project:
                            selectedDiscussionProject,
                        update
                    }
                );
                textarea.value = "";
                await loadDiscussion();
                showToast(
                    "Project update posted."
                );
            }
            catch (err) {
                console.error(err);
                showToast(
                    err.message
                );
            }
            finally {
                button.disabled = false;
            }
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
    initializeDiscussionPost();
    load();

})();
