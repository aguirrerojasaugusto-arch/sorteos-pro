import { state } from './sorteos-state.js';
import { fechaObjetivoLima } from './sorteos-clock.js';
import { setCamposClienteEditable } from './sorteos-dni.js';
import { detenerPolling } from './sorteos-polling.js';

export function abrirModal(idSorteo) {
  const sorteo = state.sorteos.find(s => s.id === idSorteo);
  if (!sorteo) return;
  
  const objetivo = fechaObjetivoLima(sorteo);
  if (objetivo && objetivo.getTime() <= Date.now()) {
    return alert('Este sorteo ya ha finalizado.');
  }

  detenerPolling();

  state.sorteoSeleccionado = sorteo;
  document.getElementById('compra-sorteo-id').value = String(sorteo.id);
  document.getElementById('compra-precio').value = sorteo.precio_jugada;
  document.getElementById('precio-unitario').textContent = sorteo.precio_jugada;
  document.getElementById('modal-titulo').textContent = `Participar en: ${sorteo.nombre}`;

  const config = state.config || {};
  document.getElementById('pago-numero').textContent = config.contacto_telefono || '993 897 647';
  document.getElementById('pago-nombre').textContent = config.brand_name || 'Artesanía Mariposita';

  document.getElementById('modal-compra').classList.remove('hidden');
  document.getElementById('form-compra').classList.remove('hidden');
  document.getElementById('resultado-compra').classList.add('hidden');
  document.getElementById('validacion-pago').classList.add('hidden');
  document.getElementById('form-compra').reset();
  document.getElementById('dni-status').textContent = '';
  document.getElementById('dni-status').className = 'status-badge';

  const preview = document.getElementById('preview-comprobante');
  if (preview) { 
    preview.style.display = 'none'; 
    preview.src = ''; 
  }
  
  ocultarErrorComprobante();
  setCamposClienteEditable(true);
  actualizarTotal();
  document.getElementById('inp-dni').focus();
}

export function cerrarModal() {
  detenerPolling();
  document.getElementById('modal-compra').classList.add('hidden');
}

export function cambiarCantidad(delta) {
  const input = document.getElementById('inp-cantidad');
  let val = parseInt(input.value) || 1;
  val += delta;
  if (val < 1) val = 1;
  if (val > 50) val = 50;
  input.value = val;
  actualizarTotal();
}

export function actualizarTotal() {
  const precio = Number(document.getElementById('compra-precio').value);
  const cantidad = Number(document.getElementById('inp-cantidad').value) || 1;
  const total = precio * cantidad;
  document.getElementById('total-pagar').textContent = `S/ ${total.toFixed(2)}`;
}

export function formatearCodigo(codigo) {
  if (!codigo) return '—';
  const partes = String(codigo).split('-');
  return partes[partes.length - 1];
}

export function mostrarErrorComprobante(msg) {
  const box = document.getElementById('error-comprobante');
  if (box) { 
    box.textContent = msg; 
    box.style.display = 'block'; 
  }
}

export function ocultarErrorComprobante() {
  const box = document.getElementById('error-comprobante');
  if (box) { 
    box.textContent = ''; 
    box.style.display = 'none'; 
  }
}