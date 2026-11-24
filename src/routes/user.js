import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { WalletRepository } from '../repositories/WalletRepository.js';
import { AppRepository } from '../repositories/AppRepository.js';
import { WalletService } from '../services/WalletService.js';
import { db } from '../config/database.js';

const router = express.Router();
const userRepo = new UserRepository(db);
const walletRepo = new WalletRepository(db);
const appRepo = new AppRepository(db);
const walletService = new WalletService(userRepo, walletRepo);

router.use(requireAuth);

router.get('/wallet', async (req, res) => {
  try {
    res.json(await walletService.getSaldo(req.user.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/wallet/recarga', async (req, res) => {
  try {
    const { monto, metodo } = req.body;
    const tx = await walletService.recargar(req.user.id, Number(monto), metodo || 'SIMULADO');
    res.status(201).json(tx);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/tickets', async (req, res) => {
  try { res.json(await appRepo.getTicketsByUsuario(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tickets/:codigo', async (req, res) => {
  try {
    const t = await appRepo.getTicketByCodigo(req.params.codigo);
    if (!t || t.usuario_id !== req.user.id)
      return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/premios', async (req, res) => {
  try {
    const tickets = await appRepo.getTicketsByUsuario(req.user.id);
    const premios = tickets.filter(t => t.premio_ganado > 0);
    res.json(premios);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;