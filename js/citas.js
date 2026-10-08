const AVAILABILITY_STORAGE_KEY = PT.KEYS.AVAILABILITY;

function readAvailability() {
    return PT.getAvailability();
}

document.addEventListener("DOMContentLoaded", initializeTutor);

function initializeTutor() {
    const session = PT.session();

    if (!session || session.role !== "tutor") {
        window.location.href = "index.html";
        return;
    }

    PT.setupCollapsibleSections();
    setupHeaderAndStats(session);
    setupDateMinimum();
    loadPets(session);
    loadVeterinarians();
    loadTutorAppointments(session);
    loadHealthReminders(session);
    loadTutorVaccines(session);
    setupPetModalControls();
    setupPetForm(session);
    setupAppointmentForm(session);
    setupAppointmentCancel(session);
    setupLogout();

    // Sincronización entre pestañas/ventanas del navegador.
    window.addEventListener("storage", handleTutorStorageChange);

    // Cada minuto se retiran de la lista las citas que ya pasaron.
    window.setInterval(() => {
        if (document.hidden) return;
        PT.purgePastAppointments();
        loadTutorAppointments(session);
        loadPets(session);
        renderStats(session);
        window.PetTechCalendar?.refresh?.();
    }, 60000);
}

// Eventos del mini calendario flotante: solo citas activas y próximas del tutor
// y la próxima dosis de las vacunas de sus mascotas.
window.PetTechCalendarEvents = function () {
    const session = PT.read(PT.KEYS.SESSION, null);
    if (!session || session.role !== "tutor") return [];

    const pets = PT.read(PT.KEYS.PETS, []).filter(pet => pet.tutorId === session.id);
    const petById = new Map(pets.map(pet => [pet.id, pet]));
    const events = [];

    PT.read(PT.KEYS.APPOINTMENTS, [])
        .filter(app => app.tutorId === session.id && app.status !== "Cancelada" && PT.isUpcomingAppointment(app))
        .forEach(app => events.push({
            tipo: "cita",
            fecha: app.date,
            hora: app.time || "",
            mascota: petById.get(app.petId)?.name || "",
            detalle: app.reason || ""
        }));

    PT.read(PT.KEYS.VACCINES, [])
        .filter(vaccine => petById.has(vaccine.petId) && vaccine.nextDate)
        .forEach(vaccine => events.push({
            tipo: "vacuna",
            fecha: vaccine.nextDate,
            hora: "",
            mascota: petById.get(vaccine.petId)?.name || "",
            detalle: vaccine.name
        }));

    return events;
};

function handleTutorStorageChange(event) {
    if (![PT.KEYS.PETS, PT.KEYS.VACCINES, PT.KEYS.APPOINTMENTS, PT.KEYS.VETS, PT.KEYS.AVAILABILITY].includes(event.key)) {
        return;
    }

    const session = PT.session();
    if (!session || session.role !== "tutor") return;

    loadPets(session);
    loadVeterinarians();
    loadTutorAppointments(session);
    loadHealthReminders(session);
    loadTutorVaccines(session);
    renderStats(session);
    renderAvailableSlots();
}

function setupHeaderAndStats(session) {
    const helloEl = document.getElementById("hello");
    if (helloEl) {
        helloEl.textContent = `Hola, ${session.name || session.email?.split("@")[0] || "Tutor"}`;
    }

    renderStats(session);
}

function renderStats(session) {
    const statsContainer = document.getElementById("stats");
    if (!statsContainer) return;

    const db = PT.db();
    const pets = PT.petsForTutor(session.id);
    const petIds = new Set(pets.map(pet => pet.id));
    const vaccines = db.vaccines.filter(vaccine => petIds.has(vaccine.petId));
    const appointments = db.appointments.filter(appointment =>
        appointment.tutorId === session.id &&
        appointment.status !== "Cancelada" &&
        PT.isUpcomingAppointment(appointment)
    );

    statsContainer.innerHTML = `
        <article class="stat-card">
            <div class="stat-value">${pets.length}</div>
            <div class="stat-label">Mascotas registradas</div>
        </article>
        <article class="stat-card">
            <div class="stat-value">${vaccines.length}</div>
            <div class="stat-label">Vacunas registradas</div>
        </article>
        <article class="stat-card">
            <div class="stat-value">${appointments.length}</div>
            <div class="stat-label">Citas próximas</div>
        </article>
    `;
}

function setupDateMinimum() {
    const dateInput = document.getElementById("appointmentDate");
    if (!dateInput) return;

    dateInput.min = PT.today();
    dateInput.addEventListener("change", renderAvailableSlots);
}

function loadPets(session) {
    const pets = PT.petsForTutor(session.id);
    const db = PT.db();
    const petList = document.getElementById("pets");
    const appointmentPet = document.getElementById("appointmentPet");

    if (petList) {
        petList.innerHTML = pets.length
            ? pets.map(pet => renderPetCard(pet, db)).join("")
            : `<div class="empty-state">Aún no tienes mascotas registradas.</div>`;
    }

    if (appointmentPet) {
        const currentValue = appointmentPet.value;
        appointmentPet.innerHTML = `<option value="">Selecciona una mascota</option>`;

        pets.forEach(pet => {
            const option = document.createElement("option");
            option.value = pet.id;
            option.textContent = `${pet.name} (${pet.species})`;
            appointmentPet.appendChild(option);
        });

        if (pets.some(pet => pet.id === currentValue)) {
            appointmentPet.value = currentValue;
        }
    }
}

function renderPetCard(pet, db) {
    const petVaccines = db.vaccines
        .filter(vaccine => vaccine.petId === pet.id)
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate));

    const petAppointments = db.appointments
        .filter(appointment =>
            appointment.petId === pet.id &&
            appointment.status !== "Cancelada" &&
            PT.isUpcomingAppointment(appointment)
        )
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    return `
        <article class="pet-card">
            <div class="pet-card-header">
                <div class="pet-avatar">${getPetEmoji(pet.species)}</div>
                <div>
                    <h3>${PT.esc(pet.name)}</h3>
                    <p class="pet-meta">
                        ${PT.esc(pet.species)} · ${PT.esc(pet.breed || "Raza no especificada")}
                        ${pet.weight ? ` · ${PT.esc(pet.weight)} kg` : ""}
                    </p>
                </div>
            </div>
            <div class="pet-details">
                <h4>Vacunas</h4>
                ${petVaccines.length ? petVaccines.map(vaccine => {
                    const status = getHealthDateStatus(vaccine.nextDate);
                    return `
                    <div class="detail-row">
                        <span>💉 ${PT.esc(vaccine.name)}</span>
                        <span class="pill ${status.pillClass}">${status.shortLabel}</span>
                    </div>`;
                }).join("") : '<p class="muted">Sin vacunas registradas.</p>'}

                <h4>Citas</h4>
                ${petAppointments.length ? petAppointments.map(appointment => `
                    <div class="detail-row">
                        <span>📅 ${PT.fmtDate(appointment.date)} ${PT.esc(appointment.time)} · ${PT.esc(appointment.reason || "Consulta")}</span>
                        <span class="pill ${appointment.status === "Confirmada" ? "green" : "orange"}">${PT.esc(appointment.status)}</span>
                    </div>
                `).join("") : '<p class="muted">Sin citas.</p>'}
            </div>
        </article>
    `;
}

function getHealthDateStatus(dateString) {
    if (!dateString) return { label: "Sin fecha", shortLabel: "Sin fecha", pillClass: "orange", days: null };
    const today = new Date(`${PT.today()}T00:00:00`);
    const target = new Date(`${dateString}T00:00:00`);
    const days = Math.ceil((target - today) / 86400000);
    if (days < 0) return { label: "Vacuna pendiente", shortLabel: "Pendiente", pillClass: "red", days };
    if (days <= 30) return { label: days === 0 ? "Vacuna para hoy" : `Vacuna en ${days} día${days === 1 ? "" : "s"}`, shortLabel: days === 0 ? "Hoy" : `En ${days} d`, pillClass: "orange", days };
    return { label: "Vacuna al día", shortLabel: `Próxima: ${PT.fmtDate(dateString)}`, pillClass: "green", days };
}

function loadHealthReminders(session) {
    const container = document.getElementById("healthReminders");
    if (!container) return;

    const db = PT.db();
    const petIds = new Set(PT.petsForTutor(session.id).map(pet => pet.id));
    const reminders = [];

    db.vaccines.filter(vaccine => petIds.has(vaccine.petId)).forEach(vaccine => {
        const pet = db.pets.find(item => item.id === vaccine.petId);
        const status = getHealthDateStatus(vaccine.nextDate);
        if (status.days !== null && status.days <= 60) {
            reminders.push({ date: vaccine.nextDate, petName: pet?.name || "Mascota", title: vaccine.name, status });
        }
    });

    reminders.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (!reminders.length) {
        container.innerHTML = `<div class="empty-state">No tienes vacunas próximas. PetTech te mostrará aquí los próximos refuerzos.</div>`;
        return;
    }

    container.innerHTML = reminders.map(item => `
        <article class="reminder-card ${item.status.days < 0 ? "reminder-danger" : "reminder-warning"}">
            <div class="reminder-icon">💉</div>
            <div class="reminder-content">
                <span class="reminder-type">Vacuna</span>
                <h3>${PT.esc(item.title)}</h3>
                <p><strong>${PT.esc(item.petName)}</strong> · próxima dosis ${PT.fmtDate(item.date)}</p>
                <span class="status-badge ${item.status.days < 0 ? "danger" : "warning"}">${PT.esc(item.status.label)}</span>
            </div>
        </article>
    `).join("");
}

function loadTutorVaccines(session) {
    const container = document.getElementById("tutorVaccines");
    if (!container) return;

    const db = PT.db();
    const pets = PT.petsForTutor(session.id);
    const petIds = new Set(pets.map(pet => pet.id));
    const vaccines = db.vaccines
        .filter(vaccine => petIds.has(vaccine.petId))
        .sort((a, b) => `${a.nextDate}`.localeCompare(`${b.nextDate}`));

    if (!vaccines.length) {
        container.innerHTML = `<div class="empty-state">El veterinario todavía no ha registrado vacunas para tus mascotas.</div>`;
        return;
    }

    container.innerHTML = vaccines.map(vaccine => {
        const pet = db.pets.find(item => item.id === vaccine.petId);
        const status = getHealthDateStatus(vaccine.nextDate);
        return `
            <article class="vaccine-card">
                <div class="vaccine-card-top">
                    <div>
                        <span class="vaccine-icon">💉</span>
                        <div class="vaccine-title-group">
                            <h3>${PT.esc(vaccine.name)}</h3>
                            <p>${PT.esc(pet?.name || "Mascota")}</p>
                        </div>
                    </div>
                    <span class="status-badge ${status.days < 0 ? "danger" : status.days <= 30 ? "warning" : "success"}">${status.label}</span>
                </div>
                <div class="vaccine-info-grid">
                    <span>Aplicada: <strong>${PT.fmtDate(vaccine.appliedDate || "")}</strong></span>
                    <span>Próxima dosis: <strong>${PT.fmtDate(vaccine.nextDate)}</strong></span>
                </div>
                ${vaccine.vetName ? `<p class="vaccine-notes">Registrada por ${PT.esc(vaccine.vetName)}${vaccine.notes ? ` · ${PT.esc(vaccine.notes)}` : ""}</p>` : ""}
            </article>
        `;
    }).join("");
}

function setupPetModalControls() {
    const modal = document.getElementById("modal");
    const addBtn = document.getElementById("addPetBtn");
    const closeBtn = document.getElementById("closeModal");
    const cancelBtn = document.getElementById("cancelModal");

    if (!modal) return;

    const closeModal = () => {
        modal.classList.add("hidden");
        document.body.classList.remove("modal-open");
    };

    addBtn?.addEventListener("click", () => {
        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        document.getElementById("petName")?.focus();
    });

    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);
    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal();
    });
}

function setupPetForm(session) {
    const form = document.getElementById("petForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const name = document.getElementById("petName").value.trim();
        const species = document.getElementById("petSpecies").value;
        const breed = document.getElementById("petBreed").value.trim();
        const birth = document.getElementById("petBirth").value;
        const weightInput = document.getElementById("petWeight").value;
        const weight = weightInput ? Number(weightInput) : 0;

        if (!name || !species || (weightInput && (!Number.isFinite(weight) || weight <= 0))) {
            return;
        }

        PT.savePet({
            id: PT.uid("p"),
            tutorId: session.id,
            name,
            species,
            breed,
            birth,
            weight
        });

        form.reset();
        document.getElementById("modal")?.classList.add("hidden");
        document.body.classList.remove("modal-open");
        loadPets(session);
        renderStats(session);
    });
}

function loadVeterinarians() {
    const db = PT.db();
    const select = document.getElementById("appointmentVet");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = `<option value="">Selecciona un veterinario</option>`;

    db.vets
        .slice()
        .sort((a, b) => a.id === "v1" ? -1 : b.id === "v1" ? 1 : String(a.name).localeCompare(String(b.name)))
        .forEach(vet => {
            const option = document.createElement("option");
            option.value = vet.id;
            option.textContent = `${vet.name} - ${vet.specialty}`;
            select.appendChild(option);
        });

    if (db.vets.some(vet => vet.id === currentValue)) {
        select.value = currentValue;
    }

    if (!select.dataset.bound) {
        select.addEventListener("change", renderAvailableSlots);
        select.dataset.bound = "true";
    }
}

function clearSelectedTime() {
    const hidden = document.getElementById("selectedAppointmentTime");
    if (hidden) hidden.value = "";
}

function renderAvailableSlots() {
    clearSelectedTime();

    const vetId = document.getElementById("appointmentVet")?.value;
    const date = document.getElementById("appointmentDate")?.value;
    const container = document.getElementById("appointmentSlots");

    if (!container) return;

    if (!vetId || !date) {
        container.innerHTML = `<div class="empty-state">Selecciona un veterinario y una fecha.</div>`;
        return;
    }

    const published = readAvailability().find(item => item.vetId === vetId && item.date === date);
    const db = PT.db();

    if (!published || !published.slots.length) {
        container.innerHTML = `<div class="empty-state">El veterinario no tiene horarios publicados para esta fecha.</div>`;
        return;
    }

    const occupiedSlots = new Set(published.occupiedSlots || []);
    container.innerHTML = "";

    published.slots.forEach(time => {
        const isOccupied = occupiedSlots.has(time) || db.appointments.some(
            appointment =>
                appointment.vetId === vetId &&
                appointment.date === date &&
                appointment.time === time &&
                appointment.status !== "Cancelada"
        );

        const button = document.createElement("button");
        button.type = "button";
        button.className = "time-slot";
        button.textContent = isOccupied ? `${time} · Ocupado` : time;

        if (isOccupied) {
            button.disabled = true;
            button.classList.add("occupied");
            button.title = "Horario ocupado";
        } else {
            button.addEventListener("click", () => {
                container.querySelectorAll(".time-slot").forEach(slot => slot.classList.remove("selected"));
                button.classList.add("selected");
                document.getElementById("selectedAppointmentTime").value = time;
            });
        }

        container.appendChild(button);
    });
}

function setupAppointmentForm(session) {
    const form = document.getElementById("appointmentForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const petId = document.getElementById("appointmentPet").value;
        const vetId = document.getElementById("appointmentVet").value;
        const date = document.getElementById("appointmentDate").value;
        const time = document.getElementById("selectedAppointmentTime").value;

        if (!petId || !vetId || !date || !time) {
            showMessage("appointmentMessage", "Selecciona mascota, veterinario, fecha y horario.", "error");
            return;
        }

        const availability = readAvailability().find(item => item.vetId === vetId && item.date === date);
        if (!availability?.slots?.includes(time)) {
            showMessage("appointmentMessage", "Ese horario ya no está disponible. Selecciona otro.", "error");
            renderAvailableSlots();
            return;
        }

        const db = PT.db();
        const vet = db.vets.find(item => item.id === vetId);
        const isOccupied = db.appointments.some(
            appointment => appointment.vetId === vetId &&
                appointment.date === date &&
                appointment.time === time &&
                appointment.status !== "Cancelada"
        );

        if (isOccupied) {
            showMessage("appointmentMessage", "Este horario acaba de ser ocupado. Elige otro.", "error");
            renderAvailableSlots();
            return;
        }

        try {
            PT.addAppointment({
                id: PT.uid("a"),
                petId,
                tutorId: session.id,
                tutorName: session.name || session.email?.split("@")[0] || "Tutor",
                tutorEmail: session.email || "",
                vetId,
                date,
                time,
                reason: vet ? `Consulta con ${vet.specialty}` : "Consulta general",
                status: "Confirmada",
                notes: "Agendado directamente desde el panel del tutor."
            });
        } catch (error) {
            if (error?.message === "SLOT_OCCUPIED") {
                showMessage("appointmentMessage", "Este horario acaba de ser ocupado. Elige otro.", "error");
                renderAvailableSlots();
                return;
            }
            showMessage("appointmentMessage", "No fue posible guardar la cita.", "error");
            return;
        }

        showMessage("appointmentMessage", "¡Cita confirmada correctamente!", "success");
        clearSelectedTime();
        renderAvailableSlots();
        loadTutorAppointments(session);
        loadHealthReminders(session);
        loadTutorVaccines(session);
        loadPets(session);
        renderStats(session);
    });
}

function loadTutorAppointments(session) {
    const container = document.getElementById("tutorAppointments");
    if (!container) return;

    PT.purgePastAppointments();

    const db = PT.db();
    const appointments = db.appointments
        .filter(appointment => appointment.tutorId === session.id && PT.isUpcomingAppointment(appointment))
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    container.innerHTML = appointments.length
        ? appointments.map(appointment => renderAppointmentCard(appointment, db)).join("")
        : `<div class="empty-state">No tienes citas próximas.</div>`;
}

function renderAppointmentCard(appointment, db) {
    const pet = db.pets.find(item => item.id === appointment.petId);
    const vet = db.vets.find(item => item.id === appointment.vetId);
    const cancelled = appointment.status === "Cancelada";

    return `
        <article class="appointment-card${cancelled ? " is-cancelled" : ""}">
            <div class="appointment-top">
                <div>
                    <h3>${PT.esc(pet?.name || "Mascota")}</h3>
                    <p>Veterinario: ${PT.esc(vet?.name || "Asignado")}</p>
                </div>
                <span class="status-badge${cancelled ? " danger" : ""}">${PT.esc(appointment.status)}</span>
            </div>
            <div class="appointment-info">
                <span>📅 ${PT.fmtDate(appointment.date)}</span>
                <span>🕐 ${PT.esc(appointment.time)}</span>
                <span>🩺 ${PT.esc(vet?.specialty || "General")}</span>
            </div>
            ${cancelled ? "" : `
            <div class="appointment-actions">
                <button type="button" class="btn btn-danger-outline btn-small" data-cancel-appointment="${PT.esc(appointment.id)}">Cancelar cita</button>
            </div>`}
        </article>
    `;
}

function setupAppointmentCancel(session) {
    const container = document.getElementById("tutorAppointments");
    if (!container) return;

    container.addEventListener("click", event => {
        const button = event.target.closest("[data-cancel-appointment]");
        if (!button) return;

        const db = PT.db();
        const appointment = db.appointments.find(item => item.id === button.dataset.cancelAppointment);
        if (!appointment) return;

        const pet = db.pets.find(item => item.id === appointment.petId);
        const confirmed = window.confirm(
            `¿Cancelar la cita de ${pet?.name || "tu mascota"} del ${PT.fmtDate(appointment.date)} a las ${appointment.time}?`
        );
        if (!confirmed) return;

        if (!PT.cancelAppointment(appointment.id, session.id)) {
            showMessage("tutorAppointmentsMessage", "No fue posible cancelar la cita.", "error");
            return;
        }

        showMessage("tutorAppointmentsMessage", "La cita fue cancelada y el horario quedó libre.", "success");
        loadTutorAppointments(session);
        loadPets(session);
        renderStats(session);
        renderAvailableSlots();
        window.PetTechCalendar?.refresh?.();
    });
}

function setupLogout() {
    const button = document.getElementById("logout");
    button?.addEventListener("click", () => {
        PT.logout();
        window.location.href = "index.html";
    });
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}`;

    window.setTimeout(() => {
        element.textContent = "";
        element.className = "form-message";
    }, 3500);
}

function getPetEmoji(species) {
    const emojis = { Perro: "🐶", Gato: "🐱", Ave: "🐦", Conejo: "🐰" };
    return emojis[species] || "🐾";
}
