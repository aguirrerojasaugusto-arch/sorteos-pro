// crear-tablas-faltantes.js
import { createClient } from '@libsql/client';

// Usamos las variables de entorno.
// Si estás en local, asegurate de tener el archivo .env con TURSO_DATABASE_URL y TURSO_AUTH_TOKEN
// Si no usás dotenv, ejecutá este script con: node --env-file=.env crear-tablas-faltantes.js
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('❌ ERROR: No se encontró TURSO_DATABASE_URL.');
  console.error('👉 Asegurate de ejecutar con: node --env-file=.env crear-tablas-faltantes.js');
  process.exit(1);
}

const db = createClient({ url, authToken });

const queries = [
  // 1. Tabla resultados (la que está rompiendo tu web ahora)
  `CREATE TABLE IF NOT EXISTS resultados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sorteo_id INTEGER,
    bolillas_json TEXT,
    si_o_si INTEGER DEFAULT 0,
    boliyapa INTEGER,
    fecha_sorteo DATETIME,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 2. Tabla transacciones (necesaria para el wallet)
  `CREATE TABLE IF NOT EXISTS transacciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    monto REAL NOT NULL,
    saldo_resultante REAL NOT NULL,
    referencia TEXT,
    estado TEXT DEFAULT 'COMPLETADO',
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 3. Tabla comprobantes (para evitar doble uso de vouchers)
  `CREATE TABLE IF NOT EXISTS comprobantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comprobante_hash TEXT NOT NULL,
    usuario_id INTEGER,
    cliente_dni TEXT,
    monto_total REAL NOT NULL DEFAULT 0,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 4. Tablas de imágenes (por si acaso)
  `CREATE TABLE IF NOT EXISTS carrusel (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bolas_logos (posicion INTEGER PRIMARY KEY, url_imagen TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS banners (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS promos_laterales (id INTEGER PRIMARY KEY AUTOINCREMENT, url_imagen TEXT NOT NULL, fecha TEXT NOT NULL DEFAULT '')`
];

async function main() {
  console.log('🔧 Conectando a Turso...');
  try {
    await db.execute('SELECT 1');
    console.log('✅ Conexión exitosa.\n');
  } catch (e) {
    console.error('❌ Error de conexión:', e.message);
    process.exit(1);
  }

  for (let i = 0; i < queries.length; i++) {
    const sql = queries[i];
    // Extraemos el nombre de la tabla del SQL solo para mostrarlo bonito en consola
    const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    const tableName = match ? match[1] : 'tabla_desconocida';

    try {
      await db.execute(sql);
      console.log(`✅ Tabla "${tableName}" creada o ya existente.`);
    } catch (e) {
      console.error(`❌ Error creando "${tableName}":`, e.message);
    }
  }

  // Aprovechamos para agregar la columna combo_descuentos a sorteos por si falta
  try {
    await db.execute(`ALTER TABLE sorteos ADD COLUMN combo_descuentos TEXT DEFAULT '[]'`);
    console.log('✅ Columna "combo_descuentos" agregada a sorteos.');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('ℹ️  La columna "combo_descuentos" ya existía en sorteos.');
    } else {
      console.warn('⚠️  No se pudo agregar combo_descuentos:', e.message);
    }
  }

  console.log('\n🎉 ¡Migración completada!');
  console.log('👉 Ahora reiniciá tu servidor en Render (o esperá que se redeploye) y recargá la web.');
}

main();