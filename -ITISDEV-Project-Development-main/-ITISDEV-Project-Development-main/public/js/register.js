const form = document.getElementById('registerForm');
const message = document.getElementById('message');

form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const committee = document.getElementById('committee').value;
    const position = document.getElementById('position').value;
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Frontend validation
    if (!name || !committee || !position || !email || !password) {
        showMessage('Please complete all required fields.', 'error');
        return;
    }

    const dlsuPattern = /^[a-zA-Z0-9._%+-]+@dlsu\.edu\.ph$/;

    if (!dlsuPattern.test(email)) {
        showMessage('Please use a valid DLSU email address.', 'error');
        return;
    }

    try {

        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                committee,
                position,
                email,
                password
            })
        });

        const data = await response.json();

        if (response.ok) {

            showMessage(data.message, 'success');

            form.reset();

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);

        } else {

            showMessage(data.message, 'error');

        }

    } catch (error) {

        console.error(error);

        showMessage(
            'Unable to connect to the server.',
            'error'
        );

    }

});

function showMessage(text, type) {

    message.className = 'message ' + type;
    message.style.display = 'block';
    message.textContent = text;

}