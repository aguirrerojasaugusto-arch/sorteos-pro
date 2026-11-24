export class PrizeCalculator {
  constructor({ appRepo, walletService }) {
    this.appRepo = appRepo;
    this.walletService = walletService;
  }

  async procesarResultado(sorteoId, bolillasGanadoras, resultadoSiOSi, resultadoBoliyapa) {
    // 1. Guardar el resultado en la base de datos
    const resultado = await this.appRepo.createResultado({
      sorteo_id: sorteoId,
      fecha_sorteo: new Date().toISOString(),
      bolillas: typeof bolillasGanadoras === 'string' ? bolillasGanadoras : JSON.stringify(bolillasGanadoras)
    });

    // 2. Actualizar el último resultado del sorteo
    await this.appRepo.updateSorteoUltimoResultado(sorteoId, resultado.bolillas);

    // 3. Obtener todos los tickets de ese sorteo para evaluarlos
    const tickets = await this.appRepo.getTicketsBySorteo(sorteoId);
    const bolillasArray = Array.isArray(bolillasGanadoras) 
      ? bolillasGanadoras.map(Number) 
      : bolillasGanadoras.split('-').map(Number);

    // 4. Evaluar cada ticket (lógica simplificada)
    for (const ticket of tickets) {
      const jugadas = JSON.parse(ticket.jugadas_json || '[]');
      let maxAciertos = 0;

      for (const jugada of jugadas) {
        if (!jugada.numeros) continue;
        const aciertos = jugada.numeros.filter(n => bolillasArray.includes(Number(n))).length;
        if (aciertos > maxAciertos) maxAciertos = aciertos;
      }

      // Si tuvo aciertos, calculamos premio (esto depende de tu tabla_premios)
      let premioGanado = 0;
      if (maxAciertos > 0) {
        const premiosConfig = await this.appRepo.getTablaPremios(sorteoId);
        const premioAplicable = premiosConfig.find(p => p.aciertos === maxAciertos);
        if (premioAplicable) {
          premioGanado = premioAplicable.monto; // O multiplicar por el precio, según tu lógica
        }
      }

      // Actualizar el ticket en la base de datos
      if (maxAciertos > 0 || premioGanado > 0) {
        await this.appRepo.updateTicketResultado(ticket.id, maxAciertos, premioGanado, 'PAGADO');
        
        // Si el ticket tiene usuario y ganó premio, abonarle a su billetera
        if (premioGanado > 0 && ticket.usuario_id) {
          await this.walletService.recargar(ticket.usuario_id, premioGanado, 'PREMIO');
        }
      } else {
        await this.appRepo.updateTicketResultado(ticket.id, maxAciertos, 0, 'PAGADO');
      }
    }

    return { 
      message: 'Resultado procesado y tickets evaluados', 
      resultado 
    };
  }
}