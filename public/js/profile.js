"use strict";

/* ==========================================================
   Profile
   Updates the signed-in user's own record. Every successful
   save calls IMC.syncSession(), which refreshes the sidebar,
   topbar, avatar menu and dashboard greeting in place.
========================================================== */

(function () {

    const {
        api,
        setAvatar,
        formatLongDate,
        syncSession,
        showToast
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    const avatarPreview = document.getElementById("avatarPreview");
    const avatarInput = document.getElementById("avatarInput");
    const chooseAvatarBtn = document.getElementById("chooseAvatarBtn");
    const uploadAvatarBtn = document.getElementById("uploadAvatarBtn");
    const avatarHint = document.getElementById("avatarHint");

    const profileForm = document.getElementById("profileForm");
    const passwordForm = document.getElementById("passwordForm");

    let pendingAvatar = null;

    /* ---------- Populate ---------- */

    /**
     * Delegates to the shared avatar renderer in common.js so the preview,
     * sidebar, topbar and menu all use one implementation.
     */
    function renderPreview(activeUser, objectUrl) {
        if (!avatarPreview) return;

        setAvatar("avatarPreview", activeUser, objectUrl);
    }

    function populate(activeUser) {
        const firstName = document.getElementById("firstName");
        const lastName = document.getElementById("lastName");
        const email = document.getElementById("email");

        if (firstName) firstName.value = activeUser.firstName || "";
        if (lastName) lastName.value = activeUser.lastName || "";
        if (email) email.value = activeUser.email || "";

        const facts = {
            factCommittee: activeUser.committee || "—",
            factPosition: activeUser.position || "—"
        };

        Object.keys(facts).forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = facts[id];
        });

        renderPreview(activeUser);
    }

    /**
     * Pull the authoritative record so the form never shows a stale
     * localStorage copy, and so createdAt is available.
     */
    /**
     * Members links here as profile.html?user=<id>. Viewing someone else
     * shows the same page read-only — editing stays self-service, which the
     * API enforces regardless of what the UI allows.
     */
    const requestedId = new URLSearchParams(window.location.search).get("user");
    const viewingOther =
        Boolean(requestedId) && String(requestedId) !== String(user.id);

    function applyReadOnly(activeUser) {
        const heading = document.querySelector(".page-title");
        const subtitle = document.querySelector(".page-subtitle");

        if (heading) heading.textContent = activeUser.name || "Member Profile";
        if (subtitle) {
            subtitle.textContent =
                "Viewing a team member's profile. Only they can edit it.";
        }

        const crumb = document.querySelector(".breadcrumb-current");
        if (crumb) crumb.textContent = "Member Profile";

        // Hide every editing affordance; the API refuses these anyway
        ["profileForm", "passwordForm"].forEach((id) => {
            const form = document.getElementById(id);
            const card = form && form.closest(".card");
            if (card) card.remove();
        });

        const avatarActions = document.querySelector(".avatar-editor-actions");
        if (avatarActions) avatarActions.remove();

        const avatarCardSub = document.querySelector(".card-sub");
        if (avatarCardSub) avatarCardSub.textContent = "Profile picture";
    }

    async function loadProfile() {
        if (viewingOther) {
            try {
                const response = await api.get("/api/users/" + requestedId);
                const other = response.user;

                if (!other) {
                    showToast("Member not found.");
                    return;
                }

                const shaped = Object.assign({}, other, { id: other._id });

                populate(shaped);
                applyReadOnly(shaped);

                const since = document.getElementById("factSince");
                if (since) since.textContent = formatLongDate(other.createdAt);
            } catch (err) {
                console.error(err);
                showToast(err.message);
            }

            return;
        }

        populate(user);

        try {
            const response = await api.get("/api/users/" + user.id);
            const fresh = response.user;

            if (!fresh) return;

            populate(fresh);

            const since = document.getElementById("factSince");
            if (since) since.textContent = formatLongDate(fresh.createdAt);
        } catch (err) {
            console.error(err);
            showToast(err.message);
        }
    }

    /* ---------- Avatar ---------- */

    if (chooseAvatarBtn && avatarInput) {
        chooseAvatarBtn.addEventListener("click", () => avatarInput.click());

        avatarInput.addEventListener("change", () => {
            const file = avatarInput.files && avatarInput.files[0];

            if (!file) return;

            if (file.size > 2 * 1024 * 1024) {
                showToast("Image must be 2 MB or smaller.");
                avatarInput.value = "";
                return;
            }

            pendingAvatar = file;

            renderPreview(user, URL.createObjectURL(file));

            if (avatarHint) {
                avatarHint.textContent =
                    file.name + " ready to upload.";
            }

            if (uploadAvatarBtn) uploadAvatarBtn.disabled = false;
        });
    }

    if (uploadAvatarBtn) {
        uploadAvatarBtn.addEventListener("click", async () => {
            if (!pendingAvatar) return;

            const formData = new FormData();
            formData.append("avatar", pendingAvatar);

            uploadAvatarBtn.disabled = true;
            uploadAvatarBtn.textContent = "Uploading…";

            try {
                const response = await api.upload(
                    "/api/users/" + user.id + "/avatar",
                    formData
                );

                // Refreshes sidebar, topbar and avatar menu everywhere
                syncSession(response.user);

                renderPreview(response.user);

                pendingAvatar = null;
                if (avatarInput) avatarInput.value = "";
                if (avatarHint) {
                    avatarHint.textContent = "Profile picture updated.";
                }

                showToast(response.message || "Profile picture updated.");
            } catch (err) {
                console.error(err);
                showToast(err.message);
                uploadAvatarBtn.disabled = false;
            } finally {
                uploadAvatarBtn.textContent = "Upload Picture";
            }
        });
    }

    /* ---------- Account details ---------- */

    if (profileForm) {
        profileForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const saveBtn = document.getElementById("saveProfileBtn");

            const payload = {
                firstName: document.getElementById("firstName").value.trim(),
                lastName: document.getElementById("lastName").value.trim(),
                email: document.getElementById("email").value.trim()
            };

            if (!payload.firstName) {
                showToast("First name is required.");
                return;
            }

            if (!/^[^@\s]+@dlsu\.edu\.ph$/i.test(payload.email)) {
                showToast("Please enter a valid @dlsu.edu.ph email address.");
                return;
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = "Saving…";
            }

            try {
                const response = await api.put(
                    "/api/users/" + user.id + "/profile",
                    payload
                );

                syncSession(response.user);
                populate(response.user);

                showToast(response.message || "Profile updated.");
            } catch (err) {
                console.error(err);
                showToast(err.message);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "Save Changes";
                }
            }
        });
    }

    /* ---------- Password ---------- */

    if (passwordForm) {
        passwordForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const saveBtn = document.getElementById("savePasswordBtn");

            const currentPassword =
                document.getElementById("currentPassword").value;
            const newPassword = document.getElementById("newPassword").value;
            const confirmPassword =
                document.getElementById("confirmPassword").value;

            if (!currentPassword || !newPassword) {
                showToast("Please complete every password field.");
                return;
            }

            if (newPassword.length < 8) {
                showToast("New password must be at least 8 characters.");
                return;
            }

            if (newPassword !== confirmPassword) {
                showToast("New passwords do not match.");
                return;
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = "Updating…";
            }

            try {
                const response = await api.put(
                    "/api/users/" + user.id + "/password",
                    { currentPassword, newPassword }
                );

                passwordForm.reset();

                showToast(response.message || "Password changed.");
            } catch (err) {
                console.error(err);
                showToast(err.message);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "Update Password";
                }
            }
        });
    }

    loadProfile();

})();
