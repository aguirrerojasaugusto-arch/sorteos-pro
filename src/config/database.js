import { createClient } from '@libsql/client';
import fs from 'fs';

// Crear la carpeta data si no existe para evitar errores en local
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

// CORREGIDO: Ahora busca TURSO_DATABASE_URL (el nombre correcto que pusiste en Render)
const url = process.env.TURSO_DATABASE_URL || 'file:data/sorteos.db';
const authToken = url.startsWith('libsql://') ? process.env.TURSO_AUTH_TOKEN : undefined;

// EXPORTAMOS db directamente
export const db = createClient({
  url: url,
  authToken: authToken,
});

// EXPORTAMOS la función
export async function testConnection() {
  try {
    await db.execute('SELECT 1');
    console.log(url.startsWith('libsql://') 
      ? '✅ Conectado exitosamente a Turso (PRODUCCIÓN)' 
      : '✅ Conectado exitosamente a SQLite (LOCAL)');
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
  }
}