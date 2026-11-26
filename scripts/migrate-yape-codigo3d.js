// scripts/migrate-yape-codigo3d.js
// Migración para implementar validación por código de 3 dígitos Yape
// Ejecutar: node scripts/migrate-yape-codigo3d.js

import { db } from '../src/config/database.js';

async function runMigration() {
  console.log('🚀 Iniciando migración: Validación Yape por código 3 dígitos\n');
  console.log('='.repeat(60));

  try {
    // ============================================================
    // 1) CREAR TABLA pagos_recibidos (para almacenar SMS de MacroDroid)
    // ============================================================
    console.log('\n📋 Paso 1: Creando tabla pagos_recibidos...');
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS pagos_recibidos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          monto REAL NOT NULL,
          codigo_operacion TEXT,
          codigo_3d TEXT,
          sms_texto TEXT,
          estado TEXT DEFAULT 'LIBRE',
          pago_pendiente_id INTEGER,
          recibido_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Tabla pagos_recibidos creada');
    } catch (e) {
      if (/already exists/i.test(e.message)) {
        console.log('   ⏭️ Tabla pagos_recibidos ya existe');
      } else {
        throw e;
      }
    }

    // Crear índice para búsquedas rápidas
    try {
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_pagos_recibidos_libre
        ON pagos_recibidos(monto, codigo_3d, estado)
      `);
      console.log('   ✅ Índice idx_pagos_recibidos_libre creado');
    } catch (e) {
      console.log('   ⏭️ Índice ya existe o no se pudo crear:', e.message);
    }

    // ============================================================
    // 2) AGREGAR COLUMNAS a pagos_pendientes
    // ============================================================
    console.log('\n📋 Paso 2: Agregando columnas a pagos_pendientes...');

    const columnasNuevas = [
      {
        nombre: 'codigo_cliente_3d',
        sql: "ALTER TABLE pagos_pendientes ADD COLUMN codigo_cliente_3d TEXT",
        descripcion: 'Código de 3 dígitos ingresado por el cliente'
      },
      {
        nombre: 'estado_verificacion',
        sql: "ALTER TABLE pagos_pendientes ADD COLUMN estado_verificacion TEXT",
        descripcion: 'Estado de verificación (VERIFICANDO, REVISION_MANUAL)'
      },
      {
        nombre: 'intentos_codigo',
        sql: "ALTER TABLE pagos_pendientes ADD COLUMN intentos_codigo INTEGER DEFAULT 0",
        descripcion: 'Número de intentos de código fallidos'
      },
      {
        nombre: 'captura_url',
        sql: "ALTER TABLE pagos_pendientes ADD COLUMN captura_url TEXT",
        descripcion: 'URL de la captura de pantalla para revisión manual'
      },
      {
        nombre: 'aprobado_por',
        sql: "ALTER TABLE pagos_pendientes ADD COLUMN aprobado_por TEXT",
        descripcion: 'Operador que aprobó manualmente'
      },
      {
        nombre: 'aprobado_en',
        sql: "ALTER TABLE pagos_pendientes ADD COLUMN aprobado_en DATETIME",
        descripcion: 'Fecha/hora de aprobación manual'
      },
      {
        nombre: 'motivo_rechazo',
        sql: "ALTER TABLE pagos_pendientes ADD COLUMN motivo_rechazo TEXT",
        descripcion: 'Motivo de rechazo si aplica'
      }
    ];

    for (const col of columnasNuevas) {
      try {
        await db.execute(col.sql);
        console.log(`   ✅ Columna agregada: ${col.nombre} (${col.descripcion})`);
      } catch (e) {
        if (/duplicate column/i.test(e.message)) {
          console.log(`   ⏭️ Columna ${col.nombre} ya existe`);
        } else {
          console.warn(`   ⚠️ Error al agregar ${col.nombre}: ${e.message}`);
        }
      }
    }

    // ============================================================
    // 3) CREAR TABLA conciliaciones (para auditoría)
    // ============================================================
    console.log('\n📋 Paso 3: Creando tabla conciliaciones...');
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS conciliaciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pago_recibido_id INTEGER,
          pago_pendiente_id INTEGER,
          tipo TEXT,
          detalle TEXT,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Tabla conciliaciones creada');
    } catch (e) {
      if (/already exists/i.test(e.message)) {
        console.log('   ⏭️ Tabla conciliaciones ya existe');
      } else {
        throw e;
      }
    }

    // ============================================================
    // 4) VERIFICAR estructura de pagos_pendientes
    // ============================================================
    console.log('\n📋 Paso 4: Verificando estructura de pagos_pendientes...');
    try {
      const info = await db.execute('PRAGMA table_info(pagos_pendientes)');
      console.log('   Columnas actuales en pagos_pendientes:');
      info.rows.forEach(row => {
        console.log(`      - ${row.name} (${row.type})`);
      });
    } catch (e) {
      console.warn('   ⚠️ No se pudo verificar estructura:', e.message);
    }

    // ============================================================
    // 5) VERIFICAR que pagos_pendientes existe
    // ============================================================
    console.log('\n📋 Paso 5: Verificando tabla pagos_pendientes...');
    try {
      const check = await db.execute(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='pagos_pendientes'
      `);
      if (check.rows.length === 0) {
        console.log('   ⚠️ Tabla pagos_pendientes NO existe. Creándola...');
        await db.execute(`
          CREATE TABLE pagos_pendientes (
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
            jugadas_json TEXT NOT NULL,
            si_o_si INTEGER DEFAULT 0,
            boliyapa_numero INTEGER,
            expira_en DATETIME NOT NULL,
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sorteo_id) REFERENCES sorteos(id)
          )
        `);
        console.log('   ✅ Tabla pagos_pendientes creada');
      } else {
        console.log('   ✅ Tabla pagos_pendientes ya existe');
      }
    } catch (e) {
      console.error('   ❌ Error verificando pagos_pendientes:', e.message);
    }

    // ============================================================
    // RESUMEN FINAL
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Migración completada exitosamente');
    console.log('='.repeat(60));
    console.log('\n✅ Nuevas tablas creadas:');
    console.log('   - pagos_recibidos (almacena SMS de MacroDroid)');
    console.log('   - conciliaciones (auditoría de aprobaciones)');
    console.log('\n✅ Nuevas columnas en pagos_pendientes:');
    console.log('   - codigo_cliente_3d');
    console.log('   - estado_verificacion');
    console.log('   - intentos_codigo');
    console.log('   - captura_url');
    console.log('   - aprobado_por');
    console.log('   - aprobado_en');
    console.log('   - motivo_rechazo');
    console.log('\n📝 Ahora puedes ejecutar:');
    console.log('   node scripts/migrate-yape-codigo3d.js\n');

  } catch (error) {
    console.error('\n❌ Error en la migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();