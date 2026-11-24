let paginaVentas = 1;
const itemsPorPagina = 5;
let ventasFiltradas = [];
let dniDebounceTimerAdmin = null;

function initVentas() {
  ventasFiltradas = globalData.tickets || [];
  paginaVentas = 1;
  renderizarTablaVentas();
  inyectarBotonesImpresion();
  inyectarMenuImprimir();
  inicializarBusquedaDNIAdmin();
}

/* ==========================================
   AUTOCOMPLETADO POR DNI (VENTA PRESENCIAL)
   ========================================== */
function inicializarBusquedaDNIAdmin() {
  const dniInput = document.getElementById('venta-dni');
  if (!dniInput) return;

  dniInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
    const dni = e.target.value;
    const statusBadge = document.getElementById('dni-status-admin');

    if (dni.length < 8) {
      if (statusBadge) {
        statusBadge.textContent = '';
        statusBadge.className = 'status-badge';
      }
      setCamposVentaEditables(true);
      return;
    }

    if (statusBadge) {
      statusBadge.textContent = 'Buscando...';
      statusBadge.className = 'status-badge buscando';
    }
    setCamposVentaEditables(false);

    clearTimeout(dniDebounceTimerAdmin);
    dniDebounceTimerAdmin = setTimeout(() => buscarClientePorDNIAdmin(dni), 500);
  });
}

async function buscarClientePorDNIAdmin(dni) {
  const statusBadge = document.getElementById('dni-status-admin');
  try {
    const res = await fetch(`/api/public/cliente/${dni}`);
    const data = await res.json();

    if (data.encontrado) {
      // ✅ FORZAR MAYÚSCULAS en el autocompletado
      const nombreCompleto = `${data.datos.nombres || ''} ${data.datos.apellidos || ''}`.trim().toUpperCase();
      document.getElementById('venta-nombre').value = nombreCompleto;
      document.getElementById('venta-telefono').value = (data.datos.celular || '').toUpperCase();
      document.getElementById('venta-departamento').value = (data.datos.departamento || '').toUpperCase();
      
      if (statusBadge) {
        statusBadge.textContent = '✓ Registrado';
        statusBadge.className = 'status-badge encontrado';
      }
      setCamposVentaEditables(false);
    } else {
      if (statusBadge) {
        statusBadge.textContent = '✗ Nuevo (Se guardará)';
        statusBadge.className = 'status-badge nuevo';
      }
      setCamposVentaEditables(true);
    }
  } catch (error) {
    console.error('Error al buscar cliente:', error);
    if (statusBadge) {
      statusBadge.textContent = 'Error de red';
    }
    setCamposVentaEditables(true);
  }
}

function setCamposVentaEditables(esEditable) {
  const nombreInput = document.getElementById('venta-nombre');
  const telefonoInput = document.getElementById('venta-telefono');
  const deptoInput = document.getElementById('venta-departamento');
  
  if (nombreInput) nombreInput.readOnly = !esEditable;
  if (telefonoInput) telefonoInput.readOnly = !esEditable;
  if (deptoInput) deptoInput.readOnly = !esEditable;
}

/* ---------- IMPRESIÓN ---------- */
function mapearTicketsParaImpresion(tickets) {
  const sorteos = globalData.sorteos || [];
  const marca = (globalData.config && globalData.config.brand_name) || 'ARTESANIA MARIPOSITA';
  return (tickets || []).map(t => {
    const s = sorteos.find(x => x.id === t.sorteo_id);
    return {
      codigo: String(t.codigo_ticket || '').split('-').pop(),
      nombre: t.cliente_nombre || '-',
      dni: t.cliente_dni || '',
      celular: t.cliente_telefono || t.telefono || '',
      departamento: t.cliente_departamento || t.departamento || '',
      sorteo: s ? s.nombre : ('Sorteo #' + (t.sorteo_id ?? '?')),
      marca
    };
  });
}

function abrirHojaImpresionTodos() {
  const todos = mapearTicketsParaImpresion(globalData.tickets || []);
  if (!todos.length) return alert('No hay tickets vendidos registrados todavía.');
  sessionStorage.setItem('ticketsParaImprimir', JSON.stringify(todos));
  window.open('/imprimir-tickets.html?modo=todos', '_blank');
}

function imprimirEstaVenta() {
  const tickets = JSON.parse(sessionStorage.getItem('ticketsVenta') || '[]');
  if (!tickets.length) return alert('Primero emite un ticket para poder imprimir.');
  sessionStorage.setItem('ticketsParaImprimir', JSON.stringify(tickets));
  window.open('/imprimir-tickets.html?modo=venta', '_blank');
}

function inyectarBotonesImpresion() {
  // Intencionalmente vacío para no agregar botones extra debajo del formulario
}

function inyectarMenuImprimir() {
  if (document.getElementById('menu-imprimir')) return;
  const sel = '.sidebar a, .sidebar button, aside a, aside button, nav a, nav button, .menu a, .menu button, .sidebar li, aside li, nav li';
  const items = Array.from(document.querySelectorAll(sel));
  let ref = items.find(el => /Venta de Tickets/i.test((el.textContent || '').trim()) && (el.textContent || '').trim().length < 40);
  if (!ref) ref = items[items.length - 1];
  if (!ref) return;

  const clon = ref.cloneNode(true);
  clon.id = 'menu-imprimir';
  clon.removeAttribute('href');
  clon.removeAttribute('data-section');
  clon.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abrirHojaImpresionTodos(); };
  clon.style.cursor = 'pointer';
  const icon = clon.querySelector('.menu-icon, i, svg, .icon');
  if (icon) icon.textContent = '🖨️'; else clon.insertAdjacentHTML('afterbegin', '<span class="menu-icon">🖨️</span> ');
  const txt = clon.childNodes;
  for (let n of txt) { if (n.nodeType === 3 && /Venta de Tickets/i.test(n.textContent)) n.textContent = ' Imprimir Tickets'; }
  if (!/Imprimir Tickets/.test(clon.textContent)) clon.append(' Imprimir Tickets');

  ref.insertAdjacentElement('afterend', clon);
}

/* ---------- TABLA / FILTRO ---------- */
function filtrarVentas() {
  const query = document.getElementById('search-ventas').value.toLowerCase().trim();
  if (!query) {
    ventasFiltradas = globalData.tickets || [];
  } else {
    ventasFiltradas = (globalData.tickets || []).filter(t => {
      const codigo = t.codigo_ticket ? t.codigo_ticket.toString().toLowerCase() : '';
      const dni = t.cliente_dni ? t.cliente_dni.toString() : '';
      const nombre = t.cliente_nombre ? t.cliente_nombre.toLowerCase() : '';
      const telefono = (t.telefono || t.cliente_telefono) ? (t.telefono || t.cliente_telefono).toString() : '';
      const depto = (t.departamento || t.cliente_departamento) ? (t.departamento || t.cliente_departamento).toLowerCase() : '';
      return codigo.includes(query) || dni.includes(query) || nombre.includes(query) || telefono.includes(query) || depto.includes(query);
    });
  }
  paginaVentas = 1;
  renderizarTablaVentas();
}

function cambiarPaginaVentas(direccion) {
  const totalPaginas = Math.ceil(ventasFiltradas.length / itemsPorPagina) || 1;
  const nuevaPagina = paginaVentas + direccion;
  if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
    paginaVentas = nuevaPagina;
    renderizarTablaVentas();
  }
}

function renderizarTablaVentas() {
  const tbody = document.getElementById('tbody-ventas');
  if (!tbody) return;

  const totalPaginas = Math.ceil(ventasFiltradas.length / itemsPorPagina) || 1;
  const inicio = (paginaVentas - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const ticketsAMostrar = ventasFiltradas.slice(inicio, fin);

  let htmlVentas = ticketsAMostrar.length > 0 ? ticketsAMostrar.map(t => {
    const fecha = new Date(t.creado_en);
    const telefono = t.telefono || t.cliente_telefono || '-';
    const depto = t.departamento || t.cliente_departamento || '-';
    const cant = t.cantidad_sorteos || t.cantidad_tickets || 1;
    const monto = t.total_pagado || 0;
    const comprobanteUrl = t.comprobante_url || t.comprobante || '';
    const codigoMostrar = t.codigo_ticket ? t.codigo_ticket.toString().split('-').pop() : '---';

    let compHtml = '-';
    if (comprobanteUrl) {
      compHtml = `<a href="#" class="voucher-link" onmouseenter="showPreview(event, '${comprobanteUrl}')" onmouseleave="hidePreview()" onclick="event.preventDefault()">Ver Imagen</a>`;
    }

    return `<tr>
      <td class="ticket-code">#${codigoMostrar}</td>
      <td>${t.cliente_dni || '-'}</td>
      <td>${t.cliente_nombre || '-'}</td>
      <td>${telefono}</td>
      <td>${depto}</td>
      <td>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
      <td>${cant}</td>
      <td>S/ ${Number(monto).toFixed(2)}</td>
      <td>${compHtml}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="9" class="empty-table-msg">No se encontraron ventas.</td></tr>`;

  tbody.innerHTML = htmlVentas;

  const infoPagina = document.getElementById('info-pagina-ventas');
  const btnPrev = document.getElementById('btn-prev-ventas');
  const btnNext = document.getElementById('btn-next-ventas');
  if (infoPagina) infoPagina.textContent = `Página ${paginaVentas} de ${totalPaginas}`;
  if (btnPrev) btnPrev.disabled = paginaVentas === 1;
  if (btnNext) btnNext.disabled = paginaVentas === totalPaginas;
}

function calcularTotal() {
  const sorteoId = Number(document.getElementById('venta-sorteo').value);
  const cant = Number(document.getElementById('venta-cantidad').value) || 1;
  const sorteo = globalData.sorteos?.find(s => s.id === sorteoId);
  const precio = sorteo ? sorteo.precio_jugada : 0;
  document.getElementById('venta-total').value = `S/ ${(precio * cant).toFixed(2)}`;
}

function generarNumerosUnicos(cantidad, maximo) {
  const numeros = new Set();
  while (numeros.size < cantidad) numeros.add(Math.floor(Math.random() * maximo) + 1);
  return Array.from(numeros).sort((a, b) => a - b);
}

function mostrarModalComprobante(datos) {
  document.getElementById('comp-nombre').textContent = datos.nombre;
  document.getElementById('comp-dni').textContent = datos.dni;
  document.getElementById('comp-celular').textContent = datos.celular || '-';
  document.getElementById('comp-departamento').textContent = datos.departamento || '-';
  document.getElementById('comp-sorteo').textContent = datos.sorteo;
  document.getElementById('comp-total').textContent = datos.total;

  const lista = document.getElementById('comp-lista-tickets');
  lista.innerHTML = '';
  datos.tickets.forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="ticket-num">#${t.codigo}</span>`;
    lista.appendChild(li);
  });

  document.getElementById('modal-comprobante-venta').classList.remove('hidden');
}

function cerrarModalComprobante() {
  document.getElementById('modal-comprobante-venta').classList.add('hidden');
}

function imprimirEstaVentaDesdeModal() {
  imprimirEstaVenta();
  cerrarModalComprobante();
}

async function emitirTicketPresencial(event) {
  const btn = event.target;
  const sorteo_id = Number(document.getElementById('venta-sorteo').value);
  const nombre = document.getElementById('venta-nombre').value.trim();
  const dni = document.getElementById('venta-dni').value.trim();
  const telefono = document.getElementById('venta-telefono').value.trim();
  const departamento = document.getElementById('venta-departamento').value.trim();
  const cantidad = Number(document.getElementById('venta-cantidad').value) || 1;

  if (!nombre || !dni) return alert('Completa Nombre y DNI');
  if (dni.length !== 8) return alert('El DNI debe tener 8 dígitos');

  const sorteo = globalData.sorteos?.find(s => s.id === sorteo_id);
  if (!sorteo) return alert('❌ Sorteo no válido o no encontrado.');

  btn.textContent = 'Emitiendo...';
  btn.disabled = true;

  let exitos = 0;
  let codigos = [];
  const ticketsVenta = [];

  try {
    for (let i = 0; i < cantidad; i++) {
      const numeros = generarNumerosUnicos(sorteo.min_bolillas || 6, sorteo.max_numero || 51);

      const body = {
        sorteo_id, cliente_nombre: nombre, cliente_dni: dni, telefono, departamento,
        jugadas: [{ zona: 'A', numeros }], cantidad_sorteos: 1, si_o_si: false,
        total_pagado: sorteo.precio_jugada
      };

      const res = await fetch('/api/public/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        const t = data.tickets ? data.tickets[0] : data.ticket;
        codigos.push(t.codigo_ticket);
        exitos++;
        ticketsVenta.push({
          codigo: String(t.codigo_ticket || '').split('-').pop(),
          nombre: t.cliente_nombre || nombre,
          dni: t.cliente_dni || dni,
          celular: t.cliente_telefono || telefono,
          departamento: t.cliente_departamento || departamento,
          sorteo: sorteo.nombre
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`❌ Error al emitir el ticket ${i + 1}:\n${errData.error || 'Error desconocido del servidor'}`);
        break;
      }
    }

    if (exitos > 0) {
      sessionStorage.setItem('ticketsVenta', JSON.stringify(ticketsVenta));
      
      mostrarModalComprobante({
        nombre: nombre,
        dni: dni,
        celular: telefono,
        departamento: departamento,
        sorteo: sorteo.nombre,
        total: `S/ ${(sorteo.precio_jugada * exitos).toFixed(2)}`,
        tickets: ticketsVenta
      });
      
      // RESET COMPLETO DEL FORMULARIO
      document.getElementById('venta-nombre').value = '';
      document.getElementById('venta-dni').value = '';
      document.getElementById('venta-telefono').value = '';
      document.getElementById('venta-departamento').value = '';
      document.getElementById('venta-cantidad').value = '1';
      
      const statusBadge = document.getElementById('dni-status-admin');
      if (statusBadge) {
        statusBadge.textContent = '';
        statusBadge.className = 'status-badge';
      }
      setCamposVentaEditables(true);
      
      calcularTotal();
      if (typeof cargarDatosGlobales === 'function') await cargarDatosGlobales();
    } else if (cantidad > 0) {
      console.warn('No se emitió ningún ticket.');
    }
  } catch (err) {
    console.error('Error de conexión:', err);
    alert('Error de conexión con el servidor.');
  } finally {
    btn.textContent = '✅ Emitir Ticket y Mostrar Comprobante';
    btn.disabled = false;
  }
}