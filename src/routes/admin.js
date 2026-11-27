import express from 'express';
import { AppRepository } from '../repositories/AppRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { WalletRepository } from '../repositories/WalletRepository.js';
import { WalletService } from '../services/WalletService.js';
import { PrizeCalculator } from '../services/PrizeCalculator.js';
import { SorteoService } from '../services/SorteoService.js';
import { db } from '../config/database.js';

const router = express.Router();
const appRepo = new AppRepository(db);
const userRepo = new UserRepository(db);
const walletService = new WalletService(userRepo, new WalletRepository(db));
const prizeCalc = new PrizeCalculator({ appRepo, walletService });
const sorteoService = new SorteoService({ appRepo, walletService, db });

router.get('/dashboard', async (req, res) => {
  try {
    res.json({
      config: await appRepo.getConfig(),
      sorteos: await appRepo.getAllSorteos(),
      tickets: await appRepo.getUltimosTickets(100),
      carrusel: await appRepo.getCarruselImagenes(),
      bolas_logos: await appRepo.getBolasLogos(),
      banners: await appRepo.getBanners(),
      promos_laterales: await appRepo.getPromosLaterales(),
      usuarios: await userRepo.getAll()
    });
  } catch (e) {
    console.error('❌ Error en /dashboard:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ✅ ACTUALIZADA: ahora acepta también logo_marca
router.post('/config', async (req, res) => {
  try {
    const {
      brand_name, footer_legal,
      contacto_telefono, contacto_direccion,
      redes_facebook, redes_youtube, redes_tiktok,
      logo_marca
    } = req.body;
    if (brand_name !== undefined) await appRepo.updateConfig('brand_name', brand_name);
    if (footer_legal !== undefined) await appRepo.updateConfig('footer_legal', footer_legal);
    if (contacto_telefono !== undefined) await appRepo.updateConfig('contacto_telefono', contacto_telefono);
    if (contacto_direccion !== undefined) await appRepo.updateConfig('contacto_direccion', contacto_direccion);
    if (redes_facebook !== undefined) await appRepo.updateConfig('redes_facebook', redes_facebook);
    if (redes_youtube !== undefined) await appRepo.updateConfig('redes_youtube', redes_youtube);
    if (redes_tiktok !== undefined) await appRepo.updateConfig('redes_tiktok', redes_tiktok);
    if (logo_marca !== undefined) await appRepo.updateConfig('logo_marca', logo_marca);
    res.json(await appRepo.getConfig());
  } catch (e) {
    console.error('❌ Error en /config:', e.message);
    res.status(400).json({ error: e.message });
  }
});

router.post('/carrusel', async (req, res) => {
  try {
    const imagenes = Array.isArray(req.body.imagenes) ? req.body.imagenes : [];
    console.log('📦 /carrusel recibe', imagenes.length, 'imágenes');
    res.json(await appRepo.updateCarruselImagenes(imagenes));
  } catch (e) {
    console.error('❌ Error en /carrusel:', e.message, e.stack);
    res.status(400).json({ error: e.message });
  }
});

router.post('/bolas', async (req, res) => {
  try {
    res.json(await appRepo.updateBolaLogo(req.body.posicion, req.body.url_imagen));
  } catch (e) {
    console.error('❌ Error en /bolas:', e.message);
    res.status(400).json({ error: e.message });
  }
});

router.post('/banners', async (req, res) => {
  try {
    const banners = Array.isArray(req.body.banners) ? req.body.banners : [];
    console.log('📦 /banners recibe', banners.length, 'banners');
    res.json(await appRepo.updateBanners(banners));
  } catch (e) {
    console.error('❌ Error en /banners:', e.message, e.stack);
    res.status(400).json({ error: e.message });
  }
});

router.post('/promos-laterales', async (req, res) => {
  try {
    const raw = req.body.promos;
    console.log('📦 /promos-laterales recibe:', JSON.stringify(raw));
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: 'El campo "promos" debe ser un array' });
    }
    const promos = raw
      .filter(p => p && typeof p.url_imagen === 'string' && p.url_imagen.trim() !== '')
      .map(p => ({
        url_imagen: p.url_imagen.trim(),
        fecha: (typeof p.fecha === 'string' ? p.fecha.trim() : '')
      }));
    console.log('📦 /promos-laterales normalizadas:', promos.length);
    res.json(await appRepo.updatePromosLaterales(promos));
  } catch (e) {
    console.error('❌ Error en /promos-laterales:', e.message);
    console.error('   Stack:', e.stack);
    res.status(400).json({ error: e.message });
  }
});

router.post('/sorteos', async (req, res) => {
  try {
    res.json(await appRepo.upsertSorteo(req.body));
  } catch (e) {
    console.error('❌ Error en /sorteos:', e.message, e.stack);
    res.status(400).json({ error: e.message });
  }
});

router.post('/resultados', async (req, res) => {
  try {
    res.status(201).json(await prizeCalc.procesarResultado(req.body.sorteo_id, req.body.bolillas, req.body.si_o_si, req.body.boliyapa));
  } catch (e) {
    console.error('❌ Error en /resultados:', e.message);
    res.status(400).json({ error: e.message });
  }
});

router.get('/usuarios', async (req, res) => {
  try {
    res.json(await userRepo.getAll());
  } catch (e) {
    console.error('❌ Error en /usuarios:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ✅ NUEVO: Panel de Revisión Manual de Pagos Yape
// ============================================================

// GET /api/admin/pagos/revision-manual
router.get('/pagos/revision-manual', async (req, res) => {
  try {
    const pagos = await appRepo.getPagosRevisionManual();
    res.json({ pagos });
  } catch (e) {
    console.error('❌ Error en /pagos/revision-manual:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/pagos/revision-manual/contador
router.get('/pagos/revision-manual/contador', async (req, res) => {
  try {
    const pagos = await appRepo.getPagosRevisionManual();
    res.json({ count: pagos.length });
  } catch (e) {
    console.error('❌ Error en /pagos/revision-manual/contador:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/pagos/:token/aprobar
router.post('/pagos/:token/aprobar', async (req, res) => {
  try {
    const { token } = req.params;
    const { operador } = req.body || {};
    if (!token) throw new Error('Token requerido');

    const pending = await db.execute({
      sql: `SELECT * FROM pagos_pendientes WHERE token = ? LIMIT 1`,
      args: [token]
    });
    if (pending.rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    const row = pending.rows[0];

    if (row.estado !== 'revision_manual') {
      return res.status(400).json({ error: `No se puede aprobar: estado actual es '${row.estado}'` });
    }

    await sorteoService.validarPagoPendiente(row, 'APROBACION_MANUAL', null);
    await db.execute({
      sql: `UPDATE pagos_pendientes SET aprobado_por=?, aprobado_en=datetime('now') WHERE id=?`,
      args: [operador || 'admin', row.id]
    });

    await db.execute({
      sql: `UPDATE pagos_recibidos SET estado='CONCILIADO_MANUALMENTE' WHERE pago_pendiente_id=?`,
      args: [row.id]
    });

    console.log(`✅ Pago #${row.id} aprobado manualmente por ${operador || 'admin'}`);
    res.json({ ok: true, estado: 'validado', pago_id: row.id });
  } catch (e) {
    console.error('❌ Error en aprobar:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/pagos/:token/rechazar
router.post('/pagos/:token/rechazar', async (req, res) => {
  try {
    const { token } = req.params;
    const { operador, motivo } = req.body || {};
    if (!token) throw new Error('Token requerido');

    const pending = await db.execute({
      sql: `SELECT * FROM pagos_pendientes WHERE token = ? LIMIT 1`,
      args: [token]
    });
    if (pending.rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    const row = pending.rows[0];

    if (row.estado !== 'revision_manual') {
      return res.status(400).json({ error: `No se puede rechazar: estado actual es '${row.estado}'` });
    }

    await db.execute({
      sql: `UPDATE pagos_pendientes SET estado='rechazado', motivo_rechazo=?, aprobado_por=? WHERE id=?`,
      args: [motivo || 'Rechazado por operador', operador || 'admin', row.id]
    });

    console.log(`❌ Pago #${row.id} rechazado por ${operador || 'admin'}: ${motivo}`);
    res.json({ ok: true, estado: 'rechazado', pago_id: row.id });
  } catch (e) {
    console.error('❌ Error en rechazar:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;