/* PetTech - Autenticación y sesión */
(function () {
    const SESSION_KEY = "PetTech_sesion";
    const USERS_KEY = "PetTech_usuarios";
    const USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,20}$/;

    function readUsers() {
        const users = PT.read(PT.KEYS.USERS, []);
        return Array.isArray(users) ? users : [];
    }

    function saveUsers(users) {
        PT.write(PT.KEYS.USERS, users);
    }

    // Hash simple solo para la simulación local. Con un servidor real
    // las contraseñas deben procesarse y guardarse en el backend.
    function hashPassword(password) {
        return PT.simplePasswordHash(password);
    }

    function findUser(role, email) {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        return readUsers().find(
            user => user.role === role && String(user.email || "").trim().toLowerCase() === normalizedEmail
        ) || null;
    }

    function startSession(role, email, name, extra = {}) {
        const normalizedEmail = String(email).trim().toLowerCase();
        const newSession = {
            id: createUserId(role, normalizedEmail),
            email: normalizedEmail,
            name,
            role,
            loginAt: new Date().toISOString(),
            ...extra
        };

        if (role === "veterinario") {
            const vet = PT.read(PT.KEYS.VETS, []).find(
                item => String(item.email || "").trim().toLowerCase() === normalizedEmail
            );
            if (vet) {
                newSession.vetId = vet.id;
                newSession.name = vet.name;
                newSession.fullName = vet.name;
                newSession.specialty = vet.specialty;
            }
        }

        PT.write(SESSION_KEY, newSession);
        window.location.href = role === "tutor" ? "tutor.html" : "veterinario.html";
    }

    function readSession() {
        const value = PT.read(PT.KEYS.SESSION, null);
        return value && typeof value === "object" ? value : null;
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

    function showRegisterMessage(message, type = "error") {
        const element = document.getElementById("registerMessage");
        if (!element) return;

        element.textContent = message;
        element.className = `form-message ${type}`;
    }

    function clearRegisterMessage() {
        const element = document.getElementById("registerMessage");
        if (!element) return;

        element.textContent = "";
        element.className = "form-message";
    }

    document.addEventListener("DOMContentLoaded", () => {
        PT.initializeLocalData();

        const mainNav = document.querySelector(".main-nav");
        const openLoginBtn = document.getElementById("openLoginBtn");
        const heroLoginBtn = document.getElementById("heroLoginBtn");
        const loginModal = document.getElementById("authModal");
        const closeLoginBtn = document.getElementById("closeAuthModal");
        const loginForm = document.getElementById("loginForm");
        const roleButtons = document.querySelectorAll(".role-btn");
        const roleInput = document.getElementById("role");
        const roleLabel = document.getElementById("roleLabel");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const registerForm = document.getElementById("registerForm");
        const registerRoleLabel = document.getElementById("registerRoleLabel");
        const toggleAuthBtn = document.getElementById("toggleAuthBtn");
        const authSwitchText = document.getElementById("authSwitchText");
        const loginTitle = document.getElementById("modalTitle");
        const authSubtitle = document.getElementById("modalSubtitle");
        const regFullName = document.getElementById("regFullName");
        const regUsername = document.getElementById("regUsername");
        const regEmail = document.getElementById("regEmail");
        const regPassword = document.getElementById("regPassword");
        const regPasswordConfirm = document.getElementById("regPasswordConfirm");

        if (!loginModal || !loginForm || !roleInput) return;

        const openLogin = () => {
            loginModal.classList.remove("hidden");
            document.body.classList.add("modal-open");
            emailInput?.focus();
        };

        const showView = view => {
            const currentRole = roleInput.value;
            const authSwitchContainer = toggleAuthBtn?.parentElement;

            // Si se selecciona Veterinario, forzamos la vista de Login y ocultamos el botón de registro
            if (currentRole === "veterinario") {
                loginForm.classList.remove("hidden");
                registerForm?.classList.add("hidden");

                if (authSwitchContainer) authSwitchContainer.classList.add("hidden");

                loginTitle.textContent = "Acceso Veterinario";
                authSubtitle.textContent = "Ingresa con tus credenciales de veterinario.";
            } else {
                // Para Tutor, permitimos alternar vistas
                const isRegister = view === "register";

                if (authSwitchContainer) authSwitchContainer.classList.remove("hidden");

                loginForm.classList.toggle("hidden", isRegister);
                registerForm?.classList.toggle("hidden", !isRegister);

                loginTitle.textContent = isRegister ? "Crear cuenta de Tutor" : "Iniciar sesión";
                authSubtitle.textContent = isRegister
                    ? "Elige tu perfil y completa tus datos para registrarte."
                    : "Selecciona el perfil que vas a utilizar.";
                if (authSwitchText) {
                    authSwitchText.textContent = isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
                }
                if (toggleAuthBtn) {
                    toggleAuthBtn.textContent = isRegister ? "Iniciar sesión" : "Registrarse como Tutor";
                }
            }

            clearLoginMessage();
            clearRegisterMessage();
            (view === "register" && currentRole === "tutor" ? regFullName : emailInput)?.focus();
        };

        toggleAuthBtn?.addEventListener("click", () => {
            showView(registerForm?.classList.contains("hidden") ? "register" : "login");
        });

        const closeLogin = () => {
            loginModal.classList.add("hidden");
            document.body.classList.remove("modal-open");
            clearLoginMessage();
            clearRegisterMessage();
            showView("login");
        };

        const session = readSession();

        if (session?.role === "tutor" || session?.role === "veterinario") {
            const targetUrl = session.role === "tutor" ? "tutor.html" : "veterinario.html";
            const roleName = session.role === "tutor" ? "Tutor" : "Veterinario";

            if (!session.id && session.email) {
                session.id = createUserId(session.role, session.email);
                PT.write(PT.KEYS.SESSION, session);
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
                    PT.logout();
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
                const label = roleInput.value === "tutor" ? "Tutor" : "Veterinario";
                roleLabel.textContent = label;
                if (registerRoleLabel) registerRoleLabel.textContent = label;

                // Actualizamos la vista automáticamente según el rol seleccionado
                showView("login");
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

            const registeredUser = findUser(role, email);

            if (registeredUser && registeredUser.passwordHash !== hashPassword(password)) {
                showLoginMessage("Correo o contraseña incorrectos.");
                passwordInput?.focus();
                return;
            }

            const previousSession = readSession();
            const sameAccount = previousSession?.email === email && previousSession?.role === role;

            const name = registeredUser
                ? registeredUser.username
                : sameAccount && previousSession.name ? previousSession.name : email.split("@")[0];

            startSession(role, email, name, {
                ...(registeredUser ? { fullName: registeredUser.fullName, username: registeredUser.username } : {}),
                ...(sameAccount && previousSession.vetId ? { vetId: previousSession.vetId } : {})
            });
        });

        registerForm?.addEventListener("submit", event => {
            event.preventDefault();
            clearRegisterMessage();

            const fullName = regFullName.value.trim().replace(/\s+/g, " ");
            const username = regUsername.value.trim();
            const email = regEmail.value.trim().toLowerCase();
            const password = regPassword.value;
            const confirmation = regPasswordConfirm.value;
            const role = roleInput.value;

            if (fullName.length < 3) {
                showRegisterMessage("Ingresa tu nombre completo.");
                regFullName.focus();
                return;
            }

            if (!USERNAME_PATTERN.test(username)) {
                showRegisterMessage("El usuario debe tener entre 3 y 20 caracteres: letras, números, punto o guion bajo.");
                regUsername.focus();
                return;
            }

            if (!email || !regEmail.checkValidity()) {
                showRegisterMessage("Ingresa un correo electrónico válido.");
                regEmail.focus();
                return;
            }

            if (password.length < 6) {
                showRegisterMessage("La contraseña debe tener al menos 6 caracteres.");
                regPassword.focus();
                return;
            }

            if (password !== confirmation) {
                showRegisterMessage("Las contraseñas no coinciden.");
                regPasswordConfirm.focus();
                return;
            }

            if (!["tutor", "veterinario"].includes(role)) {
                showRegisterMessage("Selecciona un perfil válido.");
                return;
            }

            const users = readUsers();

            if (users.some(user => user.role === role && user.email === email)) {
                showRegisterMessage("Ya existe una cuenta con este correo. Inicia sesión.");
                regEmail.focus();
                return;
            }

            if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
                showRegisterMessage("Ese nombre de usuario ya está en uso. Elige otro.");
                regUsername.focus();
                return;
            }

            users.push({
                id: createUserId(role, email),
                role,
                fullName,
                username,
                email,
                passwordHash: hashPassword(password),
                createdAt: new Date().toISOString()
            });
            saveUsers(users);

            showRegisterMessage("¡Cuenta creada! Entrando a tu panel…", "success");

            setTimeout(() => startSession(role, email, username, { fullName, username }), 700);
        });
    });
})();