// src/routes/public.js
import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { AppRepository } from '../repositories/AppRepository.js';
import { TicketSearchRepository } from '../repositories/TicketSearchRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { WalletRepository } from '../repositories/WalletRepository.js';
import { WalletService } from '../services/WalletService.js';
import { SorteoService } from '../services/SorteoService.js';
import { ComboPricingService } from '../services/ComboPricingService.js';
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
// Comprar aleatorio
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
// Crear tickets (admin)
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

export default router;