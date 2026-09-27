/* PetTech - Autenticación y sesión */
(function () {
    const SESSION_KEY = "PetTech_sesion";

    function readSession() {
        try {
            const value = JSON.parse(localStorage.getItem(SESSION_KEY));
            return value && typeof value === "object" ? value : null;
        } catch {
            return null;
        }
    }

    function createUserId(role, email) {
        const normalized = `${role}:${email.trim().toLowerCase()}`;
        let hash = 0;

        for (let index = 0; index < normalized.length; index += 1) {
            hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
        }

        return `${role}-${Math.abs(hash)}`;
    }

    function showLoginMessage(message, type = "error") {
        const element = document.getElementById("loginMessage");
        if (!element) return;

        element.textContent = message;
        element.className = `form-message ${type}`;
    }

    function clearLoginMessage() {
        const element = document.getElementById("loginMessage");
        if (!element) return;

        element.textContent = "";
        element.className = "form-message";
    }

    document.addEventListener("DOMContentLoaded", () => {
        const mainNav = document.querySelector(".main-nav");
        const openLoginBtn = document.getElementById("openLoginBtn");
        const heroLoginBtn = document.getElementById("heroLoginBtn");
        const loginModal = document.getElementById("loginModal");
        const closeLoginBtn = document.getElementById("closeLoginBtn");
        const loginForm = document.getElementById("loginForm");
        const roleButtons = document.querySelectorAll(".role-btn");
        const roleInput = document.getElementById("role");
        const roleLabel = document.getElementById("roleLabel");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        if (!loginModal || !loginForm || !roleInput) return;

        const openLogin = () => {
            loginModal.classList.remove("hidden");
            document.body.classList.add("modal-open");
            emailInput?.focus();
        };

        const closeLogin = () => {
            loginModal.classList.add("hidden");
            document.body.classList.remove("modal-open");
            clearLoginMessage();
        };

        const session = readSession();

        if (session?.role === "tutor" || session?.role === "veterinario") {
            const targetUrl = session.role === "tutor" ? "tutor.html" : "veterinario.html";
            const roleName = session.role === "tutor" ? "Tutor" : "Veterinario";

            if (!session.id && session.email) {
                session.id = createUserId(session.role, session.email);
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }

            if (openLoginBtn) {
                openLoginBtn.textContent = "Mi Panel";
                openLoginBtn.onclick = () => {
                    window.location.href = targetUrl;
                };
            }

            if (mainNav && !document.getElementById("homeLogoutBtn")) {
                const logoutButton = document.createElement("button");
                logoutButton.type = "button";
                logoutButton.id = "homeLogoutBtn";
                logoutButton.className = "btn btn-logout";
                logoutButton.textContent = "Cerrar sesión";
                logoutButton.addEventListener("click", () => {
                    localStorage.removeItem(SESSION_KEY);
                    window.location.reload();
                });
                mainNav.appendChild(logoutButton);
            }

            if (heroLoginBtn) {
                heroLoginBtn.textContent = `Volver al Panel de ${roleName}`;
                heroLoginBtn.onclick = () => {
                    window.location.href = targetUrl;
                };
            }
        } else {
            openLoginBtn?.addEventListener("click", openLogin);
            heroLoginBtn?.addEventListener("click", openLogin);
        }

        closeLoginBtn?.addEventListener("click", closeLogin);
        loginModal.addEventListener("click", event => {
            if (event.target === loginModal) closeLogin();
        });

        roleButtons.forEach(button => {
            button.addEventListener("click", () => {
                roleButtons.forEach(item => item.classList.remove("active"));
                button.classList.add("active");
                roleInput.value = button.dataset.role || "tutor";
                roleLabel.textContent = roleInput.value === "tutor" ? "Tutor" : "Veterinario";
                clearLoginMessage();
            });
        });

        loginForm.addEventListener("submit", event => {
            event.preventDefault();
            clearLoginMessage();

            const email = emailInput?.value.trim().toLowerCase() || "";
            const password = passwordInput?.value || "";
            const role = roleInput.value;

            if (!email || !emailInput.checkValidity()) {
                showLoginMessage("Ingresa un correo electrónico válido.");
                emailInput?.focus();
                return;
            }

            if (password.length < 6) {
                showLoginMessage("La contraseña debe tener al menos 6 caracteres.");
                passwordInput?.focus();
                return;
            }

            if (!["tutor", "veterinario"].includes(role)) {
                showLoginMessage("Selecciona un perfil válido.");
                return;
            }

            const previousSession = readSession();
            const sameAccount = previousSession?.email === email && previousSession?.role === role;

            const newSession = {
                id: createUserId(role, email),
                email,
                name: sameAccount && previousSession.name ? previousSession.name : email.split("@")[0],
                role,
                loginAt: new Date().toISOString(),
                ...(sameAccount && previousSession.vetId ? { vetId: previousSession.vetId } : {})
            };

            localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
            window.location.href = role === "tutor" ? "tutor.html" : "veterinario.html";
        });
    });
})();
