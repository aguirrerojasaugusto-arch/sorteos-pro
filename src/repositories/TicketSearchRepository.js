// src/repositories/TicketSearchRepository.js
import { db } from '../config/database.js';

export class TicketSearchRepository {
  constructor(dbInstance) {
    this._db = dbInstance || db;
    this._ticketCols = null;
  }

  async _getTicketColumns() {
    if (this._ticketCols) return this._ticketCols;
    const result = await this._db.execute('PRAGMA table_info(tickets)');
    this._ticketCols = result.rows;
    return this._ticketCols;
  }

  async _ticketHas(col) {
    try {
      const cols = await this._getTicketColumns();
      return cols.some(c => c.name === col);
    } catch (e) {
      return false;
    }
  }

  _normCol(col) {
    // Normaliza la columna en SQL: quita espacios, puntos y guiones para comparar solo dígitos
    return `REPLACE(REPLACE(REPLACE(COALESCE(CAST(${col} AS TEXT), ''), ' ', ''), '.', ''), '-', '')`;
  }

  async buscarTicketsPorCliente(query) {
    const raw = (query == null ? '' : String(query)).trim();
    if (!raw) return { tickets: [], total: 0 };

    try {
      const digits = raw.replace(/\D/g, '');
      const isNumeric = digits.length > 0 && digits === raw.replace(/[\s.\-]/g, '');
      const hasCodigo = await this._ticketHas('codigo_ticket');
      const hasDni = await this._ticketHas('cliente_dni');
      const hasTel = await this._ticketHas('cliente_telefono');
      const hasNombre = await this._ticketHas('cliente_nombre');
      const hasSorteoId = await this._ticketHas('sorteo_id');
      const hasCreadoEn = await this._ticketHas('creado_en');

      const conds = [];
      const args = [];

      if (isNumeric && digits.length >= 3) {
        // Busca en TODAS las columnas numéricas disponibles simultáneamente (OR)
        if (hasCodigo) {
          conds.push(`${this._normCol('t.codigo_ticket')} LIKE ?`);
          args.push(`%${digits}%`);
        }
        if (hasDni) {
          conds.push(`${this._normCol('t.cliente_dni')} = ?`);
          args.push(digits);
        }
        if (hasTel) {
          conds.push(`${this._normCol('t.cliente_telefono')} = ?`);
          args.push(digits);
        }
      } else if (!isNumeric && raw.length >= 3 && hasNombre) {
        conds.push('LOWER(t.cliente_nombre) LIKE ?');
        args.push(`%${raw.toLowerCase()}%`);
      }

      if (!conds.length) return { tickets: [], total: 0 };

      // ✅ CAMBIO CLAVE: Incluir s.fecha_sorteo en el SELECT
      const select = hasSorteoId 
        ? 't.*, s.nombre AS nombre_sorteo, s.fecha_sorteo AS fecha_sorteo' 
        : 't.*';
      
      const from = hasSorteoId
        ? 'FROM tickets t LEFT JOIN sorteos s ON t.sorteo_id = s.id'
        : 'FROM tickets t';
      
      const orderBy = hasCreadoEn ? 't.creado_en DESC' : 't.ROWID DESC';
      
      const sql = `
        SELECT ${select}
        ${from}
        WHERE ${conds.join(' OR ')}
        ORDER BY ${orderBy}
      `;

      const result = await this._db.execute({ sql, args });
      
      const tickets = result.rows.map(t => {
        // ✅ CAMBIO: Mostrar código de ticket en lugar de números jugados
        const codigo = t.codigo_ticket 
          ? String(t.codigo_ticket).split('-').pop() 
          : '---';
        
        return { 
          ...t, 
          codigo_mostrado: codigo,
          // Mantener jugadas por compatibilidad con otros módulos
          jugadas: t.jugadas_json ? JSON.parse(t.jugadas_json) : []
        };
      });

      return { tickets, total: tickets.length };
    } catch (e) {
      console.error('❌ TicketSearchRepository.buscarTicketsPorCliente:', e.message);
      return { tickets: [], total: 0 };
    }
  }
}