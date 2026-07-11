const taskForm = document.getElementById('taskForm');
const projectSelect = document.getElementById('taskProject');

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Unable to load projects.'
            );
        }

        const projects = data.projects || data;

        projectSelect.innerHTML =
            '<option value="">Select project</option>';

        projects.forEach((project) => {
            const option = document.createElement('option');

            option.value = project._id;
            option.textContent =
                project.projectName ||
                project.title ||
                'Unnamed Project';

            projectSelect.appendChild(option);
        });
    } catch (error) {
        console.error(error);
        showToast(error.message);
    }
}

async function loadMembers() {
    try {
        const response = await fetch('/auth/users');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Unable to load members.'
            );
        }

        const membersContainer =
            document.querySelector('.member-checks');

        membersContainer.innerHTML = '';

        const users = data.users || data;

        users.forEach((user) => {
            const label = document.createElement('label');
            label.className = 'member-check';

            label.innerHTML = `
                <input
                    type="checkbox"
                    name="assignedMembers"
                    value="${user._id}"
                >
                <span>${user.name}</span>
            `;

            membersContainer.appendChild(label);
        });
    } catch (error) {
        console.error(error);
        showToast(error.message);
    }
}

taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const assignedMembers = [
        ...document.querySelectorAll(
            'input[name="assignedMembers"]:checked'
        )
    ].map((checkbox) => checkbox.value);

    if (assignedMembers.length === 0) {
        showToast('Please assign at least one member.');
        return;
    }

    const payload = {
        project: projectSelect.value,
        title: document
            .getElementById('taskTitle')
            .value.trim(),
        description: document
            .getElementById('taskDescription')
            .value.trim(),
        deadline: document
            .getElementById('taskDeadline')
            .value,
        priority: document
            .getElementById('taskPriority')
            .value,
        assignedMembers
    };

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Unable to assign task.'
            );
        }

        showToast(data.message);
        taskForm.reset();
        loadTaskRecords();
    } catch (error) {
        console.error(error);
        showToast(error.message);
    }
});

async function loadTaskRecords() {
    try {
        const response = await fetch('/api/tasks');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Unable to load tasks.'
            );
        }

        console.log(data.tasks);
    } catch (error) {
        console.error(error);
    }
}

loadProjects();
loadMembers();
loadTaskRecords();
