"use strict";

/* ==========================================================
   Project Discussions
   Reads and posts through /api/discussions, which scopes every
   request to projects the signed-in user belongs to.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        generateInitials,
        formatDateTime,
        formatRelative,
        buildQueryString,
        showToast
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    const projectSelect = document.getElementById("projectSelect");
    const thread = document.getElementById("thread");
    const threadTitle = document.getElementById("threadTitle");
    const threadSub = document.getElementById("threadSub");
    const composerForm = document.getElementById("composerForm");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const refreshBtn = document.getElementById("refreshBtn");

    let activeProjectId = "";

    /* ---------- Helpers ---------- */

    function setThreadMessage(text, className) {
        thread.innerHTML =
            '<div class="' + (className || "thread-empty") + '">' +
            escapeHtml(text) +
            "</div>";
    }

    function setComposerEnabled(enabled) {
        if (messageInput) messageInput.disabled = !enabled;
        if (sendBtn) sendBtn.disabled = !enabled;
    }

    function scrollToNewest() {
        // Newest sits at the bottom of the thread
        thread.scrollTop = thread.scrollHeight;
    }

    /** Avatar markup shared by every message row. */
    function avatarHtml(author) {
        const name = (author && author.name) || "Unknown";
        const initials = escapeHtml(generateInitials(name));

        if (author && author.avatarUrl) {
            return (
                '<div class="msg-avatar"><img src="' +
                escapeHtml(author.avatarUrl) +
                '" alt="' + escapeHtml(name) + '"' +
                " onerror=\"this.remove();this.parentNode.textContent='" +
                initials +
                "'\"></div>"
            );
        }

        return '<div class="msg-avatar">' + initials + "</div>";
    }

    function messageHtml(entry, pending) {
        const author = entry.author || {};
        const name = author.name || "Unknown member";

        const role = [author.position, author.committee]
            .filter(Boolean)
            .join(" • ");

        const isMine =
            String(author._id || author.id || "") === String(user.id);

        const stamp = entry.createdAt
            ? formatRelative(entry.createdAt)
            : "Sending…";

        return (
            '<div class="msg' +
            (isMine ? " is-mine" : "") +
            (pending ? " is-pending" : "") +
            '">' +
            avatarHtml(author) +
            '<div class="msg-body">' +
            '<div class="msg-head">' +
            '<span class="msg-name">' + escapeHtml(name) + "</span>" +
            (role ? '<span class="msg-role">' + escapeHtml(role) + "</span>" : "") +
            '<span class="msg-time" title="' +
            escapeHtml(entry.createdAt ? formatDateTime(entry.createdAt) : "") +
            '">' + escapeHtml(stamp) + "</span>" +
            "</div>" +
            // escapeHtml here is what keeps posted markup inert
            '<div class="msg-text">' + escapeHtml(entry.update || "") + "</div>" +
            "</div></div>"
        );
    }

    function renderThread(entries) {
        if (!entries.length) {
            setThreadMessage(
                "No messages yet. Start the discussion below."
            );
            return;
        }

        thread.innerHTML = entries
            .map((entry) => messageHtml(entry, false))
            .join("");

        scrollToNewest();
    }

    /* ---------- Project selector ---------- */

    async function loadProjects() {
        try {
            const response = await api.get("/api/discussions/projects");
            const projects = response.data || [];

            if (!projects.length) {
                projectSelect.innerHTML =
                    '<option value="">No projects available</option>';

                setThreadMessage(
                    "You are not part of any project yet. Once you are assigned to one, its discussion appears here."
                );

                setComposerEnabled(false);
                return [];
            }

            projectSelect.innerHTML =
                '<option value="">Select a project…</option>' +
                projects
                    .map(
                        (project) =>
                            '<option value="' +
                            escapeHtml(project._id) +
                            '">' +
                            escapeHtml(project.projectName) +
                            "</option>"
                    )
                    .join("");

            return projects;
        } catch (err) {
            console.error(err);

            projectSelect.innerHTML =
                '<option value="">Unable to load projects</option>';

            setThreadMessage("Unable to load your projects.");
            showToast(err.message);

            return [];
        }
    }

    /* ---------- Thread ---------- */

    async function loadThread(projectId) {
        if (!projectId) {
            activeProjectId = "";
            threadTitle.textContent = "Discussion";
            threadSub.textContent = "Select a project to view its thread";
            setThreadMessage("Select a project to begin.");
            setComposerEnabled(false);
            return;
        }

        activeProjectId = projectId;

        setThreadMessage("Loading messages…", "thread-loading");
        setComposerEnabled(false);

        try {
            const response = await api.get(
                "/api/discussions/project/" + encodeURIComponent(projectId)
            );

            const project = response.project || {};

            threadTitle.textContent = project.projectName || "Discussion";
            threadSub.textContent = [project.committee, project.status]
                .filter(Boolean)
                .join(" · ") || "Project discussion";

            renderThread(response.data || []);
            setComposerEnabled(true);
        } catch (err) {
            console.error(err);

            setThreadMessage(
                err.status === 403
                    ? "You do not have access to this project's discussion."
                    : "Unable to load this discussion."
            );

            setComposerEnabled(false);

            if (err.status !== 403) showToast(err.message);
        }
    }

    /* ---------- Posting ---------- */

    if (composerForm) {
        composerForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const text = messageInput.value.trim();

            // Blank or whitespace-only posts never reach the server
            if (!text) {
                showToast("Please write a message first.");
                return;
            }

            if (!activeProjectId) {
                showToast("Please select a project first.");
                return;
            }

            const originalLabel = sendBtn.textContent;

            sendBtn.disabled = true;
            messageInput.disabled = true;
            sendBtn.textContent = "Posting…";

            // Optimistic row so the message appears immediately
            const placeholder = document.createElement("div");
            placeholder.innerHTML = messageHtml(
                { author: user, update: text, createdAt: null },
                true
            );

            const pendingNode = placeholder.firstChild;
            const emptyState = thread.querySelector(".thread-empty");

            if (emptyState) thread.innerHTML = "";

            thread.appendChild(pendingNode);
            scrollToNewest();

            try {
                await api.post("/api/discussions", {
                    projectId: activeProjectId,
                    update: text
                });

                messageInput.value = "";

                // Reload so the posted message carries its server timestamp
                await loadThread(activeProjectId);

                showToast("Message posted.");
            } catch (err) {
                console.error(err);

                pendingNode.remove();

                if (!thread.children.length) {
                    setThreadMessage(
                        "No messages yet. Start the discussion below."
                    );
                }

                showToast(err.message);
            } finally {
                sendBtn.textContent = originalLabel;
                setComposerEnabled(true);
            }
        });
    }

    // Enter posts, Shift+Enter adds a newline
    if (messageInput) {
        messageInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                composerForm.requestSubmit
                    ? composerForm.requestSubmit()
                    : composerForm.dispatchEvent(new Event("submit"));
            }
        });
    }

    if (projectSelect) {
        projectSelect.addEventListener("change", () => {
            const id = projectSelect.value;

            // Keep the URL shareable and reload-safe
            const url =
                "discussions.html" + buildQueryString({ project: id });

            window.history.replaceState({}, "", url);

            loadThread(id);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            if (!activeProjectId) {
                await init();
                return;
            }

            await loadThread(activeProjectId);
            showToast("Discussion refreshed.");
        });
    }

    /* ---------- Init ---------- */

    async function init() {
        const projects = await loadProjects();

        // Deep link: discussions.html?project=<projectId>
        const requested = new URLSearchParams(window.location.search)
            .get("project");

        const exists =
            requested &&
            projects.some((project) => String(project._id) === requested);

        if (requested && exists) {
            projectSelect.value = requested;
            await loadThread(requested);
            return;
        }

        if (requested && projects.length) {
            // Linked from elsewhere, but this user is not on that project
            setThreadMessage(
                "You do not have access to that project's discussion."
            );
            setComposerEnabled(false);
            return;
        }

        if (projects.length) {
            setThreadMessage("Select a project to begin.");
        }
    }

    init();

})();
