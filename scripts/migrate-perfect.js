// scripts/migrate-perfect.js
// ⚠️ Corré este script UNA VEZ antes de deployar el código nuevo.
//    node scripts/migrate-perfect.js
import { db } from '../src/config/database.js';

async function run() {
  console.log('🔍 Verificando duplicados en tickets...');
  const dupCod = await db.execute(`
    SELECT codigo_ticket, COUNT(*) AS cnt FROM tickets
    GROUP BY codigo_ticket HAVING cnt > 1
  `);
  if (dupCod.rows.length > 0) {
    console.error('❌ Hay codigo_ticket duplicados. Abortando.');
    console.error(dupCod.rows);
    process.exit(1);
  }
  console.log('✅ Sin duplicados en codigo_ticket.');

  console.log('📦 Creando tabla comprobantes...');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS comprobantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comprobante_hash TEXT NOT NULL,
      usuario_id INTEGER,
      cliente_dni TEXT,
      monto_total REAL NOT NULL DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_comprobantes_hash ON comprobantes(comprobante_hash)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_comprobantes_dni ON comprobantes(cliente_dni)`);

  console.log('🔄 Backfill de comprobantes ya usados...');
  await db.execute(`
    INSERT OR IGNORE INTO comprobantes (comprobante_hash, monto_total)
    SELECT comprobante_hash, SUM(total_pagado)
    FROM tickets
    WHERE comprobante_hash IS NOT NULL
    GROUP BY comprobante_hash
  `);

  console.log('🔒 Creando UNIQUE en codigo_ticket...');
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_codigo_ticket ON tickets(codigo_ticket)`);

  console.log('🎉 Migración completa.');
}

run().catch(e => { console.error('❌ Error:', e); process.exit(1); });