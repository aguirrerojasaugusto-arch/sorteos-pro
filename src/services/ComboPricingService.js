export class ComboPricingService {
  /**
   * Calcula el total con descuento por cantidad de sorteos consecutivos.
   * @param {number} precioJugada
   * @param {number} cantidadJugadas  (zonas A/B/C/D del mismo boleto)
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

  /**
   * Interfaz de alto nivel usada por SorteoService.
   * Toma las reglas de `sorteo.combo_descuentos` (JSON string o array).
   * @returns {number} total a pagar
   */
  calcular(sorteo, cantidadJugadas, cantidadSorteos) {
    let reglas = [];
    try {
      if (Array.isArray(sorteo?.combo_descuentos)) {
        reglas = sorteo.combo_descuentos;
      } else if (typeof sorteo?.combo_descuentos === 'string' && sorteo.combo_descuentos.trim() !== '') {
        reglas = JSON.parse(sorteo.combo_descuentos);
      }
    } catch { reglas = []; }

    const { total } = this.calcularTotal(
      Number(sorteo?.precio_jugada) || 0,
      cantidadJugadas,
      cantidadSorteos,
      Array.isArray(reglas) ? reglas : []
    );
    return total;
  }
}

export default ComboPricingService;