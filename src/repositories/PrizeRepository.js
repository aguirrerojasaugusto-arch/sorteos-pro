class PrizeRepository {
  constructor(db) { this.db = db; }
  getTablaPremios(sorteoId) {
    return this.db.prepare(
      'SELECT * FROM tabla_premios WHERE sorteo_id = ? ORDER BY aciertos DESC'
    ).all(sorteoId);
  }
  upsert(data) {
    if (data.id) {
      this.db.prepare(
        'UPDATE tabla_premios SET aciertos=?, tipo_premio=?, monto=?, descripcion=? WHERE id=?'
      ).run(data.aciertos, data.tipo_premio, data.monto, data.descripcion, data.id);
      return data;
    }
    const info = this.db.prepare(
      'INSERT INTO tabla_premios (sorteo_id, aciertos, tipo_premio, monto, descripcion) VALUES (?,?,?,?,?)'
    ).run(data.sorteo_id, data.aciertos, data.tipo_premio, data.monto, data.descripcion);
    return { id: info.lastInsertRowid, ...data };
  }
  delete(id) {
    return this.db.prepare('DELETE FROM tabla_premios WHERE id = ?').run(id);
  }
}

module.exports = PrizeRepository;