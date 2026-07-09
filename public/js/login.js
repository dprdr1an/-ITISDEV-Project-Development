// js/login.js
// Handles login form submission for the IMC Rollout & Project Tracking System.
// Calls POST /auth/login, stores the returned user in localStorage,
// and redirects to the dashboard on success.

'use strict';

// ── DOM references ────────────────────────────────────────────────────────────

const loginForm  = document.getElementById('loginForm');
const submitBtn  = document.getElementById('submitBtn');
const message    = document.getElementById('message');

const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');

const emailGroup    = document.getElementById('emailGroup');
const passwordGroup = document.getElementById('passwordGroup');
const emailError    = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');

const togglePwBtn = document.getElementById('togglePw');
const iconShow    = document.getElementById('iconShow');
const iconHide    = document.getElementById('iconHide');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Display the global status banner below the submit button.
 * @param {string} text    - Message to show.
 * @param {'success'|'error'} type - Visual style.
 */
function showMessage(text, type) {
    message.textContent = text;
    message.className   = `message ${type}`;
    message.style.display = 'block';
}

/** Hide the global status banner. */
function hideMessage() {
    message.style.display = 'none';
    message.textContent   = '';
    message.className     = 'message';
}

/**
 * Mark a field group as invalid with an inline error message.
 * @param {HTMLElement} group - The .form-group wrapper element.
 * @param {HTMLElement} el    - The error <div> inside the group.
 * @param {string}      text  - Error text to display.
 */
function setFieldError(group, el, text) {
    group.classList.add('has-error');
    el.textContent = text;
}

/** Clear a single field's error state. */
function clearFieldError(group, el) {
    group.classList.remove('has-error');
    el.textContent = '';
}

/** Clear all field-level errors and the global banner. */
function clearAllErrors() {
    clearFieldError(emailGroup,    emailError);
    clearFieldError(passwordGroup, passwordError);
    hideMessage();
}

// ── Inline validation ─────────────────────────────────────────────────────────
// Mirror the backend rules so users get instant feedback.
// The backend always re-validates independently.

const DLSU_PATTERN = /^[a-zA-Z0-9._%+-]+@dlsu\.edu\.ph$/i;

/**
 * Validate the form fields before hitting the network.
 * @returns {boolean} true when all fields pass.
 */
function validateForm() {
    let valid = true;

    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
        setFieldError(emailGroup, emailError, 'DLSU email is required.');
        valid = false;
    } else if (!DLSU_PATTERN.test(email)) {
        setFieldError(emailGroup, emailError, 'Enter a valid @dlsu.edu.ph email address.');
        valid = false;
    }

    if (!password) {
        setFieldError(passwordGroup, passwordError, 'Password is required.');
        valid = false;
    }

    return valid;
}

// ── Password visibility toggle ────────────────────────────────────────────────

togglePwBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';

    passwordInput.type     = isPassword ? 'text' : 'password';
    iconShow.style.display = isPassword ? 'none'  : '';
    iconHide.style.display = isPassword ? ''      : 'none';

    togglePwBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');

    // Return focus to the input so keyboard users aren't stranded
    passwordInput.focus();
});

// Clear per-field errors as the user corrects their input
emailInput.addEventListener('input', () => {
    clearFieldError(emailGroup, emailError);
    hideMessage();
});

passwordInput.addEventListener('input', () => {
    clearFieldError(passwordGroup, passwordError);
    hideMessage();
});

// ── Form submission ───────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    // 1. Client-side validation
    if (!validateForm()) {
        return;
    }

    const email    = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    // 2. Disable the button and show loading state
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Signing in…';

    try {
        // 3. POST to the backend login endpoint
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            // 4a. Server returned an error — surface the backend's message
            showMessage(data.message || 'Login failed. Please try again.', 'error');
            return;
        }

        // 4b. Success — store the user object and redirect
        showMessage('Login successful. Redirecting…', 'success');

        localStorage.setItem('user', JSON.stringify(data.user));

        // Short delay so the success message is readable before navigating
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 800);

    } catch (err) {
        // Network error or JSON parse failure
        console.error('Login request failed:', err);
        showMessage(
            'Unable to reach the server. Please check your connection and try again.',
            'error'
        );
    } finally {
        // Always re-enable the button (unless we're about to navigate away)
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Sign In';
    }
});