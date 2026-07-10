const map = {
    Pending: "status-pending",
    Ongoing: "status-ongoing",
    "For Review": "status-review",
    "Waiting for Approval": "status-approval",
    Completed: "status-completed"
};

const toast = document.getElementById("toast");

// Update project status
document.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", () => {
        const row = select.closest("tr");
        const badge = row.querySelector(".badge");

        badge.className = `badge ${map[select.value]}`;
        badge.innerHTML = `<span class="dot"></span>${select.value}`;

        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 2400);
    });
});

// Refresh button
document.getElementById("refreshBtn").onclick = () => {
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
};