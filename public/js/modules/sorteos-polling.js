import { state } from './sorteos-state.js';
import { formatearCodigo } from './sorteos-modal.js';

export function detenerPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
  state.compraActualId = null;
}

// Helper: asegura que exista un <p id="val-estado"> dentro de validacion-pago
// (no rompe el HTML desplegado; lo añade en runtime si falta)
function ensureEstadoEl() {
  let el = document.getElementById('val-estado');
  if (el) return el;
  const cont = document.getElementById('validacion-pago');
  if (!cont) return null;
  el = document.createElement('p');
  el.id = 'val-estado';
  el.style.fontWeight = 'bold';
  el.style.color = 'var(--tinka-green)';
  cont.appendChild(el);
  return el;
}

// Calcular segundos restantes desde expira_en (UTC)
function segundosRestantes(expiraEn) {
  if (!expiraEn) return null;
  const t = new Date(String(expiraEn).replace(' ', 'T') + 'Z').getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((t - Date.now()) / 1000));
}

export function iniciarPolling(token, montoTotal) {
  state.compraActualId = token;
  document.getElementById('form-compra').classList.add('hidden');
  document.getElementById('resultado-compra').classList.add('hidden');
  document.getElementById('validacion-pago').classList.remove('hidden');

  // Mostrar monto exacto a yapear (con centavos)
  const elTotal = document.getElementById('val-total');
  if (elTotal) elTotal.textContent = `S/ ${Number(montoTotal).toFixed(2)}`;

  const estadoEl = ensureEstadoEl();
  if (estadoEl) estadoEl.textContent = '🔍 Esperando confirmación de pago...';

  let intentos = 0;
  const maxIntentos = 300; // 300 * 3s = 15 min

  state.pollingTimer = setInterval(async () => {
    intentos++;
    try {
      const res = await fetch(`/api/public/pago-pendiente/${token}/status`);
      if (!res.ok) return; // silencio ante 404/500 transitorios
      const data = await res.json();
      const ctx = state.compraContexto || {};

      if (data.estado === 'validado') {
        detenerPolling();
        mostrarExitoCompra(data.tickets || [], ctx);
        return;
      }

      if (data.estado === 'expirado' || data.estado === 'rechazado') {
        detenerPolling();
        if (estadoEl) estadoEl.innerHTML =
          '<span style="color:#d31145;">⏰ Tiempo agotado. El pago no fue recibido.</span>';
        setTimeout(() => {
          alert('El tiempo para validar el pago ha expirado. Intenta de nuevo.');
          document.getElementById('modal-compra').classList.add('hidden');
        }, 1500);
        return;
      }

      // pendiente / comprobante_subido → actualizar contador y estado
      const secs = segundosRestantes(data.expira_en);
      const elT = document.getElementById('val-tiempo');
      if (elT && secs !== null) {
        const m = Math.floor(secs / 60), s = secs % 60;
        elT.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }
      if (estadoEl) {
        estadoEl.textContent =
          data.tiene_comprobante
            ? `🔍 Comprobante recibido. Buscando el Yape de S/ ${Number(montoTotal).toFixed(2)}... (intento ${intentos})`
            : `🔍 Esperando el Yape de S/ ${Number(montoTotal).toFixed(2)}... (intento ${intentos})`;
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

function mostrarExitoCompra(tickets, ctx) {
  document.getElementById('validacion-pago').classList.add('hidden');
  const resultDiv = document.getElementById('resultado-compra');
  resultDiv.classList.remove('hidden');

  const sorteo = state.sorteoSeleccionado || {};
  const monto = ctx.monto_total ? Number(ctx.monto_total).toFixed(2) : '0.00';

  // Agrupar códigos
  const codigos = tickets.map(t => `#${formatearCodigo(t.codigo_ticket)}`).join('  ·  ');
  const total = tickets.length || ctx.cantidad_tickets || 1;

  let html = `<div class="ticket-resumen-compacto">`;
  html += `<div class="ticket-header"><h3>🎟️ ¡Pago Validado!</h3></div>`;
  html += `<div class="ticket-info-row">`;
  html += `<div class="ticket-info-item"><span class="ticket-label">👤 NOMBRE COMPLETO</span>`;
  html += `<span class="ticket-value">${ctx.nombres || ''} ${ctx.apellidos || ''}</span></div>`;
  html += `<div class="ticket-info-item total-box"><span class="ticket-label">🎟️ TOTAL COMPRADOS</span>`;
  html += `<span class="ticket-value total-number">${total}</span></div>`;
  html += `</div>`;
  html += `<div class="ticket-numeros-box">`;
  html += `<div class="ticket-numeros-label">🎯 ${sorteo.nombre || 'Sorteo'} — ${ctx.dni || ''}</div>`;
  html += `<div class="ticket-numeros">${codigos || '—'}</div>`;
  html += `</div>`;
  html += `<div class="ticket-detalles">`;
  html += `<div class="ticket-detalle-item"><span class="detalle-label">Total Pagado:</span>`;
  html += `<span class="detalle-value total-pagado">S/ ${monto}</span></div>`;
  html += `<div class="ticket-detalle-item"><span class="detalle-label">DNI:</span>`;
  html += `<span class="detalle-value">${ctx.dni || ''}</span></div>`;
  html += `</div>`;
  html += `<button onclick="document.getElementById('modal-compra').classList.add('hidden'); document.getElementById('form-compra').classList.remove('hidden'); document.getElementById('resultado-compra').classList.add('hidden'); document.getElementById('form-compra').reset();" class="btn-aceptar-ticket">Aceptar</button>`;
  html += `</div>`;
  resultDiv.innerHTML = html;
}