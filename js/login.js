// login.js
// One login page for the admin and every coordinator. The accounts are in the data
// (users list): the admin from users.json, coordinators created by the admin.
// NOTE: this is a front-end demo. The passwords sit in the browser, so real login
// will move to the server (Express + sessions + hashed passwords) in the later labs.

import { loadData, SESSION_KEY } from "./store.js";
import { validateLogin } from "./validators.js";

const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage");
const passwordInput = document.getElementById("password");

// already logged in? go straight to the dashboard
if (sessionStorage.getItem(SESSION_KEY)) {
    location.href = "admin.html";
}

function showErrors(errors) {
    form.querySelectorAll("[data-error-for]").forEach(box => {
        const field = box.dataset.errorFor;
        box.textContent = errors[field] || "";
        form.elements[field].classList.toggle("is-invalid", Boolean(errors[field]));
    });
}

// show / hide password button
document.getElementById("togglePassword").addEventListener("click", event => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    event.target.textContent = hidden ? "Hide" : "Show";
    event.target.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    message.classList.add("d-none");

    const fields = {
        username: form.elements.username.value.trim().toLowerCase(),
        password: form.elements.password.value
    };
    const errors = validateLogin(fields);
    showErrors(errors);
    if (Object.keys(errors).length > 0) {
        return;
    }

    try {
        const data = await loadData();
        const user = data.users.find(item => item.username === fields.username && item.password === fields.password);
        if (!user) {
            // same message for a wrong username or password, so we don't tell which one exists
            message.textContent = "Wrong username or password.";
            message.classList.remove("d-none");
            form.elements.password.value = "";
            return;
        }
        // only the id is kept; the dashboard reads the account again on every page load
        sessionStorage.setItem(SESSION_KEY, String(user.id));
        location.href = "admin.html";
    } catch (error) {
        message.textContent = `Could not check the login: ${error.message}. Open the project with Live Server.`;
        message.classList.remove("d-none");
    }
});
