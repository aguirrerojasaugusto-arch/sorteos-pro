import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary'; 

import { db, testConnection } from './src/config/database.js';
import adminRoutes from './src/routes/admin.js';
import uploadRoutes from './src/routes/upload.js'; // ✅ 1. IMPORTAMOS LA RUTA DE UPLOAD
import { runMigrations } from './src/config/migrations.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// RUTAS DE LA API
// ============================================
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes); // ✅ 2. ACTIVAMOS LA RUTA DE UPLOAD (¡Adiós 404!)

// ============================================
// CONFIGURACIÓN CLOUDINARY
// ============================================
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'undefined') {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log('☁️ Cloudinary configurado');
}

const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
        return res.status(401).json({ status: 'error', mensaje: 'No autorizado' });
    }
    next();
};

// ============================================
// 1. Validar pago Yape (TU LÓGICA ORIGINAL INTACTA)
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

        const existe = await db.execute({
            sql: "SELECT 1 FROM tickets WHERE comprobante_hash = ? LIMIT 1",
            args: [codigo]
        });
        if (existe.rows.length > 0) {
            return res.json({ status: 'revisar', mensaje: 'Este código de Yape ya fue utilizado' });
        }

        const result = await db.execute({
            sql: "SELECT * FROM tickets WHERE total_pagado = ? AND comprobante_hash IS NULL ORDER BY creado_en ASC LIMIT 1",
            args: [monto],
        });

        if (result.rows.length > 0) {
            const ticket = result.rows[0];
            await db.execute({
                sql: `UPDATE tickets SET comprobante_hash = ? WHERE id = ?`,
                args: [codigo, ticket.id],
            });

            console.log(`🎉 Ticket #${ticket.codigo_ticket} APROBADO para ${nombre}`);

            res.json({
                status: 'aprobado',
                numero_ticket: ticket.codigo_ticket,
                mensaje: `Pago validado. Tu número es: ${ticket.codigo_ticket}`
            });
        } else {
            const nameCheck = await db.execute({
                sql: "SELECT * FROM tickets WHERE cliente_nombre LIKE ? AND comprobante_hash IS NULL LIMIT 1",
                args: [`%${nombre}%`]
            });

            if (nameCheck.rows.length > 0) {
                const expectedTicket = nameCheck.rows[0];
                console.log(`⚠️ Monto incorrecto. ${nombre} pagó S/.${monto} pero su ticket es de S/.${expectedTicket.total_pagado}`);
                
                res.json({ 
                    status: 'revisar', 
                    mensaje: `El monto pagado (S/.${monto}) no coincide con el valor de tu ticket (S/.${expectedTicket.total_pagado}). Por favor, realiza el pago exacto.` 
                });
            } else {
                console.log(`⚠️ Pago de S/.${monto} de ${nombre} sin ticket pendiente`);
                res.json({ 
                    status: 'revisar', 
                    mensaje: `Pago recibido de S/.${monto} por ${nombre}, pero no se encontró un ticket pendiente con ese monto.` 
                });
            }
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ status: 'error', mensaje: 'Error interno' });
    }
});

// ============================================
// 2. Crear ticket manual (TU LÓGICA ORIGINAL INTACTA)
// ============================================
app.post('/api/crear-ticket', async (req, res) => {
    try {
        const { telefono, nombre_cliente, cantidad } = req.body;
        if (!telefono || !nombre_cliente || !cantidad) {
            return res.status(400).json({ status: 'error', mensaje: 'Faltan datos' });
        }

        const monto = cantidad * 5;
        const codigo_ticket = Math.floor(10000 + Math.random() * 90000).toString(); 

        await db.execute({
            sql: `INSERT INTO tickets (codigo_ticket, cliente_nombre, cliente_telefono, cantidad_tickets, total_pagado) 
                  VALUES (?, ?, ?, ?, ?)`,
            args: [codigo_ticket, nombre_cliente, telefono, cantidad, monto],
        });

        console.log(`🎟️ Ticket creado: #${codigo_ticket} para ${nombre_cliente}`);

        res.json({
            mensaje: `Ticket creado. Envía S/.${monto} al Yape.`,
            numero_reservado: codigo_ticket
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ status: 'error', mensaje: 'Error al crear ticket' });
    }
});

// ============================================
// 3. Ver tickets (TU LÓGICA ORIGINAL INTACTA)
// ============================================
app.get('/api/tickets', async (req, res) => {
    try {
        const pendientes = await db.execute("SELECT * FROM tickets WHERE comprobante_hash IS NULL");
        const validados = await db.execute("SELECT * FROM tickets WHERE comprobante_hash IS NOT NULL");
        res.json({ pendientes: pendientes.rows, validados: validados.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 4. Health check (TU LÓGICA ORIGINAL INTACTA)
// ============================================
app.get('/api/health', (req, res) => { 
    res.json({
        status: 'ok',
        modo: process.env.TURSO_DATABASE_URL ? 'PRODUCCIÓN (Turso)' : 'LOCAL (SQLite)',
        mensaje: 'API de sorteos funcionando',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;

testConnection().then(() => {
    runMigrations().then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
            console.log(`📡 Modo: ${process.env.TURSO_DATABASE_URL ? 'PRODUCCIÓN (Turso)' : 'LOCAL (SQLite)'}`);
            console.log(`✅ Rutas montadas: /api/admin, /api/upload, /api/validar-pago-yape`);
        });
    });
});