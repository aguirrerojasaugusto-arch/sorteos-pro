import { db } from './database.js';

export async function runMigrations() {
  console.log('⏳ Verificando tablas y ejecutando migraciones...');

  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      dni TEXT UNIQUE,
      saldo REAL DEFAULT 0.0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS sorteos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      slug TEXT UNIQUE,
      subtitulo TEXT,
      premio_descripcion TEXT,
      precio_jugada REAL NOT NULL,
      pozo_actual REAL DEFAULT 0,
      imagen TEXT,
      banner_lateral TEXT,
      activo INTEGER DEFAULT 1,
      fecha_sorteo DATETIME,
      hora_sorteo TEXT,
      min_bolillas INTEGER DEFAULT 6,
      max_numero INTEGER DEFAULT 51,
      moneda TEXT DEFAULT 'S/',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sorteo_id INTEGER,
      user_id INTEGER,
      codigo_ticket TEXT NOT NULL,
      cliente_nombre TEXT,
      cliente_dni TEXT,
      cliente_telefono TEXT,
      cliente_departamento TEXT,
      cantidad_tickets INTEGER DEFAULT 1,
      total_pagado REAL DEFAULT 0,
      comprobante_url TEXT,
      comprobante_hash TEXT,
      jugadas_json TEXT,
      si_o_si INTEGER DEFAULT 0,
      boliyapa_numero INTEGER,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sorteo_id) REFERENCES sorteos(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS carrusel (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS bolas_logos (posicion INTEGER PRIMARY KEY, url_imagen TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS banners (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS promos_laterales (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL, fecha TEXT NOT NULL DEFAULT '')`
  ];

  try {
    for (const sql of queries) {
      await db.execute(sql);
    }

    const alterQueries = [
      `ALTER TABLE tickets ADD COLUMN sorteo_id INTEGER`,
      `ALTER TABLE tickets ADD COLUMN user_id INTEGER`,
      `ALTER TABLE tickets ADD COLUMN codigo_ticket TEXT`,
      `ALTER TABLE tickets ADD COLUMN cliente_nombre TEXT`,
      `ALTER TABLE tickets ADD COLUMN cliente_dni TEXT`,
      `ALTER TABLE tickets ADD COLUMN cliente_telefono TEXT`,
      `ALTER TABLE tickets ADD COLUMN cliente_departamento TEXT`,
      `ALTER TABLE tickets ADD COLUMN cantidad_tickets INTEGER DEFAULT 1`,
      `ALTER TABLE tickets ADD COLUMN total_pagado REAL DEFAULT 0`,
      `ALTER TABLE tickets ADD COLUMN comprobante_url TEXT`,
      `ALTER TABLE tickets ADD COLUMN comprobante_hash TEXT`,
      `ALTER TABLE tickets ADD COLUMN jugadas_json TEXT`,
      `ALTER TABLE tickets ADD COLUMN si_o_si INTEGER DEFAULT 0`,
      `ALTER TABLE tickets ADD COLUMN boliyapa_numero INTEGER`,
      `ALTER TABLE sorteos ADD COLUMN subtitulo TEXT`,
      `ALTER TABLE sorteos ADD COLUMN premio_descripcion TEXT`,
      `ALTER TABLE sorteos ADD COLUMN imagen TEXT`,
      `ALTER TABLE sorteos ADD COLUMN banner_lateral TEXT`,
      `ALTER TABLE sorteos ADD COLUMN activo INTEGER DEFAULT 1`,
      `ALTER TABLE sorteos ADD COLUMN fecha_sorteo DATETIME`,
      `ALTER TABLE sorteos ADD COLUMN hora_sorteo TEXT`,
      `ALTER TABLE sorteos ADD COLUMN pozo_actual REAL DEFAULT 0`,
      `ALTER TABLE promos_laterales ADD COLUMN fecha TEXT`,
      `ALTER TABLE promos_laterales ADD COLUMN url_imagen TEXT`,
      `ALTER TABLE banners ADD COLUMN url_imagen TEXT`,
      `ALTER TABLE carrusel ADD COLUMN url_imagen TEXT`,
      `ALTER TABLE users ADD COLUMN telefono TEXT`,
      `ALTER TABLE users ADD COLUMN departamento TEXT`
    ];

    for (const sql of alterQueries) {
      try {
        await db.execute(sql);
      } catch (e) {
        if (!e.message.includes('duplicate column')) {
          console.warn(`   ⚠️  ALTER falló (no crítico): ${e.message}`);
        }
      }
    }

    // ✅ Crear índice para búsquedas rápidas de duplicados
    try {
      await db.execute('CREATE INDEX IF NOT EXISTS idx_tickets_comprobante_hash ON tickets(comprobante_hash)');
    } catch (e) {
      console.warn('   ⚠️  No se pudo crear el índice de hash:', e.message);
    }

    try {
      await db.execute(`
        UPDATE users SET telefono = (
          SELECT t.cliente_telefono FROM tickets t
          WHERE t.cliente_dni = users.dni
            AND t.cliente_telefono IS NOT NULL AND t.cliente_telefono != ''
          ORDER BY t.id DESC LIMIT 1
        )
        WHERE (telefono IS NULL OR telefono = '') AND dni IS NOT NULL
      `);
      await db.execute(`
        UPDATE users SET departamento = (
          SELECT t.cliente_departamento FROM tickets t
          WHERE t.cliente_dni = users.dni
            AND t.cliente_departamento IS NOT NULL AND t.cliente_departamento != ''
          ORDER BY t.id DESC LIMIT 1
        )
        WHERE (departamento IS NULL OR departamento = '') AND dni IS NOT NULL
      `);
      console.log('🔧 Fichas de clientes completadas desde tickets');
    } catch (e) {
      console.warn('   ⚠️  No se pudieron completar fichas:', e.message);
    }

    try {
      const info = await db.execute('PRAGMA table_info(promos_laterales)');
      const colFecha = info.rows.find(r => r.name === 'fecha');
      if (colFecha && colFecha.notnull === 0) {
        console.log('🔧 Normalizando promos_laterales.fecha → NOT NULL DEFAULT \'\'');
        await db.execute(
          `CREATE TABLE promos_laterales__new (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             url_imagen TEXT NOT NULL,
             fecha TEXT NOT NULL DEFAULT ''
           )`
        );
        await db.execute(
          `INSERT INTO promos_laterales__new (id, url_imagen, fecha)
           SELECT id, COALESCE(url_imagen, ''), COALESCE(fecha, '') FROM promos_laterales`
        );
        await db.execute('DROP TABLE promos_laterales');
        await db.execute('ALTER TABLE promos_laterales__new RENAME TO promos_laterales');
        console.log('✅ promos_laterales normalizada');
      }
    } catch (e) {
      console.error('⚠️  No se pudo normalizar promos_laterales:', e.message);
    }

    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      args: ['brand_name', 'Sorteos Pro']
    });
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      args: ['footer_legal', 'Juegos responsables. Solo para mayores de 18 años.']
    });
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      args: ['contacto_telefono', '']
    });
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      args: ['contacto_direccion', '']
    });
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      args: ['redes_facebook', '']
    });
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      args: ['redes_youtube', '']
    });
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      args: ['redes_tiktok', '']
    });
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      args: ['logo_marca', '']
    });

    const checkSorteos = await db.execute('SELECT COUNT(*) as count FROM sorteos');
    if (checkSorteos.rows[0].count === 0) {
      await db.execute({
        sql: `INSERT INTO sorteos (nombre, slug, subtitulo, premio_descripcion, precio_jugada, pozo_actual, activo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ['Gana Diario', 'gana-diario-1', 'Sorteo Diario', 'Premio de S/ 1000', 10, 0, 1]
      });
    }

    console.log('✅ Tablas verificadas/creadas correctamente');
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    throw error;
  }
}