import { state } from './sorteos-state.js';
import { formatearCodigo } from './sorteos-modal.js';

export function detenerPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
  state.compraActualId = null;
}

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

function segundosRestantes(expiraEn) {
  if (!expiraEn) return null;
  const t = new Date(String(expiraEn).replace(' ', 'T') + 'Z').getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((t - Date.now()) / 1000));
}

// ✅ NUEVO: Enviar código de 3 dígitos al servidor
async function enviarCodigo(token, codigo3d) {
  try {
    const res = await fetch(`/api/public/pago-pendiente/${token}/codigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_3d: String(codigo3d) })
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Error al enviar código' };
    }
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: 'Error de conexión' };
  }
}

// ✅ NUEVO: Subir captura para revisión manual
async function subirCaptura(token, file) {
  try {
    const fd = new FormData();
    fd.append('captura', file);
    const res = await fetch(`/api/public/pago-pendiente/${token}/captura`, {
      method: 'POST', body: fd
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Error al subir captura' };
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: 'Error de conexión' };
  }
}

export function iniciarPolling(token, montoTotal) {
  state.compraActualId = token;
  document.getElementById('form-compra').classList.add('hidden');
  document.getElementById('resultado-compra').classList.add('hidden');
  document.getElementById('validacion-pago').classList.remove('hidden');

  const elTotal = document.getElementById('val-total');
  if (elTotal) elTotal.textContent = `S/ ${Number(montoTotal).toFixed(2)}`;

  const estadoEl = ensureEstadoEl();
  if (estadoEl) estadoEl.textContent = '🔍 Esperando confirmación de pago...';

  // ✅ Renderizar campo de código 3 dígitos si no existe
  renderizarCampoCodigo(token, montoTotal);

  let intentos = 0;
  const maxIntentos = 300; // 300 * 3s = 15 min
  let maxIntentosCodigo = 3;

  state.pollingTimer = setInterval(async () => {
    intentos++;
    try {
      const res = await fetch(`/api/public/pago-pendiente/${token}/status`);
      if (!res.ok) return;
      const data = await res.json();
      const ctx = state.compraContexto || {};

      if (data.estado === 'validado') {
        detenerPolling();
        mostrarExitoCompra(data.tickets || [], ctx);
        return;
      }
      if (data.estado === 'expirado' || data.estado === 'rechazado') {
        detenerPolling();
        if (estadoEl) estadoEl.innerHTML = '<span style="color:#d31145;">⏰ Tiempo agotado. El pago no fue recibido.</span>';
        setTimeout(() => {
          alert('El tiempo para validar el pago ha expirado. Intenta de nuevo.');
          document.getElementById('modal-compra').classList.add('hidden');
        }, 1500);
        return;
      }
      if (data.estado === 'revision_manual') {
        if (estadoEl) estadoEl.innerHTML = '<span style="color:#f59e0b;">📋 Pago en revisión manual. Recibirás confirmación por WhatsApp.</span>';
        return;
      }

      // Actualizar máximo de intentos desde servidor
      if (data.max_intentos) maxIntentosCodigo = data.max_intentos;

      // Actualizar contador de intentos en UI
      const elIntentos = document.getElementById('val-intentos');
      if (elIntentos) elIntentos.textContent = `Intentos: ${data.intentos_codigo || 0}/${maxIntentosCodigo}`;

      // Mostrar botón de captura si ya alcanzó el máximo de intentos
      if (data.permite_captura) {
        renderizarBotonCaptura(token);
      }

      const secs = segundosRestantes(data.expira_en);
      const elT = document.getElementById('val-tiempo');
      if (elT && secs !== null) {
        const m = Math.floor(secs / 60), s = secs % 60;
        elT.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }

      if (estadoEl) {
        if (data.estado_verificacion === 'VERIFICANDO') {
          estadoEl.textContent = `🔄 Verificando código... esperando SMS de Yape (intento ${intentos})`;
        } else if (data.tiene_comprobante) {
          estadoEl.textContent = `🔍 Comprobante recibido. Buscando el Yape de S/ ${Number(montoTotal).toFixed(2)}... (intento ${intentos})`;
        } else {
          estadoEl.textContent = `🔍 Esperando el Yape de S/ ${Number(montoTotal).toFixed(2)}... (intento ${intentos})`;
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

// ✅ NUEVO: Renderiza el campo para ingresar los 3 dígitos
function renderizarCampoCodigo(token, montoTotal) {
  const cont = document.getElementById('validacion-pago');
  if (!cont) return;
  if (document.getElementById('box-codigo-3d')) return;

  const box = document.createElement('div');
  box.id = 'box-codigo-3d';
  box.style.cssText = 'margin: 20px 0; padding: 16px; background: #f0fdf4; border: 2px solid #10b981; border-radius: 10px;';
  box.innerHTML = `
    <h4 style="margin:0 0 10px 0; color:#065f46;">🔐 Ingresa el código de seguridad de tu constancia Yape</h4>
    <p style="margin:0 0 10px 0; font-size:14px; color:#374151;">
      Son los <strong>últimos 3 dígitos</strong> del código de operación que aparece en tu constancia.
    </p>
    <div style="display:flex; gap:10px; align-items:center;">
      <input type="text" id="inp-codigo-3d" maxlength="3" inputmode="numeric" pattern="[0-9]{3}"
             placeholder="000" style="flex:1; padding:12px; font-size:20px; text-align:center; letter-spacing:8px; border:2px solid #10b981; border-radius:8px;" />
      <button id="btn-enviar-codigo" style="padding:12px 20px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
        Validar
      </button>
    </div>
    <p id="val-intentos" style="margin:8px 0 0 0; font-size:12px; color:#6b7280;">Intentos: 0/3</p>
    <p id="val-msg-codigo" style="margin:8px 0 0 0; font-size:13px; font-weight:bold;"></p>
  `;
  cont.appendChild(box);

  const inp = document.getElementById('inp-codigo-3d');
  inp.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
  });

  const btn = document.getElementById('btn-enviar-codigo');
  btn.addEventListener('click', async () => {
    const codigo = inp.value.trim();
    if (codigo.length !== 3) {
      document.getElementById('val-msg-codigo').textContent = '⚠️ Ingresa exactamente 3 dígitos';
      document.getElementById('val-msg-codigo').style.color = '#dc2626';
      return;
    }
    btn.disabled = true;
    btn.textContent = '⏳ Validando...';
    const msgEl = document.getElementById('val-msg-codigo');
    msgEl.textContent = '';

    const result = await enviarCodigo(token, codigo);
    if (result.ok) {
      if (result.estado === 'validado') {
        msgEl.textContent = '✅ ¡Pago validado!';
        msgEl.style.color = '#059669';
        inp.disabled = true;
        btn.style.display = 'none';
      } else {
        msgEl.textContent = `🔄 ${result.message}`;
        msgEl.style.color = '#2563eb';
        inp.value = '';
        inp.focus();
      }
    } else {
      msgEl.textContent = `❌ ${result.error}`;
      msgEl.style.color = '#dc2626';
      inp.value = '';
      inp.focus();
    }
    btn.disabled = false;
    btn.textContent = 'Validar';
  });
}

// ✅ NUEVO: Renderiza botón para subir captura (plan de respaldo)
function renderizarBotonCaptura(token) {
  if (document.getElementById('box-captura-respaldo')) return;
  const cont = document.getElementById('validacion-pago');
  if (!cont) return;

  const box = document.createElement('div');
  box.id = 'box-captura-respaldo';
  box.style.cssText = 'margin: 20px 0; padding: 16px; background:#fef3c7; border: 2px solid #f59e0b; border-radius: 10px;';
  box.innerHTML = `
    <h4 style="margin:0 0 10px 0; color:#92400e;">📸 ¿No se validó automáticamente?</h4>
    <p style="margin:0 0 10px 0; font-size:14px; color:#78350f;">
      Sube la captura de tu constancia Yape para revisión manual.
    </p>
    <input type="file" id="inp-captura" accept="image/*" style="margin-bottom:10px;" />
    <button id="btn-subir-captura" style="padding:10px 20px; background:#f59e0b; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
      📤 Enviar captura
    </button>
    <p id="val-msg-captura" style="margin:8px 0 0 0; font-size:13px; font-weight:bold;"></p>
  `;
  cont.appendChild(box);

  document.getElementById('btn-subir-captura').addEventListener('click', async () => {
    const fileInput = document.getElementById('inp-captura');
    if (!fileInput.files.length) {
      document.getElementById('val-msg-captura').textContent = '⚠️ Selecciona una imagen';
      document.getElementById('val-msg-captura').style.color = '#dc2626';
      return;
    }
    const btn = document.getElementById('btn-subir-captura');
    btn.disabled = true;
    btn.textContent = '⏳ Enviando...';
    const msgEl = document.getElementById('val-msg-captura');

    const result = await subirCaptura(token, fileInput.files[0]);
    if (result.ok) {
      msgEl.textContent = '✅ Captura enviada. En revisión manual.';
      msgEl.style.color = '#059669';
      btn.style.display = 'none';
      fileInput.disabled = true;
    } else {
      msgEl.textContent = `❌ ${result.error}`;
      msgEl.style.color = '#dc2626';
      btn.disabled = false;
      btn.textContent = '📤 Enviar captura';
    }
  });
}

function mostrarExitoCompra(tickets, ctx) {
  document.getElementById('validacion-pago').classList.add('hidden');
  const resultDiv = document.getElementById('resultado-compra');
  resultDiv.classList.remove('hidden');
  const sorteo = state.sorteoSeleccionado || {};
  const monto = ctx.monto_total ? Number(ctx.monto_total).toFixed(2) : '0.00';
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