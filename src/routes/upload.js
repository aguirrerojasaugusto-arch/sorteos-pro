import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const router = express.Router();

// Multer en memoria (no guarda en disco)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.post('/', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió el archivo.' });
    }

    // Convertir buffer a base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    // Subir directamente a Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'sorteos-pro/admin',
      resource_type: 'auto',
    });

    console.log('✅ Imagen subida a Cloudinary:', result.secure_url);

    res.json({ 
      url: result.secure_url,
      filename: result.public_id 
    });
  } catch (error) {
    console.error('❌ Error subiendo a Cloudinary:', error.message);
    res.status(500).json({ error: 'Error al subir la imagen a Cloudinary' });
  }
});

// Manejo de errores de Multer
router.use((err, req, res, next) => {
  console.error('❌ Error en middleware de subida:', err.message);
  res.status(400).json({ error: err.message || 'Error al procesar la imagen' });
});

export default router;