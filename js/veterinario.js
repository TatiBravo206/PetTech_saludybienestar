const AVAILABILITY_STORAGE_KEY = "PetTech_disponibilidad";

const $ = id => document.getElementById(id);

function getSession() {
    return PT.session();
}

function getTodayString() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function getStorage(key, fallback = []) {
    return PT.read(key, fallback) || fallback;
}

function saveStorage(key, value) {
    PT.write(key, value);
}

function getCurrentVeterinarian() {
    const session = getSession();
    if (!session) return null;
    const vets = getStorage(PT.KEYS.VETS, []);
    return vets.find(vet => vet.id === session.vetId || (session.email && vet.email === session.email)) || null;
}

function initializeVeterinarian() {
    const session = getSession();
    if (!session || session.role !== "veterinario") {
        window.location.href = "index.html";
        return;
    }

    setupDate();
    loadVeterinarianProfile();
    setupProfileForm();
    setupVaccineForm();
    loadVaccinePets();
    loadVeterinarianVaccines();
    setupAvailabilityForm();
    loadAppointments();
    setupLogout();
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
    $("vetName").value = vet.name || "";
    $("vetSpecialty").value = vet.specialty || "";
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
        localStorage.setItem("PetTech_sesion", JSON.stringify({ ...session, vetId: vet.id }));
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
    const pets = db.pets.filter(pet => pet.tutorId || !pet.tutorId);

    select.innerHTML = `<option value="">Selecciona una mascota</option>`;
    pets.forEach(pet => {
        const tutor = db.pets.find(item => item.id === pet.id)?.tutorId;
        const option = document.createElement("option");
        option.value = pet.id;
        option.textContent = `${pet.name} (${pet.species})${tutor ? "" : " · sin tutor asociado"}`;
        select.appendChild(option);
    });

    if (pets.some(pet => pet.id === current)) select.value = current;
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
        const record = {
            id: id || PT.uid("vax"),
            petId,
            tutorId: pet.tutorId || null,
            vetId: vet.id,
            vetName: vet.name,
            name,
            appliedDate,
            nextDate,
            notes,
            updatedAt: new Date().toISOString()
        };

        const index = vaccines.findIndex(vaccine => vaccine.id === id);
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

        const availability = getStorage(AVAILABILITY_STORAGE_KEY, []);
        const existing = availability.find(item => item.vetId === vet.id && item.date === date);
        if (existing) {
            existing.slots = [...new Set([...existing.slots, ...slots])].sort();
            existing.updatedAt = new Date().toISOString();
        } else {
            availability.push({ id: PT.uid("disp"), vetId: vet.id, vetName: vet.name, specialty: vet.specialty, date, slots, createdAt: new Date().toISOString() });
        }
        saveStorage(AVAILABILITY_STORAGE_KEY, availability);
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

function loadAppointments() {
    const container = $("vetAppointments");
    if (!container) return;
    const vet = getCurrentVeterinarian();
    if (!vet) return;

    const db = PT.db();
    const appointments = db.appointments
        .filter(item => item.vetId === vet.id)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    if (!appointments.length) {
        container.innerHTML = `<div class="empty-state">Todavía no tienes citas programadas.</div>`;
        return;
    }

    container.innerHTML = appointments.map(appointment => {
        const pet = db.pets.find(item => item.id === appointment.petId);
        const tutorName = appointment.tutorName || "Tutor no registrado";
        const tutorEmail = appointment.tutorEmail || "Correo no registrado";

        return `
            <article class="appointment-card">
                <div class="appointment-top">
                    <div>
                        <h3>${PT.esc(pet?.name || "Mascota")}</h3>
                        <p>${PT.esc(appointment.reason || "Consulta veterinaria")}</p>
                    </div>
                    <span class="status-badge">${PT.esc(appointment.status || "Programada")}</span>
                </div>
                <div class="appointment-info appointment-scheduled-info">
                    <span><strong>📅 Fecha</strong>${PT.fmtDate(appointment.date)}</span>
                    <span><strong>🕐 Hora</strong>${PT.esc(appointment.time || "No registrada")}</span>
                    <span><strong>🐾 Mascota</strong>${PT.esc(pet?.name || "No disponible")}</span>
                    <span><strong>👤 Tutor</strong>${PT.esc(tutorName)}</span>
                    <span><strong>✉️ Correo</strong>${PT.esc(tutorEmail)}</span>
                </div>
            </article>
        `;
    }).join("");
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
