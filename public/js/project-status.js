const map = {
    Pending: "status-pending",
    Active: "status-active",
    "For Review": "status-review",
    "For Approval": "status-approval",
    Completed: "status-completed",
    "On Hold": "status-hold"
};

function initializeStatusListeners() {
    document.querySelectorAll(".status-select").forEach((select) => {
        select.addEventListener("change", async () => {
            const row = select.closest("tr");
            const badge = row.querySelector(".badge");
            const projectId = select.dataset.id;

            try {
                const response = await fetch(`/api/projects/${projectId}/status`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        status: select.value
                    })
                });

                if (!response.ok) {
                    throw new Error("Failed to update status");
                }

                badge.className = `badge ${map[select.value]}`;
                badge.innerHTML = `<span class="dot"></span>${select.value}`;

                showToast("Project status updated.");
            } catch (err) {
                console.error(err);
                showToast("Failed to update status.");
            }
        });
    });
}

fetch("/api/projects")
    .then(response => response.json())
    .then(result => {

        if (!result.success) {
            throw new Error("Failed to load projects");
        }

        const projects = result.data;

        const tbody = document.getElementById("projectsTableBody");

        tbody.innerHTML = projects.map(project => `
        <tr>
            <td>
                <div class="project-name">${project.projectName}</div>
                <div class="project-meta">
                    ${project.committee} · ${project.requestingHead}
                </div>
            </td>

            <td>
                <span class="badge ${map[project.status]}">
                    <span class="dot"></span>
                    ${project.status}
                </span>
            </td>

            <td>
                <select class="status-select" data-id="${project._id}">
                    <option value="Pending" ${project.status === "Pending" ? "selected" : ""}>Pending</option>
                    <option value="Active" ${project.status === "Active" ? "selected" : ""}>Active</option>
                    <option value="For Review" ${project.status === "For Review" ? "selected" : ""}>For Review</option>
                    <option value="For Approval" ${project.status === "For Approval" ? "selected" : ""}>For Approval</option>
                    <option value="Completed" ${project.status === "Completed" ? "selected" : ""}>Completed</option>
                    <option value="On Hold" ${project.status === "On Hold" ? "selected" : ""}>On Hold</option>
                </select>
            </td>

            <td>
                ${new Date(project.createdAt).toLocaleDateString()}
            </td>
        </tr>
        `).join("");

        initializeStatusListeners();
    })
    .catch(err => {
        console.error(err);
        showToast("Failed to load projects.");
    });

fetch("/api/projects")
    .then(res => res.json())
    .then(result => {
        const projects = result.data;

        const counts = {
            Pending: 0,
            Active: 0,
            "For Review": 0,
            "For Approval": 0,
            Completed: 0,
            "On Hold": 0
        };

        projects.forEach(project => {
            if (counts.hasOwnProperty(project.status)) {
                counts[project.status]++;
            }
        });

        document.getElementById("pendingCount").textContent = counts.Pending;
        document.getElementById("activeCount").textContent = counts.Active;
        document.getElementById("reviewCount").textContent = counts["For Review"];
        document.getElementById("approvalCount").textContent = counts["For Approval"];
        document.getElementById("completedCount").textContent = counts.Completed;
        document.getElementById("holdCount").textContent = counts["On Hold"];
    })
    .catch(err => console.error(err));

fetch("/api/projects")
    .then(res => res.json())
    .then(result => {
        const projects = result.data;

        const history = document.getElementById("historyList");

        history.innerHTML = projects
            .slice(0, 6)
            .map(project => `
                <div class="history-item">
                    <div class="history-dot-wrap">
                        <span class="history-dot"></span>
                        <span class="history-line"></span>
                    </div>

                    <div>
                        <div class="history-action">
                            ${project.projectName} is currently ${project.status}
                        </div>

                        <div class="history-meta">
                            ${project.requestingHead} ·
                            ${new Date(project.updatedAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `).join("");
    });

document.getElementById("refreshBtn").onclick = () => {
    location.reload();
    // showToast("Project list refreshed.");
};