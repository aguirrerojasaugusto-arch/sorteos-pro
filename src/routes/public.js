// src/routes/public.js
import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { randomBytes } from 'crypto';
import cloudinary from '../config/cloudinary.js';
import { AppRepository } from '../repositories/AppRepository.js';
import { TicketSearchRepository } from '../repositories/TicketSearchRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { WalletRepository } from '../repositories/WalletRepository.js';
import { WalletService } from '../services/WalletService.js';
import { SorteoService } from '../services/SorteoService.js';
import { ComboPricingService } from '../services/ComboPricingService.js';
import TicketValidator from '../services/TicketValidator.js';
import { db } from '../config/database.js';

const router = express.Router();
const appRepo = new AppRepository(db);
const searchRepo = new TicketSearchRepository(db);
const userRepo = new UserRepository(db);
const walletService = new WalletService(userRepo, new WalletRepository(db));
const comboPricingService = new ComboPricingService();
const sorteoService = new SorteoService({ appRepo, walletService, db, comboPricingService });

// ✅ Storage en Cloudinary (NO en disco local)
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sorteos-pro/comprobantes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (!ok) return cb(new Error('Solo se aceptan imágenes (jpg/png/webp/gif) o PDF'));
    cb(null, true);
  }
});

const safeMsg = (e) => {
  const m = String(e?.message || 'Error');
  if (/UNIQUE constraint|SQLITE_|syntax error|no such table|no such column/i.test(m)) {
    return 'Error al procesar la compra';
  }
  return m;
};

// ============================================
// RUTA /bootstrap (devuelve TODO lo que el cliente necesita)
// ============================================
router.get('/bootstrap', async (req, res) => {
  try {
    const config = await appRepo.getConfig();
    const sorteosActivos = await appRepo.getSorteosActivos();
    const sorteos = sorteosActivos.map(s => ({ 
      ...s, 
      combo_descuentos: s.combo_descuentos ? JSON.parse(s.combo_descuentos) : [] 
    }));
    res.json({
      config,
      sorteos,
      promociones: await appRepo.getPromocionesActivas(),
      resultados_recientes: (await appRepo.getAllResultados()).slice(0, 5),
      ganadores: (await appRepo.getGanadoresRecientes(5)).map(g => ({ 
        ...g, 
        codigo_ticket: g.codigo_ticket.slice(0, 5) + '****' 
      })),
      carrusel: await appRepo.getCarruselImagenes(),
      bolas_logos: await appRepo.getBolasLogos(),
      banners: await appRepo.getBanners(),
      promos_laterales: await appRepo.getPromosLaterales()
    });
  } catch (error) {
    console.error('Error en /bootstrap:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ============================================
// RUTA /config (alias para compatibilidad)
// ============================================
router.get('/config', async (req, res) => {
  try {
    const config = await appRepo.getConfig();
    res.json(config);
  } catch (error) {
    console.error('Error en /config:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ============================================
// Buscar cliente por DNI
// ============================================
router.get('/cliente/:dni', async (req, res) => {
  try {
    const dni = req.params.dni;
    if (!dni || dni.length !== 8) return res.json({ encontrado: false });
    const cliente = await userRepo.findByDni(dni);
    if (cliente) {
      const partes = (cliente.nombre || '').trim().split(' ');
      res.json({
        encontrado: true,
        datos: {
          nombres: partes[0] || '',
          apellidos: partes.slice(1).join(' ') || '',
          celular: cliente.telefono || '',
          departamento: cliente.departamento || ''
        }
      });
    } else {
      res.json({ encontrado: false });
    }
  } catch (error) {
    console.error('Error buscando cliente:', error);
    res.json({ encontrado: false });
  }
});

// ============================================
// Comprar aleatorio (FLUJO VIEJO — SE MANTIENE)
// ============================================
router.post('/comprar-aleatorio', upload.single('comprobante'), async (req, res) => {
  try {
    const { sorteo_id, nombres, apellidos, dni, departamento, celular, cantidad_tickets } = req.body;
    if (!sorteo_id) throw new Error('ID del sorteo es requerido');
    if (!dni || String(dni).length !== 8) throw new Error('DNI válido de 8 dígitos es requerido');

    const sorteo = await appRepo.getSorteoById(Number(sorteo_id));
    if (!sorteo) throw new Error('Sorteo no encontrado');

    const nombreCompleto = `${nombres || ''} ${apellidos || ''}`.trim();
    await userRepo.saveOrUpdateClient(dni, nombreCompleto, celular, departamento);

    const cantidad = Number(cantidad_tickets) || 1;
    if (cantidad < 1 || cantidad > 50) throw new Error('Cantidad de tickets inválida (1-50)');

    const jugadas = [];
    for (let i = 0; i < cantidad; i++) {
      const numeros = [];
      while (numeros.length < sorteo.min_bolillas) {
        const n = Math.floor(Math.random() * sorteo.max_numero) + 1;
        if (!numeros.includes(n)) numeros.push(n);
      }
      numeros.sort((a, b) => a - b);
      jugadas.push({ zona: 'A', numeros });
    }

    const resultado = await sorteoService.comprar({
      sorteo_id: sorteo.id,
      cliente_nombre: nombreCompleto,
      cliente_dni: dni,
      telefono: celular || '',
      departamento: departamento || '',
      jugadas,
      cantidad_sorteos: 1,
      si_o_si: false,
      boliyapa_numero: null,
      comprobante_url: req.file ? req.file.path : null,
      comprobante_file: req.file,
      modo_aleatorio: true
    });

    res.status(201).json({ tickets: resultado.tickets });
  } catch (e) {
    console.error('Error en comprar-aleatorio:', e);
    res.status(400).json({ error: safeMsg(e) });
  }
});

// ============================================
// Crear tickets (admin) — FLUJO VIEJO, SE MANTIENE
// ============================================
router.post('/tickets', async (req, res) => {
  try {
    if (!req.body.sorteo_id) throw new Error('Falta el ID del sorteo');
    const { cliente_dni, cliente_nombre, telefono, departamento } = req.body;
    if (cliente_dni && String(cliente_dni).length === 8) {
      await userRepo.saveOrUpdateClient(cliente_dni, cliente_nombre || '', telefono || '', departamento || '');
    }
    res.status(201).json(await sorteoService.comprar(req.body));
  } catch (e) {
    console.error('Error en tickets admin:', e);
    res.status(400).json({ error: safeMsg(e) });
  }
});

// ============================================
// Ver ticket por código
// ============================================
router.get('/tickets/:codigo', async (req, res) => {
  try {
    const t = await appRepo.getTicketByCodigo(req.params.codigo);
    if (!t) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(t);
  } catch (e) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// ============================================
// Consultar tickets
// ============================================
router.get('/consultar-tickets', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim().length < 3) {
      return res.status(400).json({ error: 'Ingresa al menos 3 caracteres, un DNI (8 dígitos) o un celular (9 dígitos)' });
    }
    const resultado = await searchRepo.buscarTicketsPorCliente(q);
    if (resultado && resultado.tickets && resultado.tickets.length > 0) {
      if (!resultado.nombre) {
        resultado.nombre = resultado.tickets[0].cliente_nombre || resultado.tickets[0].nombre_cliente || resultado.tickets[0].nombre || 'Cliente';
      }
      if (!resultado.departamento) {
        resultado.departamento = resultado.tickets[0].departamento || 'No especificado';
      }
    } else if (resultado && resultado.total === 0) {
      resultado.nombre = 'No encontrado';
      resultado.departamento = '-';
    }
    res.json(resultado);
  } catch (e) {
    console.error('Error al consultar tickets:', e);
    res.status(500).json({ error: 'Error interno al buscar tickets' });
  }
});

// ============================================================
// ============================================================
// ✅ NUEVO FLUJO: PAGO CON YAPE + VALIDACIÓN POR SMS (MacroDroid)
// ============================================================
// ============================================================

const PAGO_EXPIRA_MIN = 15;
const YAPE_NUMERO_DEFAULT = '993 897 647';

function centavosAleatorios() {
  return Math.floor(Math.random() * 99) + 1; // 1..99
}

function generarJugadasAleatorias(sorteo, cantidad) {
  const out = [];
  for (let i = 0; i < cantidad; i++) {
    const nums = [];
    while (nums.length < sorteo.min_bolillas) {
      const n = Math.floor(Math.random() * sorteo.max_numero) + 1;
      if (!nums.includes(n)) nums.push(n);
    }
    nums.sort((a, b) => a - b);
    out.push({ zona: 'A', numeros: nums });
  }
  return out;
}

function extraerMontoDeSMS(texto) {
  if (!texto) return null;
  // "Recibiste S/ 20.47", "Yapeaste S/20.47", "S/ 20.47"
  const m = String(texto).match(/S\/\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return isNaN(n) ? null : +n.toFixed(2);
}

async function calcularBase({ sorteo, jugadas, cantidadSorteos, siOSi, boliyapaNumero }) {
  const base = +(Number(sorteo.precio_jugada) * jugadas.length * (Number(cantidadSorteos) || 1)).toFixed(2);
  let extra = 0;
  if (siOSi && sorteo.tiene_si_o_si) extra += Number(sorteo.costo_si_o_si) || 0;
  if (boliyapaNumero && sorteo.tiene_boliyapa) extra += Number(sorteo.costo_boliyapa) || 0;
  return +(base + extra).toFixed(2);
}

// ------------------------------------------------------------
// POST /api/public/pago-pendiente
// Crea un pago pendiente con monto único (base + centavos random)
// Body: { sorteo_id, cliente_dni, cliente_nombre, cliente_telefono,
//         cliente_departamento, cantidad_tickets, cantidad_sorteos,
//         jugadas?, si_o_si?, boliyapa_numero? }
// ------------------------------------------------------------
router.post('/pago-pendiente', async (req, res) => {
  try {
    const {
      sorteo_id,
      cliente_dni,
      cliente_nombre,
      cliente_telefono,
      cliente_departamento,
      cantidad_tickets,
      cantidad_sorteos,
      jugadas: jugadasBody,
      si_o_si,
      boliyapa_numero
    } = req.body || {};

    if (!sorteo_id) throw new Error('sorteo_id requerido');
    if (!cliente_dni || String(cliente_dni).length !== 8) throw new Error('DNI válido (8 dígitos) requerido');

    const sorteo = await appRepo.getSorteoById(Number(sorteo_id));
    if (!sorteo) throw new Error('Sorteo no encontrado');
    if (Number(sorteo.activo) === 0) throw new Error('El sorteo está inactivo');

    const nombre = (cliente_nombre || '').trim();
    if (!nombre || nombre.length < 3) throw new Error('Nombre del titular requerido');

    await userRepo.saveOrUpdateClient(String(cliente_dni), nombre, cliente_telefono || '', cliente_departamento || '');

    // ---- Jugadas: si vienen del boletera se validan; si no, se generan random ----
    const nSorteos = Math.max(1, Math.min(50, Number(cantidad_sorteos) || 1));
    const nJugadasSolicitadas = Math.max(1, Math.min(20, Number(cantidad_tickets) || 1));

    let jugadas;
    let cantidadTickets;
    if (Array.isArray(jugadasBody) && jugadasBody.length > 0) {
      jugadas = jugadasBody;
      const validator = new TicketValidator(sorteo);
      for (const j of jugadas) validator.validarJugadaIndividual(j);
      cantidadTickets = jugadas.length * nSorteos;
    } else {
      jugadas = generarJugadasAleatorias(sorteo, nJugadasSolicitadas);
      cantidadTickets = jugadas.length;
    }

    const base = await calcularBase({
      sorteo,
      jugadas,
      cantidadSorteos: nSorteos,
      siOSi: !!si_o_si,
      boliyapaNumero: boliyapa_numero || null
    });

    if (base <= 0) throw new Error('Monto inválido');

    // ---- Buscar monto único entre pendientes activos ----
    const token = randomBytes(16).toString('hex');
    const expiraEn = new Date(Date.now() + PAGO_EXPIRA_MIN * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');

    let row = null;
    let montoUnico = 0;
    let centavos = 0;

    for (let attempt = 0; attempt < 40; attempt++) {
      centavos = centavosAleatorios();
      montoUnico = +(base + centavos / 100).toFixed(2);

      try {
        const insert = await db.execute({
          sql: `INSERT INTO pagos_pendientes
                (token, sorteo_id, cliente_dni, cliente_nombre, cliente_telefono, cliente_departamento,
                 cantidad_tickets, cantidad_sorteos, monto_base, monto_unico, estado,
                 jugadas_json, si_o_si, boliyapa_numero, expira_en)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)
                RETURNING *`,
          args: [
            token, sorteo.id, String(cliente_dni), nombre,
            cliente_telefono || '', cliente_departamento || '',
            cantidadTickets, nSorteos, base, montoUnico,
            JSON.stringify(jugadas), si_o_si ? 1 : 0,
            boliyapa_numero || null, expiraEn
          ]
        });
        row = insert.rows[0];
        break;
      } catch (err) {
        const msg = String(err?.message || '');
        if (/UNIQUE constraint/i.test(msg)) {
          // Chocó con otro pago activo → probar otro centavo
          continue;
        }
        throw err;
      }
    }

    if (!row) throw new Error('No se pudo generar un monto único. Intenta de nuevo en unos segundos.');

    const yapeNumero = (await appRepo.getSetting('yape_numero')) || YAPE_NUMERO_DEFAULT;
    const yapeTitular = (await appRepo.getSetting('yape_titular')) || 'Artesanía Mariposita';

    res.status(201).json({
      token,
      sorteo: { id: sorteo.id, nombre: sorteo.nombre },
      cantidad_tickets: cantidadTickets,
      cantidad_sorteos: nSorteos,
      monto_base: base,
      centavos,
      monto_total: montoUnico,
      yape_numero: yapeNumero,
      yape_titular: yapeTitular,
      expira_en: expiraEn,
      expira_minutos: PAGO_EXPIRA_MIN
    });
  } catch (e) {
    console.error('Error en /pago-pendiente:', e);
    res.status(400).json({ error: safeMsg(e) });
  }
});

// ------------------------------------------------------------
// POST /api/public/pago-pendiente/:token/comprobante
// Sube la captura del Yape asociada a un pago pendiente
// ------------------------------------------------------------
router.post('/pago-pendiente/:token/comprobante', upload.single('comprobante'), async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) throw new Error('Token requerido');
    if (!req.file) throw new Error('Debes subir el comprobante');

    const pending = await db.execute({
      sql: `SELECT * FROM pagos_pendientes WHERE token = ? LIMIT 1`,
      args: [token]
    });
    if (pending.rows.length === 0) throw new Error('Pago pendiente no encontrado');

    const row = pending.rows[0];

    if (row.estado === 'validado') {
      return res.json({ ok: true, estado: 'validado', comprobante_url: row.comprobante_url });
    }
    if (row.estado === 'expirado' || row.estado === 'rechazado') {
      throw new Error('Este pago ya expiró. Vuelve a intentarlo.');
    }

    // Auto-expiración
    const expira = new Date(String(row.expira_en).replace(' ', 'T') + 'Z');
    if (expira.getTime() < Date.now()) {
      await db.execute({
        sql: `UPDATE pagos_pendientes SET estado='expirado' WHERE id=?`,
        args: [row.id]
      });
      throw new Error('El pago expiró. Vuelve a intentarlo.');
    }

    await db.execute({
      sql: `UPDATE pagos_pendientes
            SET estado='comprobante_subido', comprobante_url=?
            WHERE id=?`,
      args: [req.file.path, row.id]
    });

    res.json({ ok: true, estado: 'comprobante_subido', comprobante_url: req.file.path });
  } catch (e) {
    console.error('Error en /pago-pendiente/:token/comprobante:', e);
    res.status(400).json({ error: safeMsg(e) });
  }
});

// ------------------------------------------------------------
// GET /api/public/pago-pendiente/:token/status
// Endpoint de polling desde la web (cada 3s)
// ------------------------------------------------------------
router.get('/pago-pendiente/:token/status', async (req, res) => {
  try {
    const { token } = req.params;
    const pending = await db.execute({
      sql: `SELECT * FROM pagos_pendientes WHERE token = ? LIMIT 1`,
      args: [token]
    });
    if (pending.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

    const row = pending.rows[0];

    // Auto-expirar si corresponde
    if (row.estado === 'pendiente' || row.estado === 'comprobante_subido') {
      const expira = new Date(String(row.expira_en).replace(' ', 'T') + 'Z');
      if (expira.getTime() < Date.now()) {
        await db.execute({
          sql: `UPDATE pagos_pendientes SET estado='expirado' WHERE id=?`,
          args: [row.id]
        });
        row.estado = 'expirado';
      }
    }

    const out = {
      estado: row.estado,
      monto_total: row.monto_unico,
      expira_en: row.expira_en,
      tiene_comprobante: !!row.comprobante_url,
      cantidad_tickets: row.cantidad_tickets
    };

    if (row.estado === 'validado' && row.tickets_generados_json) {
      try {
        out.tickets = JSON.parse(row.tickets_generados_json);
      } catch {
        out.tickets = [];
      }
    }

    res.json(out);
  } catch (e) {
    console.error('Error en /pago-pendiente/:token/status:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ------------------------------------------------------------
// POST /api/public/yape/sms-webhook
// Recibe el SMS desde MacroDroid y valida el pago.
// Protección: ?secret=XXX o header 'x-webhook-secret'
// ------------------------------------------------------------
router.post(
  '/yape/sms-webhook',
  express.json({ type: ['application/json', 'application/*+json'] }),
  express.urlencoded({ extended: true }),
  express.text({ type: ['text/plain', 'text/*'] }),
  async (req, res) => {
    try {
      // --- Autenticación ---
      const expected = process.env.MACRODROID_WEBHOOK_SECRET;
      const provided = req.query?.secret
        || req.headers['x-webhook-secret']
        || (req.body && typeof req.body === 'object' && req.body.secret);

      if (!expected) {
        console.warn('⚠️  MACRODROID_WEBHOOK_SECRET no configurado en .env → webhook rechazado por seguridad');
        return res.status(503).json({ error: 'Webhook no configurado' });
      }
      if (!provided || String(provided) !== String(expected)) {
        console.warn('Webhook SMS: secret inválido');
        return res.status(401).json({ error: 'No autorizado' });
      }

      // --- Extraer texto del SMS en múltiples formatos ---
      let texto = '';
      if (typeof req.body === 'string') {
        texto = req.body;
      } else if (req.body && typeof req.body === 'object') {
        texto = req.body.texto
          || req.body.body
          || req.body.sms
          || req.body.message
          || req.body.fullMessage
          || '';
      }

      if (!texto || typeof texto !== 'string') {
        return res.status(400).json({ error: 'Texto del SMS requerido (campo: texto/body/sms/message)' });
      }

      const monto = extraerMontoDeSMS(texto);
      if (!monto) {
        return res.status(400).json({ error: 'No se encontró un monto S/ en el SMS', texto });
      }

      // --- Buscar pago pendiente con ese monto exacto ---
      const pending = await db.execute({
        sql: `SELECT * FROM pagos_pendientes
              WHERE monto_unico = ?
                AND estado IN ('pendiente','comprobante_subido')
                AND expira_en > datetime('now')
              ORDER BY creado_en DESC
              LIMIT 1`,
        args: [monto]
      });

      if (pending.rows.length === 0) {
        console.warn(`Webhook SMS: ningún pago pendiente con S/ ${monto} — SMS: "${texto.slice(0, 120)}"`);
        return res.status(404).json({
          matched: false,
          monto,
          error: 'No hay pago pendiente con ese monto activo'
        });
      }

      const row = pending.rows[0];

      // Si otro SMS ya lo validó (idempotencia), responder OK
      if (row.estado === 'validado') {
        return res.json({ matched: true, already_validated: true, pago_id: row.id });
      }

      // --- Crear los tickets reales ---
      let jugadas = [];
      try { jugadas = JSON.parse(row.jugadas_json || '[]'); } catch { jugadas = []; }
      if (!Array.isArray(jugadas) || jugadas.length === 0) {
        throw new Error('El pago pendiente no tiene jugadas guardadas');
      }

      const resultado = await sorteoService.comprar({
        sorteo_id: row.sorteo_id,
        cliente_nombre: row.cliente_nombre,
        cliente_dni: row.cliente_dni,
        telefono: row.cliente_telefono,
        departamento: row.cliente_departamento,
        jugadas,
        cantidad_sorteos: Number(row.cantidad_sorteos) || 1,
        si_o_si: !!row.si_o_si,
        boliyapa_numero: row.boliyapa_numero || null,
        comprobante_url: row.comprobante_url || null,
        comprobante_hash: null,
        modo_aleatorio: true,
        total_pagado: row.monto_unico
      });

      // --- Actualizar pendiente ---
      const ticketsGenerados = Array.isArray(resultado?.tickets) ? resultado.tickets : [];
      await db.execute({
        sql: `UPDATE pagos_pendientes
              SET estado='validado',
                  validado_en=datetime('now'),
                  sms_texto=?,
                  sms_monto=?,
                  tickets_generados_json=?
              WHERE id=?`,
        args: [texto, monto, JSON.stringify(ticketsGenerados), row.id]
      });

      console.log(`✅ SMS validó pago #${row.id} → DNI ${row.cliente_dni} → S/ ${monto} → ${ticketsGenerados.length} ticket(s)`);

      res.json({
        matched: true,
        pago_id: row.id,
        monto,
        tickets: ticketsGenerados.map(t => ({
          codigo_ticket: t.codigo_ticket,
          sorteo_id: t.sorteo_id
        }))
      });
    } catch (e) {
      console.error('Error en webhook SMS:', e);
      res.status(500).json({ error: safeMsg(e) });
    }
  }
);

export default router;