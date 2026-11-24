import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta destino: public/uploads
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Carpeta de uploads creada en:', uploadDir);
}

// Configuración de Multer en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, `${unique}-${safeName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const tipos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (tipos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

router.post('/', upload.single('imagen'), (req, res) => {
  console.log('--- Intento de subida a /api/upload ---');
  console.log('req.file:', req.file ? `✅ Recibido: ${req.file.filename} (${req.file.size} bytes)` : '❌ NO RECIBIDO');

  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió el archivo. Verifica que el campo se llame "imagen".' });
  }

  // Devolvemos la ruta relativa que el frontend ya sabe construir
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ✅ Manejo de errores de Multer (siempre devuelve JSON, nunca HTML)
router.use((err, req, res, next) => {
  console.error('❌ Error en middleware de subida:', err.message);
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

export default router;