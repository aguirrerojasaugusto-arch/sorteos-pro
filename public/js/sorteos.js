const state = {
  sorteos: [],
  sorteoSeleccionado: null,
  bannerIndex: 0,
  bannerTimer: null,
  config: {},
  compraActualId: null,
  pollingTimer: null
};

const PROMO_SPEED = 18;
const PROMO_VISIBLE = 4;
let promosBase = [];
let trackOffset = 0;
let trackVuelta = 0;
let promosRaf = null;
let promosPaused = false;
let promosLastTs = null;

const SORTEO_SPEED = 40;
let sorteosOffset = 0;
let sorteosVuelta = 0;
let sorteosRaf = null;
let sorteosLastTs = null;
let sorteosPaused = false;
let dniDebounceTimer = null;

function fechaObjetivoLima(s) {
  const fecha = String(s.fecha_sorteo || '').trim();
  if (!fecha) return null;
  const m = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = m[1], mo = m[2], d = m[3];
  let hora = '00:00';
  if (s.hora_sorteo) {
    const hm = String(s.hora_sorteo).match(/(\d{1,2}):(\d{2})/);
    if (hm) hora = hm[1].padStart(2, '0') + ':' + hm[2];
  } else {
    const ht = fecha.match(/[T](\d{2}):(\d{2})/);
    if (ht) hora = ht[1] + ':' + ht[2];
  }
  return new Date(`${y}-${mo}-${d}T${hora}:00-05:00`);
}

function fmtRestante(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function iniciarContadores() {
  if (window._cdTimer) clearInterval(window._cdTimer);
  const tick = () => {
    document.querySelectorAll('.card-sorteo').forEach(card => {
      const fecha = card.dataset.fecha;
      if (!fecha) return;
      const objetivo = new Date(fecha);
      const restante = objetivo.getTime() - Date.now();
      const cd = card.querySelector('.card-countdown');
      const btn = card.querySelector('.btn-participar');
      if (restante <= 0) {
        if (cd) { cd.textContent = '⛔ Sorteo finalizado'; cd.classList.add('expired'); }
        if (btn && !btn.disabled) {
          btn.disabled = true;
          btn.textContent = 'Sorteo Finalizado';
          btn.classList.add('is-finalizado');
          btn.onclick = null;
        }
      } else {
        if (cd) {
          cd.textContent = '⏳ ' + fmtRestante(restante);
          cd.classList.toggle('warn', restante < 3600000);
        }
      }
    });
  };
  tick();
  window._cdTimer = setInterval(tick, 1000);
}

async function cargarDatos() {
  try {
    const res = await fetch('/api/public/bootstrap?t=' + Date.now());
    const data = await res.json();
    state.sorteos = data.sorteos || [];
    state.config = data.config || {};
    let bannersA_Mostrar = [];
    if (data.banners && data.banners.length > 0) {
      bannersA_Mostrar = data.banners;
    } else {
      bannersA_Mostrar = state.sorteos.filter(s => s.banner_lateral).map(s => ({ url_imagen: s.banner_lateral }));
    }
    inicializarBanner(bannersA_Mostrar);
    inicializarPromos(data.promos_laterales || []);
    renderizarTarjetas();
    iniciarAutoScrollLento();
    iniciarContadores();
    inicializarBusquedaDNI();
    inicializarValidadorComprobante();
  } catch (e) { console.error('Error al cargar:', e); }
}

function inicializarBusquedaDNI() {
  const dniInput = document.getElementById('inp-dni');
  if (!dniInput) return;
  dniInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
    const dni = e.target.value;
    const statusBadge = document.getElementById('dni-status');
    if (dni.length < 8) {
      statusBadge.textContent = '';
      statusBadge.className = 'status-badge';
      setCamposClienteEditable(true);
      return;
    }
    statusBadge.textContent = 'Buscando...';
    statusBadge.className = 'status-badge buscando';
    setCamposClienteEditable(false);
    clearTimeout(dniDebounceTimer);
    dniDebounceTimer = setTimeout(() => buscarClientePorDni(dni), 500);
  });
}

async function buscarClientePorDni(dni) {
  const statusBadge = document.getElementById('dni-status');
  try {
    const res = await fetch(`/api/public/cliente/${dni}`);
    const data = await res.json();
    if (data.encontrado) {
      document.getElementById('inp-nombres').value = (data.datos.nombres || '').toUpperCase();
      document.getElementById('inp-apellidos').value = (data.datos.apellidos || '').toUpperCase();
      document.getElementById('inp-celular').value = (data.datos.celular || '').toUpperCase();
      const selectDepto = document.getElementById('inp-departamento');
      if (data.datos.departamento) {
        selectDepto.value = (data.datos.departamento || '').toUpperCase();
        statusBadge.textContent = '✓ Registrado';
        statusBadge.className = 'status-badge encontrado';
        setCamposClienteEditable(false);
      } else {
        selectDepto.value = '';
        statusBadge.textContent = '✓ Registrado (falta Departamento)';
        statusBadge.className = 'status-badge nuevo';
        setCamposClienteEditable(false);
        selectDepto.disabled = false;
        selectDepto.focus();
      }
    } else {
      statusBadge.textContent = '✗ Nuevo (Se guardará)';
      statusBadge.className = 'status-badge nuevo';
      setCamposClienteEditable(true);
    }
  } catch (error) {
    console.error('Error al buscar cliente:', error);
    statusBadge.textContent = 'Error de red';
    setCamposClienteEditable(true);
  }
}

function setCamposClienteEditable(esEditable) {
  document.getElementById('inp-nombres').readOnly = !esEditable;
  document.getElementById('inp-apellidos').readOnly = !esEditable;
  document.getElementById('inp-celular').readOnly = !esEditable;
  document.getElementById('inp-departamento').disabled = !esEditable;
}

function inicializarBanner(banners) {
  const container = document.getElementById('banner-rotativo');
  if (!container) return;
  if (banners.length === 0) {
    container.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#999;">Sin banners configurados</div>';
    return;
  }
  container.innerHTML = banners.map((b, i) => `<img src="${b.url_imagen}" class="${i === 0 ? 'active' : ''}" alt="Banner ${i+1}">`).join('');
  const slides = container.querySelectorAll('img');
  if (slides.length > 1) {
    if (state.bannerTimer) clearInterval(state.bannerTimer);
    state.bannerIndex = 0;
    state.bannerTimer = setInterval(() => {
      slides[state.bannerIndex].classList.remove('active');
      state.bannerIndex = (state.bannerIndex + 1) % slides.length;
      slides[state.bannerIndex].classList.add('active');
    }, 4000);
  }
}

function inicializarPromos(promos) {
  const viewport = document.getElementById('promos-viewport');
  const track = document.getElementById('promos-track');
  if (!viewport || !track) return;
  promosBase = (promos || []).filter(p => p && p.url_imagen);
  if (promosBase.length === 0) {
    viewport.innerHTML = '<p style="text-align:center; color:#999; padding: 2rem;">Sin promociones</p>';
    return;
  }
  let base = promosBase.slice();
  while (base.length < PROMO_VISIBLE) base = base.concat(promosBase);
  const lista = base.concat(base);
  track.innerHTML = lista.map(p => `<div class="promo-card"><img src="${p.url_imagen}" alt="Promo"><div class="promo-fecha">${p.fecha || ''}</div></div>`).join('');
  viewport.onmouseenter = () => promosPaused = true;
  viewport.onmouseleave = () => promosPaused = false;
  requestAnimationFrame(() => { ajustarPromos(); iniciarPromosLoop(); });
}

function ajustarPromos() {
  const viewport = document.getElementById('promos-viewport');
  const track = document.getElementById('promos-track');
  if (!viewport || !track) return;
  const cards = track.querySelectorAll('.promo-card');
  if (!cards.length) return;
  const H = viewport.clientHeight;
  const gap = parseFloat(getComputedStyle(track).gap) || 12;
  const cardH = (H - (PROMO_VISIBLE - 1) * gap) / PROMO_VISIBLE;
  cards.forEach(c => { c.style.height = cardH + 'px'; });
  const perCopy = cards.length / 2;
  trackVuelta = perCopy * (cardH + gap);
  if (trackVuelta > 0) {
    while (trackOffset <= -trackVuelta) trackOffset += trackVuelta;
    while (trackOffset > 0) trackOffset -= trackVuelta;
  }
  track.style.transform = `translateY(${trackOffset}px)`;
}

function iniciarPromosLoop() {
  if (promosRaf) cancelAnimationFrame(promosRaf);
  promosLastTs = null;
  const step = (ts) => {
    if (promosLastTs == null) promosLastTs = ts;
    const dt = (ts - promosLastTs) / 1000;
    promosLastTs = ts;
    if (!promosPaused && trackVuelta > 0) {
      trackOffset -= PROMO_SPEED * dt;
      if (trackOffset <= -trackVuelta) trackOffset += trackVuelta;
      const track = document.getElementById('promos-track');
      if (track) track.style.transform = `translateY(${trackOffset}px)`;
    }
    promosRaf = requestAnimationFrame(step);
  };
  promosRaf = requestAnimationFrame(step);
}

function scrollPromos(direction) {
  const viewport = document.getElementById('promos-viewport');
  const track = document.getElementById('promos-track');
  if (!viewport || !track || !trackVuelta) return;
  const cards = track.querySelectorAll('.promo-card');
  if (!cards.length) return;
  const cardH = cards[0].offsetHeight;
  const gap = parseFloat(getComputedStyle(track).gap) || 12;
  trackOffset -= direction * (cardH + gap);
  while (trackOffset <= -trackVuelta) trackOffset += trackVuelta;
  while (trackOffset > 0) trackOffset -= trackVuelta;
  track.style.transform = `translateY(${trackOffset}px)`;
}

function htmlTarjetas(sorteos) {
  const ahora = Date.now();
  return sorteos.map(s => {
    const imgUrl = s.imagen ? (s.imagen.startsWith('http') ? s.imagen : window.location.origin + s.imagen) : '/uploads/default.jpg';
    const objetivo = fechaObjetivoLima(s);
    const restanteMs = objetivo ? objetivo.getTime() - ahora : null;
    const bloqueado = objetivo && restanteMs <= 0;
    const fechaTexto = objetivo ? objetivo.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' }) : 'Por definir';
    const cdHtml = objetivo ? `<div class="card-countdown ${restanteMs <= 0 ? 'expired' : (restanteMs < 3600000 ? 'warn' : '')}">${bloqueado ? '⛔ Sorteo finalizado' : '⏳ ' + fmtRestante(restanteMs)}</div>` : '';
    const btnHtml = bloqueado ? `<button class="btn-participar is-finalizado" disabled>Sorteo Finalizado</button>` : `<button class="btn-participar" onclick="abrirModal(${s.id})">Participar</button>`;
    const premioTexto = s.premio_descripcion ? s.premio_descripcion : 'Premio Sorpresa';
    return `<div class="card-sorteo" data-fecha="${s.fecha_sorteo || ''}"><img src="${imgUrl}" class="card-img" alt="${s.nombre}"><div class="card-content"><div><div class="card-title">${s.nombre}</div><div class="card-pozo" style="font-size: 1.1rem; color:#007B4B; margin-bottom: 0.5rem;">${premioTexto}</div><div style="font-size: 0.8rem; color: #666; margin-bottom: 0.3rem;">Cierra: ${fechaTexto}</div>${cdHtml}</div><div><div class="card-precio">Ticket: S/ ${s.precio_jugada}</div>${btnHtml}</div></div></div>`;
  }).join('');
}

function renderizarTarjetas() {
  const grid = document.getElementById('grid-sorteos');
  if (!grid) return;
  if (state.sorteos.length === 0) {
    grid.innerHTML = '<p style="text-align:center; width:100%; color:#999;">No hay sorteos activos en este momento.</p>';
    sorteosVuelta = 0;
    return;
  }
  grid.innerHTML = htmlTarjetas(state.sorteos);
}

function iniciarAutoScrollLento() { iniciarCintaSorteos(); }

function construirCintaSorteos() {
  const wrapper = document.querySelector('.carrusel-sorteos-wrapper');
  const track = document.getElementById('grid-sorteos');
  if (!wrapper || !track || !state.sorteos.length) { sorteosVuelta = 0; return; }
  const baseHTML = htmlTarjetas(state.sorteos);
  const gap = parseFloat(getComputedStyle(track).gap) || 24;
  const viewportW = wrapper.clientWidth;
  let unidadHTML = baseHTML;
  track.innerHTML = unidadHTML;
  let unidadW = track.scrollWidth;
  let guard = 0;
  while (unidadW < viewportW + gap && guard < 12) {
    unidadHTML += baseHTML;
    track.innerHTML = unidadHTML;
    unidadW = track.scrollWidth;
    guard++;
  }
  track.innerHTML = unidadHTML + unidadHTML;
  sorteosVuelta = unidadW + gap;
  while (sorteosOffset <= -sorteosVuelta) sorteosOffset += sorteosVuelta;
  while (sorteosOffset > 0) sorteosOffset -= sorteosVuelta;
  track.style.transform = `translateX(${sorteosOffset}px)`;
}

function iniciarCintaSorteos() {
  const wrapper = document.querySelector('.carrusel-sorteos-wrapper');
  const track = document.getElementById('grid-sorteos');
  if (!wrapper || !track) return;
  if (sorteosRaf) cancelAnimationFrame(sorteosRaf);
  construirCintaSorteos();
  wrapper.onmouseenter = () => sorteosPaused = true;
  wrapper.onmouseleave = () => sorteosPaused = false;
  sorteosLastTs = null;
  const step = (ts) => {
    if (sorteosLastTs == null) sorteosLastTs = ts;
    const dt = (ts - sorteosLastTs) / 1000;
    sorteosLastTs = ts;
    if (!sorteosPaused && sorteosVuelta > 0) {
      sorteosOffset -= SORTEO_SPEED * dt;
      if (sorteosOffset <= -sorteosVuelta) sorteosOffset += sorteosVuelta;
      track.style.transform = `translateX(${sorteosOffset}px)`;
    }
    sorteosRaf = requestAnimationFrame(step);
  };
  sorteosRaf = requestAnimationFrame(step);
}

function scrollSorteos(direction) {
  const wrapper = document.querySelector('.carrusel-sorteos-wrapper');
  const track = document.getElementById('grid-sorteos');
  if (!wrapper || !track || !sorteosVuelta) return;
  const card = track.querySelector('.card-sorteo');
  if (!card) return;
  const gap = parseFloat(getComputedStyle(track).gap) || 24;
  sorteosOffset -= direction * (card.offsetWidth + gap);
  while (sorteosOffset <= -sorteosVuelta) sorteosOffset += sorteosVuelta;
  while (sorteosOffset > 0) sorteosOffset -= sorteosVuelta;
  track.style.transform = `translateX(${sorteosOffset}px)`;
}

window.addEventListener('resize', () => {
  const viewport = document.getElementById('promos-viewport');
  if (viewport && viewport.querySelector('.promo-card')) ajustarPromos();
  const ws = document.querySelector('.carrusel-sorteos-wrapper');
  if (ws && ws.querySelector('.card-sorteo')) { construirCintaSorteos(); }
});

function abrirModal(idSorteo) {
  const sorteo = state.sorteos.find(s => s.id === idSorteo);
  if (!sorteo) return;
  const objetivo = fechaObjetivoLima(sorteo);
  if (objetivo && objetivo.getTime() <= Date.now()) {
    return alert('Este sorteo ya ha finalizado.');
  }
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
  if (preview) { preview.style.display = 'none'; preview.src = ''; }
  ocultarErrorComprobante();
  setCamposClienteEditable(true);
  actualizarTotal();
  document.getElementById('inp-dni').focus();
}

function cerrarModal() {
  document.getElementById('modal-compra').classList.add('hidden');
}

function cambiarCantidad(delta) {
  const input = document.getElementById('inp-cantidad');
  let val = parseInt(input.value) || 1;
  val += delta;
  if (val < 1) val = 1;
  if (val > 50) val = 50;
  input.value = val;
  actualizarTotal();
}

function actualizarTotal() {
  const precio = Number(document.getElementById('compra-precio').value);
  const cantidad = Number(document.getElementById('inp-cantidad').value) || 1;
  const total = precio * cantidad;
  document.getElementById('total-pagar').textContent = `S/ ${total.toFixed(2)}`;
}

function formatearCodigo(codigo) {
  if (!codigo) return '—';
  const partes = String(codigo).split('-');
  return partes[partes.length - 1];
}

function mostrarErrorComprobante(msg) {
  const box = document.getElementById('error-comprobante');
  if (box) { box.textContent = msg; box.style.display = 'block'; }
}

function ocultarErrorComprobante() {
  const box = document.getElementById('error-comprobante');
  if (box) { box.textContent = ''; box.style.display = 'none'; }
}

function inicializarValidadorComprobante() {
  const inp = document.getElementById('inp-comprobante');
  const preview = document.getElementById('preview-comprobante');
  if (inp) {
    inp.addEventListener('change', (e) => {
      ocultarErrorComprobante();
      const file = e.target.files[0];
      if (file && preview) {
        if (file.size > 5 * 1024 * 1024) {
          mostrarErrorComprobante('❌ El comprobante supera el máximo de 5MB.');
          inp.value = '';
          preview.style.display = 'none';
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          preview.src = ev.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else if (preview) {
        preview.style.display = 'none';
        preview.src = '';
      }
    });
  }
}

async function validarComprobanteYapePlin(file) {
  const nombreKeyword = /yape|plin|comprobante|pago|voucher|recibo|transferencia|transacci|captura|screenshot|pantalla/i.test(file.name);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = 200, H = 200;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      let morado = 0, cian = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        total++;
        if (a < 128) continue;
        if (b > g && r > g && (b - g) > 30 && b > 110 && r < 230 && g < 160) morado++;
        else if (b > 150 && g > 120 && r < 120 && b > r && g > r) cian++;
      }
      const pctMorado = (morado / total) * 100;
      const pctCian = (cian / total) * 100;
      const hayColorMarca = pctMorado >= 0.3 || pctCian >= 0.3;
      const ratio = img.naturalHeight / img.naturalWidth;
      const esVertical = ratio >= 1.0;
      const esValido = esVertical && (nombreKeyword || hayColorMarca);
      resolve({ esValido, nombreKeyword, hayColorMarca, esVertical, ratio, pctMorado, pctCian });
    };
    img.onerror = () => resolve({ esValido: false, error: true });
    img.src = URL.createObjectURL(file);
  });
}

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
      btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
    }
    const validacion = await validarComprobanteYapePlin(file);
    if (validacion.error) {
      mostrarErrorComprobante('❌ No se pudo leer la imagen. Sube un archivo JPG o PNG válido.');
      btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
    }
    if (!validacion.esValido) {
      mostrarErrorComprobante('❌ Este no es un comprobante válido de Yape o Plin.');
      btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
    }
    formData.append('comprobante', file);
  } else {
    mostrarErrorComprobante('❌ Debes subir un comprobante de pago.');
    btn.textContent = 'Confirmar Compra'; btn.disabled = false; return;
  }
  try {
    const res = await fetch('/api/public/comprar-aleatorio', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('form-compra').classList.add('hidden');
      const resultDiv = document.getElementById('resultado-compra');
      resultDiv.classList.remove('hidden');
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
      let html = `<h3 style="color:var(--tinka-green); margin-bottom: 15px; text-align: center;">🎟️ Resumen de tus Tickets</h3>`;
      html += `<div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px;">`;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">`;
      html += `<div><strong>👤 Cliente:</strong> ${nombres} ${apellidos}</div>`;
      html += `<div><strong>🎟️ Total:</strong> <span style="color:var(--tinka-red); font-size:1.2rem; font-weight:bold;">${data.tickets.length}</span></div>`;
      html += `</div></div>`;
      html += `<div style="border:1px solid #ddd; border-radius:8px; overflow:hidden;">`;
      html += `<table style="width:100%; border-collapse:collapse;">`;
      html += `<thead><tr style="background:var(--tinka-yellow);">`;
      html += `<th style="padding:12px; text-align:left; font-weight:bold;">SORTEO</th>`;
      html += `<th style="padding:12px; text-align:left; font-weight:bold;">FECHA SORTEO</th>`;
      html += `<th style="padding:12px; text-align:left; font-weight:bold;">TUS NÚMEROS</th>`;
      html += `</tr></thead><tbody>`;
      Object.entries(ticketsPorSorteo).forEach(([sorteoId, info]) => {
        const fechaSorteo = info.fechaSorteo ? new Date(info.fechaSorteo).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : 'Por definir';
        const codigosFormateados = info.tickets.map(c => `#${formatearCodigo(c)}`).join(', ');
        html += `<tr style="border-bottom:1px solid #eee;">`;
        html += `<td style="padding:12px; font-weight:bold;">${info.nombre}</td>`;
        html += `<td style="padding:12px;">${fechaSorteo}</td>`;
        html += `<td style="padding:12px; font-family:'Courier New', monospace; font-weight:bold; color:var(--tinka-red);">${codigosFormateados}</td>`;
        html += `</tr>`;
      });
      html += `</tbody></table></div>`;
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

cargarDatos();