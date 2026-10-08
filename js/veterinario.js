const AVAILABILITY_STORAGE_KEY = PT.KEYS.AVAILABILITY;

const $ = id => document.getElementById(id);

function getSession() {
    return PT.session();
}

function getTodayString() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function getStorage(key, fallback = []) {
    const value = PT.read(key, fallback);
    return Array.isArray(value) ? value : fallback;
}

function saveStorage(key, value) {
    PT.write(key, value);
}

function getCurrentVeterinarian() {
    const session = getSession();
    if (!session || session.role !== "veterinario") return null;

    const email = String(session.email || "").trim().toLowerCase();
    const vets = getStorage(PT.KEYS.VETS, []);

    return vets.find(vet =>
        vet.id === session.vetId ||
        (email && String(vet.email || "").trim().toLowerCase() === email)
    ) || null;
}

function initializeVeterinarian() {
    const session = getSession();
    if (!session || session.role !== "veterinario") {
        window.location.href = "index.html";
        return;
    }

    setupLogout();
    setupDate();
    loadVeterinarianProfile();
    setupProfileForm();
    setupVaccineForm();
    loadVaccinePets();
    loadVeterinarianVaccines();
    setupAvailabilityForm();
    setupAppointmentActions();
    loadAppointments();

    // Refresca el panel si el tutor agenda desde otra pestaña.
    window.addEventListener("storage", handleVeterinarianStorageChange);

    // Cada minuto se retiran las citas de días anteriores (también al pasar la medianoche).
    window.setInterval(() => {
        if (!document.hidden) loadAppointments();
    }, 60000);
}

function handleVeterinarianStorageChange(event) {
    if (![PT.KEYS.PETS, PT.KEYS.VACCINES, PT.KEYS.APPOINTMENTS, PT.KEYS.VETS, PT.KEYS.AVAILABILITY].includes(event.key)) {
        return;
    }

    const session = getSession();
    if (!session || session.role !== "veterinario") return;

    loadVaccinePets();
    loadVeterinarianVaccines();
    loadAppointments();
}

document.addEventListener("DOMContentLoaded", initializeVeterinarian);

function setupDate() {
    const availabilityDate = $("availabilityDate");
    const appliedDate = $("vaccineAppliedDate");
    const nextDate = $("vaccineNextDate");
    const today = getTodayString();

    if (availabilityDate) availabilityDate.min = today;
    if (appliedDate) {
        appliedDate.max = today;
        appliedDate.value = today;
        appliedDate.addEventListener("change", () => {
            if (nextDate) nextDate.min = appliedDate.value || today;
        });
    }
    if (nextDate) nextDate.min = today;
}

function loadVeterinarianProfile() {
    const vet = getCurrentVeterinarian();
    if (!vet) return;
    const nameInput = $("vetName");
    const specialtyInput = $("vetSpecialty");
    if (!nameInput || !specialtyInput) return;

    nameInput.value = vet.name || "";
    specialtyInput.value = vet.specialty || "";
}

function setupProfileForm() {
    const form = $("vetProfileForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();
        const session = getSession();
        const name = $("vetName").value.trim();
        const specialty = $("vetSpecialty").value;
        if (!name || !specialty) {
            showMessage("profileMessage", "Completa todos los datos del perfil.", "error");
            return;
        }

        const vets = getStorage(PT.KEYS.VETS, []);
        let vet = session?.vetId ? vets.find(item => item.id === session.vetId) : null;
        if (!vet && session?.email) vet = vets.find(item => item.email === session.email);

        if (!vet) {
            vet = { id: PT.uid("vet"), name, specialty, email: session.email };
            vets.push(vet);
        } else {
            vet.name = name;
            vet.specialty = specialty;
            vet.email = session.email || vet.email || "";
        }

        saveStorage(PT.KEYS.VETS, vets);
        PT.write(PT.KEYS.SESSION, {
            ...session,
            vetId: vet.id,
            name: vet.name,
            fullName: vet.name,
            specialty: vet.specialty
        });
        showMessage("profileMessage", "Perfil veterinario guardado correctamente.", "success");
        loadVaccinePets();
        loadVeterinarianVaccines();
        });
}

function loadVaccinePets() {
    const select = $("vaccinePet");
    if (!select) return;

    const current = select.value;
    const db = PT.db();
    const pets = db.pets.filter(pet => Boolean(pet.tutorId));

    select.innerHTML = `<option value="">Selecciona una mascota</option>`;

    pets.forEach(pet => {
        const tutor = getTutorById(pet.tutorId, db);
        const option = document.createElement("option");
        option.value = pet.id;
        option.textContent = `${pet.name} (${pet.species}) · ${tutor?.username || tutor?.email || "Tutor"}`;
        select.appendChild(option);
    });

    if (pets.some(pet => pet.id === current)) {
        select.value = current;
    }
}

function getTutorById(tutorId, db = PT.db()) {
    const users = PT.read(PT.KEYS.USERS, []);
    return users.find(user => user.role === "tutor" && user.id === tutorId) || null;
}

function setupVaccineForm() {
    const form = $("vaccineForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();
        const session = getSession();
        const vet = getCurrentVeterinarian();
        const id = $("vaccineId").value;
        const petId = $("vaccinePet").value;
        const name = $("vaccineName").value;
        const appliedDate = $("vaccineAppliedDate").value;
        const nextDate = $("vaccineNextDate").value;
        const notes = $("vaccineNotes").value.trim();

        if (!vet) {
            showMessage("vaccineMessage", "Primero guarda el perfil veterinario.", "error");
            return;
        }
        if (!petId || !name || !appliedDate || !nextDate) {
            showMessage("vaccineMessage", "Completa mascota, vacuna y fechas.", "error");
            return;
        }
        if (appliedDate > getTodayString()) {
            showMessage("vaccineMessage", "La fecha de aplicación no puede ser futura.", "error");
            return;
        }
        if (nextDate < appliedDate) {
            showMessage("vaccineMessage", "La próxima dosis debe ser posterior o igual a la aplicación.", "error");
            return;
        }

        const db = PT.db();
        const pet = db.pets.find(item => item.id === petId);
        if (!pet) {
            showMessage("vaccineMessage", "No se encontró la mascota seleccionada.", "error");
            return;
        }

        const vaccines = db.vaccines.slice();
        const index = vaccines.findIndex(vaccine => vaccine.id === id);
        const previous = index >= 0 ? vaccines[index] : null;
        const tutorId = pet.tutorId || previous?.tutorId || null;

        if (!tutorId) {
            showMessage("vaccineMessage", "La mascota debe estar asociada a un tutor antes de registrar la vacuna.", "error");
            return;
        }

        const record = {
            id: id || PT.uid("vax"),
            petId,
            tutorId,
            vetId: vet.id,
            vetName: vet.name,
            name,
            appliedDate,
            nextDate,
            notes,
            updatedAt: new Date().toISOString()
        };

        if (index >= 0) vaccines[index] = { ...vaccines[index], ...record };
        else vaccines.push(record);

        PT.write(PT.KEYS.VACCINES, vaccines);
        showMessage("vaccineMessage", index >= 0 ? "Vacuna actualizada correctamente." : "Vacuna registrada correctamente. El tutor podrá verla en sus recordatorios.", "success");
        resetVaccineForm();
        loadVeterinarianVaccines();
    });

    $("cancelVaccineEdit")?.addEventListener("click", resetVaccineForm);
}

function resetVaccineForm() {
    const form = $("vaccineForm");
    if (!form) return;
    form.reset();
    $("vaccineId").value = "";
    $("vaccineAppliedDate").value = getTodayString();
    $("vaccineAppliedDate").max = getTodayString();
    $("vaccineNextDate").min = getTodayString();
    $("saveVaccineBtn").textContent = "Registrar vacuna";
    $("cancelVaccineEdit")?.classList.add("hidden");
}

function loadVeterinarianVaccines() {
    const container = $("veterinarianVaccines");
    if (!container) return;

    const vet = getCurrentVeterinarian();
    if (!vet) {
        container.innerHTML = `<div class="empty-state">Guarda primero tu perfil veterinario.</div>`;
        return;
    }

    const db = PT.db();
    const vaccines = db.vaccines
        .filter(vaccine => vaccine.vetId === vet.id)
        .sort((a, b) => String(b.appliedDate || "").localeCompare(String(a.appliedDate || "")));

    if (!vaccines.length) {
        container.innerHTML = `<div class="empty-state">Todavía no has registrado vacunas.</div>`;
        return;
    }

    container.innerHTML = vaccines.map(vaccine => {
        const pet = db.pets.find(item => item.id === vaccine.petId);
        const status = getVaccineStatus(vaccine.nextDate);
        return `
            <article class="vaccine-card">
                <div class="vaccine-card-top">
                    <div>
                        <span class="vaccine-icon">💉</span>
                        <div class="vaccine-title-group">
                            <h3>${PT.esc(vaccine.name)}</h3>
                            <p>${PT.esc(pet?.name || "Mascota")}${pet?.species ? ` · ${PT.esc(pet.species)}` : ""}</p>
                        </div>
                    </div>
                    <span class="status-badge ${status.className}">${status.label}</span>
                </div>
                <div class="vaccine-info-grid">
                    <span>Aplicada: <strong>${PT.fmtDate(vaccine.appliedDate)}</strong></span>
                    <span>Próxima: <strong>${PT.fmtDate(vaccine.nextDate)}</strong></span>
                </div>
                ${vaccine.notes ? `<p class="vaccine-notes">${PT.esc(vaccine.notes)}</p>` : ""}
                <div class="vaccine-actions">\n                    <button type="button" class="btn btn-outline btn-small" data-edit-vaccine="${PT.esc(vaccine.id)}">Editar</button>\n                    <button type="button" class="btn btn-danger-outline btn-small" data-delete-vaccine="${PT.esc(vaccine.id)}">Eliminar</button>\n                </div>
            </article>
        `;
    }).join("");

    container.querySelectorAll("[data-edit-vaccine]").forEach(button => {
        button.addEventListener("click", () => editVaccine(button.dataset.editVaccine));
    });
    container.querySelectorAll("[data-delete-vaccine]").forEach(button => {
        button.addEventListener("click", () => deleteVaccine(button.dataset.deleteVaccine));
    });
}

function editVaccine(id) {
    const vaccine = PT.db().vaccines.find(item => item.id === id);
    if (!vaccine) return;

    $("vaccineId").value = vaccine.id;
    $("vaccinePet").value = vaccine.petId;
    $("vaccineName").value = vaccine.name;
    $("vaccineAppliedDate").value = vaccine.appliedDate || "";
    $("vaccineNextDate").value = vaccine.nextDate || "";
    $("vaccineNotes").value = vaccine.notes || "";
    $("saveVaccineBtn").textContent = "Guardar cambios";
    $("cancelVaccineEdit")?.classList.remove("hidden");
    $("vaccineForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteVaccine(id) {
    const vaccine = PT.db().vaccines.find(item => item.id === id);
    if (!vaccine) return;
    const pet = PT.db().pets.find(item => item.id === vaccine.petId);
    const confirmed = window.confirm(`¿Eliminar el registro de ${vaccine.name} de ${pet?.name || "la mascota"}?`);
    if (!confirmed) return;

    const vaccines = PT.db().vaccines.filter(item => item.id !== id);
    PT.write(PT.KEYS.VACCINES, vaccines);
    if ($("vaccineId").value === id) resetVaccineForm();
    loadVeterinarianVaccines();
    showMessage("vaccineMessage", "Registro de vacuna eliminado.", "success");
}

function getVaccineStatus(nextDate) {
    if (!nextDate) return { label: "Sin próxima dosis", className: "neutral" };
    const today = new Date(`${getTodayString()}T00:00:00`);
    const target = new Date(`${nextDate}T00:00:00`);
    const days = Math.ceil((target - today) / 86400000);
    if (days < 0) return { label: "Pendiente", className: "danger" };
    if (days <= 30) return { label: `Próxima en ${days} día${days === 1 ? "" : "s"}`, className: "warning" };
    return { label: "Al día", className: "success" };
}

function setupAvailabilityForm() {
    const form = $("availabilityForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();
        const vet = getCurrentVeterinarian();
        const date = $("availabilityDate").value;
        const start = $("startTime").value;
        const end = $("endTime").value;
        const duration = Number($("slotDuration").value);

        if (!vet) {
            showMessage("availabilityMessage", "Primero debes guardar tu perfil veterinario.", "error");
            return;
        }
        if (!date || !start || !end || !Number.isFinite(duration)) {
            showMessage("availabilityMessage", "Completa todos los campos.", "error");
            return;
        }
        if (date < getTodayString() || start >= end) {
            showMessage("availabilityMessage", "Verifica la fecha y el rango horario.", "error");
            return;
        }

        const slots = generateTimeSlots(start, end, duration);
        if (!slots.length) {
            showMessage("availabilityMessage", "El rango seleccionado no permite generar bloques.", "error");
            return;
        }

        const availability = PT.getAvailability();
        const existing = availability.find(item => item.vetId === vet.id && item.date === date);

        if (existing) {
            existing.slots = [...new Set([...(existing.slots || []), ...slots])].sort();
            existing.occupiedSlots = [...new Set(existing.occupiedSlots || [])]
                .filter(time => existing.slots.includes(time));
            existing.vetName = vet.name;
            existing.specialty = vet.specialty;
            existing.updatedAt = new Date().toISOString();
        } else {
            availability.push({
                id: PT.uid("disp"),
                vetId: vet.id,
                vetName: vet.name,
                specialty: vet.specialty,
                date,
                slots: [...new Set(slots)].sort(),
                occupiedSlots: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        PT.saveAvailability(availability);
        form.reset();
        setupDate();
        showMessage("availabilityMessage", "Disponibilidad publicada correctamente.", "success");
        });
}

function generateTimeSlots(start, end, duration) {
    const slots = [];
    let current = timeToMinutes(start);
    const finish = timeToMinutes(end);
    while (current + duration <= finish) {
        slots.push(minutesToTime(current));
        current += duration;
    }
    return slots;
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function dateToString(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function plural(count, one, many) {
    return count === 1 ? one : many;
}

function dayLabel(date, today) {
    const tomorrowDate = new Date(`${today}T00:00:00`);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    const formatted = formatDate(date);
    const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    if (date === today) return `Hoy, ${formatted}`;
    if (date === dateToString(tomorrowDate)) return `Mañana, ${formatted}`;
    return capitalized;
}

// Muestra cuántas citas tiene el veterinario hoy y cómo van.
function updateTodaySummary(todayAppointments) {
    const count = $("todayCount");
    const label = $("todayLabel");
    const detail = $("todayDetail");
    if (!count || !label || !detail) return;

    const total = todayAppointments.length;
    const attended = todayAppointments.filter(item => item.attendance === "attended").length;
    const missed = todayAppointments.filter(item => item.attendance === "missed").length;
    const pending = total - attended - missed;

    count.textContent = total;
    label.textContent = plural(total, "cita hoy", "citas hoy");
    detail.textContent = total === 0
        ? "No tienes citas para hoy."
        : `${pending} por atender, ${attended} ${plural(attended, "asistió", "asistieron")}, ${missed} ${plural(missed, "no asistió", "no asistieron")}.`;
}

function loadAppointments() {
    const container = $("vetAppointments");
    if (!container) return;

    const vet = getCurrentVeterinarian();
    if (!vet) {
        updateTodaySummary([]);
        return;
    }

    const today = getTodayString();
    const db = PT.db(); // Elimina del almacenamiento las citas de días anteriores.

    // Solo se muestran las citas de hoy y de los días siguientes.
    const appointments = db.appointments
        .filter(item => item.vetId === vet.id && item.date >= today)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    updateTodaySummary(appointments.filter(item => item.date === today && item.status !== "Cancelada"));

    if (!appointments.length) {
        container.innerHTML = `<div class="empty-state">No tienes citas para hoy ni para los próximos días.</div>`;
        return;
    }

    const groups = new Map();
    appointments.forEach(item => {
        if (!groups.has(item.date)) groups.set(item.date, []);
        groups.get(item.date).push(item);
    });

    container.innerHTML = Array.from(groups, ([date, items]) => `
        <h3 class="appointment-day">${PT.esc(dayLabel(date, today))}</h3>
        ${items.map(item => renderVetAppointment(item, db, today)).join("")}
    `).join("");
}

function renderVetAppointment(appointment, db, today) {
    const pet = db.pets.find(item => item.id === appointment.petId);
    const tutorName = appointment.tutorName || "Tutor no registrado";
    const tutorEmail = appointment.tutorEmail || "Correo no registrado";
    const cancelled = appointment.status === "Cancelada";
    const id = PT.esc(appointment.id);

    let badge = `<span class="status-badge">${PT.esc(appointment.status || "Programada")}</span>`;
    if (cancelled) badge = `<span class="status-badge danger">Cancelada</span>`;
    else if (appointment.attendance === "attended") badge = `<span class="status-badge success">Asistió</span>`;
    else if (appointment.attendance === "missed") badge = `<span class="status-badge danger">No asistió</span>`;

    let actions = "";
    if (!cancelled && appointment.date !== today) {
        actions = `<div class="appointment-actions"><span class="appointment-note">Podrás registrar la asistencia el día de la cita.</span></div>`;
    } else if (!cancelled && appointment.attendance) {
        actions = `
            <div class="appointment-actions">
                <button type="button" class="btn btn-outline btn-small" data-attendance-id="${id}" data-attendance-value="reset">Corregir</button>
            </div>`;
    } else if (!cancelled) {
        actions = `
            <div class="appointment-actions">
                <button type="button" class="btn btn-primary btn-small" data-attendance-id="${id}" data-attendance-value="attended">Asistió</button>
                <button type="button" class="btn btn-danger-outline btn-small" data-attendance-id="${id}" data-attendance-value="missed">No asistió</button>
            </div>`;
    }

    return `
        <article class="appointment-card${cancelled ? " is-cancelled" : ""}">
            <div class="appointment-top">
                <div>
                    <h3>${PT.esc(pet?.name || "Mascota")}</h3>
                    <p>${PT.esc(appointment.reason || "Consulta veterinaria")}</p>
                </div>
                ${badge}
            </div>
            <div class="appointment-info appointment-scheduled-info">
                <span><strong>📅 Fecha</strong>${PT.fmtDate(appointment.date)}</span>
                <span><strong>🕐 Hora</strong>${PT.esc(appointment.time || "No registrada")}</span>
                <span><strong>🐾 Mascota</strong>${PT.esc(pet?.name || "No disponible")}</span>
                <span><strong>👤 Tutor</strong>${PT.esc(tutorName)}</span>
                <span><strong>✉️ Correo</strong>${PT.esc(tutorEmail)}</span>
            </div>
            ${actions}
        </article>
    `;
}

function setupAppointmentActions() {
    const container = $("vetAppointments");
    if (!container) return;

    container.addEventListener("click", event => {
        const button = event.target.closest("[data-attendance-value]");
        if (!button) return;

        const vet = getCurrentVeterinarian();
        if (!vet) return;

        const value = button.dataset.attendanceValue;
        PT.setAttendance(button.dataset.attendanceId, vet.id, value === "reset" ? null : value);
        loadAppointments();
    });
}

function setupLogout() {
    $("logoutBtn")?.addEventListener("click", () => {
        PT.logout();
        window.location.href = "index.html";
    });
}

function showMessage(elementId, message, type) {
    const element = $(elementId);
    if (!element) return;
    element.textContent = message;
    element.className = `form-message ${type}`;
    window.setTimeout(() => {
        element.textContent = "";
        element.className = "form-message";
    }, 4500);
}

function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
