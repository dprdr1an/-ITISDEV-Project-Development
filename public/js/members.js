"use strict";

/* ==========================================================
   Members — team directory
   Reuses GET /api/users (search / committee / position filters and
   active task counts) plus the shared filter controller.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        generateInitials,
        formatLongDate,
        buildQueryString,
        createFilterController,
        populateSelect,
        populateCommitteeSelect,
        emptyResultMessage,
        renderNotice,
        showToast,
        ROLES,
        hasRole
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    const list = document.getElementById("memberList");
    const isChairperson = hasRole(ROLES.CHAIRPERSON);

    const POSITIONS = ["Chairperson", "Executive"];

    // Declared before renderMembers()/load() read it
    let filters = null;

    /* ---------- Rendering ---------- */

    function avatarHtml(member) {
        const initials = escapeHtml(generateInitials(member.name));

        if (member.avatarUrl) {
            return (
                '<div class="member-avatar-lg"><img src="' +
                escapeHtml(member.avatarUrl) +
                '" alt="' + escapeHtml(member.name || "") + '"' +
                " onerror=\"this.remove();this.parentNode.textContent='" +
                initials +
                "'\"></div>"
            );
        }

        return '<div class="member-avatar-lg">' + initials + "</div>";
    }

    function renderMembers(members) {
        if (!members.length) {
            renderNotice(
                list,
                emptyResultMessage(
                    filters && filters.isFiltering(),
                    "No members registered yet."
                )
            );
            return;
        }

        list.innerHTML = members
            .map((member) => {
                const id = escapeHtml(member._id);

                const tasks =
                    member.activeTaskCount === 1
                        ? "1 active task"
                        : (member.activeTaskCount || 0) + " active tasks";

                // Chairpersons can also assign work from here
                const assign = isChairperson
                    ? '<a class="member-action" href="task-assignment.html">Assign Task</a>'
                    : "";

                return (
                    '<div class="member-row">' +
                    avatarHtml(member) +
                    '<div class="member-main">' +
                    '<div class="member-name">' +
                    escapeHtml(member.name) +
                    "</div>" +
                    '<div class="member-meta">' +
                    "<span>" + escapeHtml(member.position || "—") + "</span>" +
                    '<span class="dim">·</span>' +
                    "<span>" + escapeHtml(member.committee || "—") + "</span>" +
                    '<span class="dim">·</span>' +
                    '<span class="dim">' + escapeHtml(member.email || "—") + "</span>" +
                    "</div>" +
                    '<div class="member-meta">' +
                    '<span class="dim">Joined ' +
                    escapeHtml(formatLongDate(member.createdAt)) +
                    "</span>" +
                    '<span class="dim">·</span>' +
                    '<span class="dim">' + escapeHtml(tasks) + "</span>" +
                    "</div>" +
                    "</div>" +
                    '<div class="member-actions">' +
                    '<a class="member-action" href="profile.html?user=' +
                    id +
                    '">View Profile</a>' +
                    assign +
                    "</div></div>"
                );
            })
            .join("");
    }

    function setCount(shown) {
        const note = document.getElementById("memberCount");

        if (note) {
            note.textContent =
                shown === 1 ? "1 member" : shown + " members";
        }
    }

    /* ---------- Load ---------- */

    async function refresh(params) {
        try {
            const response = await api.get(
                "/api/users" +
                    buildQueryString(params || (filters ? filters.params() : {}))
            );

            const members = response.users || [];

            renderMembers(members);
            setCount(members.length);

            return members;
        } catch (err) {
            console.error(err);
            renderNotice(list, "Unable to load the member directory.");
            showToast(err.message);
            return [];
        }
    }

    filters = createFilterController({
        controls: {
            search:    { id: "memberSearch", debounce: true },
            committee: { id: "memberCommittee" },
            position:  { id: "memberPosition" }
        },
        clearButtonId: "clearMemberFilters",
        onChange: refresh
    });

    (async function init() {
        populateSelect("memberPosition", POSITIONS, "All Positions");

        // Official structure, so every committee is filterable even
        // before anyone has been assigned to it
        populateCommitteeSelect("memberCommittee", {
            placeholder: "All Committees"
        });

        await refresh({});
    })();

})();
