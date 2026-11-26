import { state } from './sorteos-state.js';
import { fechaObjetivoLima } from './sorteos-clock.js';
import { setCamposClienteEditable } from './sorteos-dni.js';
import { detenerPolling } from './sorteos-polling.js';

export function abrirModal(idSorteo) {
  console.log('🔍 abrirModal llamado con id:', idSorteo, 'tipo:', typeof idSorteo);
  console.log('📦 Sorteos en state:', state.sorteos);
  
  const sorteo = state.sorteos.find(s => String(s.id) === String(idSorteo));
  console.log('🎯 Sorteo encontrado:', sorteo);
  
  if (!sorteo) {
    console.error('❌ Sorteo no encontrado. IDs disponibles:', state.sorteos.map(s => ({ id: s.id, tipo: typeof s.id })));
    return alert('No se pudo cargar el sorteo. Recarga la página.');
  }

  console.log('⏰ Calculando fecha objetivo...');
  const objetivo = fechaObjetivoLima(sorteo);
  console.log('📅 Fecha objetivo:', objetivo);
  
  if (objetivo && objetivo.getTime() <= Date.now()) {
    console.log('⛔ Sorteo finalizado');
    return alert('Este sorteo ya ha finalizado.');
  }

  console.log('🛑 Deteniendo polling...');
  detenerPolling();
  state.sorteoSeleccionado = sorteo;

  console.log('📝 Llenando formulario...');
  document.getElementById('compra-sorteo-id').value = String(sorteo.id);
  document.getElementById('compra-precio').value = sorteo.precio_jugada;
  document.getElementById('precio-unitario').textContent = sorteo.precio_jugada;
  document.getElementById('modal-titulo').textContent = `Participar en: ${sorteo.nombre}`;

  const config = state.config || {};
  document.getElementById('pago-numero').textContent = config.contacto_telefono || '993 897 647';
  document.getElementById('pago-nombre').textContent = config.brand_name || 'Artesanía Mariposita';

  console.log('👁️ Mostrando modal...');
  
  // ✅ FIX: Forzar estilos inline para asegurar visibilidad
  const modal = document.getElementById('modal-compra');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.background = 'rgba(0,0,0,0.6)';
  modal.style.zIndex = '9999';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  
  document.getElementById('form-compra').classList.remove('hidden');
  document.getElementById('form-compra').style.display = 'block';
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

  console.log('✅ Modal abierto correctamente');
  ocultarErrorComprobante();
  setCamposClienteEditable(true);
  actualizarTotal();
  
  setTimeout(() => {
    document.getElementById('inp-dni').focus();
  }, 100);
}

export function cerrarModal() {
  detenerPolling();
  const modal = document.getElementById('modal-compra');
  modal.classList.add('hidden');
  modal.style.display = '';
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