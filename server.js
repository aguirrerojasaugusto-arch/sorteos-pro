require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// MODO DE BASE DE DATOS: Turso o Memoria
// ============================================
let db = null;
let usandoTurso = false;

if (process.env.TURSO_URL && process.env.TURSO_URL !== 'undefined' && process.env.TURSO_URL.trim() !== '') {
    // Modo producción: Turso
    const { createClient } = require('@libsql/client');
    db = createClient({
        url: process.env.TURSO_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    usandoTurso = true;
    console.log('🗄️  Conectado a Turso (producción)');
} else {
    // Modo local: Base de datos en memoria
    console.log('💾 Usando base de datos en memoria (modo local)');
    let ticketsPendientes = [];
    let pagosValidados = [];

    db = {
        async execute({ sql, args }) {
            if (sql.includes('INSERT')) {
                const ticket = {
                    id: args[0],
                    telefono: args[1],
                    nombre_cliente: args[2],
                    cantidad: args[3],
                    monto: args[4],
                    numero_sorteo: args[5],
                    estado: 'pendiente',
                    creado_en: new Date().toISOString()
                };
                ticketsPendientes.push(ticket);
                return { rows: [] };
            }
            if (sql.includes('UPDATE')) {
                const id = args[3];
                const ticket = ticketsPendientes.find(t => t.id === id);
                if (ticket) {
                    ticket.estado = 'pagado';
                    ticket.codigo_yape = args[0];
                    ticket.nombre_pagador = args[1];
                    ticket.fecha_pago = args[2];
                    pagosValidados.push(ticket);
                    ticketsPendientes = ticketsPendientes.filter(t => t.id !== id);
                }
                return { rows: [] };
            }
            if (sql.includes("estado = 'pendiente'") && !sql.includes('monto =')) {
                return { rows: ticketsPendientes };
            }
            if (sql.includes('monto = ?')) {
                const monto = args[0];
                const encontrados = ticketsPendientes.filter(t => t.monto === monto);
                return { rows: encontrados };
            }
            if (sql.includes("estado = 'pagado'")) {
                return { rows: pagosValidados.slice(0, 50) };
            }
            return { rows: [] };
        }
    };
}

// Configuración de Cloudinary (solo si hay credenciales)
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'undefined' && process.env.CLOUDINARY_CLOUD_NAME.trim() !== '') {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log('☁️  Cloudinary configurado');
}

// Middleware de seguridad
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
        return res.status(401).json({ status: 'error', mensaje: 'No autorizado' });
    }
    next();
};

// ============================================
// 1. Validar pago Yape
// ============================================
app.post('/api/validar-pago-yape', verifyApiKey, async (req, res) => {
    try {
        const sms_body_raw = req.query.sms_body || req.body.sms_body || req.body.body || req.body.mensaje || "";
        const sender = req.query.sender || req.body.sender || "Desconocido";
        const fecha = req.query.fecha || req.body.fecha || new Date().toISOString();

        const sms_body = String(sms_body_raw).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

        if (!sms_body) {
            return res.status(400).json({ status: 'error', mensaje: 'Falta el contenido del SMS' });
        }

        console.log('📩 SMS recibido:', sms_body);

        const regex = /Recibistes?\s+S\/\.?\s*([0-9.]+)\s+de\s+(.+?)[\.\s]+(?:C[oó]digo|Cod|Code)[:\s]*([A-Z0-9]+)/i;
        const match = sms_body.match(regex);

        if (!match) {
            console.log('❌ Formato de SMS no reconocido');
            return res.json({ status: 'error', mensaje: 'Formato de SMS no reconocido' });
        }

        const monto = parseFloat(match[1]);
        const nombre = match[2].replace(/[\.\s]+$/, '').trim();
        const codigo = match[3];

        console.log(`✅ Pago detectado: ${nombre} - S/.${monto} - Código: ${codigo}`);

        const result = await db.execute({
            sql: "SELECT * FROM tickets WHERE monto = ? AND estado = 'pendiente' ORDER BY creado_en ASC LIMIT 1",
            args: [monto],
        });

        if (result.rows.length > 0) {
            const ticket = result.rows[0];

            await db.execute({
                sql: `UPDATE tickets SET estado = 'pagado', codigo_yape = ?, nombre_pagador = ?, fecha_pago = ? WHERE id = ?`,
                args: [codigo, nombre, fecha, ticket.id],
            });

            console.log(`🎉 Ticket #${ticket.numero_sorteo} APROBADO para ${nombre}`);

            res.json({
                status: 'aprobado',
                numero_ticket: ticket.numero_sorteo,
                mensaje: `Pago validado. Tu número es: ${ticket.numero_sorteo}`
            });
        } else {
            console.log(`⚠️ Pago de S/.${monto} sin ticket pendiente`);
            res.json({ status: 'revisar', mensaje: 'Pago recibido pero no hay ticket pendiente' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ status: 'error', mensaje: 'Error interno' });
    }
});

// ============================================
// 2. Crear ticket
// ============================================
app.post('/api/crear-ticket', async (req, res) => {
    try {
        const { telefono, nombre_cliente, cantidad } = req.body;
        if (!telefono || !nombre_cliente || !cantidad) {
            return res.status(400).json({ status: 'error', mensaje: 'Faltan datos' });
        }

        const monto = cantidad * 5;
        const id = Date.now().toString();
        const numero_sorteo = Math.floor(1000 + Math.random() * 9000);

        await db.execute({
            sql: `INSERT INTO tickets (id, telefono, nombre_cliente, cantidad, monto, numero_sorteo, estado) 
                  VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
            args: [id, telefono, nombre_cliente, cantidad, monto, numero_sorteo],
        });

        console.log(`🎟️ Ticket creado: #${numero_sorteo} para ${nombre_cliente}`);

        res.json({
            mensaje: `Ticket creado. Envía S/.${monto} al Yape.`,
            numero_reservado: numero_sorteo
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ status: 'error', mensaje: 'Error al crear ticket' });
    }
});

// ============================================
// 3. Ver tickets
// ============================================
app.get('/api/tickets', async (req, res) => {
    try {
        const pendientes = await db.execute("SELECT * FROM tickets WHERE estado = 'pendiente'");
        const validados = await db.execute("SELECT * FROM tickets WHERE estado = 'pagado'");
        res.json({ pendientes: pendientes.rows, validados: validados.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 4. Health check
// ============================================
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        modo: usandoTurso ? 'PRODUCCIÓN (Turso)' : 'LOCAL (Memoria)',
        mensaje: 'API de sorteos funcionando',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// INICIAR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📡 Modo: ${usandoTurso ? 'PRODUCCIÓN' : 'LOCAL'}`);
});