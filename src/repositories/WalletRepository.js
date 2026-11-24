import { db } from '../config/database.js';

export class WalletRepository {
  constructor(database = db) { 
    this.db = database; 
  }

  async createTransaccion(data) {
    const res = await this.db.execute({
      sql: `INSERT INTO transacciones (usuario_id, tipo, monto, saldo_resultante, referencia, estado) 
            VALUES (?,?,?,?,?,?) RETURNING id`,
      args: [
        data.usuario_id, data.tipo, data.monto, data.saldo_resultante,
        data.referencia || null, data.estado || 'COMPLETADO'
      ]
    });
    
    const txRes = await this.db.execute({
      sql: 'SELECT * FROM transacciones WHERE id = ?',
      args: [res.rows[0].id]
    });
    return txRes.rows[0];
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
      sql: 'SELECT t.*, u.email FROM transacciones t JOIN usuarios u ON u.id = t.usuario_id ORDER BY t.creado_en DESC LIMIT ?',
      args: [limit]
    });
    return res.rows;
  }
}