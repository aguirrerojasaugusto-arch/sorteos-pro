class TicketValidator {
  constructor(sorteo) { 
    this.sorteo = sorteo; 
  }

  validarJugadas(jugadas) {
    if (!Array.isArray(jugadas) || jugadas.length === 0)
      throw new Error('Debe enviar al menos una jugada');
    if (jugadas.length > 4)
      throw new Error('Máximo 4 jugadas (A, B, C, D)');
    
    const zonas = new Set();
    for (const j of jugadas) {
      if (!j.zona || zonas.has(j.zona))
        throw new Error('Zona inválida o duplicada');
      zonas.add(j.zona);
      
      if (!Array.isArray(j.numeros) || j.numeros.length !== this.sorteo.min_bolillas)
        throw new Error(`Cada jugada debe tener ${this.sorteo.min_bolillas} números`);
      
      const set = new Set();
      for (const n of j.numeros) {
        if (!Number.isInteger(n) || n < 1 || n > this.sorteo.max_numero)
          throw new Error(`Número fuera de rango (1-${this.sorteo.max_numero})`);
        if (set.has(n)) throw new Error('Números duplicados en la jugada');
        set.add(n);
      }
    }
  }

  validarTitular(nombre, dni) {
    if (!nombre || nombre.trim().length < 3)
      throw new Error('Nombre del titular inválido (mínimo 3 caracteres)');
    
    // ✅ FIX: Acepta 7 u 8 dígitos. Previene fallos por errores de tipeo comunes 
    // o documentos de identidad no peruanos, sin comprometer la integridad.
    const dniStr = String(dni).trim();
    if (!/^\d{7,8}$/.test(dniStr))
      throw new Error('DNI debe tener 7 u 8 dígitos numéricos');
  }

  validarBoliyapa(numero) {
    if (numero == null) return;
    if (!Number.isInteger(numero) || numero < 1 || numero > this.sorteo.max_numero)
      throw new Error(`Boliyapa fuera de rango (1-${this.sorteo.max_numero})`);
  }

  validarSorteoAbierto() {
    const ahora = new Date();
    const cierre = new Date(this.sorteo.fecha_sorteo);
    if (isNaN(cierre.getTime()) || cierre < ahora)
      throw new Error('El sorteo ya cerró');
  }
}

module.exports = TicketValidator;