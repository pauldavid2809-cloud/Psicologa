const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ==========================================
// CONFIGURACIÓN DE TU CARPETA DE GOOGLE DRIVE
// ==========================================
// Cambia esta ruta a la ubicación local de tu Google Drive en tu PC.
// En Windows, Google Drive suele montarse como el disco virtual G:
// Ejemplos comunes:
// - "G:/Mi unidad/NombreDeTuCarpeta" (Español)
// - "G:/My Drive/NombreDeTuCarpeta" (Inglés)
// - "C:/Users/Paul/Google Drive/Mi unidad" (Sincronización clásica)
const CLOUD_SYNC_DIR = "G:/Mi unidad/RegistroEmocional";

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Directorios y archivos requeridos
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'database.json');

// Asegurar existencia de la carpeta de uploads
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuración de Multer para almacenar archivos con nombres seguros
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Sanitizar nombre de archivo original
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        cb(null, uniqueSuffix + '-' + sanitized);
    }
});
const upload = multer({ storage: storage });

// Leer base de datos
function readDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialDB = { records: [], tasks: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), 'utf8');
        return initialDB;
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error leyendo base de datos, inicializando nueva:", err);
        return { records: [], tasks: [] };
    }
}

// Escribir base de datos
function writeDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Copiar archivo a la nube local sincronizada
function copyToCloud(sourcePath, filename) {
    if (!CLOUD_SYNC_DIR) return;
    try {
        // Asegurar que la carpeta de la nube existe localmente
        if (!fs.existsSync(CLOUD_SYNC_DIR)) {
            fs.mkdirSync(CLOUD_SYNC_DIR, { recursive: true });
        }
        
        const destPath = path.join(CLOUD_SYNC_DIR, filename);
        fs.copyFileSync(sourcePath, destPath);
        console.log(`[Nube] Archivo guardado con éxito en: ${destPath}`);
    } catch (err) {
        console.warn(`[Nube] No se pudo copiar a la nube (¿está instalada y abierta la app de Google Drive?):`, err.message);
    }
}

// --- RUTAS DE LA API ---

// 1. Obtener registros y consultas
app.get('/api/records', (req, res) => {
    const db = readDatabase();
    res.json(db.records);
});

// 2. Crear autorregistro de Paul
app.post('/api/records', (req, res) => {
    const { date, thought, emotions, intensity, conduct } = req.body;
    
    if (!date || !thought || !emotions || !intensity || !conduct) {
        return res.status(400).json({ error: "Faltan campos obligatorios en el registro." });
    }

    const db = readDatabase();
    const newRecord = {
        id: "rec-" + Date.now(),
        type: "record",
        date,
        thought,
        emotions,
        intensity: parseInt(intensity),
        conduct,
        feedback: null
    };

    db.records.push(newRecord);
    writeDatabase(db);
    res.json(newRecord);
});

// 3. Crear consulta psicológica
app.post('/api/consultations', (req, res) => {
    const { date, notes } = req.body;
    
    if (!date) {
        return res.status(400).json({ error: "La fecha es obligatoria." });
    }

    const db = readDatabase();
    const newConsultation = {
        id: "con-" + Date.now(),
        type: "consultation",
        date,
        notes: notes || ""
    };

    db.records.push(newConsultation);
    writeDatabase(db);
    res.json(newConsultation);
});

// 4. Añadir feedback clínico de Emily en un registro
app.post('/api/records/:id/feedback', (req, res) => {
    const recordId = req.params.id;
    const { feedback } = req.body;

    if (!feedback) {
        return res.status(400).json({ error: "El comentario no puede estar vacío." });
    }

    const db = readDatabase();
    const recordIndex = db.records.findIndex(r => r.id === recordId);
    
    if (recordIndex === -1) {
        return res.status(404).json({ error: "Registro no encontrado." });
    }

    db.records[recordIndex].feedback = feedback;
    db.records[recordIndex].feedbackDate = new Date().toISOString();
    
    writeDatabase(db);
    res.json(db.records[recordIndex]);
});

// 5. Obtener todas las tareas
app.get('/api/tasks', (req, res) => {
    const db = readDatabase();
    res.json(db.tasks);
});

// 6. Asignar nueva tarea (Emily)
app.post('/api/tasks', (req, res) => {
    const { title, desc, due } = req.body;

    if (!title || !desc || !due) {
        return res.status(400).json({ error: "Faltan campos para asignar la tarea." });
    }

    const db = readDatabase();
    const newTask = {
        id: "task-" + Date.now(),
        title,
        desc,
        due,
        completed: false,
        reply: null
    };

    db.tasks.push(newTask);
    writeDatabase(db);
    res.json(newTask);
});

// 7. Enviar respuesta a tarea + subir archivo adjunto (Paul)
app.post('/api/tasks/:id/reply', upload.single('attachment'), (req, res) => {
    const taskId = req.params.id;
    const { reply } = req.body;

    if (!reply) {
        return res.status(400).json({ error: "La respuesta es obligatoria." });
    }

    const db = readDatabase();
    const taskIndex = db.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
        return res.status(404).json({ error: "Tarea no encontrada." });
    }

    db.tasks[taskIndex].completed = true;
    db.tasks[taskIndex].reply = reply;
    db.tasks[taskIndex].completedDate = new Date().toISOString();

    // Guardar información del archivo adjunto si se subió
    if (req.file) {
        const fileMetadata = {
            name: req.file.filename,
            originalName: req.file.originalname,
            size: (req.file.size / 1024).toFixed(1) + " KB",
            path: `/uploads/${req.file.filename}`
        };
        
        db.tasks[taskIndex].file = fileMetadata;

        // Copiar automáticamente a la carpeta de Google Drive local en segundo plano
        copyToCloud(req.file.path, req.file.filename);
    } else {
        db.tasks[taskIndex].file = null;
    }

    writeDatabase(db);
    res.json(db.tasks[taskIndex]);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor de MindReg corriendo en http://localhost:${PORT}`);
    console.log(`📂 Base de datos local: ${DB_FILE}`);
    console.log(`📎 Subida de archivos en: ${UPLOADS_DIR}`);
    console.log(`☁️ Carpeta de sincronización de Nube: ${CLOUD_SYNC_DIR}`);
    console.log(`======================================================\n`);
});
