import fs from 'fs/promises';
import crypto from 'crypto';
import TicketValidator from './TicketValidator.js';

const MAX_REINTENTOS_CODIGO = 5;

function esViolacionUnica(err, columna = null) {
  const msg = String(err?.message || err || '');
  if (!/UNIQUE constraint failed/i.test(msg)) return false;
  if (!columna) return true;
  return msg.includes(columna);
}

function esTablaInexistente(err) {
  return /no such table/i.test(String(err?.message || err || ''));
}

export class SorteoService {
  constructor({ appRepo, walletService, db, comboPricingService = null }) {
    if (!db) throw new Error('SorteoService requiere `db` en el constructor');
    this.appRepo = appRepo;
    this.walletService = walletService;
    this.db = db;
    this.comboPricingService = comboPricingService;
  }

  calcularPrecioServidor(sorteo, cantidadJugadas, cantidadSorteos) {
    if (this.comboPricingService && typeof this.comboPricingService.calcular === 'function') {
      const v = Number(this.comboPricingService.calcular(sorteo, cantidadJugadas, cantidadSorteos));
      if (Number.isFinite(v) && v > 0) return Number(v.toFixed(2));
    }
    return Number((Number(sorteo.precio_jugada) * cantidadJugadas * cantidadSorteos).toFixed(2));
  }

  // ⚠️ DEPRECATED: Se mantiene por compatibilidad pero ya NO se usa en el flujo nuevo
  generarCentavosAleatorios() {
    return Math.floor(Math.random() * 99) + 1; // 1 a 99 centavos
  }

  // ⚠️ DEPRECATED: Se mantiene por compatibilidad pero ya NO se usa en el flujo nuevo
  calcularMontoYapeExacto(totalBase) {
    const centavos = this.generarCentavosAleatorios();
    const montoExacto = Number((totalBase + centavos / 100).toFixed(2));
    return { montoExacto, centavos };
  }

  async generarCodigoUnico(exec = null) {
    for (let i = 0; i < 100; i++) {
      const num = Math.floor(10000 + Math.random() * 90000);
      const existe = await this.appRepo.existeCodigoTicket(String(num), exec);
      if (!existe) return String(num);
    }
    const ultimo = await this.appRepo.getUltimoCodigoNumeric(exec);
    return String((Number(ultimo) || 99999) + 1).padStart(5, '0').slice(-5);
  }

  async insertarTicketConRetry(tx, template) {
    let codigo = await this.generarCodigoUnico(tx);
    let ultimoError = null;
    for (let intento = 0; intento < MAX_REINTENTOS_CODIGO; intento++) {
      try {
        return await this.appRepo.createTicket({ ...template, codigo_ticket: codigo }, tx);
      } catch (e) {
        ultimoError = e;
        if (esViolacionUnica(e, 'codigo_ticket') || esViolacionUnica(e, 'idx_tickets_codigo')) {
          codigo = String(Math.floor(10000 + Math.random() * 90000));
          continue;
        }
        throw e;
      }
    }
    throw new Error(`No se pudo generar un código único tras ${MAX_REINTENTOS_CODIGO} intentos: ${ultimoError?.message}`);
  }

  async comprar(data) {
    // ========== 1) Validaciones (solo lecturas) ==========
    const sorteo = await this.appRepo.getSorteoById(data.sorteo_id);
    if (!sorteo) throw new Error('Sorteo no encontrado');
    if (sorteo.activo !== undefined && Number(sorteo.activo) !== 1) {
      throw new Error('Este sorteo no está activo');
    }
    const jugadas = data.jugadas || [];
    if (!Array.isArray(jugadas) || jugadas.length === 0) {
      throw new Error('No se seleccionaron jugadas');
    }
    const modoAleatorio = data.modo_aleatorio === true;
    const cantidadSorteos = Number(data.cantidad_sorteos) || 1;
    if (cantidadSorteos < 1 || cantidadSorteos > 100) {
      throw new Error('Cantidad de sorteos inválida (1-100)');
    }
    const validator = new TicketValidator(sorteo);
    if (modoAleatorio) {
      if (jugadas.length > 100) throw new Error('Cantidad de tickets inválida (1-100)');
      for (const j of jugadas) validator.validarJugadaIndividual(j);
    } else {
      validator.validarJugadas(jugadas);
    }
    validator.validarBoliyapa(data.boliyapa_numero != null ? Number(data.boliyapa_numero) : null);
    if (data.cliente_dni && String(data.cliente_dni).trim() !== '') {
      validator.validarTitular(data.cliente_nombre, data.cliente_dni);
    }
    const totalTickets = jugadas.length * cantidadSorteos;
    if (totalTickets < 1) throw new Error('Total de tickets inválido');

    const total_pagado = this.calcularPrecioServidor(sorteo, jugadas.length, cantidadSorteos);
    if (!Number.isFinite(total_pagado) || total_pagado <= 0) {
      throw new Error('No se pudo calcular el monto a pagar');
    }

    // ==========================================
    // Hash del comprobante
    // ==========================================
    let comprobanteHash = null;
    if (data.comprobante_file && data.comprobante_file.path) {
      const ruta = data.comprobante_file.path;
      if (/^https?:\/\//i.test(ruta)) {
        comprobanteHash = crypto.createHash('sha256').update(String(ruta)).digest('hex');
      } else {
        try {
          const buf = await fs.readFile(ruta);
          comprobanteHash = crypto.createHash('sha256').update(buf).digest('hex');
        } catch (err) {
          console.error('Error al leer comprobante:', err);
          throw new Error('No se pudo leer el comprobante adjunto');
        }
      }
    }

    // ========== 2) Transacción atómica ==========
    const tx = await this.db.transaction('write');
    try {
      if (data.usuario_id) {
        await this.walletService.pagar(data.usuario_id, total_pagado, `Compra de ${totalTickets} ticket(s)`, tx);
      }
      if (comprobanteHash) {
        try {
          await tx.execute({
            sql: `INSERT INTO comprobantes (comprobante_hash, usuario_id, cliente_dni, monto_total)
                  VALUES (?, ?, ?, ?)`,
            args: [comprobanteHash, data.usuario_id || null, String(data.cliente_dni || '').trim() || null, total_pagado]
          });
        } catch (e) {
          if (esTablaInexistente(e)) {
            console.warn('⚠️ Tabla `comprobantes` no existe. Continuando sin bloqueo de duplicados.');
          } else if (esViolacionUnica(e, 'comprobante_hash') || esViolacionUnica(e, 'idx_comprobantes')) {
            throw new Error('⚠️ Este comprobante ya fue utilizado anteriormente.');
          } else {
            throw e;
          }
        }
      }
      const precioPorTicket = Number((total_pagado / totalTickets).toFixed(2));
      const ticketsCreados = [];
      for (const jugada of jugadas) {
        for (let i = 0; i < cantidadSorteos; i++) {
          const template = {
            sorteo_id: data.sorteo_id,
            usuario_id: data.usuario_id || null,
            cliente_nombre: data.cliente_nombre,
            cliente_dni: String(data.cliente_dni || '').trim(),
            telefono: data.telefono || null,
            departamento: data.departamento || null,
            jugadas_json: JSON.stringify([jugada]),
            si_o_si: data.si_o_si ? 1 : 0,
            boliyapa_numero: data.boliyapa_numero != null ? Number(data.boliyapa_numero) : null,
            cantidad_sorteos: 1,
            total_pagado: precioPorTicket,
            comprobante_url: data.comprobante_url || null,
            comprobante_hash: comprobanteHash
          };
          ticketsCreados.push(await this.insertarTicketConRetry(tx, template));
        }
      }
      await tx.commit();
      return { tickets: ticketsCreados, total_pagado };
    } catch (e) {
      await tx.rollback().catch(err => console.error('Error en rollback:', err));
      if (comprobanteHash && data.comprobante_file?.path && !/^https?:\/\//i.test(data.comprobante_file.path)) {
        await fs.unlink(data.comprobante_file.path).catch(() => {});
      }
      throw e;
    }
  }

  // ⚠️ DEPRECATED: Se mantiene por compatibilidad pero ya NO se usa en el flujo nuevo
  async comprarConYape(data) {
    const sorteo = await this.appRepo.getSorteoById(data.sorteo_id);
    if (!sorteo) throw new Error('Sorteo no encontrado');
    if (sorteo.activo !== undefined && Number(sorteo.activo) !== 1) {
      throw new Error('Este sorteo no está activo');
    }
    const jugadas = data.jugadas || [];
    if (!Array.isArray(jugadas) || jugadas.length === 0) {
      throw new Error('No se seleccionaron jugadas');
    }
    const cantidadSorteos = Number(data.cantidad_sorteos) || 1;
    if (cantidadSorteos < 1 || cantidadSorteos > 100) {
      throw new Error('Cantidad de sorteos inválida (1-100)');
    }
    const validator = new TicketValidator(sorteo);
    if (jugadas.length > 100) throw new Error('Cantidad de tickets inválida (1-100)');
    for (const j of jugadas) validator.validarJugadaIndividual(j);
    if (data.cliente_dni && String(data.cliente_dni).trim() !== '') {
      validator.validarTitular(data.cliente_nombre, data.cliente_dni);
    }
    const totalTickets = jugadas.length * cantidadSorteos;
    if (totalTickets < 1) throw new Error('Total de tickets inválido');

    const totalBase = this.calcularPrecioServidor(sorteo, jugadas.length, cantidadSorteos);
    if (!Number.isFinite(totalBase) || totalBase <= 0) {
      throw new Error('No se pudo calcular el monto a pagar');
    }

    const { montoExacto: monto_yape_exacto, centavos } = this.calcularMontoYapeExacto(totalBase);

    const tx = await this.db.transaction('write');
    try {
      const precioPorTicket = Number((totalBase / totalTickets).toFixed(2));
      const ticketsCreados = [];
      for (const jugada of jugadas) {
        for (let i = 0; i < cantidadSorteos; i++) {
          const template = {
            sorteo_id: data.sorteo_id,
            usuario_id: data.usuario_id || null,
            cliente_nombre: data.cliente_nombre,
            cliente_dni: String(data.cliente_dni || '').trim(),
            telefono: data.telefono || null,
            departamento: data.departamento || null,
            jugadas_json: JSON.stringify([jugada]),
            si_o_si: data.si_o_si ? 1 : 0,
            boliyapa_numero: data.boliyapa_numero != null ? Number(data.boliyapa_numero) : null,
            cantidad_sorteos: 1,
            total_pagado: precioPorTicket,
            comprobante_url: null,
            comprobante_hash: null,
            monto_yape_exacto: monto_yape_exacto,
            estado_pago: 'pendiente',
            captura_yape_url: null,
            sms_codigo_operacion: null,
            webhook_recibido_at: null,
          };
          ticketsCreados.push(await this.insertarTicketConRetry(tx, template));
        }
      }
      await tx.commit();
      return { 
        tickets: ticketsCreados, 
        total_base: totalBase,
        monto_yape_exacto: monto_yape_exacto,
        centavos_agregados: centavos
      };
    } catch (e) {
      await tx.rollback().catch(err => console.error('Error en rollback:', err));
      throw e;
    }
  }

  // ⚠️ DEPRECATED: Se mantiene por compatibilidad pero ya NO se usa en el flujo nuevo
  async validarPagoYape(montoRecibido, smsBody, codigoOperacion) {
    const ticket = await this.appRepo.getTicketPendienteByMontoYape(montoRecibido);
    if (!ticket) {
      await this.appRepo.logYapeWebhook(montoRecibido, smsBody, null, 'no_encontrado');
      return {
        success: false,
        message: `No hay ticket pendiente con monto S/ ${montoRecibido.toFixed(2)}`
      };
    }
    await this.appRepo.actualizarEstadoPago(ticket.id, 'validado', {
      sms_codigo_operacion: codigoOperacion,
      webhook_recibido_at: new Date().toISOString()
    });
    await this.appRepo.logYapeWebhook(montoRecibido, smsBody, ticket.id, 'validado');
    return {
      success: true,
      ticket: ticket,
      message: `Pago validado. Ticket #${ticket.codigo_ticket}`
    };
  }

  // ✅ NUEVO: Validar un pago pendiente (usado por webhook SMS y aprobación manual)
  async validarPagoPendiente(row, smsTexto, codigoOperacion) {
    let jugadas = [];
    try { jugadas = JSON.parse(row.jugadas_json || '[]'); } catch { jugadas = []; }
    if (!Array.isArray(jugadas) || jugadas.length === 0) {
      throw new Error('El pago pendiente no tiene jugadas guardadas');
    }

    const resultado = await this.comprar({
      sorteo_id: row.sorteo_id,
      cliente_nombre: row.cliente_nombre,
      cliente_dni: row.cliente_dni,
      telefono: row.cliente_telefono,
      departamento: row.cliente_departamento,
      jugadas,
      cantidad_sorteos: Number(row.cantidad_sorteos) || 1,
      si_o_si: !!row.si_o_si,
      boliyapa_numero: row.boliyapa_numero || null,
      comprobante_url: row.comprobante_url || row.captura_url || null,
      comprobante_hash: null,
      modo_aleatorio: true,
      total_pagado: row.monto_unico
    });

    const ticketsGenerados = Array.isArray(resultado?.tickets) ? resultado.tickets : [];
    await this.db.execute({
      sql: `UPDATE pagos_pendientes
            SET estado='validado',
                validado_en=datetime('now'),
                sms_texto=?,
                sms_monto=?,
                sms_codigo_operacion=?,
                tickets_generados_json=?
            WHERE id=?`,
      args: [smsTexto, row.monto_unico, codigoOperacion, JSON.stringify(ticketsGenerados), row.id]
    });

    console.log(`✅ Pago #${row.id} validado → DNI ${row.cliente_dni} → S/ ${row.monto_unico} → ${ticketsGenerados.length} ticket(s)`);
    return { tickets: ticketsGenerados, pago_id: row.id };
  }
}