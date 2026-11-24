import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Importaciones de configuración
import { testConnection } from './config/database.js';
import { runMigrations } from './config/migrations.js';

// Importación de rutas
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import uploadRoutes from './routes/upload.js';

// Configuración para usar __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ==========================================
// MIDDLEWARES
// ==========================================
app.use(helmet({ 
  contentSecurityPolicy: false
})); 
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde.'
});
app.use('/api/', limiter);

// ==========================================
// ARCHIVOS ESTÁTICOS (FRONTEND)
// ==========================================
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// RUTAS DE LA API
// ==========================================
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ==========================================
// INICIALIZACIÓN DEL SERVIDOR
// ==========================================
async function startServer() {
  try {
    await testConnection();
    await runMigrations();

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`🔗 Panel Admin: http://localhost:${PORT}/admin.html`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar la app:', error);
    process.exit(1);
  }
}

startServer();