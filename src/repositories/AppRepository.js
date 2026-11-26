import { db } from '../config/database.js';

export class AppRepository {
  constructor(dbInstance) {
    this._db = dbInstance || db;
    this._ticketCols = null;
  }

  async getDashboardStats() {
    const usersCount = await this._db.execute('SELECT COUNT(*) as total FROM users');
    const totalSales = await this._db.execute('SELECT SUM(total_pagado) as total FROM tickets');
    return { totalUsers: usersCount.rows[0].total, totalSales: totalSales.rows[0].total || 0 };
  }

  async getSetting(key) {
    const result = await this._db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
    return result.rows[0] ? result.rows[0].value : null;
  }

  async setSetting(key, value) {
    await this._db.execute({
      sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      args: [key, value]
    });
  }

  async getConfig() {
    const result = await this._db.execute('SELECT * FROM settings');
    const config = {};
    result.rows.forEach(row => { config[row.key] = row.value; });
    return config;
  }

  async updateConfig(key, value) {
    await this.setSetting(key, value);
    return this.getConfig();
  }

  async getSorteoById(id) {
    const result = await this._db.execute({ sql: 'SELECT * FROM sorteos WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  }

  async getAllSorteos() {
    const result = await this._db.execute('SELECT * FROM sorteos ORDER BY id DESC');
    return result.rows;
  }

  async getSorteosActivos() {
    const result = await this._db.execute('SELECT * FROM sorteos WHERE activo = 1');
    return result.rows;
  }

  async upsertSorteo(sorteo) {
    if (sorteo.id) {
      const result = await this._db.execute({
        sql: `UPDATE sorteos SET nombre = ?, slug = ?, subtitulo = ?, premio_descripcion = ?, precio_jugada = ?, pozo_actual = 0, min_bolillas = ?, max_numero = ?, imagen = ?, banner_lateral = ?, fecha_sorteo = ?, hora_sorteo = ?, activo = ? WHERE id = ? RETURNING *`,
        args: [
          sorteo.nombre, sorteo.slug, sorteo.subtitulo || null, sorteo.premio_descripcion || null,
          sorteo.precio_jugada, sorteo.min_bolillas || 6, sorteo.max_numero || 51,
          sorteo.imagen || null, sorteo.banner_lateral || null, sorteo.fecha_sorteo || null,
          sorteo.hora_sorteo || null, sorteo.activo !== undefined ? Number(sorteo.activo) : 1, sorteo.id
        ]
      });
      return result.rows[0];
    } else {
      const result = await this._db.execute({
        sql: `INSERT INTO sorteos ( nombre, slug, subtitulo, premio_descripcion, precio_jugada, pozo_actual, min_bolillas, max_numero, imagen, banner_lateral, fecha_sorteo, hora_sorteo, activo ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        args: [
          sorteo.nombre, sorteo.slug, sorteo.subtitulo || null, sorteo.premio_descripcion || null,
          sorteo.precio_jugada, sorteo.min_bolillas || 6, sorteo.max_numero || 51,
          sorteo.imagen || null, sorteo.banner_lateral || null, sorteo.fecha_sorteo || null,
          sorteo.hora_sorteo || null, sorteo.activo !== undefined ? Number(sorteo.activo) : 1
        ]
      });
      return result.rows[0];
    }
  }

  async _getTicketColumns(exec = null) {
    if (this._ticketCols) return this._ticketCols;
    const e = exec || this._db;
    const result = await e.execute('PRAGMA table_info(tickets)');
    this._ticketCols = result.rows;
    console.log('📋 Esquema real de tickets:', this._ticketCols.map(c => `${c.name}${c.notnull ? ' (NOT NULL)' : ''}`).join(', '));
    return this._ticketCols;
  }

  async createTicket(data, exec = null) {
    const e = exec || this._db;
    const cols = await this._getTicketColumns(e);
    const mapping = {
      codigo_ticket: data.codigo_ticket,
      sorteo_id: data.sorteo_id ?? null,
      user_id: data.usuario_id ?? data.user_id ?? null,
      cliente_nombre: data.cliente_nombre ?? null,
      cliente_dni: data.cliente_dni ?? null,
      cliente_telefono: data.telefono ?? data.cliente_telefono ?? null,
      cliente_departamento: data.departamento ?? data.cliente_departamento ?? null,
      cantidad_tickets: data.cantidad_sorteos ?? data.cantidad_tickets ?? 1,
      total_pagado: data.total_pagado ?? 0,
      comprobante_url: data.comprobante_url ?? null,
      comprobante_hash: data.comprobante_hash ?? null,
      jugadas_json: data.jugadas_json ?? '[]',
      si_o_si: data.si_o_si ?? 0,
      boliyapa_numero: data.boliyapa_numero ?? null,
      monto_yape_exacto: data.monto_yape_exacto ?? null,
      estado_pago: data.estado_pago ?? 'pendiente',
      captura_yape_url: data.captura_yape_url ?? null,
      sms_codigo_operacion: data.sms_codigo_operacion ?? null,
      webhook_recibido_at: data.webhook_recibido_at ?? null,
    };
    const insertCols = [];
    const args = [];
    for (const col of cols) {
      if (col.pk === 1) continue;
      if (col.name === 'creado_en') continue;
      if (col.name in mapping) {
        insertCols.push(col.name);
        args.push(mapping[col.name]);
      } else if (col.notnull === 1 && (col.dflt_value === null || col.dflt_value === undefined)) {
        const t = (col.type || '').toUpperCase();
        const fallback = t.includes('INT') ? 0 : t.includes('REAL') ? 0.0 : '';
        console.warn(`⚠️ Columna NOT NULL desconocida "${col.name}" → fallback ${JSON.stringify(fallback)}`);
        insertCols.push(col.name);
        args.push(fallback);
      }
    }
    const sql = `INSERT INTO tickets (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')}) RETURNING *`;
    const result = await e.execute({ sql, args });
    return result.rows[0];
  }

  async existeCodigoTicket(codigo, exec = null) {
    const e = exec || this._db;
    const result = await e.execute({ sql: 'SELECT 1 FROM tickets WHERE codigo_ticket = ? LIMIT 1', args: [codigo] });
    return result.rows.length > 0;
  }

  async existeComprobanteHash(hash, exec = null) {
    if (!hash) return false;
    const e = exec || this._db;
    try {
      const result = await e.execute({
        sql: 'SELECT 1 FROM comprobantes WHERE comprobante_hash = ? LIMIT 1',
        args: [hash]
      });
      return result.rows.length > 0;
    } catch (err) {
      if (/no such table/i.test(String(err.message || ''))) return false;
      throw err;
    }
  }

  async getUltimoCodigoNumeric(exec = null) {
    const e = exec || this._db;
    const result = await e.execute({
      sql: `SELECT codigo_ticket FROM tickets WHERE LENGTH(codigo_ticket) = 5 ORDER BY codigo_ticket DESC LIMIT 1`
    });
    return result.rows[0] ? result.rows[0].codigo_ticket : null;
  }

  async getUltimosTickets(limit = 100) {
    const result = await this._db.execute({ sql: 'SELECT * FROM tickets ORDER BY id DESC LIMIT ?', args: [limit] });
    return result.rows;
  }

  async getTicketByCodigo(codigo) {
    const result = await this._db.execute({ sql: 'SELECT * FROM tickets WHERE codigo_ticket = ?', args: [codigo] });
    return result.rows[0] || null;
  }

  async getTicketsByUsuario(usuarioId) {
    const result = await this._db.execute({ sql: 'SELECT * FROM tickets WHERE user_id = ? ORDER BY id DESC', args: [usuarioId] });
    return result.rows;
  }

  // ✅ NUEVO: Buscar pago pendiente VERIFICANDO por monto y código 3d (Escenario B)
  async getPagoPendienteVerificando(monto, codigo3d) {
    const r = await this._db.execute({
      sql: `SELECT * FROM pagos_pendientes
            WHERE monto_unico = ? AND codigo_cliente_3d = ?
              AND estado_verificacion = 'VERIFICANDO'
              AND estado IN ('pendiente','verificando','comprobante_subido')
              AND expira_en > datetime('now')
            ORDER BY creado_en DESC LIMIT 1`,
      args: [monto, codigo3d]
    });
    return r.rows[0] || null;
  }

  // ✅ NUEVO: Obtener pagos en revisión manual (para Panel Admin)
  async getPagosRevisionManual() {
    const r = await this._db.execute({
      sql: `SELECT * FROM pagos_pendientes
            WHERE estado = 'revision_manual'
            ORDER BY creado_en DESC`
    });
    return r.rows;
  }

  // ⚠️ DEPRECATED: Se mantiene por compatibilidad pero ya NO se usa en el flujo nuevo
  async getTicketPendienteByMontoYape(montoExacto, exec = null) {
    const e = exec || this._db;
    const result = await e.execute({
      sql: `SELECT * FROM tickets WHERE monto_yape_exacto = ? AND estado_pago = 'pendiente' ORDER BY creado_en ASC LIMIT 1`,
      args: [montoExacto]
    });
    return result.rows[0] || null;
  }

  // ⚠️ DEPRECATED: Se mantiene por compatibilidad pero ya NO se usa en el flujo nuevo
  async actualizarEstadoPago(ticketId, estado, datos = {}, exec = null) {
    const e = exec || this._db;
    const updates = ['estado_pago = ?'];
    const args = [estado];
    if (datos.captura_yape_url) {
      updates.push('captura_yape_url = ?');
      args.push(datos.captura_yape_url);
    }
    if (datos.sms_codigo_operacion) {
      updates.push('sms_codigo_operacion = ?');
      args.push(datos.sms_codigo_operacion);
    }
    if (datos.webhook_recibido_at) {
      updates.push('webhook_recibido_at = ?');
      args.push(datos.webhook_recibido_at);
    }
    args.push(ticketId);
    const sql = `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`;
    await e.execute({ sql, args });
  }

  async getTicketsByCompra(clienteDni, sorteoId, minutos = 15) {
    const result = await this._db.execute({
      sql: `SELECT * FROM tickets WHERE cliente_dni = ? AND sorteo_id = ? AND creado_en >= datetime('now', '-${minutos} minutes') ORDER BY id DESC`,
      args: [clienteDni, sorteoId]
    });
    return result.rows;
  }

  async getCarruselImagenes() {
    const result = await this._db.execute('SELECT * FROM carrusel ORDER BY id ASC');
    return result.rows;
  }

  async updateCarruselImagenes(imagenes) {
    await this._db.execute('DELETE FROM carrusel');
    for (const img of imagenes) {
      await this._db.execute({ sql: 'INSERT INTO carrusel (url_imagen) VALUES (?)', args: [img.url_imagen] });
    }
    return this.getCarruselImagenes();
  }

  async getBolasLogos() {
    const result = await this._db.execute('SELECT * FROM bolas_logos ORDER BY posicion ASC');
    return result.rows;
  }

  async updateBolaLogo(posicion, url_imagen) {
    await this._db.execute({
      sql: `INSERT INTO bolas_logos (posicion, url_imagen) VALUES (?, ?) ON CONFLICT(posicion) DO UPDATE SET url_imagen = excluded.url_imagen`,
      args: [posicion, url_imagen]
    });
    return this.getBolasLogos();
  }

  async getBanners() {
    const result = await this._db.execute('SELECT * FROM banners ORDER BY id ASC');
    return result.rows;
  }

  async updateBanners(banners) {
    await this._db.execute('DELETE FROM banners');
    for (const b of banners) {
      await this._db.execute({ sql: 'INSERT INTO banners (url_imagen) VALUES (?)', args: [b.url_imagen] });
    }
    return this.getBanners();
  }

  async getPromosLaterales() {
    const result = await this._db.execute('SELECT * FROM promos_laterales ORDER BY id ASC');
    return result.rows;
  }

  async updatePromosLaterales(promos) {
    await this._db.execute('DELETE FROM promos_laterales');
    for (let i = 0; i < promos.length; i++) {
      const p = promos[i];
      const url_imagen = (p && typeof p.url_imagen === 'string') ? p.url_imagen.trim() : '';
      const fecha = (p && typeof p.fecha === 'string') ? p.fecha.trim() : '';
      if (!url_imagen) continue;
      await this._db.execute({
        sql: 'INSERT INTO promos_laterales (url_imagen, fecha) VALUES (?, ?)',
        args: [url_imagen, fecha]
      });
    }
    return this.getPromosLaterales();
  }

  async getPromocionesActivas() {
    try {
      const result = await this._db.execute('SELECT * FROM promociones');
      return result.rows;
    } catch (e) { return []; }
  }

  async getAllResultados() {
    const result = await this._db.execute('SELECT * FROM resultados ORDER BY id DESC');
    return result.rows;
  }

  async getGanadoresRecientes(limit = 5) {
    const result = await this._db.execute({
      sql: 'SELECT * FROM tickets WHERE total_pagado > 0 ORDER BY id DESC LIMIT ?',
      args: [limit]
    });
    return result.rows;
  }

  async logYapeWebhook(montoRecibido, smsBody, ticketId, estado) {
    const result = await this._db.execute({
      sql: `INSERT INTO yape_webhook_logs (monto_recibido, sms_body, ticket_id, estado) VALUES (?, ?, ?, ?) RETURNING *`,
      args: [montoRecibido, smsBody, ticketId, estado]
    });
    return result.rows[0];
  }

  async limpiarTicketsExpirados(minutos = 15) {
    const result = await this._db.execute({
      sql: `DELETE FROM tickets WHERE estado_pago = 'pendiente' AND creado_en < datetime('now', '-${minutos} minutes')`,
      args: []
    });
    return result.rows.length;
  }
}