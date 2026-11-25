async function comprarTickets(e) {
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
      document.getElementById('form-compra').classList.add('hidden');
      const resultDiv = document.getElementById('resultado-compra');
      resultDiv.classList.remove('hidden');

      // ✅ NUEVO: Agrupar tickets por sorteo
      const ticketsPorSorteo = {};
      data.tickets.forEach(t => {
        const sorteoId = t.sorteo_id;
        if (!ticketsPorSorteo[sorteoId]) {
          ticketsPorSorteo[sorteoId] = {
            nombre: state.sorteoSeleccionado.nombre,
            fechaSorteo: state.sorteoSeleccionado.fecha_sorteo,
            tickets: []
          };
        }
        ticketsPorSorteo[sorteoId].tickets.push(t.codigo_ticket);
      });

      // ✅ NUEVO: Generar HTML agrupado por sorteo
      let html = `<h3 style="color:var(--tinka-green); margin-bottom: 15px; text-align: center;">🎟️ Resumen de tus Tickets</h3>`;
      html += `<div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px;">`;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">`;
      html += `<div><strong>👤 Cliente:</strong> ${nombres} ${apellidos}</div>`;
      html += `<div><strong>🎟️ Total:</strong> <span style="color:var(--tinka-red); font-size:1.2rem; font-weight:bold;">${data.tickets.length}</span></div>`;
      html += `</div>`;
      html += `</div>`;

      // ✅ NUEVO: Tabla agrupada por sorteo
      html += `<div style="border:1px solid #ddd; border-radius:8px; overflow:hidden;">`;
      html += `<table style="width:100%; border-collapse:collapse;">`;
      html += `<thead><tr style="background:var(--tinka-yellow);">`;
      html += `<th style="padding:12px; text-align:left; font-weight:bold;">SORTEO</th>`;
      html += `<th style="padding:12px; text-align:left; font-weight:bold;">FECHA SORTEO</th>`;
      html += `<th style="padding:12px; text-align:left; font-weight:bold;">TUS NÚMEROS</th>`;
      html += `</tr></thead>`;
      html += `<tbody>`;

      Object.entries(ticketsPorSorteo).forEach(([sorteoId, info]) => {
        const fechaSorteo = info.fechaSorteo 
          ? new Date(info.fechaSorteo).toLocaleDateString('es-PE', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric',
              timeZone: 'America/Lima'
            })
          : 'Por definir';
        
        const codigosFormateados = info.tickets.map(c => `#${formatearCodigo(c)}`).join(', ');
        
        html += `<tr style="border-bottom:1px solid #eee;">`;
        html += `<td style="padding:12px; font-weight:bold;">${info.nombre}</td>`;
        html += `<td style="padding:12px;">${fechaSorteo}</td>`;
        html += `<td style="padding:12px; font-family:'Courier New', monospace; font-weight:bold; color:var(--tinka-red);">${codigosFormateados}</td>`;
        html += `</tr>`;
      });

      html += `</tbody></table>`;
      html += `</div>`;

      html += `<button onclick="cerrarModal(); location.reload();" style="margin-top:20px; padding:12px; width:100%; background:var(--tinka-green); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:1rem;">Cerrar</button>`;
      
      resultDiv.innerHTML = html;
    } else {
      const err = await res.json();
      mostrarErrorComprobante('❌ ' + (err.error || 'Error en la compra.'));
    }
  } catch (error) {
    alert('Error de conexión con el servidor.');
  } finally {
    btn.textContent = 'Confirmar Compra';
    btn.disabled = false;
  }
}