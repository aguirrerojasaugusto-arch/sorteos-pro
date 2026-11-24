class ComboPricingService {
  /**
   * Calcula el total con descuento por cantidad de sorteos consecutivos.
   * @param {number} precioJugada
   * @param {number} cantidadJugadas  (zonas A/B/C/D)
   * @param {number} cantidadSorteos
   * @param {Array<{cantidad:number, descuento:number}>} reglas
   */
  calcularTotal(precioJugada, cantidadJugadas, cantidadSorteos, reglas = []) {
    const base = +(precioJugada * cantidadJugadas * cantidadSorteos).toFixed(2);
    const regla = [...reglas].sort((a, b) => b.cantidad - a.cantidad)
      .find(r => cantidadSorteos >= r.cantidad);
    const descuento = regla ? regla.descuento : 0;
    const total = +(base * (1 - descuento)).toFixed(2);
    return { base, descuento, total };
  }
}

module.exports = ComboPricingService;