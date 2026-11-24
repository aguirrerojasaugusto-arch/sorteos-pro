// src/routes/public.js
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import { AppRepository } from '../repositories/AppRepository.js';
import { TicketSearchRepository } from '../repositories/TicketSearchRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { WalletRepository } from '../repositories/WalletRepository.js';
import { WalletService } from '../services/WalletService.js';
import { SorteoService } from '../services/SorteoService.js';
import { db } from '../config/database.js';

const router = express.Router();

const appRepo = new AppRepository(db);
const searchRepo = new TicketSearchRepository(db);
const userRepo = new UserRepository(db);
const walletService = new WalletService(userRepo, new WalletRepository(db));
const sorteoService = new SorteoService({ appRepo, walletService });
const compraLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

if (!fs.existsSync('public/uploads')) {
  fs.mkdirSync('public/uploads', { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage: storage });

router.get('/bootstrap', async (req, res) => {
  try {
    const config = await appRepo.getConfig();
    const sorteosActivos = await appRepo.getSorteosActivos();
    const sorteos = sorteosActivos.map(s => ({ ...s, combo_descuentos: s.combo_descuentos ? JSON.parse(s.combo_descuentos) : [] }));
    
    res.json({
      config, sorteos,
      promociones: await appRepo.getPromocionesActivas(),
      resultados_recientes: (await appRepo.getAllResultados()).slice(0, 5),
      ganadores: (await appRepo.getGanadoresRecientes(5)).map(g => ({ ...g, codigo_ticket: g.codigo_ticket.slice(0, 5) + '****' })),
      carrusel: await appRepo.getCarruselImagenes(),
      bolas_logos: await appRepo.getBolasLogos(),
      banners: await appRepo.getBanners(),
      promos_laterales: await appRepo.getPromosLaterales()
    });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Error interno' }); 
  }
});

router.get('/cliente/:dni', async (req, res) => {
  try {
    const dni = req.params.dni;
    if (!dni || dni.length !== 8) return res.json({ encontrado: false });

    const cliente = await userRepo.findByDni(dni);

    if (cliente) {
      const partes = (cliente.nombre || '').trim().split(' ');
      const nombres = partes[0] || '';
      const apellidos = partes.slice(1).join(' ') || '';

      res.json({
        encontrado: true,
        datos: {
          nombres,
          apellidos,
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

router.post('/comprar-aleatorio', compraLimiter, upload.single('comprobante'), async (req, res) => {
  try {
    const { sorteo_id, nombres, apellidos, dni, departamento, celular, cantidad_tickets } = req.body;

    if (!sorteo_id) throw new Error('ID del sorteo es requerido');
    if (!dni || dni.length !== 8) throw new Error('DNI válido de 8 dígitos es requerido');

    const sorteo = await appRepo.getSorteoById(Number(sorteo_id));
    if (!sorteo) throw new Error('Sorteo no encontrado');
    
    const nombreCompleto = `${nombres || ''} ${apellidos || ''}`.trim();
    await userRepo.saveOrUpdateClient(dni, nombreCompleto, celular, departamento);

    const ticketsGenerados = [];
    const cantidad = Number(cantidad_tickets) || 1;
    const comprobanteUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    for (let i = 0; i < cantidad; i++) {
      const numerosAleatorios = [];
      while (numerosAleatorios.length < sorteo.min_bolillas) {
        const num = Math.floor(Math.random() * sorteo.max_numero) + 1;
        if (!numerosAleatorios.includes(num)) numerosAleatorios.push(num);
      }
      numerosAleatorios.sort((a, b) => a - b);
      
      const bodyCompra = {
        sorteo_id: sorteo.id,
        cliente_nombre: nombreCompleto,
        cliente_dni: dni,
        telefono: celular || '',
        departamento: departamento || '',
        jugadas: [{ zona: 'A', numeros: numerosAleatorios }],
        cantidad_sorteos: 1,
        si_o_si: false,
        boliyapa_numero: null,
        comprobante_url: comprobanteUrl,
        comprobante_file: req.file, // ✅ NUEVO: Necesario para que SorteoService calcule el hash y bloquee duplicados
        total_pagado: sorteo.precio_jugada
      };
      
      const resultado = await sorteoService.comprar(bodyCompra);
      const ticketCreado = resultado.tickets ? resultado.tickets[0] : resultado.ticket;
      ticketsGenerados.push(ticketCreado);
    }
    
    res.status(201).json({ tickets: ticketsGenerados });
  } catch (e) { 
    console.error('Error en comprar-aleatorio:', e);
    res.status(400).json({ error: e.message }); 
  }
});

router.post('/tickets', compraLimiter, async (req, res) => {
  try { 
    if (!req.body.sorteo_id) throw new Error('Falta el ID del sorteo');
    
    const { cliente_dni, cliente_nombre, telefono, departamento } = req.body;
    if (cliente_dni && String(cliente_dni).length === 8) {
      await userRepo.saveOrUpdateClient(cliente_dni, cliente_nombre || '', telefono || '', departamento || '');
    }
    
    res.status(201).json(await sorteoService.comprar(req.body)); 
  } catch (e) { 
    console.error('Error en tickets admin:', e);
    res.status(400).json({ error: e.message }); 
  }
});

router.get('/tickets/:codigo', async (req, res) => {
  try {
    const t = await appRepo.getTicketByCodigo(req.params.codigo);
    if (!t) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ Endpoint público para consultar tickets por DNI, nombre, celular o código
router.get('/consultar-tickets', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim().length < 3) {
      return res.status(400).json({ error: 'Ingresa al menos 3 caracteres, un DNI (8 dígitos) o un celular (9 dígitos)' });
    }
    
    // ✅ CAMBIO: Usamos el nuevo repositorio especializado en búsqueda
    const resultado = await searchRepo.buscarTicketsPorCliente(q);
    
    // ✅ Asegurar que el resultado tenga nombre y departamento para el modal
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