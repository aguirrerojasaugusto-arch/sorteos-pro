import { state } from './sorteos-state.js';
import { formatearCodigo } from './sorteos-modal.js';

export function detenerPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
  state.compraActualId = null;
}

export function iniciarPolling(ticketId, montoExacto) {
  state.compraActualId = ticketId;

  document.getElementById('form-compra').classList.add('hidden');
  document.getElementById('resultado-compra').classList.add('hidden');
  document.getElementById('validacion-pago').classList.remove('hidden');

  document.getElementById('monto-exacto-display').textContent = montoExacto.toFixed(2);
  const config = state.config || {};
  document.getElementById('yape-numero-validacion').textContent = config.contacto_telefono || '993 897 647';
  document.getElementById('yape-nombre-validacion').textContent = config.brand_name || 'Artesanía Mariposita';

  let intentos = 0;
  const maxIntentos = 300;

  state.pollingTimer = setInterval(async () => {
    intentos++;
    try {
      const res = await fetch(`/api/public/compra/${ticketId}/estado`);
      const data = await res.json();
      const estadoDiv = document.getElementById('estado-validacion');

      if (data.estado === 'validado') {
        detenerPolling();
        mostrarExitoCompra(data.ticket);
      } else if (data.estado === 'expirado') {
        detenerPolling();
        if (estadoDiv) {
          estadoDiv.innerHTML = '<span style="color: #d31145;">⏰ Tiempo agotado. El pago no fue recibido.</span>';
        }
        setTimeout(() => {
          alert('El tiempo para validar el pago ha expirado. Intenta de nuevo.');
          document.getElementById('modal-compra').classList.add('hidden');
        }, 2000);
      } else if (data.estado === 'pendiente') {
        if (data.segundos_restantes !== undefined) {
          const mins = Math.floor(data.segundos_restantes / 60);
          const secs = data.segundos_restantes % 60;
          document.getElementById('tiempo-restante').textContent =
            `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        if (estadoDiv) {
          estadoDiv.textContent = `🔍 Buscando confirmación... (intento ${intentos})`;
        }
      }
    } catch (error) {
      console.error('Error en polling:', error);
    }

    if (intentos >= maxIntentos) {
      detenerPolling();
      alert('Tiempo agotado. Intenta de nuevo.');
      document.getElementById('modal-compra').classList.add('hidden');
    }
  }, 3000);
}

function mostrarExitoCompra(ticket) {
  document.getElementById('validacion-pago').classList.add('hidden');
  const resultDiv = document.getElementById('resultado-compra');
  resultDiv.classList.remove('hidden');

  const sorteo = state.sorteoSeleccionado;
  const fechaSorteo = sorteo.fecha_sorteo 
    ? new Date(sorteo.fecha_sorteo).toLocaleDateString('es-PE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        timeZone: 'America/Lima'
      })
    : 'Por definir';

  let html = `
    <div class="ticket-resumen-compacto">
      <div class="ticket-header">
        <h3>🎟️ Resumen de tus Tickets</h3>
      </div>
      
      <div class="ticket-info-row">
        <div class="ticket-info-item">
          <span class="ticket-label">👤 NOMBRE COMPLETO</span>
          <span class="ticket-value">${ticket.cliente_nombre || 'N/A'}</span>
        </div>
        <div class="ticket-info-item total-box">
          <span class="ticket-label">🎟️ TOTAL COMPRADOS</span>
          <span class="ticket-value total-number">1</span>
        </div>
      </div>

      <div class="ticket-numeros-box">
        <div class="ticket-numeros-label">🎯 TU NÚMERO:</div>
        <div class="ticket-numeros">#${formatearCodigo(ticket.codigo_ticket)}</div>
      </div>

      <div class="ticket-detalles">
        <div class="ticket-detalle-item">
          <span class="detalle-label">Sorteo:</span>
          <span class="detalle-value">${sorteo.nombre}</span>
        </div>
        <div class="ticket-detalle-item">
          <span class="detalle-label">Fecha del Sorteo:</span>
          <span class="detalle-value">${fechaSorteo}</span>
        </div>
        <div class="ticket-detalle-item">
          <span class="detalle-label">Total Pagado:</span>
          <span class="detalle-value total-pagado">S/ ${ticket.total_pagado.toFixed(2)}</span>
        </div>
      </div>

      <button onclick="document.getElementById('modal-compra').classList.add('hidden'); location.reload();" class="btn-aceptar-ticket">
        Aceptar
      </button>
    </div>
  `;

  resultDiv.innerHTML = html;
}