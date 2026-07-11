"use strict";

/* ==========================================================
   IMC Rollout & Project Tracking System
   Common JavaScript
   Shared across authenticated pages
========================================================== */

/* ---------- Helpers ---------- */

function getUser() {
    return JSON.parse(localStorage.getItem("user") || "null");
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}

function generateInitials(name = "") {
    return name
        .trim()
        .split(/\s+/)
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
}

/* ---------- Authentication ---------- */

const user = getUser();

if (!user) {
    window.location.href = "login.html";
}

/* ---------- User Information ---------- */

const initials = generateInitials(user.name);

setText("username", user.name);

setText("sidebarUsername", user.name);
setText(
    "sidebarRole",
    `${user.position} • ${user.committee}`
);

setText("workloadUsername", user.name);

setText("sidebarAvatar", initials);
setText("topbarAvatar", initials);
setText("workloadAvatar", initials);

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

    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );
}

/* ---------- Toast ---------- */

let toastTimer;

function showToast(message) {

    const toast =
        document.getElementById("toast");

    if (!toast) return;

    const msg =
        document.getElementById("toastMsg");

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

/* ---------- Logout ---------- */

function logout() {

    localStorage.removeItem("user");

    window.location.href = "login.html";

}

window.logout = logout;
window.showToast = showToast;
window.currentUser = user;