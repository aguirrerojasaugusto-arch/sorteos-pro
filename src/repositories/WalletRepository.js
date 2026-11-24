import { db } from '../config/database.js';

// ✅ Tabla real: `users` (confirmado por UserRepository.js y migrations.js)
const TABLA_USUARIOS = 'users';

export class WalletRepository {
  constructor(database = db) {
    this.db = database;
  }

  async debitarSaldoAtomico(userId, monto, exec = null) {
    const e = exec || this.db;
    const res = await e.execute({
      sql: `UPDATE ${TABLA_USUARIOS}
            SET saldo = saldo - ?
            WHERE id = ? AND saldo >= ?
            RETURNING saldo`,
      args: [monto, userId, monto]
    });
    if (res.rows.length === 0) {
      const check = await e.execute({
        sql: `SELECT saldo FROM ${TABLA_USUARIOS} WHERE id = ?`,
        args: [userId]
      });
      if (check.rows.length === 0) throw new Error('Usuario no encontrado');
      throw new Error('Saldo insuficiente');
    }
    return { nuevoSaldo: res.rows[0].saldo };
  }

  async acreditarSaldoAtomico(userId, monto, exec = null) {
    const e = exec || this.db;
    const res = await e.execute({
      sql: `UPDATE ${TABLA_USUARIOS}
            SET saldo = saldo + ?
            WHERE id = ?
            RETURNING saldo`,
      args: [monto, userId]
    });
    if (res.rows.length === 0) throw new Error('Usuario no encontrado');
    return { nuevoSaldo: res.rows[0].saldo };
  }

  async createTransaccion(data, exec = null) {
    const e = exec || this.db;
    const res = await e.execute({
      sql: `INSERT INTO transacciones (usuario_id, tipo, monto, saldo_resultante, referencia, estado)
            VALUES (?,?,?,?,?,?) RETURNING *`,
      args: [
        data.usuario_id, data.tipo, data.monto, data.saldo_resultante,
        data.referencia || null, data.estado || 'COMPLETADO'
      ]
    });
    return res.rows[0];
  }

  async getTransaccionesByUsuario(usuarioId, limit = 50) {
    const res = await this.db.execute({
      sql: 'SELECT * FROM transacciones WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT ?',
      args: [usuarioId, limit]
    });
    return res.rows;
  }

  async getAllTransacciones(limit = 100) {
    const res = await this.db.execute({
      sql: `SELECT t.*, u.email FROM transacciones t
            JOIN ${TABLA_USUARIOS} u ON u.id = t.usuario_id
            ORDER BY t.creado_en DESC LIMIT ?`,
      args: [limit]
    });
    return res.rows;
  }
}