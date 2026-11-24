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

  // ✅ Precio SIEMPRE calculado en servidor. Ignora `data.total_pagado`.
  //    - Si hay comboPricingService: usa descuentos por combo del sorteo.
  //    - Si no: precio_jugada × cantidad_jugadas × cantidad_sorteos.
  calcularPrecioServidor(sorteo, cantidadJugadas, cantidadSorteos) {
    if (this.comboPricingService && typeof this.comboPricingService.calcular === 'function') {
      const v = Number(this.comboPricingService.calcular(sorteo, cantidadJugadas, cantidadSorteos));
      if (Number.isFinite(v) && v > 0) return Number(v.toFixed(2));
    }
    return Number((Number(sorteo.precio_jugada) * cantidadJugadas * cantidadSorteos).toFixed(2));
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
      // Modo aleatorio: cada jugada es un ticket independiente.
      // No se exige zona única entre jugadas (todas pueden ser 'A').
      if (jugadas.length > 100) throw new Error('Cantidad de tickets inválida (1-100)');
      for (const j of jugadas) validator.validarJugadaIndividual(j);
    } else {
      // Modo boleto: hasta 4 zonas (A,B,C,D) en el mismo boleto.
      validator.validarJugadas(jugadas);
    }
    validator.validarBoliyapa(data.boliyapa_numero != null ? Number(data.boliyapa_numero) : null);
    if (data.cliente_dni && String(data.cliente_dni).trim() !== '') {
      validator.validarTitular(data.cliente_nombre, data.cliente_dni);
    }

    const totalTickets = jugadas.length * cantidadSorteos;
    if (totalTickets < 1) throw new Error('Total de tickets inválido');

    // ✅ Precio server-side.
    const total_pagado = this.calcularPrecioServidor(sorteo, jugadas.length, cantidadSorteos);
    if (!Number.isFinite(total_pagado) || total_pagado <= 0) {
      throw new Error('No se pudo calcular el monto a pagar');
    }

    // Hash del comprobante (lectura, fuera de la tx)
    let comprobanteHash = null;
    if (data.comprobante_file && data.comprobante_file.path) {
      try {
        const buf = await fs.readFile(data.comprobante_file.path);
        comprobanteHash = crypto.createHash('sha256').update(buf).digest('hex');
      } catch (err) {
        console.error('Error al leer comprobante:', err);
        throw new Error('No se pudo leer el comprobante adjunto');
      }
    }

    // ========== 2) Transacción atómica ==========
    const tx = await this.db.transaction('write');
    try {
      if (data.usuario_id) {
        await this.walletService.pagar(
          data.usuario_id, total_pagado,
          `Compra de ${totalTickets} ticket(s)`, tx
        );
      }

      // INSERT comprobante — el UNIQUE acá cierra la race de duplicados.
      if (comprobanteHash) {
        try {
          await tx.execute({
            sql: `INSERT INTO comprobantes (comprobante_hash, usuario_id, cliente_dni, monto_total)
                  VALUES (?, ?, ?, ?)`,
            args: [
              comprobanteHash,
              data.usuario_id || null,
              String(data.cliente_dni || '').trim() || null,
              total_pagado
            ]
          });
        } catch (e) {
          if (esTablaInexistente(e)) {
            console.warn('⚠️ Tabla `comprobantes` no existe. Corre las migraciones. Continuando sin bloqueo de duplicados.');
          } else if (esViolacionUnica(e, 'comprobante_hash') || esViolacionUnica(e, 'idx_comprobantes')) {
            throw new Error('⚠️ Este comprobante ya fue utilizado anteriormente. Si crees que es un error, contacta a soporte.');
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

      // Si la tx se abortó, el archivo subido es basura → borrarlo.
      if (comprobanteHash && data.comprobante_file?.path) {
        await fs.unlink(data.comprobante_file.path).catch(() => {});
      }
      throw e;
    }
  }
}