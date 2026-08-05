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
        "task-assignment.html": [ROLES.CHAIRPERSON],

        // Registration moved under Members. It stays reachable when signed
        // out (the login page links to it, and the first account has to be
        // created somehow), but a signed-in Executive may not open it.
        "register.html": [ROLES.CHAIRPERSON]
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

    /* ---------- Committee constants ---------- */

    /**
     * Committee data comes from /js/constants.js, which the server
     * generates from config/constants.js. Nothing here hardcodes a list.
     */
    const CONSTANTS = window.IMC_CONSTANTS || {};

    const COMMITTEE_OPTIONS = CONSTANTS.COMMITTEE_OPTIONS || [];
    const COMMITTEE_VALUES = CONSTANTS.COMMITTEE_VALUES || [];
    const COMMITTEE_NAMES = CONSTANTS.COMMITTEE_NAMES || [];
    const POSITIONS = CONSTANTS.POSITIONS || ["Chairperson", "Executive"];

    /**
     * Fills a <select> with the official committees, grouped by parent so
     * repeated sub-committee names ("Administrative" under both Project
     * Management and Human Resources) stay distinguishable.
     *
     * Any element carrying data-committee-select is filled automatically;
     * data-placeholder sets the first option's label.
     */
    function populateCommitteeSelect(select, options) {
        const el =
            typeof select === "string"
                ? document.getElementById(select)
                : select;

        if (!el || !COMMITTEE_OPTIONS.length) return;

        const settings = options || {};
        const current = el.value;

        const placeholder =
            settings.placeholder ||
            el.getAttribute("data-placeholder") ||
            "Select committee";

        // Group options under their parent committee
        const groups = [];

        COMMITTEE_OPTIONS.forEach((option) => {
            let group = groups.find((g) => g.name === option.group);

            if (!group) {
                group = { name: option.group, items: [] };
                groups.push(group);
            }

            group.items.push(option);
        });

        const markup = groups
            .map((group) => {
                // A standalone committee needs no optgroup wrapper
                if (
                    group.items.length === 1 &&
                    group.items[0].value === group.name
                ) {
                    return (
                        '<option value="' +
                        escapeHtml(group.name) +
                        '">' +
                        escapeHtml(group.name) +
                        "</option>"
                    );
                }

                return (
                    '<optgroup label="' +
                    escapeHtml(group.name) +
                    '">' +
                    group.items
                        .map(
                            (item) =>
                                '<option value="' +
                                escapeHtml(item.value) +
                                '">' +
                                escapeHtml(item.label) +
                                "</option>"
                        )
                        .join("") +
                    "</optgroup>"
                );
            })
            .join("");

        el.innerHTML =
            '<option value="">' + escapeHtml(placeholder) + "</option>" + markup;

        // Keep a prior selection if it is still a valid committee
        if (current && COMMITTEE_VALUES.indexOf(current) !== -1) {
            el.value = current;
        }
    }

    /** Fills every [data-committee-select] on the page. */
    function populateAllCommitteeSelects() {
        document
            .querySelectorAll("[data-committee-select]")
            .forEach((select) => populateCommitteeSelect(select));
    }

    /* ---------- Search & filter (shared) ---------- */

    /**
     * Delays a call until the caller stops firing it. Used so typing in a
     * search box issues one request instead of one per keystroke.
     */
    function debounce(fn, delay) {
        let timer;

        return function () {
            const args = arguments;

            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(null, args), delay || 300);
        };
    }

    /** Serialises a params object, dropping blanks so filters combine cleanly. */
    function buildQueryString(params) {
        const query = new URLSearchParams();

        Object.keys(params || {}).forEach((key) => {
            const value = params[key];

            if (value === undefined || value === null) return;

            const text = String(value).trim();

            if (text !== "") query.set(key, text);
        });

        const out = query.toString();

        return out ? "?" + out : "";
    }

    /**
     * Wires a set of search/filter controls to a single refresh function.
     *
     * One definition drives every page: each control declares the query
     * param it maps to, free-text inputs are debounced while selects and
     * dates apply immediately, and every control is read on each refresh so
     * search and filters always preserve one another.
     *
     *   createFilterController({
     *       controls: {
     *           search:   { id: "taskSearch", debounce: true },
     *           status:   { id: "taskStatus" },
     *           priority: { id: "taskPriority" }
     *       },
     *       clearButtonId: "clearFiltersBtn",
     *       onChange: refreshList
     *   })
     *
     * Returns { params(), refresh(), clear(), isFiltering() }.
     */
    function createFilterController(config) {
        const controls = config.controls || {};
        const onChange = config.onChange;

        // param name -> element (missing elements are skipped, so a page
        // can adopt a subset of controls without extra branching)
        const bound = {};

        Object.keys(controls).forEach((param) => {
            const spec = controls[param];
            const el = document.getElementById(
                typeof spec === "string" ? spec : spec.id
            );

            if (el) bound[param] = { el: el, spec: spec };
        });

        function params() {
            const out = {};

            Object.keys(bound).forEach((param) => {
                const value = bound[param].el.value;

                if (value !== undefined && String(value).trim() !== "") {
                    out[param] = String(value).trim();
                }
            });

            return out;
        }

        function isFiltering() {
            return Object.keys(params()).length > 0;
        }

        function refresh() {
            if (typeof onChange === "function") return onChange(params());
        }

        const debounced = debounce(refresh, config.delay || 300);

        Object.keys(bound).forEach((param) => {
            const entry = bound[param];
            const el = entry.el;
            const wantsDebounce =
                typeof entry.spec === "object" && entry.spec.debounce;

            if (wantsDebounce) {
                el.addEventListener("input", debounced);
            } else {
                el.addEventListener("change", refresh);
            }

            // Enter should apply immediately rather than wait out the debounce
            if (el.tagName === "INPUT") {
                el.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        refresh();
                    }
                });
            }
        });

        function clear() {
            Object.keys(bound).forEach((param) => {
                bound[param].el.value = "";
            });

            return refresh();
        }

        const clearBtn = config.clearButtonId
            ? document.getElementById(config.clearButtonId)
            : null;

        if (clearBtn) clearBtn.addEventListener("click", clear);

        return { params: params, refresh: refresh, clear: clear,
                 isFiltering: isFiltering };
    }

    /**
     * Fills a <select> with options derived from the data currently loaded,
     * so a filter never offers a value that cannot match anything. Keeps the
     * user's current choice selected when it still exists.
     */
    function populateSelect(id, values, allLabel) {
        const select = document.getElementById(id);

        if (!select) return;

        const current = select.value;
        const list = Array.from(new Set(values.filter(Boolean)));

        select.innerHTML =
            '<option value="">' +
            escapeHtml(allLabel || "All") +
            "</option>" +
            list
                .map((item) => {
                    const value = typeof item === "object" ? item.value : item;
                    const label = typeof item === "object" ? item.label : item;

                    return (
                        '<option value="' + escapeHtml(value) + '">' +
                        escapeHtml(label) +
                        "</option>"
                    );
                })
                .join("");

        // Restore the previous selection if it survived the refresh
        const stillThere = list.some(
            (item) =>
                String(typeof item === "object" ? item.value : item) ===
                String(current)
        );

        if (stillThere) select.value = current;
    }

    /**
     * Standard message for an empty result set. Distinguishes "nothing
     * matched your filters" from "there is nothing here yet", because the
     * two call for different user actions.
     */
    function emptyResultMessage(isFiltering, emptyText) {
        return isFiltering
            ? "No results found."
            : emptyText || "Nothing to show yet.";
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

    /* ---------- Shared dropdown registry ---------- */

    /**
     * Every topbar dropdown (avatar menu, notifications, calendar) registers
     * here. This gives us one outside-click handler and one Escape handler for
     * all of them instead of a set per panel, and guarantees that opening one
     * closes the others.
     */
    const dropdowns = [];

    function closeAllDropdowns(except) {
        dropdowns.forEach((entry) => {
            if (entry !== except) entry.toggle(false);
        });
    }

    function registerDropdown(options) {
        const trigger = options.trigger;
        const wrap = options.wrap;
        const panel = options.panel;

        const entry = { trigger, wrap, panel };

        entry.toggle = function (open) {
            const next =
                open === undefined
                    ? !panel.classList.contains("open")
                    : open;

            if (next) closeAllDropdowns(entry);

            panel.classList.toggle("open", next);

            if (trigger) {
                trigger.setAttribute("aria-expanded", String(next));
            }

            // Refresh contents each time the panel is opened so the data is
            // never stale, rather than fetching once at page load.
            if (next && typeof options.onOpen === "function") {
                options.onOpen();
            }
        };

        if (trigger) {
            trigger.addEventListener("click", (event) => {
                event.stopPropagation();
                entry.toggle();
            });

            trigger.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    entry.toggle();
                }
            });
        }

        dropdowns.push(entry);

        return entry;
    }

    // One listener pair covers every registered dropdown
    document.addEventListener("click", (event) => {
        dropdowns.forEach((entry) => {
            if (!entry.wrap.contains(event.target)) entry.toggle(false);
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeAllDropdowns();
    });

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

        registerDropdown({ trigger: avatar, wrap: wrap, panel: menu });

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

    /* ---------- Notification presentation (shared) ---------- */

    // Canonical backend type -> category. Used by both this panel and the
    // full Notifications page so the mapping lives in exactly one place.
    const NOTIFICATION_CATEGORY = {
        DEADLINE_REMINDER: "deadline",
        TASK_OVERDUE: "overdue",
        TASK_ASSIGNED: "update",
        TASK_UPDATED: "update",
        PROJECT_STATUS_CHANGED: "update",
        ROLLOUT_UPDATED: "update",
        APPROVAL_REQUIRED: "approval",
        PROJECT_APPROVED: "approval"
    };

    const CATEGORY_PRESENTATION = {
        deadline: { label: "Deadline Reminder", color: "var(--yellow)",
                    bg: "var(--yellow-light)", badge: "badge-preso" },
        overdue:  { label: "Overdue Alert", color: "var(--red)",
                    bg: "var(--red-light)", badge: "badge-doc" },
        update:   { label: "Update", color: "var(--blue)",
                    bg: "var(--blue-light)", badge: "badge-photo" },
        approval: { label: "Approval", color: "var(--green)",
                    bg: "var(--green-light)", badge: "badge-pubmat" }
    };

    const CATEGORY_ICON = {
        deadline: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        overdue: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
                 '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        update: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
        approval: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
    };

    function notificationCategory(type) {
        return NOTIFICATION_CATEGORY[type] || "update";
    }

    function notificationPresentation(type) {
        return CATEGORY_PRESENTATION[notificationCategory(type)] ||
            CATEGORY_PRESENTATION.update;
    }

    function notificationIcon(type) {
        return CATEGORY_ICON[notificationCategory(type)] || CATEGORY_ICON.update;
    }

    /* ---------- Topbar panels (calendar + notifications) ---------- */

    /**
     * Wraps a topbar icon button in a dropdown panel. Mirrors how the avatar
     * menu is built so all three behave identically on every page.
     */
    function buildPanel(buttonId, title, actionHtml) {
        const button = document.getElementById(buttonId);

        if (!button || !isValidUser(user)) return null;
        if (button.closest(".topbar-panel-wrap")) return null;

        const wrap = document.createElement("div");
        wrap.className = "topbar-panel-wrap";

        button.parentNode.insertBefore(wrap, button);
        wrap.appendChild(button);

        const panel = document.createElement("div");
        panel.className = "topbar-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", title);

        panel.innerHTML =
            '<div class="topbar-panel-header">' +
            '<span class="topbar-panel-title">' + escapeHtml(title) + "</span>" +
            (actionHtml || "") +
            "</div>" +
            '<div class="topbar-panel-body"></div>';

        wrap.appendChild(panel);

        return {
            button: button,
            wrap: wrap,
            panel: panel,
            body: panel.querySelector(".topbar-panel-body")
        };
    }

    function panelMessage(body, message) {
        body.innerHTML =
            '<div class="topbar-panel-empty">' + escapeHtml(message) + "</div>";
    }

    /* ---------- Calendar: my upcoming deadlines ---------- */

    /**
     * Whole-day difference between a deadline and today, so "tomorrow" does
     * not depend on the time of day the task was created.
     */
    function daysUntil(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;

        const now = new Date();
        const startToday = new Date(
            now.getFullYear(), now.getMonth(), now.getDate()
        );
        const startDue = new Date(
            date.getFullYear(), date.getMonth(), date.getDate()
        );

        return Math.round((startDue - startToday) / 86400000);
    }

    function deadlineGroupLabel(days) {
        if (days < 0) {
            const overdueBy = Math.abs(days);
            return overdueBy === 1 ? "Overdue by 1 day" : "Overdue by " + overdueBy + " days";
        }
        if (days === 0) return "Today";
        if (days === 1) return "Tomorrow";
        return days + " Days Remaining";
    }

    function buildCalendarPanel() {
        const parts = buildPanel("calendarBtn", "My Upcoming Deadlines");

        if (!parts) return;

        panelMessage(parts.body, "Loading your deadlines…");

        async function load() {
            try {
                // Reuses the My Tasks endpoint; the server scopes it to the
                // session user, so no other member's tasks can appear here.
                const response = await api.get("/api/tasks?mine=true");

                const tasks = (response.tasks || [])
                    .filter((task) =>
                        task.status !== "Completed" && task.deadline
                    )
                    .sort(
                        (a, b) => new Date(a.deadline) - new Date(b.deadline)
                    );

                if (!tasks.length) {
                    panelMessage(parts.body, "You have no upcoming deadlines.");
                    return;
                }

                let html = "";
                let lastLabel = null;

                tasks.forEach((task) => {
                    const days = daysUntil(task.deadline);
                    const label = deadlineGroupLabel(days);

                    if (label !== lastLabel) {
                        html +=
                            '<div class="deadline-group-label">' +
                            escapeHtml(label) +
                            "</div>";
                        lastLabel = label;
                    }

                    const state =
                        days < 0 ? " is-overdue"
                        : days === 0 ? " is-today"
                        : days <= 3 ? " is-soon"
                        : "";

                    const projectName =
                        (task.project && task.project.projectName) ||
                        "Unassigned project";

                    html +=
                        '<div class="deadline-item' + state + '">' +
                        '<span class="deadline-rail"></span>' +
                        '<div class="deadline-main">' +
                        '<div class="deadline-title">' +
                        escapeHtml(task.title) +
                        "</div>" +
                        '<div class="deadline-project">Project: ' +
                        escapeHtml(projectName) +
                        "</div>" +
                        '<div class="deadline-meta">' +
                        '<span class="badge ' + badgeClass(task.status) + '">' +
                        escapeHtml(task.status) +
                        "</span>" +
                        "<span>Due " + escapeHtml(formatLongDate(task.deadline)) + "</span>" +
                        '<span' + (days < 0 ? ' class="overdue"' : "") + ">" +
                        escapeHtml(deadlineGroupLabel(days)) +
                        "</span>" +
                        "</div></div></div>";
                });

                html +=
                    '<div class="topbar-panel-footer">' +
                    '<a href="my-tasks.html">View all my tasks</a></div>';

                parts.body.innerHTML = html;
            } catch (err) {
                console.error("Calendar panel error:", err);
                panelMessage(parts.body, "Unable to load your deadlines.");
            }
        }

        registerDropdown({
            trigger: parts.button,
            wrap: parts.wrap,
            panel: parts.panel,
            onOpen: load
        });
    }

    /* ---------- Notifications panel ---------- */

    function buildNotificationsPanel() {
        const parts = buildPanel(
            "notifBtn",
            "Notifications",
            '<button type="button" class="topbar-panel-action" ' +
            'id="panelMarkAll">Mark all as read</button>'
        );

        if (!parts) return;

        panelMessage(parts.body, "Loading notifications…");

        const markAllBtn = parts.panel.querySelector("#panelMarkAll");

        function paintUnreadDot(count) {
            const dot = document.getElementById("notifDot");
            if (dot) dot.hidden = !count;

            if (markAllBtn) markAllBtn.disabled = !count;
        }

        function render(notifications) {
            if (!notifications.length) {
                panelMessage(parts.body, "You have no notifications yet.");
                return;
            }

            parts.body.innerHTML =
                notifications
                    .slice(0, 12)
                    .map((notification) => {
                        const style = notificationPresentation(notification.type);

                        const project =
                            notification.relatedProject &&
                            notification.relatedProject.projectName
                                ? '<span>' +
                                  escapeHtml(notification.relatedProject.projectName) +
                                  "</span>"
                                : "";

                        const markBtn = notification.isRead
                            ? ""
                            : '<button type="button" class="panel-notif-read" ' +
                              'data-read="' + escapeHtml(notification._id) +
                              '">Mark as read</button>';

                        return (
                            '<div class="panel-notif' +
                            (notification.isRead ? "" : " unread") +
                            '">' +
                            '<div class="panel-notif-icon" style="background:' +
                            style.bg + ';">' +
                            '<svg viewBox="0 0 24 24" style="stroke:' +
                            style.color + ';">' +
                            notificationIcon(notification.type) +
                            "</svg></div>" +
                            '<div class="panel-notif-main">' +
                            '<div class="panel-notif-title">' +
                            escapeHtml(notification.title) +
                            "</div>" +
                            '<div class="panel-notif-msg">' +
                            escapeHtml(notification.message) +
                            "</div>" +
                            '<div class="panel-notif-meta">' +
                            "<span>" +
                            escapeHtml(formatRelative(notification.createdAt)) +
                            "</span>" +
                            project +
                            markBtn +
                            "</div></div></div>"
                        );
                    })
                    .join("") +
                '<div class="topbar-panel-footer">' +
                '<a href="notifications.html">View all notifications</a></div>';

            parts.body.querySelectorAll("[data-read]").forEach((button) => {
                button.addEventListener("click", async (event) => {
                    event.stopPropagation();
                    button.disabled = true;

                    try {
                        await api.put(
                            "/api/notifications/" + button.dataset.read + "/read"
                        );
                        await load();
                    } catch (err) {
                        console.error(err);
                        showToast(err.message);
                        button.disabled = false;
                    }
                });
            });
        }

        async function load() {
            try {
                // Server scopes this to the session user
                const response = await api.get("/api/notifications");
                const notifications = response.notifications || [];

                paintUnreadDot(
                    notifications.filter((n) => !n.isRead).length
                );

                render(notifications);
            } catch (err) {
                console.error("Notifications panel error:", err);
                panelMessage(parts.body, "Unable to load notifications.");
            }
        }

        if (markAllBtn) {
            markAllBtn.addEventListener("click", async (event) => {
                event.stopPropagation();
                markAllBtn.disabled = true;

                try {
                    await api.put("/api/notifications/read-all");
                    await load();
                    showToast("All notifications marked as read.");
                } catch (err) {
                    console.error(err);
                    showToast(err.message);
                    markAllBtn.disabled = false;
                }
            });
        }

        registerDropdown({
            trigger: parts.button,
            wrap: parts.wrap,
            panel: parts.panel,
            onOpen: load
        });

        // Prime the unread dot without opening the panel
        load();
    }

    /* ---------- Sidebar user card ---------- */

    /**
     * The whole card navigates to the profile page, matching the topbar
     * avatar's View Profile action. Defined once here rather than per page.
     */
    function bindSidebarUser() {
        const card = document.querySelector(".sidebar-user");

        if (!card || !isValidUser(user)) return;

        card.setAttribute("role", "link");
        card.setAttribute("tabindex", "0");
        card.setAttribute("title", "View my profile");

        function go() {
            window.location.href = "profile.html";
        }

        card.addEventListener("click", go);

        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                go();
            }
        });
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

    populateAllCommitteeSelects();
    buildAvatarMenu();
    buildNotificationsPanel();
    buildCalendarPanel();
    bindSidebarUser();

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
        notificationCategory,
        notificationPresentation,
        notificationIcon,
        daysUntil,
        deadlineGroupLabel,
        badgeClass,
        statusClass,
        priorityClass,
        renderNotice,
        renderTableNotice,

        // constants
        COMMITTEE_OPTIONS,
        COMMITTEE_VALUES,
        COMMITTEE_NAMES,
        POSITIONS,
        populateCommitteeSelect,
        populateAllCommitteeSelects,

        // search & filter
        debounce,
        buildQueryString,
        createFilterController,
        populateSelect,
        emptyResultMessage,
        showToast,

        // network
        api
    };

    // Backwards-compatible globals used by existing page scripts
    window.logout = logout;
    window.showToast = showToast;
    window.currentUser = user;

})();
