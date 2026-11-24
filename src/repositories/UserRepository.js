import { db } from '../config/database.js';

export class UserRepository {
  constructor(database = db) { 
    this.db = database; 
  }

  async findByEmail(email) {
    const res = await this.db.execute({ 
      sql: 'SELECT * FROM users WHERE email = ?', 
      args: [email] 
    });
    return res.rows[0] || null;
  }

  async findById(id) {
    const res = await this.db.execute({ 
      sql: 'SELECT * FROM users WHERE id = ?', 
      args: [id] 
    });
    return res.rows[0] || null;
  }

  async findByDni(dni) {
    const res = await this.db.execute({ 
      sql: 'SELECT nombre, dni, telefono, departamento FROM users WHERE dni = ?', 
      args: [dni] 
    });
    return res.rows[0] || null;
  }

  // ✅ COALESCE/NULLIF: si llega vacío, NO pisa el dato ya guardado
  async saveOrUpdateClient(dni, nombreCompleto, telefono, departamento) {
    const emailTemp = `cliente_${dni}@juegayana.temp`;
    await this.db.execute({
      sql: `INSERT INTO users (nombre, email, password, dni, telefono, departamento) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(dni) DO UPDATE SET 
            nombre = excluded.nombre,
            telefono = COALESCE(NULLIF(excluded.telefono, ''), users.telefono),
            departamento = COALESCE(NULLIF(excluded.departamento, ''), users.departamento)`,
      args: [nombreCompleto, emailTemp, 'guest', dni, telefono || '', departamento || '']
    });
  }

  async create(data) {
    const res = await this.db.execute({
      sql: `INSERT INTO users (email, password, nombre, dni, telefono) 
            VALUES (?,?,?,?,?) RETURNING id`,
      args: [data.email, data.password_hash, data.nombre, data.dni, data.telefono || null]
    });
    return await this.findById(res.rows[0].id);
  }

  async updateSaldo(id, nuevoSaldo) {
    return await this.db.execute({ 
      sql: 'UPDATE users SET saldo = ? WHERE id = ?', 
      args: [nuevoSaldo, id] 
    });
  }

  async getAll() {
    const res = await this.db.execute(
      'SELECT id, email, nombre, dni, telefono, saldo, creado_en FROM users ORDER BY id DESC'
    );
    return res.rows;
  }
}