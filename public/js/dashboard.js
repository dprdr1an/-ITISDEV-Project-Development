const user = JSON.parse(localStorage.getItem("user") || "null");

if (!user) {
    window.location.href = "login.html";
}

// Generate user initials
const initials = user.name
    .split(" ")
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

// Greeting
const username = document.getElementById("username");
if (username) {
    username.textContent = user.name;
}

// Sidebar
const sidebarUsername = document.getElementById("sidebarUsername");
if (sidebarUsername) {
    sidebarUsername.textContent = user.name;
}

const sidebarRole = document.getElementById("sidebarRole");
if (sidebarRole) {
    sidebarRole.textContent = `${user.position} • ${user.committee}`;
}

// Sidebar Avatar
const sidebarAvatar = document.getElementById("sidebarAvatar");
if (sidebarAvatar) {
    sidebarAvatar.textContent = initials;
}

// Topbar Avatar
const topbarAvatar = document.getElementById("topbarAvatar");
if (topbarAvatar) {
    topbarAvatar.textContent = initials;
}

// Workload Section
const workloadUsername = document.getElementById("workloadUsername");
if (workloadUsername) {
    workloadUsername.textContent = user.name;
}

const workloadAvatar = document.getElementById("workloadAvatar");
if (workloadAvatar) {
    workloadAvatar.textContent = initials;
}

// Sidebar
const hamburgerBtn = document.getElementById("hamburgerBtn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
}

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
}

hamburgerBtn.addEventListener("click", () => {
    sidebar.classList.contains("open")
        ? closeSidebar()
        : openSidebar();
});

sidebarOverlay.addEventListener("click", closeSidebar);

// Task checkbox toggle
document.querySelectorAll(".task-checkbox:not(.checked)").forEach(cb => {
    cb.addEventListener("click", () => {
        cb.classList.toggle("checked");

        const nameEl = cb.closest(".task-item").querySelector(".task-name");

        if (cb.classList.contains("checked")) {
            cb.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
            nameEl.classList.add("done");
        } else {
            cb.innerHTML = "";
            nameEl.classList.remove("done");
        }
    });
});

// Animate progress bars
window.addEventListener("load", () => {
    document.querySelectorAll(
        ".progress-bar-fill, .workload-bar-fill, .mockup-bar-fill"
    ).forEach(bar => {
        const target = bar.style.width;
        bar.style.width = "0%";
        bar.style.transition = "width 1s cubic-bezier(0.4,0,0.2,1)";

        setTimeout(() => {
            bar.style.width = target;
        }, 200);
    });
});

// Navigation active state
document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", function (e) {
        if (this.getAttribute("href") === "#") {
            e.preventDefault();

            document
                .querySelectorAll(".nav-item")
                .forEach(i => i.classList.remove("active"));

            this.classList.add("active");
        }
    });
});