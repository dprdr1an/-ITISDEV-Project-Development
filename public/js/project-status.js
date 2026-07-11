const map = {
    Pending: "status-pending",
    Ongoing: "status-ongoing",
    "For Review": "status-review",
    "Waiting for Approval": "status-approval",
    Completed: "status-completed"
};

// Update project status
document.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", () => {
        const row = select.closest("tr");
        const badge = row.querySelector(".badge");

        badge.className = `badge ${map[select.value]}`;
        badge.innerHTML = `<span class="dot"></span>${select.value}`;

        showToast("Project status updated.");
    });
});

// Refresh button
document.getElementById("refreshBtn").onclick = () => {
    showToast("Project list refreshed.");
};