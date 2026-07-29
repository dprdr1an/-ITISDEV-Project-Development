"use strict";

/* ==========================================================
   IMC Rollout & Project Tracking System
   Common JavaScript — shared across every page

   Responsibilities:
     1. Route protection for authenticated pages
     2. Populating shared user placeholders (sidebar / topbar)
     3. Sidebar + toast behaviour
     4. Reusable helpers (API, escaping, dates, badges, states)

   Page scripts should use window.IMC.* rather than re-implementing
   fetch/format/escape logic locally.
========================================================== */

(function () {

    /* ---------- Module state ---------- */

    // Declared up front: renderUserPlaceholders() runs during init, before
    // buildAvatarMenu(), and reads this via renderAvatarMenuIdentity().
    let avatarMenu = null;

    /* ---------- Page classification ---------- */

    // Pages reachable without a session. Everything else is protected.
    const PUBLIC_PAGES = [
        "",
        "index.html",
        "login.html",
        "register.html"
    ];

    // Positions understood by the system
    const ROLES = {
        CHAIRPERSON: "Chairperson",
        EXECUTIVE: "Executive"
    };

    /**
     * Pages restricted to particular positions. Anything not listed is
     * available to every signed-in user. The API enforces the same rules —
     * this map only stops the page from rendering.
     */
    const PAGE_ROLES = {
        "task-assignment.html": [ROLES.CHAIRPERSON]
    };

    function currentPage() {
        const parts = window.location.pathname.split("/");
        return parts[parts.length - 1].toLowerCase();
    }

    function isPublicPage() {
        return PUBLIC_PAGES.includes(currentPage());
    }

    /* ---------- Storage ---------- */

    const STORAGE_KEY = "user";

    function getUser() {
        try {
            return JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "null"
            );
        } catch (err) {
            // Corrupted payload — treat as logged out
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }

    function setUser(user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }

    function clearUser() {
        localStorage.removeItem(STORAGE_KEY);
    }

    /** True when the signed-in user holds one of the given positions. */
    function hasRole() {
        const active = getUser();
        const allowed = Array.prototype.slice.call(arguments);

        return Boolean(active && allowed.includes(active.position));
    }

    /**
     * Replace the stored user and refresh every shared placeholder.
     * Called after a profile save so the sidebar, topbar, greeting and
     * avatar menu update without a page reload.
     */
    function syncSession(updatedUser) {
        if (!updatedUser) return;

        // Bump so a newly uploaded picture is not served from cache
        updatedUser.avatarVersion = Date.now();

        setUser(updatedUser);
        window.currentUser = updatedUser;

        renderUserPlaceholders(updatedUser);
    }

    /**
     * A stored user is only usable if it carries the fields the app
     * renders and queries with. Anything less is treated as no session.
     */
    function isValidUser(user) {
        return Boolean(
            user &&
            typeof user === "object" &&
            user.id &&
            user.name
        );
    }

    /* ---------- Route protection ---------- */

    const user = getUser();

    if (!isPublicPage() && !isValidUser(user)) {
        clearUser();

        // Remember where the user was headed so login can return them
        const target = currentPage();

        window.location.replace(
            "login.html?redirect=" + encodeURIComponent(target)
        );

        // Stop this script; the page is being navigated away from
        return;
    }

    /* ---------- Role guard ---------- */

    const pageRoles = PAGE_ROLES[currentPage()];

    if (pageRoles && user && !pageRoles.includes(user.position)) {
        // Signed in, but the wrong position for this page
        window.location.replace("dashboard.html?denied=" +
            encodeURIComponent(currentPage()));

        return;
    }

    /* ---------- Small DOM helpers ---------- */

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function setHTML(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = value;
    }

    /**
     * Escape untrusted values before they go anywhere near innerHTML.
     * All record data rendered by page scripts must pass through this.
     */
    function escapeHtml(value) {
        if (value === null || value === undefined) return "";

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function generateInitials(name) {
        return String(name || "")
            .trim()
            .split(/\s+/)
            .map((word) => word[0] || "")
            .join("")
            .substring(0, 2)
            .toUpperCase();
    }

    /* ---------- Dates ---------- */

    function toDate(value) {
        if (!value) return null;

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    /** "Jul 8" */
    function formatShortDate(value) {
        const date = toDate(value);
        if (!date) return "—";

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
        });
    }

    /** "Jul 8, 2026" */
    function formatLongDate(value) {
        const date = toDate(value);
        if (!date) return "—";

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    /** "Jul 8 · 3:00 PM" */
    function formatDateTime(value) {
        const date = toDate(value);
        if (!date) return "—";

        return (
            formatShortDate(date) +
            " · " +
            date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit"
            })
        );
    }

    /** "10 minutes ago", "Yesterday", "Jul 7, 2026" */
    function formatRelative(value) {
        const date = toDate(value);
        if (!date) return "—";

        const diffMs = Date.now() - date.getTime();
        const minutes = Math.round(diffMs / 60000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) {
            return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
        }

        const hours = Math.round(minutes / 60);
        if (hours < 24) {
            return hours + (hours === 1 ? " hour ago" : " hours ago");
        }

        const days = Math.round(hours / 24);
        if (days === 1) return "Yesterday";
        if (days < 7) return days + " days ago";

        return formatLongDate(date);
    }

    /** Deadline label plus whether it has already passed. */
    function describeDeadline(value) {
        const date = toDate(value);

        if (!date) {
            return { label: "No deadline", isOverdue: false, isToday: false };
        }

        const today = new Date();
        const startOfToday = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );
        const startOfDue = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

        const dayDiff = Math.round(
            (startOfDue - startOfToday) / 86400000
        );

        if (dayDiff < 0) {
            return {
                label: "Overdue — " + formatShortDate(date),
                isOverdue: true,
                isToday: false
            };
        }

        if (dayDiff === 0) {
            return {
                label: "Today — " + formatShortDate(date),
                isOverdue: false,
                isToday: true
            };
        }

        return {
            label: formatShortDate(date),
            isOverdue: false,
            isToday: false
        };
    }

    /* ---------- Status / priority class maps ---------- */

    // Used by the dashboard project table (badge-* variants)
    const BADGE_CLASSES = {
        // Task workflow
        "Not Started": "badge-pending",
        "In Progress": "badge-active",
        "Ready for Review": "badge-review",

        // Project statuses
        "Pending": "badge-pending",
        "Active": "badge-active",
        "Ongoing": "badge-active",
        "For Review": "badge-review",
        "For Approval": "badge-approval",
        "Waiting for Approval": "badge-approval",
        "Completed": "badge-done",
        "On Hold": "badge-pending"
    };

    // Used by the project status tracker (status-* variants)
    const STATUS_CLASSES = {
        "Not Started": "status-pending",
        "In Progress": "status-ongoing",
        "Ready for Review": "status-review",
        "Pending": "status-pending",
        "Active": "status-ongoing",
        "Ongoing": "status-ongoing",
        "For Review": "status-review",
        "For Approval": "status-approval",
        "Waiting for Approval": "status-approval",
        "Completed": "status-completed",
        "On Hold": "status-pending"
    };

    const PRIORITY_CLASSES = {
        "High": "priority-high",
        "Medium": "priority-medium",
        "Low": "priority-low"
    };

    function badgeClass(status) {
        return BADGE_CLASSES[status] || "badge-pending";
    }

    function statusClass(status) {
        return STATUS_CLASSES[status] || "status-pending";
    }

    function priorityClass(priority) {
        return PRIORITY_CLASSES[priority] || "priority-medium";
    }

    /* ---------- API layer ---------- */

    /**
     * Wrapper around fetch that normalises JSON parsing and error
     * messages so page scripts do not each re-implement it.
     */
    async function request(url, options) {
        const config = Object.assign(
            { headers: {}, credentials: "same-origin" },
            options || {}
        );

        if (config.body && !(config.body instanceof FormData)) {
            config.headers["Content-Type"] = "application/json";
            config.body = JSON.stringify(config.body);
        }

        let response;

        try {
            response = await fetch(url, config);
        } catch (err) {
            console.error("Network error for " + url, err);
            throw new Error(
                "Unable to reach the server. Check your connection."
            );
        }

        let data = null;

        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            data = await response.json().catch(() => null);
        }

        if (!response.ok) {
            const message =
                (data && (data.message || data.error)) ||
                "Request failed (" + response.status + ").";

            // The server session expired or was never established while the
            // browser still holds a stale localStorage copy. Reset and
            // send the user back to login rather than failing silently.
            if (response.status === 401 && !isPublicPage()) {
                clearUser();
                window.location.replace(
                    "login.html?redirect=" +
                        encodeURIComponent(currentPage())
                );
            }

            const error = new Error(message);
            error.status = response.status;
            throw error;
        }

        return data;
    }

    const api = {
        get: (url) => request(url, { method: "GET" }),
        post: (url, body) => request(url, { method: "POST", body }),
        put: (url, body) => request(url, { method: "PUT", body }),
        patch: (url, body) => request(url, { method: "PATCH", body }),
        del: (url) => request(url, { method: "DELETE" }),
        upload: (url, formData) =>
            request(url, { method: "POST", body: formData })
    };

    /* ---------- Loading / empty / error states ---------- */

    /**
     * Render a non-record message inside a container, reusing the
     * existing .notice styling so no new CSS is introduced.
     */
    function renderNotice(container, message) {
        const el =
            typeof container === "string"
                ? document.getElementById(container)
                : container;

        if (!el) return;

        el.innerHTML =
            '<div class="notice">' + escapeHtml(message) + "</div>";
    }

    /** Same message rendered as a full-width table row. */
    function renderTableNotice(tbody, message, colspan) {
        const el =
            typeof tbody === "string"
                ? document.getElementById(tbody)
                : tbody;

        if (!el) return;

        el.innerHTML =
            '<tr><td colspan="' +
            (colspan || 5) +
            '" style="padding:18px;text-align:center;color:var(--gray-400);">' +
            escapeHtml(message) +
            "</td></tr>";
    }

    /* ---------- Shared user placeholders ---------- */

    /**
     * Fill an avatar element with the uploaded picture when one exists,
     * falling back to initials. Cache-busted so a freshly uploaded image
     * replaces the old one immediately.
     */
    function setAvatar(id, activeUser, previewSrc) {
        const el = document.getElementById(id);
        if (!el) return;

        const initials = generateInitials(activeUser.name);

        // No picture uploaded — initials are the correct result, not a failure
        if (!previewSrc && !activeUser.avatarUrl) {
            el.textContent = initials;
            return;
        }

        // previewSrc is a local object URL used before an upload is saved
        const src =
            previewSrc ||
            activeUser.avatarUrl +
                (activeUser.avatarUrl.indexOf("?") === -1 ? "?v=" : "&v=") +
                (activeUser.avatarVersion || "1");

        const img = document.createElement("img");
        img.alt = activeUser.name || "Profile picture";

        // Show initials until the picture is decoded, then swap. Replacing the
        // contents only on success means a slow load never flashes an empty
        // circle, and a broken one still leaves something readable.
        img.addEventListener("load", () => {
            el.textContent = "";
            el.appendChild(img);
        });

        img.addEventListener("error", () => {
            el.textContent = initials;

            // Loud on purpose: a missing file used to fail silently and look
            // identical to "no picture uploaded", which made it undebuggable.
            console.warn(
                "Avatar failed to load, falling back to initials: " + src
            );
        });

        el.textContent = initials;
        img.src = src;
    }

    function renderUserPlaceholders(activeUser) {
        if (!activeUser) return;

        setText("username", activeUser.name);
        setText("sidebarUsername", activeUser.name);
        setText("workloadUsername", activeUser.name);

        const role = [activeUser.position, activeUser.committee]
            .filter(Boolean)
            .join(" • ");

        setText("sidebarRole", role);

        setAvatar("sidebarAvatar", activeUser);
        setAvatar("topbarAvatar", activeUser);
        setAvatar("workloadAvatar", activeUser);

        renderAvatarMenuIdentity(activeUser);
    }

    /* ---------- Role-aware navigation ---------- */

    /**
     * Hides sidebar links the signed-in position may not use.
     * Markup carries data-roles="Chairperson" (comma separated).
     */
    function applyNavPermissions(activeUser) {
        if (!activeUser) return;

        document.querySelectorAll("[data-roles]").forEach((el) => {
            const allowed = el
                .getAttribute("data-roles")
                .split(",")
                .map((role) => role.trim())
                .filter(Boolean);

            if (allowed.length && !allowed.includes(activeUser.position)) {
                el.remove();
            }
        });
    }

    if (isValidUser(user)) {
        applyNavPermissions(user);
        renderUserPlaceholders(user);
    }

    /* ---------- Sidebar ---------- */

    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    function openSidebar() {
        if (!sidebar || !sidebarOverlay) return;

        sidebar.classList.add("open");
        sidebarOverlay.classList.add("show");
    }

    function closeSidebar() {
        if (!sidebar || !sidebarOverlay) return;

        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("show");
    }

    if (hamburgerBtn && sidebar && sidebarOverlay) {
        hamburgerBtn.addEventListener("click", () => {
            sidebar.classList.contains("open")
                ? closeSidebar()
                : openSidebar();
        });

        sidebarOverlay.addEventListener("click", closeSidebar);
    }

    /* ---------- Toast ---------- */

    let toastTimer;

    function showToast(message) {
        const toast = document.getElementById("toast");

        if (!toast) return;

        const msg = document.getElementById("toastMsg");

        if (msg) {
            msg.textContent = message;
        } else {
            toast.textContent = message;
        }

        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2500);
    }

    /* ---------- Avatar menu ---------- */

    const ICON_PROFILE =
        '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
        '<circle cx="12" cy="7" r="4"/></svg>';

    const ICON_LOGOUT =
        '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
        '<polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';

    /**
     * Wraps the topbar avatar in a dropdown containing View Profile and
     * Logout. Built here so every authenticated page gets it without
     * repeating the markup.
     */
    function buildAvatarMenu() {
        const avatar = document.getElementById("topbarAvatar");

        if (!avatar || !isValidUser(user)) return;

        // Do not double-wrap if a page already provides the structure
        if (avatar.closest(".avatar-menu-wrap")) return;

        const wrap = document.createElement("div");
        wrap.className = "avatar-menu-wrap";

        avatar.parentNode.insertBefore(wrap, avatar);
        wrap.appendChild(avatar);

        avatar.setAttribute("role", "button");
        avatar.setAttribute("tabindex", "0");
        avatar.setAttribute("aria-haspopup", "true");
        avatar.setAttribute("aria-expanded", "false");

        const menu = document.createElement("div");
        menu.className = "avatar-menu";
        menu.setAttribute("role", "menu");

        menu.innerHTML =
            '<div class="avatar-menu-header">' +
            '<div class="avatar-menu-name" id="avatarMenuName"></div>' +
            '<div class="avatar-menu-role" id="avatarMenuRole"></div>' +
            "</div>" +
            '<a class="avatar-menu-item" href="profile.html" role="menuitem">' +
            ICON_PROFILE +
            "View Profile</a>" +
            '<button type="button" class="avatar-menu-item danger" ' +
            'data-logout role="menuitem">' +
            ICON_LOGOUT +
            "Logout</button>";

        wrap.appendChild(menu);
        avatarMenu = menu;

        function toggle(open) {
            const next =
                open === undefined ? !menu.classList.contains("open") : open;

            menu.classList.toggle("open", next);
            avatar.setAttribute("aria-expanded", String(next));
        }

        avatar.addEventListener("click", (event) => {
            event.stopPropagation();
            toggle();
        });

        avatar.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle();
            }
        });

        // Clicking anywhere else, or pressing Escape, closes the menu
        document.addEventListener("click", (event) => {
            if (!wrap.contains(event.target)) toggle(false);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") toggle(false);
        });

        renderAvatarMenuIdentity(user);
    }

    function renderAvatarMenuIdentity(activeUser) {
        if (!avatarMenu || !activeUser) return;

        setText("avatarMenuName", activeUser.name);
        setText(
            "avatarMenuRole",
            [activeUser.position, activeUser.committee]
                .filter(Boolean)
                .join(" • ")
        );
    }

    /* ---------- Logout ---------- */

    /**
     * Ends the server session first, then clears local state and returns to
     * login. The redirect happens even if the network call fails, so the
     * user is never stranded on a page they can no longer use.
     */
    async function logout() {
        try {
            await fetch("/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });
        } catch (err) {
            console.error("Logout request failed:", err);
        }

        clearUser();
        window.location.replace("login.html");
    }

    // Any element marked data-logout triggers a logout
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-logout]");

        if (trigger) {
            event.preventDefault();
            logout();
        }
    });

    /* ---------- Bootstrap ---------- */

    buildAvatarMenu();

    /* ---------- Public surface ---------- */

    window.IMC = {
        // session
        getUser,
        setUser,
        clearUser,
        isValidUser,
        logout,
        ROLES,
        hasRole,
        syncSession,

        // navigation
        applyNavPermissions,

        // dom
        setText,
        setHTML,
        escapeHtml,
        generateInitials,
        renderUserPlaceholders,
        setAvatar,

        // dates
        formatShortDate,
        formatLongDate,
        formatDateTime,
        formatRelative,
        describeDeadline,

        // presentation
        badgeClass,
        statusClass,
        priorityClass,
        renderNotice,
        renderTableNotice,
        showToast,

        // network
        api
    };

    // Backwards-compatible globals used by existing page scripts
    window.logout = logout;
    window.showToast = showToast;
    window.currentUser = user;

})();
