/* PetTech - estado local compartido y utilidades */
const PT = {
    KEYS: {
        SESSION: "PetTech_sesion",
        USERS: "PetTech_usuarios",
        PETS: "PetTech_mascotas",
        VETS: "PetTech_veterinarios",
        VACCINES: "PetTech_vacunas",
        APPOINTMENTS: "PetTech_citas",
        AVAILABILITY: "PetTech_disponibilidad"
    },

    DEMO: {
        VET: {
            id: "v1",
            name: "Dr. Carlos Ruiz",
            email: "carlos@pettech.com",
            specialty: "Medicina General"
        },
        TUTOR: {
            id: "tutor-demo",
            fullName: "Tutor Demo",
            username: "tutor.demo",
            email: "tutor@pettech.com",
            password: "123456"
        }
    },

    read(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            const value = JSON.parse(raw);
            return value ?? fallback;
        } catch {
            return fallback;
        }
    },

    write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        return value;
    },

    uid(prefix = "id") {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    },

    userId(role, email) {
        const normalized = `${role}:${String(email || "").trim().toLowerCase()}`;
        let hash = 0;

        for (let index = 0; index < normalized.length; index += 1) {
            hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
        }

        return `${role}-${Math.abs(hash)}`;
    },

    session() {
        const session = this.read(this.KEYS.SESSION);

        if (!session || typeof session !== "object") return null;

        if (!session.id && session.email && session.role) {
            session.id = this.userId(session.role, session.email);
        }

        // Enlaza automáticamente la sesión veterinaria con el perfil v1.
        if (session.role === "veterinario" && session.email) {
            const vet = this.read(this.KEYS.VETS, []).find(
                item => String(item.email || "").trim().toLowerCase() === String(session.email).trim().toLowerCase()
            );

            if (vet && session.vetId !== vet.id) {
                session.vetId = vet.id;
            }
        }

        this.write(this.KEYS.SESSION, session);
        return session;
    },

    logout() {
        localStorage.removeItem(this.KEYS.SESSION);
    },

    initializeLocalData() {
        // Veterinario predeterminado: se crea o se actualiza para garantizar v1.
        const vets = this.read(this.KEYS.VETS, []);
        const vetIndex = vets.findIndex(vet => vet.id === this.DEMO.VET.id);

        if (vetIndex === -1) {
            vets.push({ ...this.DEMO.VET });
        } else {
            vets[vetIndex] = { ...vets[vetIndex], ...this.DEMO.VET };
        }
        this.write(this.KEYS.VETS, vets);

        // Usuario tutor demo para poder probar el flujo completo en local.
        const users = this.read(this.KEYS.USERS, []);
        const tutorId = this.userId("tutor", this.DEMO.TUTOR.email);

        const demoAccounts = [
            {
                id: this.userId("veterinario", this.DEMO.VET.email),
                role: "veterinario",
                fullName: this.DEMO.VET.name,
                username: "carlos.ruiz",
                email: this.DEMO.VET.email,
                passwordHash: this.simplePasswordHash("123456"),
                createdAt: new Date().toISOString(),
                demo: true
            },
            {
                id: tutorId,
                role: "tutor",
                fullName: this.DEMO.TUTOR.fullName,
                username: this.DEMO.TUTOR.username,
                email: this.DEMO.TUTOR.email,
                passwordHash: this.simplePasswordHash(this.DEMO.TUTOR.password),
                createdAt: new Date().toISOString(),
                demo: true
            }
        ];

        demoAccounts.forEach(account => {
            const exists = users.some(user =>
                user.role === account.role &&
                String(user.email || "").trim().toLowerCase() === account.email
            );

            if (!exists) users.push(account);
        });

        this.write(this.KEYS.USERS, users);

        const pets = this.read(this.KEYS.PETS, []);
        if (!pets.length) {
            this.write(this.KEYS.PETS, [{
                id: "p1",
                tutorId,
                name: "Max",
                species: "Perro",
                breed: "Labrador",
                birth: "2021-05-10",
                weight: 25
            }]);
        } else {
            // Solo enlazamos la mascota demo p1 si todavía no tiene tutor.
            const p1 = pets.find(pet => pet.id === "p1");
            if (p1 && !p1.tutorId) {
                p1.tutorId = tutorId;
                this.write(this.KEYS.PETS, pets);
            }
        }

        let vaccines = this.read(this.KEYS.VACCINES, []);

        if (!vaccines.length) {
            vaccines = [{
                id: "vax1",
                petId: "p1",
                tutorId,
                vetId: this.DEMO.VET.id,
                vetName: this.DEMO.VET.name,
                name: "Rabia",
                appliedDate: "2026-09-15",
                nextDate: "2027-09-15",
                notes: "Esquema de refuerzo anual."
            }];
        } else {
            // Migración local: completa tutor/veterinario en registros antiguos.
            vaccines = vaccines.map(vaccine => {
                const pet = pets.find(item => item.id === vaccine.petId);
                const vet = vets.find(item => item.id === vaccine.vetId);

                return {
                    ...vaccine,
                    tutorId: vaccine.tutorId || pet?.tutorId || null,
                    vetName: vet?.name || vaccine.vetName || ""
                };
            });
        }

        this.write(this.KEYS.VACCINES, vaccines);

        if (!Array.isArray(this.read(this.KEYS.APPOINTMENTS, null))) {
            this.write(this.KEYS.APPOINTMENTS, []);
        }

        const availability = this.read(this.KEYS.AVAILABILITY, null);
        if (!Array.isArray(availability)) {
            this.write(this.KEYS.AVAILABILITY, []);
        }
    },

    db() {
        this.initializeLocalData();

        return {
            pets: this.read(this.KEYS.PETS, []),
            vets: this.read(this.KEYS.VETS, []),
            vaccines: this.read(this.KEYS.VACCINES, []),
            appointments: this.read(this.KEYS.APPOINTMENTS, [])
        };
    },

    petsForTutor(tutorId) {
        return this.db().pets.filter(pet => pet.tutorId === tutorId);
    },

    savePet(petData) {
        const pets = this.read(this.KEYS.PETS, []);
        pets.push(petData);
        this.write(this.KEYS.PETS, pets);
        return petData;
    },

    getAvailability() {
        const availability = this.read(this.KEYS.AVAILABILITY, []);
        const appointments = this.read(this.KEYS.APPOINTMENTS, []);

        return (Array.isArray(availability) ? availability : []).map(item => ({
            ...item,
            slots: Array.isArray(item.slots) ? [...new Set(item.slots)].sort() : [],
            occupiedSlots: [
                ...new Set([
                    ...(Array.isArray(item.occupiedSlots) ? item.occupiedSlots : []),
                    ...appointments
                        .filter(app =>
                            app.vetId === item.vetId &&
                            app.date === item.date &&
                            app.status !== "Cancelada"
                        )
                        .map(app => app.time)
                ])
            ]
        }));
    },

    saveAvailability(availability) {
        return this.write(this.KEYS.AVAILABILITY, availability);
    },

    addAppointment(appData) {
        const appointments = this.read(this.KEYS.APPOINTMENTS, []);
        const duplicate = appointments.some(app =>
            app.vetId === appData.vetId &&
            app.date === appData.date &&
            app.time === appData.time &&
            app.status !== "Cancelada"
        );

        if (duplicate) {
            throw new Error("SLOT_OCCUPIED");
        }

        appointments.push(appData);
        this.write(this.KEYS.APPOINTMENTS, appointments);

        // Mantiene la disponibilidad sincronizada y deja explícitamente el bloque ocupado.
        const availability = this.read(this.KEYS.AVAILABILITY, []);
        const item = availability.find(
            entry => entry.vetId === appData.vetId && entry.date === appData.date
        );

        if (item) {
            item.occupiedSlots = [
                ...new Set([...(item.occupiedSlots || []), appData.time])
            ];
            this.write(this.KEYS.AVAILABILITY, availability);
        }

        return appData;
    },

    simplePasswordHash(password) {
        let hash = 5381;
        for (let index = 0; index < String(password).length; index += 1) {
            hash = ((hash << 5) + hash + String(password).charCodeAt(index)) | 0;
        }
        return `h${Math.abs(hash)}`;
    },

    esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    },

    fmtDate(dateStr) {
        if (!dateStr) return "";
        const parts = String(dateStr).split("-");
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
    }
};

// Se ejecuta antes de auth.js, citas.js y veterinario.js.
PT.initializeLocalData();
