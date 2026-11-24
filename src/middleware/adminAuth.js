export function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_KEY || 'admin2026';
  
  if (!key || key !== expected) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}