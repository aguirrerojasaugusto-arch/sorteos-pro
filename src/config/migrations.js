import { db } from './database.js';

export async function runMigrations() {
  console.log('⏳ Verificando tablas y ejecutando migraciones...');
  const queries = [
    `CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, dni TEXT UNIQUE, saldo REAL DEFAULT 0.0, creado_en DATETIME DEFAULT CURRENT_TIMESTAMP )`,
    `CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT )`,
    `CREATE TABLE IF NOT EXISTS sorteos ( id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, slug TEXT UNIQUE, subtitulo TEXT, premio_descripcion TEXT, precio_jugada REAL NOT NULL, pozo_actual REAL DEFAULT 0, imagen TEXT, banner_lateral TEXT, activo INTEGER DEFAULT 1, fecha_sorteo DATETIME, hora_sorteo TEXT, min_bolillas INTEGER DEFAULT 6, max_numero INTEGER DEFAULT 51, moneda TEXT DEFAULT 'S/', creado_en DATETIME DEFAULT CURRENT_TIMESTAMP )`,
    `CREATE TABLE IF NOT EXISTS tickets ( id INTEGER PRIMARY KEY AUTOINCREMENT, sorteo_id INTEGER, user_id INTEGER, codigo_ticket TEXT NOT NULL, cliente_nombre TEXT, cliente_dni TEXT, cliente_telefono TEXT, cliente_departamento TEXT, cantidad_tickets INTEGER DEFAULT 1, total_pagado REAL DEFAULT 0, comprobante_url TEXT, comprobante_hash TEXT, jugadas_json TEXT, si_o_si INTEGER DEFAULT 0, boliyapa_numero INTEGER, creado_en DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(sorteo_id) REFERENCES sorteos(id), FOREIGN KEY(user_id) REFERENCES users(id) )`,
    `CREATE TABLE IF NOT EXISTS carrusel (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS bolas_logos (posicion INTEGER PRIMARY KEY, url_imagen TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS banners (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS promos_laterales (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL, fecha TEXT NOT NULL DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS comprobantes ( id INTEGER PRIMARY KEY AUTOINCREMENT, comprobante_hash TEXT NOT NULL, usuario_id INTEGER, cliente_dni TEXT, monto_total REAL NOT NULL DEFAULT 0, creado_en DATETIME DEFAULT CURRENT_TIMESTAMP )`,
    `CREATE TABLE IF NOT EXISTS yape_webhook_logs ( id INTEGER PRIMARY KEY AUTOINCREMENT, monto_recibido REAL NOT NULL, sms_body TEXT, ticket_id INTEGER, estado TEXT DEFAULT 'pendiente', creado_en DATETIME DEFAULT CURRENT_TIMESTAMP )`,
    // ✅ NUEVO: Tabla para pagos pendientes (flujo Yape con código 3 dígitos)
    `CREATE TABLE IF NOT EXISTS pagos_pendientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      sorteo_id INTEGER NOT NULL,
      cliente_dni TEXT NOT NULL,
      cliente_nombre TEXT NOT NULL,
      cliente_telefono TEXT,
      cliente_departamento TEXT,
      cantidad_tickets INTEGER NOT NULL,
      cantidad_sorteos INTEGER NOT NULL DEFAULT 1,
      monto_base REAL NOT NULL,
      monto_unico REAL NOT NULL,
      estado TEXT DEFAULT 'pendiente',
      estado_verificacion TEXT,
      codigo_cliente_3d TEXT,
      intentos_codigo INTEGER DEFAULT 0,
      jugadas_json TEXT NOT NULL,
      si_o_si INTEGER DEFAULT 0,
      boliyapa_numero INTEGER,
      expira_en DATETIME NOT NULL,
      comprobante_url TEXT,
      captura_url TEXT,
      sms_texto TEXT,
      sms_monto REAL,
      sms_codigo_operacion TEXT,
      tickets_generados_json TEXT,
      validado_en DATETIME,
      aprobado_por TEXT,
      aprobado_en DATETIME,
      motivo_rechazo TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sorteo_id) REFERENCES sorteos(id)
    )`,
    // ✅ NUEVO: Tabla para notificaciones SMS recibidas
    `CREATE TABLE IF NOT EXISTS pagos_recibidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monto REAL NOT NULL,
      codigo_operacion TEXT,
      codigo_3d TEXT,
      sms_texto TEXT,
      estado TEXT DEFAULT 'LIBRE',
      pago_pendiente_id INTEGER,
      recibido_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    // ✅ NUEVO: Tabla de conciliaciones
    `CREATE TABLE IF NOT EXISTS conciliaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pago_recibido_id INTEGER,
      pago_pendiente_id INTEGER,
      tipo TEXT,
      detalle TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
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
      `ALTER TABLE users ADD COLUMN departamento TEXT`,
      `ALTER TABLE tickets ADD COLUMN monto_yape_exacto REAL`,
      `ALTER TABLE tickets ADD COLUMN estado_pago TEXT DEFAULT 'pendiente'`,
      `ALTER TABLE tickets ADD COLUMN captura_yape_url TEXT`,
      `ALTER TABLE tickets ADD COLUMN sms_codigo_operacion TEXT`,
      `ALTER TABLE tickets ADD COLUMN webhook_recibido_at DATETIME`
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

    // ✅ Índices
    try {
      await db.execute('CREATE INDEX IF NOT EXISTS idx_tickets_comprobante_hash ON tickets(comprobante_hash)');
    } catch (e) {
      console.warn('   ⚠️  No se pudo crear el índice de hash:', e.message);
    }

    try {
      await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_comprobantes_hash ON comprobantes(comprobante_hash)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_comprobantes_dni ON comprobantes(cliente_dni)');
    } catch (e) {
      console.warn('   ⚠️  No se pudo crear UNIQUE en comprobantes:', e.message);
    }

    try {
      await db.execute('CREATE INDEX IF NOT EXISTS idx_tickets_monto_yape ON tickets(monto_yape_exacto)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_tickets_estado_pago ON tickets(estado_pago)');
    } catch (e) {
      console.warn('   ⚠️  No se pudo crear índices de Yape:', e.message);
    }

    try {
      const dup = await db.execute(`
        SELECT codigo_ticket, COUNT(*) AS cnt
        FROM tickets
        GROUP BY codigo_ticket
        HAVING cnt > 1
      `);
      if (dup.rows.length === 0) {
        await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_codigo_ticket ON tickets(codigo_ticket)');
      } else {
        console.warn(`   ⚠️  Hay ${dup.rows.length} codigo_ticket duplicados.`);
      }
    } catch (e) {
      console.warn('   ⚠️  No se pudo crear UNIQUE en codigo_ticket:', e.message);
    }

    // ✅ Índices nuevos para pagos_pendientes y pagos_recibidos
    try {
      await db.execute('CREATE INDEX IF NOT EXISTS idx_pagos_pendientes_token ON pagos_pendientes(token)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_pagos_pendientes_estado ON pagos_pendientes(estado)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_pagos_pendientes_expira ON pagos_pendientes(expira_en)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_pagos_recibidos_libre ON pagos_recibidos(monto, codigo_3d, estado)');
    } catch (e) {
      console.warn('   ⚠️  No se pudo crear índices de pagos:', e.message);
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