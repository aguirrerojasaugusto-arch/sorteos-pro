const boletera = {
  seleccionados: [],
  jugadas: { A: [] },
  zonaActiva: 'A'
};

function renderMatriz() {
  const s = state.sorteoActual;
  if (!s) return;
  const cont = document.getElementById('matriz');
  cont.innerHTML = '';
  for (let i = 1; i <= s.max_numero; i++) {
    const btn = document.createElement('button');
    btn.className = 'bolilla';
    btn.textContent = i;
    if (boletera.jugadas[boletera.zonaActiva]?.includes(i)) btn.classList.add('selected');
    btn.addEventListener('click', () => toggleNumero(i));
    cont.appendChild(btn);
  }
}

function toggleNumero(n) {
  const zona = boletera.zonaActiva;
  const arr = boletera.jugadas[zona] || [];
  const idx = arr.indexOf(n);
  if (idx >= 0) arr.splice(idx, 1);
  else {
    if (arr.length >= state.sorteoActual.min_bolillas) return;
    arr.push(n);
  }
  boletera.jugadas[zona] = arr;
  renderMatriz();
  renderContador();
}

function renderContador() {
  const arr = boletera.jugadas[boletera.zonaActiva] || [];
  document.getElementById('contador').textContent =
    `${arr.length} / ${state.sorteoActual.min_bolillas} seleccionados (Zona ${boletera.zonaActiva})`;
}

function renderTabs() {
  const cont = document.getElementById('tabs-jugadas');
  cont.innerHTML = '';
  Object.keys(boletera.jugadas).forEach(zona => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (zona === boletera.zonaActiva ? ' active' : '');
    tab.textContent = zona;
    tab.addEventListener('click', () => {
      boletera.zonaActiva = zona;
      renderMatriz(); renderTabs(); renderContador();
    });
    cont.appendChild(tab);
  });
  if (Object.keys(boletera.jugadas).length < 4) {
    const add = document.createElement('div');
    add.className = 'tab';
    add.textContent = '+';
    add.addEventListener('click', () => {
      const letras = ['A', 'B', 'C', 'D'];
      const next = letras.find(l => !boletera.jugadas[l]);
      if (next) { boletera.jugadas[next] = []; boletera.zonaActiva = next; renderMatriz(); renderTabs(); renderContador(); }
    });
    cont.appendChild(add);
  }
}

document.getElementById('btn-azar').addEventListener('click', () => {
  const s = state.sorteoActual;
  const arr = [];
  while (arr.length < s.min_bolillas) {
    const n = Math.floor(Math.random() * s.max_numero) + 1;
    if (!arr.includes(n)) arr.push(n);
  }
  arr.sort((a, b) => a - b);
  boletera.jugadas[boletera.zonaActiva] = arr;
  renderMatriz(); renderContador();
});

document.getElementById('btn-limpiar').addEventListener('click', () => {
  boletera.jugadas[boletera.zonaActiva] = [];
  renderMatriz(); renderContador();
});

function calcularResumen() {
  const s = state.sorteoActual;
  const jugadas = Object.entries(boletera.jugadas).filter(([, arr]) => arr.length === s.min_bolillas);
  const cantidadJugadas = jugadas.length;
  const cantidadSorteos = Number(document.getElementById('sel-sorteos').value);
  const reglas = s.combo_descuentos || [];
  const base = +(s.precio_jugada * cantidadJugadas * cantidadSorteos).toFixed(2);
  const regla = [...reglas].sort((a,b)=>b.cantidad-a.cantidad).find(r => cantidadSorteos >= r.cantidad);
  const descuento = regla ? regla.descuento : 0;
  let total = +(base * (1 - descuento)).toFixed(2);
  const siOSi = document.getElementById('chk-si-o-si').checked;
  const boliyapa = document.getElementById('inp-boliyapa').value;
  if (siOSi && s.tiene_si_o_si) total += s.costo_si_o_si;
  if (boliyapa && s.tiene_boliyapa) total += s.costo_boliyapa;
  
  document.getElementById('resumen').innerHTML = `
    <div>Jugadas: ${cantidadJugadas} × ${cantidadSorteos} sorteos</div>
    <div>Base: S/ ${base}</div>
    <div>Descuento: -${(descuento*100).toFixed(0)}%</div>
    ${siOSi ? `<div>Sí o Sí: S/ ${s.costo_si_o_si}</div>` : ''}
    ${boliyapa ? `<div>Boliyapa: S/ ${s.costo_boliyapa}</div>` : ''}
    <div class="total">Total: S/ ${total.toFixed(2)}</div>
  `;
  return { jugadas, cantidadJugadas, cantidadSorteos, total };
}

['sel-sorteos','chk-si-o-si','inp-boliyapa'].forEach(id =>
  document.getElementById(id).addEventListener('input', calcularResumen));

document.getElementById('btn-comprar').addEventListener('click', async () => {
  const resumen = calcularResumen();
  const { jugadas } = resumen;
  const nombre = document.getElementById('inp-nombre').value.trim();
  const dni = document.getElementById('inp-dni').value.trim();
  
  if (jugadas.length === 0) return alert('Selecciona al menos una jugada completa');
  if (!nombre || !/^\d{8}$/.test(dni)) return alert('Nombre y DNI válidos requeridos');

  const body = {
    sorteo_id: state.sorteoActual.id,
    cliente_nombre: nombre,
    cliente_dni: dni,
    jugadas: jugadas.map(([zona, numeros]) => ({ zona, numeros })),
    cantidad_sorteos: Number(document.getElementById('sel-sorteos').value),
    total_pagado: resumen.total,
    si_o_si: document.getElementById('chk-si-o-si').checked,
    boliyapa_numero: document.getElementById('inp-boliyapa').value || null,
    usuario_id: localStorage.getItem('usuario_id') || null,
    pagar_con_saldo: !!localStorage.getItem('token')
  };

  const btnComprar = document.getElementById('btn-comprar');
  btnComprar.disabled = true;
  btnComprar.textContent = 'Procesando...';

  try {
    const res = await fetch('/api/public/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al comprar');
    
    // ✅ NUEVO: Guardar en sessionStorage para que la página de impresión los lea
    // Mapeamos cada ticket generado a un objeto simple que entiende imprimir-tickets.html
    const ticketsParaImprimir = data.tickets.map(t => ({
      codigo: t.codigo_ticket,
      nombre: body.cliente_nombre,
      celular: '', // Puedes agregar este campo al formulario de boletera si lo necesitas
      departamento: '', // Puedes agregar este campo al formulario de boletera si lo necesitas
      sorteo: state.sorteoActual.nombre,
      marca: 'Juega y Gana'
    }));
    
    // Guardamos en la clave 'ticketsVenta' (modo=venta en la URL de impresión)
    sessionStorage.setItem('ticketsVenta', JSON.stringify(ticketsParaImprimir));
    
    alert(`✅ Compra exitosa\nSe generaron ${data.tickets.length} tickets.\nTotal: S/ ${data.total_pagado.toFixed(2)}`);
    
    // ✅ OPCIONAL: Abrir automáticamente la pestaña de impresión después de comprar
    // window.open('/imprimir-tickets.html?modo=venta', '_blank');
    
    window.location.reload();
  } catch (err) {
    alert(err.message);
  } finally {
    btnComprar.disabled = false;
    btnComprar.textContent = 'Comprar';
  }
});

// Init
function initBoletera() {
  if (!state.sorteoActual) return;
  boletera.jugadas = { A: [] };
  boletera.zonaActiva = 'A';
  renderMatriz(); renderTabs(); renderContador(); calcularResumen();
}

const originalRenderHero = window.renderHero;
setTimeout(initBoletera, 500);