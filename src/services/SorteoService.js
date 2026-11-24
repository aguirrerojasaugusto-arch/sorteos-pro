import fs from 'fs/promises';
import crypto from 'crypto';

export class SorteoService {
  constructor({ appRepo, walletService }) {
    this.appRepo = appRepo;
    this.walletService = walletService;
  }

  async generarCodigoUnico() {
    const maxReintentos = 100;
    for (let i = 0; i < maxReintentos; i++) {
      const num = Math.floor(10000 + Math.random() * 90000);
      const existe = await this.appRepo.existeCodigoTicket(String(num));
      if (!existe) return String(num);
    }
    const ultimo = await this.appRepo.getUltimoCodigoNumeric();
    return String((Number(ultimo) || 99999) + 1).padStart(5, '0').slice(-5);
  }

  async comprar(data) {
    const sorteo = await this.appRepo.getSorteoById(data.sorteo_id);
    if (!sorteo) throw new Error('Sorteo no encontrado');

    const jugadas = data.jugadas || [];
    if (jugadas.length === 0) throw new Error('No se seleccionaron jugadas');

    const cantidadSorteos = Number(data.cantidad_sorteos) || 1;
    const totalTickets = jugadas.length * cantidadSorteos;
    const total_pagado = Number(data.total_pagado) || (sorteo.precio_jugada * totalTickets);

    if (data.usuario_id) {
      await this.walletService.pagar(data.usuario_id, total_pagado, `Compra de ${totalTickets} tickets`);
    }

    const precioPorTicket = Number((total_pagado / totalTickets).toFixed(2));
    const ticketsCreados = [];

    // ✅ VALIDACIÓN DE DUPLICADOS POR HASH SHA-256
    let comprobanteHash = null;
    if (data.comprobante_file && data.comprobante_file.path) {
      try {
        const fileBuffer = await fs.readFile(data.comprobante_file.path);
        comprobanteHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        const yaExiste = await this.appRepo.existeComprobanteHash(comprobanteHash);
        if (yaExiste) {
          // Limpieza: borramos el archivo duplicado del disco para no llenar el servidor
          await fs.unlink(data.comprobante_file.path).catch(() => {});
          throw new Error('⚠️ Este comprobante ya fue utilizado anteriormente. Si crees que es un error, contacta a soporte.');
        }
      } catch (err) {
        if (err.message.includes('ya fue utilizado')) throw err;
        console.error('Error al procesar comprobante:', err);
      }
    }

    for (const jugada of jugadas) {
      for (let i = 0; i < cantidadSorteos; i++) {
        const codigoTicket = await this.generarCodigoUnico();

        const ticketData = {
          codigo_ticket: codigoTicket,
          sorteo_id: data.sorteo_id,
          usuario_id: data.usuario_id || null,
          cliente_nombre: data.cliente_nombre,
          cliente_dni: String(data.cliente_dni || '').trim(),
          telefono: data.telefono || null,
          departamento: data.departamento || null,
          jugadas_json: JSON.stringify([jugada]),
          si_o_si: data.si_o_si ? 1 : 0,
          boliyapa_numero: data.boliyapa_numero || null,
          cantidad_sorteos: 1,
          total_pagado: precioPorTicket,
          comprobante_url: data.comprobante_url || null,
          comprobante_hash: comprobanteHash // ✅ NUEVO
        };

        const ticketGuardado = await this.appRepo.createTicket(ticketData);
        ticketsCreados.push(ticketGuardado);
      }
    }

    return { tickets: ticketsCreados, total_pagado };
  }
}