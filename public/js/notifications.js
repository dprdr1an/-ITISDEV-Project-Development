"use strict";

/* ==========================================================
   Notifications & Reminders
   Loads the signed-in user's notifications from the API,
   supports filtering, and persists read state.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        formatRelative,
        formatDateTime,
        renderNotice,
        showToast,
        notificationCategory,
        notificationPresentation,
        notificationIcon
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    /* ---------- Type mapping ---------- */

    // Type/category/icon mapping now lives in common.js so this page and the
    // topbar notifications panel cannot drift apart.
    function categoryOf(notification) {
        return notificationCategory(notification.type);
    }

    function styleOf(category) {
        // The page uses the category name as an icon modifier class
        return Object.assign(
            { icon: category },
            notificationPresentation(CATEGORY_TYPE_SAMPLE[category])
        );
    }

    // Reverse lookup so styleOf(category) can reuse the shared presentation
    const CATEGORY_TYPE_SAMPLE = {
        deadline: "DEADLINE_REMINDER",
        overdue: "TASK_OVERDUE",
        update: "PROJECT_STATUS_CHANGED",
        approval: "PROJECT_APPROVED"
    };

    /* ---------- State ---------- */

    let notifications = [];
    let activeFilter = "all";

    /* ---------- Notification cards ---------- */

    function renderCards() {
        const list = document.getElementById("notifList");
        if (!list) return;

        const visible =
            activeFilter === "all"
                ? notifications
                : notifications.filter(
                      (n) => categoryOf(n) === activeFilter
                  );

        if (!visible.length) {
            renderNotice(
                list,
                notifications.length
                    ? "No notifications in this category."
                    : "You have no notifications yet."
            );
            return;
        }

        list.innerHTML = visible
            .map((notification) => {
                const category = categoryOf(notification);
                const style = styleOf(category);

                const actions = notification.isRead
                    ? ""
                    : '<div class="notif-actions">' +
                      '<button class="mini-btn" data-read="' +
                      escapeHtml(notification._id) +
                      '">Mark as Read</button>' +
                      "</div>";

                return (
                    '<article class="notif-card' +
                    (notification.isRead ? "" : " unread") +
                    '" data-type="' +
                    category +
                    '">' +
                    '<div class="notif-icon ' +
                    style.icon +
                    '"><svg viewBox="0 0 24 24">' +
                    notificationIcon(CATEGORY_TYPE_SAMPLE[style.icon]) +
                    "</svg></div>" +
                    '<div class="notif-body">' +
                    '<div class="notif-title">' +
                    escapeHtml(notification.title) +
                    "</div>" +
                    '<div class="notif-message">' +
                    escapeHtml(notification.message) +
                    "</div>" +
                    '<div class="notif-meta">' +
                    '<span><span class="status-dot" style="background:' +
                    style.color +
                    '"></span>' +
                    escapeHtml(style.label) +
                    "</span>" +
                    "<span>" +
                    escapeHtml(formatRelative(notification.createdAt)) +
                    "</span>" +
                    "</div>" +
                    actions +
                    "</div></article>"
                );
            })
            .join("");

        bindCardActions();
    }

    function bindCardActions() {
        document.querySelectorAll("[data-read]").forEach((button) => {
            button.addEventListener("click", async () => {
                const id = button.dataset.read;

                button.disabled = true;

                try {
                    await api.put("/api/notifications/" + id + "/read");

                    const record = notifications.find(
                        (n) => String(n._id) === String(id)
                    );

                    if (record) {
                        record.isRead = true;
                        record.readAt = new Date().toISOString();
                    }

                    renderCards();
                    renderHistory();

                    showToast("Notification marked as read.");
                } catch (err) {
                    console.error(err);
                    showToast(err.message);
                    button.disabled = false;
                }
            });
        });
    }

    /* ---------- History ---------- */

    function renderHistory() {
        const list = document.getElementById("historyList");
        if (!list) return;

        if (!notifications.length) {
            renderNotice(list, "No notification history yet.");
            return;
        }

        list.innerHTML = notifications
            .slice(0, 8)
            .map((notification) => {
                const style = styleOf(categoryOf(notification));

                return (
                    '<div class="history-row">' +
                    '<div class="history-time">' +
                    escapeHtml(formatDateTime(notification.createdAt)) +
                    "</div>" +
                    "<div>" +
                    '<div class="history-label">' +
                    escapeHtml(notification.title) +
                    "</div>" +
                    '<div class="file-meta">' +
                    escapeHtml(notification.message) +
                    "</div>" +
                    "</div>" +
                    '<span class="badge ' +
                    style.badge +
                    '">' +
                    escapeHtml(style.label) +
                    "</span>" +
                    "</div>"
                );
            })
            .join("");
    }

    /* ---------- Upcoming reminders ---------- */

    async function renderReminders() {
        const list = document.getElementById("remindersList");
        if (!list) return;

        try {
            const response = await api.get(
                "/api/tasks?member=" + encodeURIComponent(user.id)
            );

            const now = new Date();

            const upcoming = (response.tasks || [])
                .filter(
                    (task) =>
                        task.status !== "Completed" &&
                        task.deadline &&
                        new Date(task.deadline) >= now
                )
                .sort(
                    (a, b) => new Date(a.deadline) - new Date(b.deadline)
                )
                .slice(0, 5);

            if (!upcoming.length) {
                renderNotice(list, "No upcoming deadlines.");
                return;
            }

            list.innerHTML = upcoming
                .map((task) => {
                    const date = new Date(task.deadline);

                    const day = date.toLocaleDateString("en-US", {
                        day: "2-digit"
                    });
                    const month = date.toLocaleDateString("en-US", {
                        month: "short"
                    });

                    const projectName =
                        (task.project && task.project.projectName) ||
                        "Unassigned project";

                    const time = date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit"
                    });

                    return (
                        '<div class="reminder-item">' +
                        '<div class="reminder-date">' +
                        "<strong>" +
                        escapeHtml(day) +
                        "</strong><span>" +
                        escapeHtml(month) +
                        "</span></div>" +
                        "<div>" +
                        '<div class="reminder-title">' +
                        escapeHtml(task.title) +
                        "</div>" +
                        '<div class="reminder-sub">' +
                        escapeHtml(projectName) +
                        " · " +
                        escapeHtml(time) +
                        "</div>" +
                        "</div></div>"
                    );
                })
                .join("");
        } catch (err) {
            console.error(err);
            renderNotice(list, "Unable to load reminders.");
        }
    }

    /* ---------- Filters ---------- */

    document.querySelectorAll(".filter-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            document
                .querySelectorAll(".filter-pill")
                .forEach((p) => p.classList.remove("active"));

            pill.classList.add("active");

            activeFilter = pill.dataset.filter;

            renderCards();
        });
    });

    /* ---------- Mark all as read ---------- */

    const markAllBtn = document.getElementById("markAllBtn");

    if (markAllBtn) {
        markAllBtn.addEventListener("click", async () => {
            const unread = notifications.filter((n) => !n.isRead);

            if (!unread.length) {
                showToast("No unread notifications.");
                return;
            }

            markAllBtn.disabled = true;

            try {
                await api.put("/api/notifications/read-all");

                notifications.forEach((n) => {
                    n.isRead = true;
                });

                renderCards();
                renderHistory();

                showToast("All notifications marked as read.");
            } catch (err) {
                console.error(err);
                showToast(err.message);
            } finally {
                markAllBtn.disabled = false;
            }
        });
    }

    /* ---------- Load ---------- */

    async function load() {
        try {
            // Scoped server-side to the signed-in user
            const response = await api.get("/api/notifications");

            notifications = response.notifications || [];

            renderCards();
            renderHistory();
        } catch (err) {
            console.error(err);

            renderNotice("notifList", "Unable to load notifications.");
            renderNotice("historyList", "Unable to load history.");

            showToast(err.message);
        }
    }

    load();
    renderReminders();

})();
