/* PetTech - utilidades y datos compartidos */

const PT = {
    KEYS: {
        SESSION: "PetTech_sesion",
        PETS: "PetTech_mascotas",
        VETS: "PetTech_veterinarios",
        VACCINES: "PetTech_vacunas",
        APPOINTMENTS: "PetTech_citas"
    },

    read(key, fallback = null) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value ?? fallback;
        } catch {
            return fallback;
        }
    },

    write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    session() {
        const session = this.read(this.KEYS.SESSION);

        if (!session || typeof session !== "object") return null;

        if (!session.id && session.email && session.role) {
            session.id = this.userId(session.role, session.email);
            this.write(this.KEYS.SESSION, session);
        }

        return session;
    },

    userId(role, email) {
        const normalized = `${role}:${String(email).trim().toLowerCase()}`;
        let hash = 0;

        for (let index = 0; index < normalized.length; index += 1) {
            hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
        }

        return `${role}-${Math.abs(hash)}`;
    },

    logout() {
        localStorage.removeItem(this.KEYS.SESSION);
    },

    db() {
        const pets = this.read(this.KEYS.PETS, null) || [
            { id: "p1", tutorId: null, name: "Max", species: "Perro", breed: "Labrador", birth: "2021-05-10", weight: 25 }
        ];

        const vets = this.read(this.KEYS.VETS, null) || [
            { id: "v1", name: "Dra. Laura Martínez", specialty: "Medicina general" },
            { id: "v2", name: "Dr. Carlos Gómez", specialty: "Dermatología veterinaria" }
        ];

        const vaccines = this.read(this.KEYS.VACCINES, null) || [
            { id: "vax1", petId: "p1", tutorId: null, vetId: "v1", vetName: "Dra. Laura Martínez", name: "Rabia", appliedDate: "2025-11-15", nextDate: "2026-11-15", notes: "Esquema de refuerzo anual." }
        ];

        const appointments = this.read(this.KEYS.APPOINTMENTS, []) || [];

        return { pets, vets, vaccines, appointments };
    },

    petsForTutor(tutorId) {
        const db = this.db();
        return db.pets.filter(pet => pet.tutorId === tutorId || !pet.tutorId);
    },

    savePet(petData) {
        const db = this.db();
        db.pets.push(petData);
        this.write(this.KEYS.PETS, db.pets);
    },

    addAppointment(appData) {
        const db = this.db();
        db.appointments.push(appData);
        this.write(this.KEYS.APPOINTMENTS, db.appointments);
    },

    uid(prefix = "id") {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
        const parts = dateStr.split("-");
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
    }
};
