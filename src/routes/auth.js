import express from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/AuthService.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { db } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const authService = new AuthService(new UserRepository(db));
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/register', limiter, async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/login', limiter, async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await new UserRepository(db).findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { password_hash, ...safe } = user;
    res.json({ usuario: safe });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/logout', requireAuth, (req, res) => res.status(204).end());

export default router;