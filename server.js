import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { db, testConnection } from './src/config/database.js';
import adminRoutes from './src/routes/admin.js';
import uploadRoutes from './src/routes/upload.js';
import publicRoutes from './src/routes/public.js';
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/user.js';
import { runMigrations } from './src/config/migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'undefined') {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('☁️ Cloudinary configurado');
}

// ✅ Verificación de API Key para el webhook
const verifyApiKey = (req, res, next) => {
  const expectedKey = process.env.API_KEY;
  if (!expectedKey) return next(); // Si no hay API_KEY configurada, permitir (desarrollo)
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ status: 'error', mensaje: 'No autorizado.' });
  }
  next();
};

// ============================================
// ✅ Webhook para MacroDroid (MEJORADO)
// ============================================
app.post('/api/validar-pago-yape', verifyApiKey, async (req, res) => {
  try {
    const sms_body_raw = req.query.sms_body || req.body.sms_body || req.body.body || req.body.mensaje || '';
    const sms_body = String(sms_body_raw).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

    if (!sms_body) {
      return res.status(400).json({ status: 'error', mensaje: 'Falta el contenido del SMS' });
    }

    console.log('📩 SMS recibido de MacroDroid:', sms_body);

    // Regex para capturar el monto y código de operación
    const regexMonto = /S\/\.?\s*([0-9.,]+)/i;
    const regexCodigo = /(?:C[oó]digo|Cod|Code|Operaci[oó]n)[:\s]*([A-Z0-9]+)/i;
    const matchMonto = sms_body.match(regexMonto);
    const matchCodigo = sms_body.match(regexCodigo);

    if (!matchMonto) {
      return res.json({ status: 'error', mensaje: 'No se detectó un monto en el SMS' });
    }

    const montoStr = matchMonto[1].replace(',', '.');
    const monto = parseFloat(montoStr);
    const codigo = matchCodigo ? matchCodigo[1] : `YAPE_${Date.now()}`;

    console.log(`✅ Pago detectado: S/.${monto} - Código: ${codigo}`);

    // 1. Evitar procesar el mismo SMS dos veces (por código de operación)
    const existeCodigo = await db.execute({
      sql: 'SELECT 1 FROM tickets WHERE comprobante_hash = ? LIMIT 1',
      args: [codigo]
    });
    if (existeCodigo.rows.length > 0) {
      return res.json({ status: 'revisar', mensaje: 'Este código de Yape ya fue utilizado' });
    }

    // 2. Buscar el ticket pendiente con el monto exacto (incluye centavos mágicos)
    const result = await db.execute({
      sql: `SELECT * FROM tickets
            WHERE monto_exacto = ?
              AND estado_pago = 'pendiente'
              AND (expires_at IS NULL OR expires_at > datetime('now'))
            ORDER BY creado_en ASC
            LIMIT 1`,
      args: [monto]
    });

    if (result.rows.length === 0) {
      // Log del intento fallido
      await db.execute({
        sql: `INSERT INTO yape_webhook_logs (sms_body, monto_detectado, codigo_operacion, estado)
              VALUES (?, ?, ?, ?)`,
        args: [sms_body, monto, codigo, 'no_encontrado']
      });
      console.log(`⚠️ Pago de S/.${monto} sin ticket pendiente`);
      return res.json({
        status: 'revisar',
        mensaje: `Pago recibido de S/.${monto}, pero no hay ticket pendiente con ese monto exacto.`
      });
    }

    const ticket = result.rows[0];

    // 3. ✅ Validar el ticket: actualizar estado y comprobante_hash
    await db.execute({
      sql: `UPDATE tickets
            SET comprobante_hash = ?,
                estado_pago = 'validado'
            WHERE id = ?`,
      args: [codigo, ticket.id]
    });

    // 4. Log exitoso
    await db.execute({
      sql: `INSERT INTO yape_webhook_logs (sms_body, monto_detectado, codigo_operacion, ticket_id, estado)
            VALUES (?, ?, ?, ?, ?)`,
      args: [sms_body, monto, codigo, ticket.id, 'validado']
    });

    console.log(`🎉 Ticket #${ticket.codigo_ticket} APROBADO (Monto: S/.${monto})`);

    return res.json({
      status: 'aprobado',
      numero_ticket: ticket.codigo_ticket,
      mensaje: `Pago validado. Tu número es: ${ticket.codigo_ticket}`
    });
  } catch (error) {
    console.error('❌ Error procesando pago de Yape:', error);
    res.status(500).json({ status: 'error', mensaje: 'Error interno del servidor' });
  }
});

// ============================================
// ✅ NUEVO: Endpoint para limpiar tickets expirados (puedes llamarlo con cron)
// ============================================
app.post('/api/admin/limpiar-expirados', verifyApiKey, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `UPDATE tickets
            SET estado_pago = 'expirado'
            WHERE estado_pago = 'pendiente'
              AND expires_at IS NOT NULL
              AND expires_at < datetime('now')`
    });
    console.log(`🧹 Tickets expirados limpiados: ${result.changes || 0}`);
    res.json({ status: 'ok', limpiados: result.changes || 0 });
  } catch (error) {
    console.error('Error limpiando expirados:', error);
    res.status(500).json({ status: 'error', mensaje: 'Error interno' });
  }
});

// ============================================
// Health check
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    modo: process.env.TURSO_DATABASE_URL ? 'PRODUCCIÓN (Turso)' : 'LOCAL (SQLite)',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

testConnection().then(() => {
  runMigrations().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  });
});