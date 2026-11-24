import express from 'express';
import { AppRepository } from '../repositories/AppRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { WalletRepository } from '../repositories/WalletRepository.js';
import { WalletService } from '../services/WalletService.js';
import { PrizeCalculator } from '../services/PrizeCalculator.js';
import { db } from '../config/database.js';

const router = express.Router();
const appRepo = new AppRepository(db);
const userRepo = new UserRepository(db);
const walletService = new WalletService(userRepo, new WalletRepository(db));
const prizeCalc = new PrizeCalculator({ appRepo, walletService });

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
      logo_marca  // ✅ NUEVO
    } = req.body;

    if (brand_name !== undefined) await appRepo.updateConfig('brand_name', brand_name);
    if (footer_legal !== undefined) await appRepo.updateConfig('footer_legal', footer_legal);
    if (contacto_telefono !== undefined) await appRepo.updateConfig('contacto_telefono', contacto_telefono);
    if (contacto_direccion !== undefined) await appRepo.updateConfig('contacto_direccion', contacto_direccion);
    if (redes_facebook !== undefined) await appRepo.updateConfig('redes_facebook', redes_facebook);
    if (redes_youtube !== undefined) await appRepo.updateConfig('redes_youtube', redes_youtube);
    if (redes_tiktok !== undefined) await appRepo.updateConfig('redes_tiktok', redes_tiktok);
    if (logo_marca !== undefined) await appRepo.updateConfig('logo_marca', logo_marca);  // ✅ NUEVO

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

export default router;