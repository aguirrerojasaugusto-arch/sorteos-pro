import { state } from './sorteos-state.js';
import { mostrarErrorComprobante, formatearCodigo } from './sorteos-modal.js';
import { inicializarValidadorComprobante, validarComprobanteYapePlin } from './sorteos-comprobante.js';
import { iniciarPolling } from './sorteos-polling.js';

export function inicializarCompra() {
  inicializarValidadorComprobante();
}

export async function comprarTickets(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = '⏳ Procesando...';
  btn.disabled = true;

  const dni = document.getElementById('inp-dni').value;
  if (dni.length !== 8) {
    alert('Por favor, ingrese un DNI válido de 8 dígitos.');
    btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
  }

  const nombres = document.getElementById('inp-nombres').value;
  const apellidos = document.getElementById('inp-apellidos').value;
  const departamento = document.getElementById('inp-departamento').value;
  const sorteoIdVal = document.getElementById('compra-sorteo-id').value;

  const formData = new FormData();
  formData.append('sorteo_id', sorteoIdVal);
  formData.append('nombres', nombres);
  formData.append('apellidos', apellidos);
  formData.append('dni', dni);
  formData.append('departamento', departamento);
  formData.append('celular', document.getElementById('inp-celular').value);
  formData.append('cantidad_tickets', document.getElementById('inp-cantidad').value);

  const comprobanteInput = document.getElementById('inp-comprobante');
  if (comprobanteInput.files.length > 0) {
    const file = comprobanteInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      mostrarErrorComprobante('❌ El comprobante supera el máximo de 5MB.');
      btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
    }
    
    const validacion = await validarComprobanteYapePlin(file);
    if (validacion.error) {
      mostrarErrorComprobante('❌ No se pudo leer la imagen. Sube un archivo JPG o PNG válido.');
      btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
    }
    if (!validacion.esValido) {
      mostrarErrorComprobante('❌ Este no es un comprobante válido de Yape o Plin.');
      btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
    }
    formData.append('comprobante', file);
  } else {
    mostrarErrorComprobante('❌ Debes subir un comprobante de pago.');
    btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
  }

  try {
    const res = await fetch('/api/public/comprar-aleatorio', { method: 'POST', body: formData });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      mostrarErrorComprobante('❌ ' + (err.error || 'Error en la compra.'));
      return;
    }

    const data = await res.json();
    if (!data.tickets || data.tickets.length === 0) {
      mostrarErrorComprobante('❌ No se generaron tickets. Intenta de nuevo.');
      return;
    }

    // ✅ MOSTRAR RESUMEN COMPACTO
    document.getElementById('form-compra').classList.add('hidden');
    document.getElementById('validacion-pago').classList.add('hidden');
    const resultDiv = document.getElementById('resultado-compra');
    resultDiv.classList.remove('hidden');

    // ✅ AGRUPAR tickets por sorteo_id con fallback seguro
    const sorteoActual = state.sorteoSeleccionado || {};
    const ticketsPorSorteo = {};
    
    data.tickets.forEach(t => {
      const sid = t.sorteo_id ?? sorteoActual.id ?? 'default';
      if (!ticketsPorSorteo[sid]) {
        ticketsPorSorteo[sid] = {
          nombre: t.nombre_sorteo || sorteoActual.nombre || 'Sorteo',
          fechaSorteo: t.fecha_sorteo || sorteoActual.fecha_sorteo || null,
          tickets: []
        };
      }
      ticketsPorSorteo[sid].tickets.push(t.codigo_ticket);
    });

    // ✅ Formatear fecha del sorteo de forma SEGURA (compatible iOS/Safari)
    const formatearFechaSorteo = (fechaStr) => {
      if (!fechaStr) return 'Por definir';
      const normalizada = String(fechaStr).replace(' ', 'T');
      const d = new Date(normalizada);
      if (isNaN(d.getTime())) return 'Por definir';
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // ✅ Generar HTML compacto tipo "ticket digital"
    let html = `<div class="ticket-resumen-compacto">`;
    html += `<div class="ticket-header"><h3>🎟️ Resumen de tus Tickets</h3></div>`;

    // Fila cliente + total
    html += `<div class="ticket-info-row">`;
    html += `<div class="ticket-info-item">`;
    html += `<span class="ticket-label">👤 NOMBRE COMPLETO</span>`;
    html += `<span class="ticket-value">${nombres} ${apellidos}</span>`;
    html += `</div>`;
    html += `<div class="ticket-info-item total-box">`;
    html += `<span class="ticket-label">🎟️ TOTAL COMPRADOS</span>`;
    html += `<span class="ticket-value total-number">${data.tickets.length}</span>`;
    html += `</div>`;
    html += `</div>`;

    // ✅ Un bloque POR SORTEO con códigos reales agrupados
    Object.values(ticketsPorSorteo).forEach(info => {
      const codigos = info.tickets.map(c => `#${formatearCodigo(c)}`).join('  ·  ');
      html += `<div class="ticket-numeros-box">`;
      html += `<div class="ticket-numeros-label">🎯 ${info.nombre} — ${formatearFechaSorteo(info.fechaSorteo)}</div>`;
      html += `<div class="ticket-numeros">${codigos}</div>`;
      html += `</div>`;
    });

    // Detalles finales
    html += `<div class="ticket-detalles">`;
    html += `<div class="ticket-detalle-item">`;
    html += `<span class="detalle-label">Total Pagado:</span>`;
    html += `<span class="detalle-value total-pagado">S/ ${Number(data.total_pagado || 0).toFixed(2)}</span>`;
    html += `</div>`;
    if (data.centavos_agregados !== undefined) {
      html += `<div class="ticket-detalle-item">`;
      html += `<span class="detalle-label">Centavos de validación:</span>`;
      html += `<span class="detalle-value">+ S/ ${Number(data.centavos_agregados).toFixed(2)}</span>`;
      html += `</div>`;
    }
    html += `<div class="ticket-detalle-item">`;
    html += `<span class="detalle-label">DNI:</span>`;
    html += `<span class="detalle-value">${dni}</span>`;
    html += `</div>`;
    html += `</div>`;

    // Botón Aceptar (cierra modal y limpia sin recargar toda la página)
    html += `<button onclick="document.getElementById('modal-compra').classList.add('hidden'); document.getElementById('form-compra').classList.remove('hidden'); document.getElementById('resultado-compra').classList.add('hidden'); document.getElementById('form-compra').reset();" class="btn-aceptar-ticket">Aceptar</button>`;
    html += `</div>`;

    resultDiv.innerHTML = html;

  } catch (error) {
    console.error('Error de conexión:', error);
    alert('Error de conexión con el servidor.');
  } finally {
    btn.textContent = 'Confirmar Compra';
    btn.disabled = false;
  }
}