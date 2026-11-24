import { createClient } from '@libsql/client';
import fs from 'fs';

if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

const url = process.env.TURSO_DATABASE_URL || 'file:data/sorteos.db';
const authToken = url.startsWith('libsql://') ? process.env.TURSO_AUTH_TOKEN : undefined;

export const db = createClient({ url, authToken });

// ✅ Pragmas (solo aplican a SQLite local; en Turso son no-op).
// busy_timeout reduce SQLITE_BUSY cuando una query coincide con un writer.
db.execute('PRAGMA journal_mode = WAL').catch(() => {});
db.execute('PRAGMA busy_timeout = 5000').catch(() => {});
db.execute('PRAGMA foreign_keys = ON').catch(() => {});

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