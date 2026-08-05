"use strict";

/* ==========================================================
   Spark an Idea — AI Project Planning Assistant

   Assists the existing Project Request workflow: it drafts a proposal,
   the officer reviews it, and only on "Use Suggestion" does it populate
   the form. Nothing is ever submitted automatically.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        showToast,
        COMMITTEE_VALUES
    } = window.IMC;

    if (!window.currentUser) return;

    const modal = document.getElementById("aiModal");
    const sparkBtn = document.getElementById("sparkIdeaBtn");

    if (!modal || !sparkBtn) return;

    const briefForm = document.getElementById("aiBriefForm");
    const loading = document.getElementById("aiLoading");
    const preview = document.getElementById("aiPreview");
    const errorBox = document.getElementById("aiError");

    const generateBtn = document.getElementById("aiGenerateBtn");
    const regenerateBtn = document.getElementById("aiRegenerateBtn");
    const useBtn = document.getElementById("aiUseBtn");
    const cancelBtn = document.getElementById("aiCancelBtn");
    const closeBtn = document.getElementById("aiCloseBtn");

    // Last successful proposal, held for "Use Suggestion"
    let proposal = null;
    let busy = false;

    /* ---------- View state ---------- */

    function show(el, visible) {
        if (el) el.hidden = !visible;
    }

    /**
     * Three states: the brief, generating, and the preview.
     * Controls are disabled while generating so nothing races.
     */
    function setState(state) {
        show(briefForm, state === "brief");
        show(loading, state === "loading");
        show(preview, state === "preview");
        show(errorBox, state === "error");

        show(generateBtn, state === "brief" || state === "error");
        show(regenerateBtn, state === "preview");
        show(useBtn, state === "preview");

        busy = state === "loading";

        [generateBtn, regenerateBtn, useBtn, cancelBtn, closeBtn].forEach(
            (btn) => {
                if (btn) btn.disabled = busy;
            }
        );

        briefForm.querySelectorAll("input, select, textarea").forEach((el) => {
            el.disabled = busy;
        });
    }

    function openModal() {
        modal.hidden = false;
        proposal = null;
        setState("brief");

        const first = document.getElementById("aiProjectType");
        if (first) first.focus();
    }

    function closeModal() {
        if (busy) return;

        modal.hidden = true;
        proposal = null;
    }

    /* ---------- Brief ---------- */

    function readBrief() {
        return {
            projectType: document.getElementById("aiProjectType").value.trim(),
            targetParticipants:
                document.getElementById("aiParticipants").value.trim(),
            studentProblem: document.getElementById("aiProblem").value.trim(),
            goal: document.getElementById("aiGoal").value.trim(),
            estimatedParticipants:
                document.getElementById("aiScale").value.trim(),
            budget: document.getElementById("aiBudget").value.trim(),
            additionalNotes: document.getElementById("aiNotes").value.trim()
        };
    }

    /* ---------- Preview ---------- */

    function listSection(label, items) {
        const values = (items || []).filter(Boolean);

        if (!values.length) return "";

        return (
            '<div class="ai-section">' +
            '<div class="ai-section-label">' + escapeHtml(label) + "</div>" +
            '<div class="ai-section-body"><ul>' +
            values
                .map((item) => "<li>" + escapeHtml(item) + "</li>")
                .join("") +
            "</ul></div></div>"
        );
    }

    function textSection(label, value) {
        if (!value) return "";

        return (
            '<div class="ai-section">' +
            '<div class="ai-section-label">' + escapeHtml(label) + "</div>" +
            '<div class="ai-section-body">' + escapeHtml(value) + "</div>" +
            "</div>"
        );
    }

    function renderPreview(data) {
        const committees = (data.recommendedCommittees || [])
            .map(
                (entry) =>
                    '<div class="ai-committee">' +
                    "<strong>" + escapeHtml(entry.committee) + "</strong>" +
                    "<span>" + escapeHtml(entry.reason) + "</span>" +
                    "</div>"
            )
            .join("");

        preview.innerHTML =
            '<div class="ai-preview-title">' +
            escapeHtml(data.projectTitle || "Untitled project") +
            "</div>" +
            '<div class="ai-preview-pitch">' +
            escapeHtml(data.elevatorPitch || "") +
            "</div>" +
            textSection("Project Description", data.projectDescription) +
            textSection("Student Problem Being Addressed", data.studentProblem) +
            listSection("Objectives", data.objectives) +
            textSection("Target Participants", data.targetParticipants) +
            (committees
                ? '<div class="ai-section">' +
                  '<div class="ai-section-label">Recommended Committees</div>' +
                  committees +
                  "</div>"
                : "") +
            textSection("Suggested Timeline", data.suggestedTimeline) +
            textSection("Estimated Scale", data.estimatedScale) +
            listSection("Suggested Deliverables", data.suggestedDeliverables) +
            listSection("Suggested Rollout Materials", data.suggestedRolloutMaterials) +
            listSection("Potential Risks", data.potentialRisks) +
            listSection("Success Metrics", data.successMetrics) +
            textSection("Why This Fits CATCH2T28", data.whyItFits);
    }

    /* ---------- Generation ---------- */

    async function generate() {
        const brief = readBrief();

        const missing = [
            ["projectType", "project type"],
            ["targetParticipants", "target participants"],
            ["studentProblem", "student problem"],
            ["goal", "goal"]
        ].filter(([key]) => !brief[key]);

        if (missing.length) {
            showToast("Please fill in the " + missing[0][1] + ".");
            setState("brief");
            return;
        }

        setState("loading");

        try {
            const response = await api.post("/api/ai/project-proposal", brief);

            proposal = response.data;

            renderPreview(proposal);
            setState("preview");
        } catch (err) {
            console.error(err);

            errorBox.textContent =
                err.message ||
                "Something went wrong generating the proposal. Please try again.";

            setState("error");
        }
    }

    /* ---------- Form population ---------- */

    /** True when the officer has already typed something worth protecting. */
    function formHasContent() {
        const name = document.getElementById("projName");
        const desc = document.getElementById("projDesc");
        const committee = document.getElementById("projCommittee");

        if (name && name.value.trim()) return true;
        if (desc && desc.value.trim()) return true;
        if (committee && committee.value) return true;

        const notes = document.querySelectorAll(".form-col textarea");

        return Array.prototype.some.call(
            notes,
            (el) => el.value && el.value.trim()
        );
    }

    /** Maps a recommended committee onto an official dropdown value. */
    function matchCommittee(name) {
        const input = String(name || "").trim().toLowerCase();

        if (!input) return "";

        const exact = COMMITTEE_VALUES.find(
            (value) => value.toLowerCase() === input
        );

        if (exact) return exact;

        // "Creatives" → "Integrated Marketing Communications (IMC) — Creatives"
        const bySub = COMMITTEE_VALUES.filter((value) => {
            const parts = value.split("—");
            const leaf = (parts[parts.length - 1] || "").trim().toLowerCase();
            return leaf === input;
        });

        if (bySub.length === 1) return bySub[0];

        // Parent name given, e.g. "Documentation"
        const byParent = COMMITTEE_VALUES.filter(
            (value) => value.toLowerCase().indexOf(input) === 0
        );

        return byParent.length ? byParent[0] : "";
    }

    /**
     * Fires an event resolved from the element's own document rather than a
     * bare global, so this works regardless of the executing realm.
     */
    function notify(el, type) {
        const view = el.ownerDocument && el.ownerDocument.defaultView;
        const Ctor = (view && view.Event) || Event;

        el.dispatchEvent(new Ctor(type, { bubbles: true }));
    }

    function setValue(id, value) {
        const el = document.getElementById(id);

        if (el && value) {
            el.value = value;
            // Keep the page's own counters and progress bar in step
            notify(el, "input");
            notify(el, "change");
        }
    }

    function populateForm(data) {
        setValue("projName", data.projectTitle);

        // Description carries the pitch plus the drafted description
        const description = [data.elevatorPitch, data.projectDescription]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 500);

        setValue("projDesc", description);

        // First recommended committee that maps to an official value
        const recommended = (data.recommendedCommittees || [])
            .map((entry) => matchCommittee(entry.committee))
            .filter(Boolean);

        if (recommended.length) {
            setValue("projCommittee", recommended[0]);
        }

        // Key messages textarea (second textarea in the form columns)
        const textareas = document.querySelectorAll(".form-col textarea");

        if (textareas[1]) {
            textareas[1].value = (data.objectives || []).join("\n");
            notify(textareas[1], "input");
        }

        // Additional notes: the context that has no dedicated field
        if (textareas.length > 2) {
            const notes = textareas[textareas.length - 1];

            const extras = [
                data.studentProblem
                    ? "Student problem: " + data.studentProblem
                    : "",
                data.targetParticipants
                    ? "Target participants: " + data.targetParticipants
                    : "",
                data.suggestedTimeline
                    ? "Suggested timeline: " + data.suggestedTimeline
                    : "",
                data.estimatedScale
                    ? "Estimated scale: " + data.estimatedScale
                    : "",
                (data.successMetrics || []).length
                    ? "Success metrics: " + data.successMetrics.join("; ")
                    : "",
                (data.potentialRisks || []).length
                    ? "Risks: " + data.potentialRisks.join("; ")
                    : ""
            ].filter(Boolean);

            notes.value = extras.join("\n");
            notify(notes, "input");
        }

        // Deliverables — reuse the page's own row markup rather than
        // redefining it here. Prefer the page's builder; fall back to
        // cloning an existing row so this never depends on a global.
        const rows = document.getElementById("deliverableRows");
        const deliverables = (data.suggestedDeliverables || []).slice(0, 8);

        if (rows && deliverables.length) {
            const template = rows.querySelector(".deliverable-row");
            const canBuild = typeof window.addDeliverable === "function";

            if (canBuild || template) {
                const blank = template ? template.cloneNode(true) : null;

                rows.innerHTML = "";

                deliverables.forEach((item) => {
                    if (canBuild) {
                        window.addDeliverable();
                    } else {
                        const clone = blank.cloneNode(true);
                        const select = clone.querySelector("select");

                        if (select) select.selectedIndex = 0;

                        rows.appendChild(clone);
                    }

                    const row = rows.lastElementChild;
                    const input = row && row.querySelector("input");

                    if (input) {
                        input.value = item;
                        notify(input, "input");
                    }
                });
            }
        }

        if (typeof window.updateProgress === "function") {
            window.updateProgress();
        }
    }

    /* ---------- Wiring ---------- */

    sparkBtn.addEventListener("click", openModal);

    if (generateBtn) generateBtn.addEventListener("click", generate);
    if (regenerateBtn) regenerateBtn.addEventListener("click", generate);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    // Click the backdrop (not the dialog) to dismiss
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.hidden) closeModal();
    });

    if (useBtn) {
        useBtn.addEventListener("click", () => {
            if (!proposal) return;

            // Never silently overwrite work already in the form
            if (formHasContent()) {
                const replace = window.confirm(
                    "The form already has content. Replace it with the AI suggestion?"
                );

                if (!replace) return;
            }

            populateForm(proposal);
            closeModal();

            showToast("Proposal added — review and edit before submitting.");
        });
    }

    /* ---------- Availability ---------- */

    // The button only appears when the server has a Gemini key configured,
    // so officers never click into a dead feature.
    (async function checkAvailability() {
        try {
            const status = await api.get("/api/ai/status");

            if (status && status.enabled) sparkBtn.hidden = false;
        } catch (err) {
            console.error("AI status check failed:", err);
        }
    })();

})();
