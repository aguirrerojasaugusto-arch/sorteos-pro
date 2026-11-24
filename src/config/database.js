import { createClient } from '@libsql/client';
import fs from 'fs';

// Crear la carpeta data si no existe para evitar errores en local
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

// Usa la variable de entorno, o si no existe, usa el archivo local
const url = process.env.TURSO_DATABASE_URL || 'file:data/sorteos.db';
const authToken = url.startsWith('libsql://') ? process.env.TURSO_AUTH_TOKEN : undefined;

export const db = createClient({
  url: url,
  authToken: authToken,
});

// Función para probar la conexión al arrancar la app
export async function testConnection() {
  try {
    await db.execute('SELECT 1');
    console.log('✅ Conectado exitosamente a la base de datos local (SQLite)');
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    process.exit(1); 
  }
}