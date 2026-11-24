const token = localStorage.getItem('token');
if (!token) window.location.href = '/';

const authHeaders = { 'Authorization': `Bearer ${token}` };

async function cargarWallet() {
  try {
    const res = await fetch('/api/user/wallet', { headers: authHeaders });
    const data = await res.json();
    document.getElementById('saldo-actual').textContent = `S/ ${data.saldo.toFixed(2)}`;
    renderTransacciones(data.transacciones);
  } catch (err) {
    console.error('Error cargando wallet:', err);
  }
}

function renderTransacciones(txs) {
  const contenedor = document.getElementById('lista-transacciones');
  if (!contenedor) return;
  
  contenedor.innerHTML = txs.map(t =>
    `<div style="padding:.5rem;border-bottom:1px solid var(--surface-2);">
      ${t.tipo} — S/ ${t.monto.toFixed(2)} — Saldo: S/ ${t.saldo_resultante.toFixed(2)}
      <small style="color:var(--text-muted);float:right;">${t.creado_en}</small>
    </div>`
  ).join('') || '<p style="padding:1rem;">Sin transacciones</p>';
}

async function cargarTickets() {
  try {
    const res = await fetch('/api/user/tickets', { headers: authHeaders });
    const tickets = await res.json();
    const contenedor = document.getElementById('lista-tickets');
    if (!contenedor) return;

    contenedor.innerHTML = tickets.map(t =>
      `<div style="padding:.5rem;border-bottom:1px solid var(--surface-2);">
        <strong>${t.codigo_ticket}</strong> — Sorteo #${t.sorteo_id} — S/ ${t.total_pagado}
        — Aciertos: ${t.aciertos ?? '—'}
      </div>`
    ).join('') || '<p style="padding:1rem;">Sin tickets</p>';
  } catch (err) {
    console.error('Error cargando tickets:', err);
  }
}

async function cargarPremios() {
  try {
    const res = await fetch('/api/user/premios', { headers: authHeaders });
    const premios = await res.json();
    const contenedor = document.getElementById('lista-premios');
    if (!contenedor) return;

    contenedor.innerHTML = premios.map(p =>
      `<div style="padding:.5rem;border-bottom:1px solid var(--surface-2);">
        ${p.codigo_ticket} — Premio: S/ ${p.premio_ganado}
      </div>`
    ).join('') || '<p style="padding:1rem;">Sin premios aún</p>';
  } catch (err) {
    console.error('Error cargando premios:', err);
  }
}

document.getElementById('btn-recargar')?.addEventListener('click', async () => {
  const monto = Number(document.getElementById('inp-recarga').value);
  if (!monto || monto <= 0) return alert('Monto inválido');
  
  try {
    const res = await fetch('/api/user/wallet/recarga', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto, metodo: 'SIMULADO' })
    });
    if (!res.ok) throw new Error('Error al recargar');
    cargarWallet();
    document.getElementById('inp-recarga').value = '';
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btn-logout')?.addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.clear();
  window.location.href = '/';
});

// Inicializar
cargarWallet();
cargarTickets();
cargarPremios();