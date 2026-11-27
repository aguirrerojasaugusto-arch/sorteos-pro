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

  // ---------- Validaciones locales ----------
  const dni = document.getElementById('inp-dni').value;
  if (dni.length !== 8) {
    alert('Por favor, ingrese un DNI válido de 8 dígitos.');
    btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
  }
  const nombres = document.getElementById('inp-nombres').value;
  const apellidos = document.getElementById('inp-apellidos').value;
  const departamento = document.getElementById('inp-departamento').value;
  const celular = document.getElementById('inp-celular').value;
  const sorteoIdVal = document.getElementById('compra-sorteo-id').value;
  const cantidad = document.getElementById('inp-cantidad').value;

  // ✅ Comprobante ya NO es obligatorio aquí (se sube opcionalmente en la pantalla de validación)

  try {
    // ============================================================
    // PASO 1: Crear pago pendiente → genera monto EXACTO (sin centavos aleatorios)
    // ============================================================
    console.log('📤 Paso 1: creando pago pendiente...');
    const resPendiente = await fetch('/api/public/pago-pendiente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sorteo_id: Number(sorteoIdVal),
        cliente_dni: dni,
        cliente_nombre: `${nombres} ${apellidos}`.trim(),
        cliente_telefono: celular,
        cliente_departamento: departamento,
        cantidad_tickets: Number(cantidad) || 1,
        cantidad_sorteos: 1
      })
    });
    if (!resPendiente.ok) {
      const err = await resPendiente.json().catch(() => ({}));
      mostrarErrorComprobante('❌ ' + (err.error || 'No se pudo iniciar el pago.'));
      btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
    }
    const data = await resPendiente.json();
    console.log('🎫 Pago pendiente creado:', data);
    const { token, monto_total, yape_numero, yape_titular, expira_en, cantidad_tickets } = data;

    // ✅ PASO 2 ELIMINADO: Ya no subimos comprobante aquí.
    // El comprobante ahora es opcional y se sube desde la pantalla de validación.

    // ============================================================
    // PASO 3: Mostrar pantalla de validación con monto EXACTO + campo de 3 dígitos
    // ============================================================
    document.getElementById('form-compra').classList.add('hidden');
    document.getElementById('resultado-compra').classList.add('hidden');
    document.getElementById('validacion-pago').classList.remove('hidden');

    const elTotal = document.getElementById('val-total');
    if (elTotal) elTotal.textContent = `S/ ${Number(monto_total).toFixed(2)}`;
    const elNum = document.getElementById('pago-numero');
    if (elNum) elNum.textContent = yape_numero || '993 897 647';
    const elNom = document.getElementById('pago-nombre');
    if (elNom) elNom.textContent = yape_titular || 'Artesanía Mariposita';

    state.compraActualId = token;
    state.compraContexto = { monto_total, cantidad_tickets, expira_en, nombres, apellidos, dni };

    iniciarPolling(token, Number(monto_total));
  } catch (error) {
    console.error('Error de conexión:', error);
    alert('Error de conexión con el servidor.');
  } finally {
    btn.textContent = 'Confirmar Compra';
    btn.disabled = false;
  }
}