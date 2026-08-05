"use strict";

/* ==========================================================
   File Upload & Repository
   Uploads through /api/files/upload (multipart) and lists
   stored files from the API.
========================================================== */

(function () {

    const {
        api,
        escapeHtml,
        formatShortDate,
        renderNotice,
        renderTableNotice,
        showToast,
        buildQueryString,
        createFilterController,
        populateSelect,
        emptyResultMessage
    } = window.IMC;

    const user = window.currentUser;

    if (!user) return;

    const drop = document.getElementById("fileDrop");
    const input = document.getElementById("fileInput");
    const queue = document.getElementById("uploadList");
    const uploadForm = document.getElementById("uploadForm");
    const projectSelect = document.getElementById("uploadProject");
    const categorySelect = document.getElementById("uploadCategory");
    const folderInput = document.getElementById("uploadFolder");
    const projectFilter = document.getElementById("projectFilter");
    const filesBody = document.getElementById("filesBody");

    // Files chosen in this session but not yet sent
    let pending = [];

    /* ---------- Icons ---------- */

    const ICONS = {
        image:
            '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
            '<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        slides:
            '<rect x="2" y="3" width="20" height="14" rx="2"/>' +
            '<line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
        doc:
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
            '<line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
    };

    function iconFor(mimeType) {
        if (!mimeType) return ICONS.doc;
        if (mimeType.startsWith("image/")) return ICONS.image;
        if (mimeType.includes("presentation")) return ICONS.slides;
        return ICONS.doc;
    }

    // Badge classes already defined in the stylesheet
    const CATEGORY_BADGE = {
        Pubmat: "badge-pubmat",
        Photo: "badge-photo",
        Caption: "badge-doc",
        Presentation: "badge-preso",
        Document: "badge-doc",
        Other: "badge-doc"
    };

    function formatSize(bytes) {
        if (!bytes && bytes !== 0) return "—";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
        return (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    function extensionOf(name) {
        const parts = String(name || "").split(".");
        return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
    }

    /* ---------- Projects ---------- */

    async function loadProjects() {
        try {
            const response = await api.get("/api/projects");
            const projects = response.data || [];

            [projectSelect, projectFilter].forEach((select) => {
                if (!select) return;

                const isFilter = select === projectFilter;

                select.innerHTML = isFilter
                    ? '<option value="">All projects</option>'
                    : '<option value="">Link file to project</option>';

                projects.forEach((project) => {
                    const option = document.createElement("option");
                    option.value = project._id;
                    option.textContent =
                        project.projectName || "Unnamed Project";
                    select.appendChild(option);
                });
            });
        } catch (err) {
            console.error(err);
            showToast(err.message);
        }
    }

    /* ---------- Upload queue ---------- */

    function renderQueue() {
        if (!queue) return;

        if (!pending.length) {
            renderNotice(
                queue,
                "No files selected yet. Uploaded files will be linked to the selected project and saved in the repository."
            );
            return;
        }

        queue.innerHTML = pending
            .map(
                (file) =>
                    '<div class="upload-item">' +
                    '<div class="file-icon-small"><svg viewBox="0 0 24 24">' +
                    iconFor(file.type) +
                    "</svg></div>" +
                    '<div class="upload-item-info">' +
                    '<div class="file-title">' +
                    escapeHtml(file.name) +
                    "</div>" +
                    '<div class="file-meta">' +
                    escapeHtml(formatSize(file.size)) +
                    " · Ready to upload</div>" +
                    '<div class="progress-track">' +
                    '<div class="progress-fill" style="width:0%;"></div>' +
                    "</div></div></div>"
            )
            .join("");
    }

    function addFiles(fileList) {
        if (!fileList || !fileList.length) return;

        pending = pending.concat([...fileList]);
        renderQueue();
    }

    if (drop && input) {
        drop.addEventListener("click", () => input.click());

        drop.addEventListener("dragover", (event) => {
            event.preventDefault();
            drop.classList.add("dragover");
        });

        drop.addEventListener("dragleave", () => {
            drop.classList.remove("dragover");
        });

        drop.addEventListener("drop", (event) => {
            event.preventDefault();
            drop.classList.remove("dragover");
            addFiles(event.dataTransfer.files);
        });

        input.addEventListener("change", () => addFiles(input.files));
    }

    /* ---------- Upload submit ---------- */

    if (uploadForm) {
        uploadForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!projectSelect || !projectSelect.value) {
                showToast("Please select a project to link these files to.");
                return;
            }

            if (!categorySelect || !categorySelect.value) {
                showToast("Please select a file category.");
                return;
            }

            if (!pending.length) {
                showToast("Please choose at least one file.");
                return;
            }

            const bars = queue
                ? queue.querySelectorAll(".progress-fill")
                : [];

            let uploaded = 0;
            const failures = [];

            // The endpoint takes one file per request
            for (let i = 0; i < pending.length; i += 1) {
                const file = pending[i];

                const formData = new FormData();
                formData.append("file", file);
                formData.append("project", projectSelect.value);
                formData.append("category", categorySelect.value);
                formData.append(
                    "folder",
                    (folderInput && folderInput.value.trim()) || "General"
                );
                formData.append("uploadedBy", user.id);

                try {
                    await api.upload("/api/files/upload", formData);

                    uploaded += 1;

                    if (bars[i]) bars[i].style.width = "100%";
                } catch (err) {
                    console.error(err);
                    failures.push(file.name + ": " + err.message);

                    if (bars[i]) {
                        bars[i].style.width = "100%";
                        bars[i].style.background = "var(--red)";
                    }
                }
            }

            if (uploaded) {
                pending = [];
                renderQueue();
                uploadForm.reset();
                await loadFiles();
            }

            if (failures.length) {
                showToast(failures[0]);
            } else {
                showToast(
                    uploaded === 1
                        ? "File uploaded successfully."
                        : uploaded + " files uploaded successfully."
                );
            }
        });
    }

    /* ---------- Stored files ---------- */

    function renderFolderCounts(counts) {
        const map = {
            folderCountPubmat: counts.Pubmat || 0,
            folderCountPhoto: counts.Photo || 0,
            folderCountCaption: counts.Caption || 0,
            folderCountPresentation: counts.Presentation || 0,
            folderCountDocument: counts.Document || 0,
            folderCountOther: counts.Other || 0
        };

        Object.keys(map).forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;

            el.textContent =
                map[id] === 1 ? "1 file" : map[id] + " files";
        });
    }

    function renderFiles(files) {
        if (!filesBody) return;

        if (!files.length) {
            renderTableNotice(
                filesBody,
                "No files stored yet. Upload a file to get started.",
                5
            );
            return;
        }

        filesBody.innerHTML = files
            .map((file) => {
                const badge =
                    CATEGORY_BADGE[file.category] || "badge-doc";

                const projectName =
                    (file.project && file.project.projectName) ||
                    "Unlinked";

                const uploader =
                    (file.uploadedBy && file.uploadedBy.name) || "—";

                return (
                    "<tr>" +
                    "<td>" +
                    '<div class="file-name-cell">' +
                    '<div class="file-icon-small"><svg viewBox="0 0 24 24">' +
                    iconFor(file.mimeType) +
                    "</svg></div>" +
                    "<div>" +
                    '<div class="file-title">' +
                    escapeHtml(file.originalName) +
                    "</div>" +
                    '<div class="file-meta">' +
                    escapeHtml(extensionOf(file.originalName)) +
                    " · " +
                    escapeHtml(formatSize(file.size)) +
                    " · uploaded " +
                    escapeHtml(formatShortDate(file.createdAt)) +
                    "</div>" +
                    "</div></div></td>" +
                    "<td>" +
                    escapeHtml(projectName) +
                    "</td>" +
                    '<td><span class="badge ' +
                    badge +
                    '">' +
                    escapeHtml(file.category) +
                    "</span></td>" +
                    "<td>" +
                    escapeHtml(uploader) +
                    "</td>" +
                    "<td>" +
                    '<div class="quick-actions">' +
                    '<a class="action-link" href="/api/files/download/' +
                    escapeHtml(file._id) +
                    '">Download</a>' +
                    '<button class="action-link" data-delete="' +
                    escapeHtml(file._id) +
                    '">Delete</button>' +
                    "</div></td>" +
                    "</tr>"
                );
            })
            .join("");

        bindFileActions();
    }

    function bindFileActions() {
        document.querySelectorAll("[data-delete]").forEach((button) => {
            button.addEventListener("click", async () => {
                const id = button.dataset.delete;

                if (!window.confirm("Delete this file permanently?")) {
                    return;
                }

                button.disabled = true;

                try {
                    await api.del("/api/files/" + id);
                    showToast("File deleted.");
                    await loadFiles();
                } catch (err) {
                    console.error(err);
                    showToast(err.message);
                    button.disabled = false;
                }
            });
        });
    }

    /* ---------- Search & Filter ---------- */

    const categoryFilter = document.getElementById("categoryFilter");

    // Declared before loadFiles() reads it, so the reference is never
    // evaluated in the temporal dead zone.
    let fileFilters = null;

    async function loadFiles(params) {
        if (!filesBody) return;

        try {
            const query = params ||
                (fileFilters ? fileFilters.params() : {});

            const response = await api.get(
                "/api/files" + buildQueryString(query)
            );

            const files = response.files || [];

            if (!files.length) {
                renderTableNotice(
                    filesBody,
                    emptyResultMessage(
                        fileFilters && fileFilters.isFiltering(),
                        "No files stored yet. Upload a file to get started."
                    ),
                    5
                );
            } else {
                renderFiles(files);
            }

            // Folder tallies stay global so they describe the repository,
            // not the current view.
            renderFolderCounts(response.categoryCounts || {});
            syncFolderCards();
        } catch (err) {
            console.error(err);
            renderTableNotice(filesBody, "Unable to load files.", 5);
            showToast(err.message);
        }
    }

    fileFilters = createFilterController({
        controls: {
            search:   { id: "fileSearch", debounce: true },
            project:  { id: "projectFilter" },
            category: { id: "categoryFilter" }
        },
        clearButtonId: "clearFileFilters",
        onChange: loadFiles
    });

    /** Keeps the folder cards visually in step with the category select. */
    function syncFolderCards() {
        const active = categoryFilter ? categoryFilter.value : "";

        document.querySelectorAll(".folder-card[data-category]").forEach(
            (card) =>
                card.classList.toggle(
                    "active",
                    Boolean(active) && card.dataset.category === active
                )
        );
    }

    // Folder cards remain a shortcut for the category filter; clicking the
    // active one clears it. They drive the same select rather than a second
    // piece of state.
    document.querySelectorAll(".folder-card[data-category]").forEach((card) => {
        card.addEventListener("click", () => {
            if (!categoryFilter) return;

            const category = card.dataset.category;

            categoryFilter.value =
                categoryFilter.value === category ? "" : category;

            fileFilters.refresh();

            showToast(
                categoryFilter.value
                    ? "Showing " + categoryFilter.value + " files."
                    : "Showing all files."
            );
        });
    });

    /* ---------- Init ---------- */

    populateSelect(
        "categoryFilter",
        Object.keys(CATEGORY_BADGE),
        "All categories"
    );

    renderQueue();
    loadProjects().then(() => loadFiles());

})();
