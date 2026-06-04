// Global State variables
let state = {
    activeRole: 'paul', // 'paul' or 'emily'
    activeTab: 'paul-dashboard', // default tab
    records: [],
    tasks: []
};

// Global chart instances
let paulChartInstance = null;
let emilyChartInstance = null;
let selectedFileMetadata = null; // Temp holder for file uploads

// App Initialization
document.addEventListener("DOMContentLoaded", async () => {
    await initDatabase();
    setDefaultDateInput();
    renderNavigation();
    navigateToTab(state.activeTab);
    lucide.createIcons();
});

// Sync data from Express Server API
async function initDatabase() {
    // Load active role simulation preference from local storage
    const storedRole = localStorage.getItem("mindreg_active_role");
    if (storedRole) {
        state.activeRole = storedRole;
        if (state.activeRole === 'paul') {
            state.activeTab = 'paul-dashboard';
        } else {
            state.activeTab = 'emily-dashboard';
        }
    }
    
    // Sync UI view theme class
    updateThemeClass();

    // Fetch data from server
    try {
        const recordsRes = await fetch('/api/records');
        if (recordsRes.ok) {
            state.records = await recordsRes.json();
        }

        const tasksRes = await fetch('/api/tasks');
        if (tasksRes.ok) {
            state.tasks = await tasksRes.json();
        }
    } catch (err) {
        console.error("Error cargando base de datos desde el servidor:", err);
        alert("⚠️ No se pudo conectar con el servidor de Node.js. Asegúrate de que esté corriendo.");
    }
}

function updateThemeClass() {
    const btnPaul = document.getElementById('btn-role-paul');
    const btnEmily = document.getElementById('btn-role-emily');
    const badgeText = document.getElementById('role-badge-text');

    if (state.activeRole === 'paul') {
        document.body.classList.remove('role-emily-theme');
        if (btnPaul) btnPaul.classList.add('active');
        if (btnEmily) btnEmily.classList.remove('active');
        if (badgeText) badgeText.innerText = "Paul (Paciente)";
    } else {
        document.body.classList.add('role-emily-theme');
        if (btnPaul) btnPaul.classList.remove('active');
        if (btnEmily) btnEmily.classList.add('active');
        if (badgeText) badgeText.innerText = "Emily (Psicóloga)";
    }
}

// Set current time in record form date picker
function setDefaultDateInput() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    const dateTimeLocal = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    const dateInput = document.getElementById("record-date");
    if (dateInput) dateInput.value = dateTimeLocal;
}

// Render dynamic tabs depending on the active role
function renderNavigation() {
    const navContainer = document.getElementById("nav-links-container");
    navContainer.innerHTML = "";

    const paulLinks = [
        { id: "paul-dashboard", label: "Mi Progreso", icon: "layout-dashboard" },
        { id: "paul-new-record", label: "Nuevo Registro", icon: "plus-circle" },
        { id: "paul-history", label: "Historial", icon: "history" },
        { id: "paul-tasks", label: "Mis Tareas", icon: "check-square" }
    ];

    const emilyLinks = [
        { id: "emily-dashboard", label: "Resumen Clínico", icon: "gauge" },
        { id: "emily-records", label: "Ver Registros de Paul", icon: "folder-heart" },
        { id: "emily-assign-task", label: "Asignar Tareas", icon: "clipboard-list" }
    ];

    const activeLinks = state.activeRole === 'paul' ? paulLinks : emilyLinks;

    activeLinks.forEach(link => {
        const btn = document.createElement("button");
        btn.id = `nav-tab-${link.id}`;
        btn.className = "nav-tab";
        btn.onclick = () => navigateToTab(link.id);
        btn.innerHTML = `<i data-lucide="${link.icon}"></i> ${link.label}`;
        navContainer.appendChild(btn);
    });

    lucide.createIcons();
}

// Handle switching between patient and therapist simulator views
function switchRole(role) {
    state.activeRole = role;
    localStorage.setItem("mindreg_active_role", role);
    
    // Choose default tab
    state.activeTab = role === 'paul' ? 'paul-dashboard' : 'emily-dashboard';
    
    updateThemeClass();
    renderNavigation();
    navigateToTab(state.activeTab);
}

// Tab navigation handler
async function navigateToTab(tabId) {
    state.activeTab = tabId;
    
    // Hide all sections
    document.querySelectorAll(".content-section").forEach(sec => {
        sec.classList.remove("active");
    });

    // Show selected section
    const targetSection = document.getElementById(`section-${tabId}`);
    if (targetSection) {
        targetSection.classList.add("active");
    }

    // Update active class on tab buttons
    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.classList.remove("active");
    });
    const activeBtn = document.getElementById(`nav-tab-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add("active");
    }

    // Dynamic data fetch on tab navigation to keep synced
    try {
        if (tabId === 'paul-dashboard' || tabId === 'emily-dashboard' || tabId === 'paul-history' || tabId === 'emily-records') {
            const res = await fetch('/api/records');
            if (res.ok) state.records = await res.json();
        }
        if (tabId === 'paul-tasks' || tabId === 'emily-assign-task' || tabId === 'paul-dashboard' || tabId === 'emily-dashboard') {
            const res = await fetch('/api/tasks');
            if (res.ok) state.tasks = await res.json();
        }
    } catch (e) {
        console.warn("Error auto-sincronizando con el servidor:", e.message);
    }

    // Custom tab trigger renders
    if (tabId === 'paul-dashboard') {
        renderPaulDashboard();
    } else if (tabId === 'paul-history') {
        renderPaulHistory();
    } else if (tabId === 'paul-new-record') {
        setDefaultDateInput();
        updateIntensityDisplay(50);
        document.getElementById("form-self-record").reset();
        document.getElementById("record-intensity").value = 50;
    } else if (tabId === 'paul-tasks') {
        renderPaulTasks();
    } else if (tabId === 'emily-dashboard') {
        renderEmilyDashboard();
    } else if (tabId === 'emily-records') {
        renderEmilyRecords();
    } else if (tabId === 'emily-assign-task') {
        renderEmilyTasksPanel();
    }
}

// --- PACIENT FLOW (PAUL) ---

// Updates label for intensity slider
function updateIntensityDisplay(val) {
    const display = document.getElementById("intensity-value-display");
    if (display) {
        display.innerText = val + "%";
    }
}

// Save emotional record via API POST
async function saveSelfRecord(e) {
    e.preventDefault();

    const dateVal = document.getElementById("record-date").value;
    const thoughtVal = document.getElementById("record-thought").value;
    const intensityVal = parseInt(document.getElementById("record-intensity").value);
    const conductVal = document.getElementById("record-conduct").value;
    
    // Get checked emotions
    const emotionsChecked = [];
    document.querySelectorAll("input[name='emotions']:checked").forEach(checkbox => {
        emotionsChecked.push(checkbox.value);
    });

    if (emotionsChecked.length === 0) {
        alert("Por favor, selecciona al menos una emoción.");
        return;
    }

    try {
        const res = await fetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: dateVal,
                thought: thoughtVal,
                emotions: emotionsChecked,
                intensity: intensityVal,
                conduct: conductVal
            })
        });

        if (!res.ok) throw new Error("Error guardando el registro.");
        
        const savedRecord = await res.json();
        state.records.push(savedRecord);
        navigateToTab('paul-dashboard');
    } catch (err) {
        console.error(err);
        alert("No se pudo conectar al servidor para guardar el autorregistro.");
    }
}

// Populate stats & render chart on Paul's dashboard
function renderPaulDashboard() {
    // 1. Stats Counter
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRecords = state.records.filter(r => {
        if (r.type !== 'record') return false;
        const rDate = new Date(r.date);
        return rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear;
    });

    document.getElementById("paul-stat-count").innerText = monthlyRecords.length;

    // 2. Average intensity
    const totalIntensity = monthlyRecords.reduce((sum, r) => sum + r.intensity, 0);
    const avgIntensity = monthlyRecords.length > 0 ? Math.round(totalIntensity / monthlyRecords.length) : 0;
    document.getElementById("paul-stat-avg-intensity").innerText = avgIntensity + "%";

    // 3. Render mini tasks checklist
    renderPaulMiniTasks();

    // 4. Render Evolution Chart
    renderChart('chart-paul-evolution', 'paul');
}

// Display top 3 tasks on Patient Dashboard
function renderPaulMiniTasks() {
    const container = document.getElementById("paul-mini-tasks-container");
    container.innerHTML = "";

    const pendingTasks = state.tasks.filter(t => !t.completed).slice(0, 3);

    if (pendingTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state-mini">
                <p style="font-size: 0.85rem; color: var(--text-secondary);">🎉 ¡No tienes tareas pendientes asignadas!</p>
            </div>
        `;
        return;
    }

    pendingTasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "mini-task-item";
        
        const dueText = formatFriendlyDate(task.due);
        item.innerHTML = `
            <span class="task-dot"></span>
            <div style="flex-grow: 1;">
                <div style="font-weight: 500; font-size: 0.85rem;">${task.title}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">Límite: ${dueText}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Render patient Tasks view
function renderPaulTasks() {
    const container = document.getElementById("paul-tasks-container");
    container.innerHTML = "";

    if (state.tasks.length === 0) {
        container.innerHTML = `
            <div class="card empty-state" style="grid-column: 1/-1;">
                <i data-lucide="check-square"></i>
                <h3>No hay tareas</h3>
                <p>La Dra. Emily aún no ha asignado tareas en el sistema.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const sortedTasks = [...state.tasks].sort((a, b) => a.completed - b.completed);

    sortedTasks.forEach(task => {
        const card = document.createElement("div");
        card.className = `card task-card ${task.completed ? 'completed' : ''}`;
        
        const dueText = formatFriendlyDate(task.due);
        
        let replyBtnHTML = "";
        let submissionHTML = "";
        
        if (!task.completed) {
            replyBtnHTML = `
                <button class="btn btn-primary" onclick="openTaskReplyModal('${task.id}', '${task.title.replace(/'/g, "\\'")}')">
                    <i data-lucide="file-up"></i> Entregar Tarea
                </button>
            `;
        } else {
            let fileHTML = "";
            if (task.file) {
                fileHTML = `
                    <div style="margin-top: 0.65rem; display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Archivo Adjunto:</span>
                        <a href="${task.file.path}" download="${task.file.originalName}" target="_blank" class="file-attachment-tag">
                            <i data-lucide="paperclip"></i> ${task.file.originalName} (${task.file.size})
                        </a>
                    </div>
                `;
            }

            submissionHTML = `
                <div class="task-reply-submission">
                    <span class="submission-header">Tu Respuesta:</span>
                    <p class="submission-content">${task.reply}</p>
                    ${fileHTML}
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:0.5rem;">
                        Entregado el ${formatDateTimeString(task.completedDate)}
                    </span>
                </div>
            `;
        }

        card.innerHTML = `
            <div>
                <div class="task-card-header">
                    <div class="task-title-group">
                        <h3>${task.title}</h3>
                        <span class="task-due-date">Fecha límite: ${dueText}</span>
                    </div>
                    <span class="task-status-badge ${task.completed ? 'completed' : ''}">
                        ${task.completed ? 'Completada' : 'Pendiente'}
                    </span>
                </div>
                <p class="task-desc-text" style="margin-top: 1rem; margin-bottom: 1rem;">${task.desc}</p>
                ${submissionHTML}
            </div>
            <div style="margin-top: 1rem;">
                ${replyBtnHTML}
            </div>
        `;
        
        container.appendChild(card);
    });

    lucide.createIcons();
}

// Open / Close Consultation Modal
function openConsultationModal() {
    const modal = document.getElementById("modal-consultation");
    modal.classList.add("active");
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    document.getElementById("consultation-date").value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function closeConsultationModal() {
    document.getElementById("modal-consultation").classList.remove("active");
    document.getElementById("form-consultation").reset();
}

// Save consultation details via API
async function saveConsultation(e) {
    e.preventDefault();

    const dateVal = document.getElementById("consultation-date").value;
    const notesVal = document.getElementById("consultation-notes").value;

    try {
        const res = await fetch('/api/consultations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: dateVal,
                notes: notesVal
            })
        });

        if (!res.ok) throw new Error("Error guardando consulta.");

        const savedConsultation = await res.json();
        state.records.push(savedConsultation);

        closeConsultationModal();
        renderPaulDashboard();
    } catch (err) {
        console.error(err);
        alert("No se pudo guardar la consulta.");
    }
}

// Open / Close Task Reply Modal
function openTaskReplyModal(id, title) {
    document.getElementById("reply-task-id").value = id;
    document.getElementById("reply-task-title").innerHTML = `Asignación: <strong>${title}</strong>`;
    document.getElementById("modal-task-reply").classList.add("active");
}

function closeTaskReplyModal() {
    document.getElementById("modal-task-reply").classList.remove("active");
    document.getElementById("form-task-reply").reset();
    removeSelectedFile();
}

// Save response to task + upload file with Multipart FormData
async function saveTaskReply(e) {
    e.preventDefault();

    const taskId = document.getElementById("reply-task-id").value;
    const replyVal = document.getElementById("reply-content").value;
    const fileInput = document.getElementById("reply-file");

    const formData = new FormData();
    formData.append("reply", replyVal);
    if (fileInput && fileInput.files[0]) {
        formData.append("attachment", fileInput.files[0]);
    }

    try {
        const res = await fetch(`/api/tasks/${taskId}/reply`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error("Error al entregar la tarea.");

        const savedTask = await res.json();

        // Sync local state
        const taskIndex = state.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            state.tasks[taskIndex] = savedTask;
        }

        closeTaskReplyModal();
        renderPaulTasks();
    } catch (err) {
        console.error(err);
        alert("Error de conexión. No se pudo entregar la tarea en el servidor.");
    }
}

// File Attachment Event Handlers (Preview before uploading)
function handleFileSelected(input) {
    const filePreview = document.getElementById("file-preview-container");
    const previewFilename = document.getElementById("preview-filename");
    const previewFilesize = document.getElementById("preview-filesize");
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const sizeInKB = Math.round(file.size / 1024);
        
        selectedFileMetadata = {
            name: file.name,
            size: sizeInKB + " KB",
            type: file.type
        };
        
        if (previewFilename) previewFilename.innerText = file.name;
        if (previewFilesize) previewFilesize.innerText = selectedFileMetadata.size;
        if (filePreview) filePreview.style.display = "flex";
        lucide.createIcons();
    }
}

function removeSelectedFile() {
    const fileInput = document.getElementById("reply-file");
    const filePreview = document.getElementById("file-preview-container");
    
    if (fileInput) fileInput.value = "";
    if (filePreview) filePreview.style.display = "none";
    selectedFileMetadata = null;
}

// Render Patient's records history
function renderPaulHistory(filteredRecords = null) {
    const feedContainer = document.getElementById("paul-records-feed");
    feedContainer.innerHTML = "";

    const recordsToRender = filteredRecords || [...state.records].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (recordsToRender.length === 0) {
        feedContainer.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="folder-open"></i>
                <h3>No hay registros</h3>
                <p>No se encontraron autorregistros con los filtros aplicados.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    recordsToRender.forEach(item => {
        const card = document.createElement("div");
        
        if (item.type === 'record') {
            card.className = "card record-card";
            
            let emotionsChips = "";
            item.emotions.forEach(emo => {
                const emotionClass = "emo-" + emo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                emotionsChips += `<span class="emotion-chip size-small ${emotionClass}">${emo}</span> `;
            });

            const intensityClass = item.intensity >= 80 ? 'high-intensity' : '';
            
            let feedbackHTML = "";
            if (item.feedback) {
                feedbackHTML = `
                    <div class="record-feedback-section">
                        <div class="feedback-card-content">
                            <div class="feedback-header">
                                <span><i data-lucide="message-square"></i> Dra. Emily Mejias</span>
                                <span>${formatDateTimeString(item.feedbackDate)}</span>
                            </div>
                            <p class="feedback-text">${item.feedback}</p>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="record-card-header">
                    <div class="record-type-date">
                        <span class="record-title-badge record-badge"><i data-lucide="clipboard-signature"></i> Autorregistro</span>
                        <span class="record-date-str">${formatDateTimeString(item.date)}</span>
                    </div>
                    <span class="record-intensity-badge ${intensityClass}">Intensidad: ${item.intensity}%</span>
                </div>
                <div class="record-card-body">
                    <div class="thought-box">
                        <span class="box-title"><i data-lucide="brain"></i> Pensamiento Automático</span>
                        <p class="thought-text">"${item.thought}"</p>
                    </div>
                    <div class="record-emotions-row">
                        <span class="emotions-label">Emociones:</span>
                        <div class="emotions-list">${emotionsChips}</div>
                    </div>
                    <div class="conduct-box">
                        <span class="box-title"><i data-lucide="activity"></i> Conducta resultante</span>
                        <p class="conduct-text">${item.conduct}</p>
                    </div>
                    ${feedbackHTML}
                </div>
            `;
        } else {
            card.className = "card record-card consultation-type";
            const notesText = item.notes ? item.notes : "Sin notas adicionales.";

            card.innerHTML = `
                <div class="record-card-header">
                    <div class="record-type-date">
                        <span class="record-title-badge consultation-badge"><i data-lucide="calendar-heart"></i> Consulta Psicológica</span>
                        <span class="record-date-str">${formatDateTimeString(item.date)}</span>
                    </div>
                </div>
                <div class="record-card-body">
                    <div class="clinical-notes-box" style="border-color: rgba(244,63,94,0.2); background: rgba(244,63,94,0.02)">
                        <span class="box-title" style="color: var(--color-accent)"><i data-lucide="sticky-note"></i> Apuntes de Sesión</span>
                        <p class="notes-text">${notesText}</p>
                    </div>
                </div>
            `;
        }
        
        feedContainer.appendChild(card);
    });

    lucide.createIcons();
}

// Handle search queries and filters on Patient view
function applyFilters() {
    const searchVal = document.getElementById("filter-search").value.toLowerCase();
    const emotionVal = document.getElementById("filter-emotion").value;
    const minIntensityVal = parseInt(document.getElementById("filter-intensity-min").value);
    const dateFromVal = document.getElementById("filter-date-from").value;
    const dateToVal = document.getElementById("filter-date-to").value;

    const filtered = state.records.filter(item => {
        if (item.type === 'record') {
            const matchesText = item.thought.toLowerCase().includes(searchVal) || item.conduct.toLowerCase().includes(searchVal);
            if (!matchesText) return false;
            
            if (emotionVal && !item.emotions.includes(emotionVal)) return false;
            if (item.intensity < minIntensityVal) return false;
        } else {
            const matchesText = item.notes.toLowerCase().includes(searchVal);
            if (!matchesText) return false;
            
            if (emotionVal) return false; // Consultations don't have emotions
            if (minIntensityVal > 0) return false;
        }

        if (dateFromVal) {
            const dateItem = new Date(item.date);
            const dateFrom = new Date(dateFromVal + "T00:00");
            if (dateItem < dateFrom) return false;
        }

        if (dateToVal) {
            const dateItem = new Date(item.date);
            const dateTo = new Date(dateToVal + "T23:59");
            if (dateItem > dateTo) return false;
        }

        return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderPaulHistory(filtered);
}

// Reset patient filters
function resetFilters() {
    document.getElementById("filter-search").value = "";
    document.getElementById("filter-emotion").value = "";
    document.getElementById("filter-intensity-min").value = 0;
    document.getElementById("filter-intensity-min").nextElementSibling.innerText = "0%";
    document.getElementById("filter-date-from").value = "";
    document.getElementById("filter-date-to").value = "";
    
    applyFilters();
}

// Export logs database to CSV format
function exportDataCSV() {
    if (state.records.length === 0) {
        alert("No hay registros para exportar.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Tipo,Fecha y Hora,Pensamiento Automatico / Notas,Intensidad,Emociones,Conducta\n";

    const sorted = [...state.records].sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach(r => {
        let type = r.type === 'record' ? 'Autorregistro' : 'Consulta';
        let date = formatDateTimeString(r.date).replace(/,/g, '');
        let content = r.type === 'record' ? r.thought : r.notes;
        let intensity = r.type === 'record' ? r.intensity : 'N/A';
        let emotions = r.type === 'record' ? r.emotions.join('|') : 'N/A';
        let conduct = r.type === 'record' ? r.conduct : 'N/A';

        content = `"${content.replace(/"/g, '""')}"`;
        if (conduct !== 'N/A') {
            conduct = `"${conduct.replace(/"/g, '""')}"`;
        }

        csvContent += `${type},${date},${content},${intensity},${emotions},${conduct}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mindreg_reporte_${PaulUrdanetaDateSlug()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function PaulUrdanetaDateSlug() {
    const d = new Date();
    return `${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}`;
}

// --- THERAPIST FLOW (EMILY) ---

// Render clinician profile header and quick summary metrics
function renderEmilyDashboard() {
    // 1. Records count
    const totalRecords = state.records.filter(r => r.type === 'record').length;
    document.getElementById("emily-stat-records-count").innerText = totalRecords;

    // 2. Average intensity
    const totalIntensity = state.records.filter(r => r.type === 'record').reduce((sum, r) => sum + r.intensity, 0);
    const avgIntensity = totalRecords > 0 ? Math.round(totalIntensity / totalRecords) : 0;
    document.getElementById("emily-stat-alert-intensity").innerText = avgIntensity + "%";

    // 3. Completed tasks count
    const completedTasks = state.tasks.filter(t => t.completed).length;
    document.getElementById("emily-stat-tasks-done").innerText = `${completedTasks}/${state.tasks.length}`;

    // 4. Session statistics
    const consultations = state.records.filter(r => r.type === 'consultation').sort((a,b) => new Date(b.date) - new Date(a.date));
    const consultationsCountEl = document.getElementById("emily-consultations-count");
    const lastConsultationDateEl = document.getElementById("emily-last-consultation-date");

    if (consultationsCountEl) consultationsCountEl.innerText = consultations.length;
    
    if (consultations.length > 0) {
        if (lastConsultationDateEl) lastConsultationDateEl.innerText = formatDateTimeString(consultations[0].date);
    } else {
        if (lastConsultationDateEl) lastConsultationDateEl.innerText = "No registrada";
    }

    // 5. Render evolution chart
    renderChart('chart-emily-evolution', 'emily');
}

// Assign and save new therapists tasks via API
async function saveAssignedTask(e) {
    e.preventDefault();

    const title = document.getElementById("task-title").value;
    const desc = document.getElementById("task-desc").value;
    const due = document.getElementById("task-due").value;

    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, desc, due })
        });

        if (!res.ok) throw new Error("Error asignando tarea.");
        
        const savedTask = await res.json();
        state.tasks.push(savedTask);

        document.getElementById("form-assign-task").reset();
        renderEmilyTasksPanel();
    } catch (err) {
        console.error(err);
        alert("No se pudo asignar la tarea en el servidor.");
    }
}

// Render Emily's tasks control panel
function renderEmilyTasksPanel() {
    const container = document.getElementById("emily-assigned-tasks-container");
    container.innerHTML = "";

    if (state.tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="clipboard-list"></i>
                <p>Aún no has asignado ninguna tarea a Paul.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const sorted = [...state.tasks].sort((a, b) => new Date(b.due) - new Date(a.due));

    sorted.forEach(task => {
        const row = document.createElement("div");
        row.className = "assigned-task-row";
        
        let statusBadge = `<span class="task-status-badge">Pendiente</span>`;
        let submissionHTML = "";

        if (task.completed) {
            statusBadge = `<span class="task-status-badge completed">Entregada</span>`;
            
            let fileHTML = "";
            if (task.file) {
                fileHTML = `
                    <div style="margin-top: 0.65rem; display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Archivo Adjunto:</span>
                        <a href="${task.file.path}" download="${task.file.originalName}" target="_blank" class="file-attachment-tag">
                            <i data-lucide="paperclip"></i> ${task.file.originalName} (${task.file.size})
                        </a>
                    </div>
                `;
            }

            submissionHTML = `
                <div class="task-reply-submission" style="margin-top: 0.75rem; border-color: rgba(16,185,129,0.15); background: rgba(16,185,129,0.01);">
                    <span class="submission-header" style="color: var(--color-psy)">Respuesta de Paul:</span>
                    <p class="submission-content" style="font-size: 0.85rem;">"${task.reply}"</p>
                    ${fileHTML}
                    <span style="font-size: 0.7rem; color: var(--text-muted); display:block; margin-top:0.35rem;">
                        Entregado: ${formatDateTimeString(task.completedDate)}
                    </span>
                </div>
            `;
        }

        row.innerHTML = `
            <div class="assigned-task-row-header">
                <div>
                    <h4>${task.title}</h4>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Límite: ${formatFriendlyDate(task.due)}</span>
                </div>
                ${statusBadge}
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${task.desc}</p>
            ${submissionHTML}
        `;

        container.appendChild(row);
    });

    lucide.createIcons();
}

// Render Emily's records viewer
function renderEmilyRecords(filteredRecords = null) {
    const feedContainer = document.getElementById("emily-records-feed");
    feedContainer.innerHTML = "";

    const recordsToRender = filteredRecords || [...state.records].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (recordsToRender.length === 0) {
        feedContainer.innerHTML = `
            <div class="card empty-state">
                <i data-lucide="search-code"></i>
                <h3>Búsqueda vacía</h3>
                <p>No hay registros clínicos que coincidan con los filtros.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    recordsToRender.forEach(item => {
        const card = document.createElement("div");
        
        if (item.type === 'record') {
            card.className = "card record-card";
            
            let emotionsChips = "";
            item.emotions.forEach(emo => {
                const emotionClass = "emo-" + emo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                emotionsChips += `<span class="emotion-chip size-small ${emotionClass}">${emo}</span> `;
            });

            const intensityClass = item.intensity >= 80 ? 'high-intensity' : '';
            
            let feedbackActionHTML = "";
            if (item.feedback) {
                feedbackActionHTML = `
                    <div class="record-feedback-section">
                        <div class="feedback-card-content" style="border-color: rgba(16, 185, 129, 0.35); background: rgba(16, 185, 129, 0.05)">
                            <div class="feedback-header">
                                <span><i data-lucide="message-square"></i> Tu Comentario Clínico</span>
                                <span>${formatDateTimeString(item.feedbackDate)}</span>
                            </div>
                            <p class="feedback-text">${item.feedback}</p>
                            <button class="btn btn-text text-teal" style="font-size: 0.75rem; margin-top: 0.25rem;" onclick="openClinicalCommentModal('${item.id}', '${item.feedback.replace(/'/g, "\\'")}')">
                                <i data-lucide="edit-3" style="width:0.8rem; height:0.8rem;"></i> Editar Comentario
                            </button>
                        </div>
                    </div>
                `;
            } else {
                feedbackActionHTML = `
                    <div class="record-feedback-section" style="display:flex; justify-content: flex-end;">
                        <button class="btn btn-secondary" onclick="openClinicalCommentModal('${item.id}')">
                            <i data-lucide="message-circle-plus" class="text-teal"></i> Dejar Orientación Clínica
                        </button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="record-card-header">
                    <div class="record-type-date">
                        <span class="record-title-badge record-badge"><i data-lucide="clipboard-signature"></i> Autorregistro</span>
                        <span class="record-date-str">${formatDateTimeString(item.date)}</span>
                    </div>
                    <span class="record-intensity-badge ${intensityClass}">Intensidad: ${item.intensity}%</span>
                </div>
                <div class="record-card-body">
                    <div class="thought-box">
                        <span class="box-title"><i data-lucide="brain"></i> Pensamiento Automático</span>
                        <p class="thought-text">"${item.thought}"</p>
                    </div>
                    <div class="record-emotions-row">
                        <span class="emotions-label">Emociones:</span>
                        <div class="emotions-list">${emotionsChips}</div>
                    </div>
                    <div class="conduct-box">
                        <span class="box-title"><i data-lucide="activity"></i> Conducta</span>
                        <p class="thought-text">${item.conduct}</p>
                    </div>
                    ${feedbackActionHTML}
                </div>
            `;
        } else {
            card.className = "card record-card consultation-type";
            const notesText = item.notes ? item.notes : "Sin notas adicionales.";

            card.innerHTML = `
                <div class="record-card-header">
                    <div class="record-type-date">
                        <span class="record-title-badge consultation-badge"><i data-lucide="calendar-heart"></i> Consulta Psicológica</span>
                        <span class="record-date-str">${formatDateTimeString(item.date)}</span>
                    </div>
                </div>
                <div class="record-card-body">
                    <div class="clinical-notes-box" style="border-color: rgba(244,63,94,0.2); background: rgba(244,63,94,0.02)">
                        <span class="box-title" style="color: var(--color-accent)"><i data-lucide="sticky-note"></i> Apuntes de Sesión</span>
                        <p class="notes-text">${notesText}</p>
                    </div>
                </div>
            `;
        }
        
        feedContainer.appendChild(card);
    });

    lucide.createIcons();
}

// Search and filter records for psychologist panel
function applyFiltersEmily() {
    const searchVal = document.getElementById("emily-filter-search").value.toLowerCase();
    const emotionVal = document.getElementById("emily-filter-emotion").value;
    const minIntensityVal = parseInt(document.getElementById("emily-filter-intensity-min").value);
    const typeVal = document.getElementById("emily-filter-type").value;

    const filtered = state.records.filter(item => {
        if (typeVal === 'records' && item.type !== 'record') return false;
        if (typeVal === 'consultations' && item.type !== 'consultation') return false;

        if (item.type === 'record') {
            const matchesText = item.thought.toLowerCase().includes(searchVal) || item.conduct.toLowerCase().includes(searchVal);
            if (!matchesText) return false;
            
            if (emotionVal && !item.emotions.includes(emotionVal)) return false;
            if (item.intensity < minIntensityVal) return false;
        } else {
            const matchesText = item.notes.toLowerCase().includes(searchVal);
            if (!matchesText) return false;
            
            if (emotionVal) return false;
            if (minIntensityVal > 0) return false;
        }

        return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderEmilyRecords(filtered);
}

// Reset filters in psychologist view
function resetFiltersEmily() {
    document.getElementById("emily-filter-search").value = "";
    document.getElementById("emily-filter-emotion").value = "";
    document.getElementById("emily-filter-intensity-min").value = 0;
    document.getElementById("emily-filter-intensity-min").nextElementSibling.innerText = "0%";
    document.getElementById("emily-filter-type").value = "all";
    
    applyFiltersEmily();
}

// Open / Close Clinical feedback modal
function openClinicalCommentModal(recordId, existingText = "") {
    document.getElementById("comment-record-id").value = recordId;
    document.getElementById("clinical-comment-content").value = existingText;
    document.getElementById("modal-clinical-comment").classList.add("active");
}

function closeClinicalCommentModal() {
    document.getElementById("modal-clinical-comment").classList.remove("active");
    document.getElementById("form-clinical-comment").reset();
}

// Save Clinical comment feedback via API
async function saveClinicalComment(e) {
    e.preventDefault();

    const recordId = document.getElementById("comment-record-id").value;
    const commentVal = document.getElementById("clinical-comment-content").value;

    try {
        const res = await fetch(`/api/records/${recordId}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback: commentVal })
        });

        if (!res.ok) throw new Error("Error guardando comentario.");

        const savedRecord = await res.json();

        // Sync local records state
        const recordIndex = state.records.findIndex(r => r.id === recordId);
        if (recordIndex !== -1) {
            state.records[recordIndex] = savedRecord;
        }

        closeClinicalCommentModal();
        renderEmilyRecords();
    } catch (err) {
        console.error(err);
        alert("No se pudo conectar al servidor para guardar la retroalimentación.");
    }
}

// --- DYNAMIC DUAL GRAPHS (Chart.js implementation) ---

// Sorts and structures historical points to display inside the Chart.js grid
function renderChart(canvasId, role) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (role === 'paul' && paulChartInstance) {
        paulChartInstance.destroy();
    } else if (role === 'emily' && emilyChartInstance) {
        emilyChartInstance.destroy();
    }

    const chronologicalItems = [...state.records].sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = [];
    const intensityData = [];
    const consultationData = [];

    chronologicalItems.forEach(item => {
        const dateObj = new Date(item.date);
        const dayLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
        labels.push(dayLabel);

        if (item.type === 'record') {
            intensityData.push(item.intensity);
            consultationData.push(null);
        } else {
            intensityData.push(null);
            consultationData.push({
                x: labels.length - 1,
                y: 100,
                notes: item.notes
            });
        }
    });

    const activeColor = role === 'paul' ? '#6366f1' : '#10b981';
    const accentColor = '#f43f5e';

    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Intensidad Emocional',
                    data: intensityData,
                    borderColor: activeColor,
                    backgroundColor: role === 'paul' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    tension: 0.35,
                    pointBackgroundColor: activeColor,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    spanGaps: true,
                },
                {
                    label: 'Día de Consulta',
                    data: consultationData,
                    borderColor: accentColor,
                    backgroundColor: accentColor,
                    pointStyle: 'rectRot',
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    showLine: false,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1f2937',
                    titleColor: '#ffffff',
                    titleFont: { family: 'Outfit', weight: 'bold' },
                    bodyFont: { family: 'Inter' },
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            const datasetIndex = context.datasetIndex;
                            if (datasetIndex === 0) {
                                return ` Intensidad: ${context.parsed.y}%`;
                            } else {
                                const rawPoint = context.dataset.data[context.dataIndex];
                                return [
                                    ` [CONSULTA PSICOLÓGICA]`,
                                    ` Nota: ${rawPoint.notes ? rawPoint.notes.substring(0, 30) + '...' : 'Sin notas'}`
                                ];
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter' },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter' }
                    }
                }
            }
        }
    };

    const ctx = canvas.getContext('2d');
    const newChart = new Chart(ctx, chartConfig);

    if (role === 'paul') {
        paulChartInstance = newChart;
    } else {
        emilyChartInstance = newChart;
    }
}

// --- FORMAT DATE HELPERS ---

function formatFriendlyDate(dateStr) {
    if (!dateStr) return "Sin fecha";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    const year = parts[0];
    const monthIndex = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    return `${day} de ${months[monthIndex]}, ${year}`;
}

function formatDateTimeString(dateTimeStr) {
    if (!dateTimeStr) return "Sin fecha";
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return dateTimeStr;

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${dd}/${mm}/${yyyy} a las ${hh}:${min} hs`;
}
