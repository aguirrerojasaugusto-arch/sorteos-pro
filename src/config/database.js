const { createClient } = require('@libsql/client');
const fs = require('fs');

// Crear la carpeta data si no existe para evitar errores en local
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

// CORREGIDO: Ahora busca TURSO_DATABASE_URL (el nombre correcto que pusiste en Render)
const url = process.env.TURSO_DATABASE_URL || 'file:data/sorteos.db';
const authToken = url.startsWith('libsql://') ? process.env.TURSO_AUTH_TOKEN : undefined;

const db = createClient({
  url: url,
  authToken: authToken,
});

async function testConnection() {
  try {
    await db.execute('SELECT 1');
    console.log(url.startsWith('libsql://') 
      ? '✅ Conectado exitosamente a Turso (PRODUCCIÓN)' 
      : '✅ Conectado exitosamente a SQLite (LOCAL)');
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    // Quitamos el process.exit(1) para que Render no mate el proceso si hay un micro-corte
  }
}

module.exports = { db, testConnection };