const drop = document.getElementById("fileDrop");
const input = document.getElementById("fileInput");
const list = document.getElementById("uploadList");
const toast = document.getElementById("toast");

// Open file picker
drop.onclick = () => input.click();

// Drag & Drop
drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
});

drop.addEventListener("dragleave", () => {
    drop.classList.remove("dragover");
});

drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    renderFiles(e.dataTransfer.files);
});

// File picker
input.addEventListener("change", () => {
    renderFiles(input.files);
});

// Display selected files
function renderFiles(files) {
    if (!files.length) return;

    list.innerHTML = "";

    [...files].forEach((file, i) => {
        const div = document.createElement("div");

        div.className = "upload-item";

        div.innerHTML = `
            <div class="file-icon-small">
                <svg viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                </svg>
            </div>

            <div class="upload-item-info">
                <div class="file-title">${file.name}</div>

                <div class="file-meta">
                    ${(file.size / 1024 / 1024).toFixed(2)} MB · Ready to upload
                </div>

                <div class="progress-track">
                    <div
                        class="progress-fill"
                        style="width:${Math.min(70 + i * 10, 100)}%;"
                    ></div>
                </div>
            </div>
        `;

        list.appendChild(div);
    });
}

// Upload form
document.getElementById("uploadForm").addEventListener("submit", (e) => {
    e.preventDefault();

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
});

// Folder cards & actions
document.querySelectorAll(".folder-card, .action-link").forEach((el) => {
    el.addEventListener("click", (e) => {
        if (el.tagName === "BUTTON") {
            e.preventDefault();
        }

        toast.textContent =
            el.textContent.trim() === "Move"
                ? "Folder/category organization opened."
                : "File repository updated.";

        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 2200);
    });
});