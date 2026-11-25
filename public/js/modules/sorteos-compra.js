import { state } from './sorteos-state.js';
import { 
  mostrarErrorComprobante, 
  formatearCodigo,
  actualizarTotal 
} from './sorteos-modal.js';
import { 
  inicializarValidadorComprobante, 
  validarComprobanteYapePlin 
} from './sorteos-comprobante.js';
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
    btn.textContent = 'Confirmar Compra';
    btn.disabled = false;
    return;
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
      btn.textContent = 'Confirmar Compra';
      btn.disabled = false;
      return;
    }
    
    const validacion = await validarComprobanteYapePlin(file);
    if (validacion.error) {
      mostrarErrorComprobante('❌ No se pudo leer la imagen. Sube un archivo JPG o PNG válido.');
      btn.textContent = 'Confirmar Compra';
      btn.disabled = false;
      return;
    }
    if (!validacion.esValido) {
      mostrarErrorComprobante('❌ Este no es un comprobante válido de Yape o Plin.');
      btn.textContent = 'Confirmar Compra';
      btn.disabled = false;
      return;
    }
    formData.append('comprobante', file);
  } else {
    mostrarErrorComprobante('❌ Debes subir un comprobante de pago.');
    btn.textContent = 'Confirmar Compra';
    btn.disabled = false;
    return;
  }

  try {
    const res = await fetch('/api/public/comprar-aleatorio', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      
      if (data.tickets && data.tickets.length > 0 && data.total_pagado) {
        const primerTicketId = data.tickets[0].id;
        iniciarPolling(primerTicketId, data.total_pagado);
      } else {
        mostrarErrorComprobante('❌ Error al procesar la compra. Intenta de nuevo.');
      }
    } else {
      const err = await res.json();
      mostrarErrorComprobante('❌ ' + (err.error || 'Error en la compra.'));
    }
  } catch (error) {
    console.error('Error de conexión:', error);
    alert('Error de conexión con el servidor.');
  } finally {
    btn.textContent = 'Confirmar Compra';
    btn.disabled = false;
  }
}