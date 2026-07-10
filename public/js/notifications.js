const pills = document.querySelectorAll(".filter-pill");
const cards = document.querySelectorAll(".notif-card");
const toast = document.getElementById("toast");

// Filter notifications
pills.forEach((pill) => {
    pill.onclick = () => {
        pills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");

        const filter = pill.dataset.filter;

        cards.forEach((card) => {
            card.style.display =
                filter === "all" || card.dataset.type === filter
                    ? "flex"
                    : "none";
        });
    };
});

// Mark all as read
document.getElementById("markAllBtn").onclick = () => {
    cards.forEach((card) => {
        card.classList.remove("unread");
    });

    toast.textContent = "All notifications marked as read.";
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2200);
};

// Notification action buttons
document.querySelectorAll(".mini-btn").forEach((button) => {
    button.onclick = () => {
        toast.textContent = `${button.textContent} selected.`;
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 2000);
    };
});