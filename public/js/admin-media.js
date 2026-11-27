// ============================================================
// admin-media.js
// Gestión de Carrusel, Banners y Promos Laterales
// Genera slots dinámicamente al cargar
// ============================================================

let urlsCarrusel = [];
let urlsBanners = [];
let urlsPromos = [];
let carruselCount = 0;
let bannerCount = 0;
let promoCount = 0;

function initMedia() {
  // Generar slots de bolas (8 fijos)
  generarSlotsBolas();

  // Cargar y generar slots de carrusel
  urlsCarrusel = (globalData.carrusel || []).map(c => c.url_imagen || '');
  carruselCount = urlsCarrusel.length;
  renderCarrusel();

  // Cargar y generar slots de banners
  urlsBanners = (globalData.banners || []).map(b => b.url_imagen || '');
  bannerCount = urlsBanners.length;
  renderBanners();

  // Cargar y generar slots de promos
  urlsPromos = (globalData.promos_laterales || []).map(p => ({
    url_imagen: p.url_imagen || '',
    fecha: p.fecha || ''
  }));
  promoCount = urlsPromos.length;
  renderPromos();
}

// ============================================================
// BOLAS (8 slots fijos)
// ============================================================
function generarSlotsBolas() {
  const container = document.getElementById('bolas-container');
  if (!container || container.children.length > 0) return; // Ya generados

  for (let i = 1; i <= 8; i++) {
    const slot = document.createElement('div');
    slot.className = 'upload-slot';
    slot.innerHTML = `
      <div class="file-input-wrapper">
        <label>Bola ${i}</label>
        <img id="preview-bola-${i}" class="preview-img-dinamica" />
        <input type="file" id="file-bola-${i}" accept="image/*" onchange="subirLogoBola(${i})" />
      </div>
    `;
    container.appendChild(slot);
  }
}

// ============================================================
// CARRUSEL
// ============================================================
function renderCarrusel() {
  const container = document.getElementById('carrusel-container');
  if (!container) return;
  container.innerHTML = '';

  urlsCarrusel.forEach((url, i) => {
    container.appendChild(createCarruselSlot(i, url));
  });

  // Slot vacío para agregar más
  container.appendChild(createCarruselSlot(carruselCount++, ''));
}

function createCarruselSlot(index, url) {
  const slot = document.createElement('div');
  slot.className = 'upload-slot';
  slot.dataset.index = index;
  slot.innerHTML = `
    <div class="file-input-wrapper">
      <label>Imagen ${index + 1}</label>
      <img id="preview-${index}" class="preview-img-dinamica${url ? ' d-block' : ''}" src="${url || ''}" />
      <input type="file" id="file-${index}" accept="image/*" onchange="subirImagen(${index})" />
      ${url ? `<button type="button" class="btn-eliminar-slot" onclick="eliminarCarrusel(${index})">🗑️</button>` : ''}
    </div>
  `;
  return slot;
}

async function subirImagen(index) {
  const file = document.getElementById('file-' + index).files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('imagen', file);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      urlsCarrusel[index] = data.url;
      renderCarrusel();
    } else {
      alert(`❌ Error al subir imagen:\n${await leerError(res)}`);
    }
  } catch (e) {
    alert('Error de conexión con el servidor');
  }
}

function eliminarCarrusel(index) {
  if (!confirm('¿Eliminar esta imagen del carrusel?')) return;
  urlsCarrusel.splice(index, 1);
  renderCarrusel();
}

function agregarSlotCarrusel() {
  urlsCarrusel.push('');
  renderCarrusel();
}

async function guardarCarrusel() {
  const imagenes = urlsCarrusel.filter(url => url !== '').map(url => ({ url_imagen: url }));
  try {
    const res = await fetch('/api/admin/carrusel', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagenes })
    });
    if (res.ok) alert('✅ Carrusel actualizado');
    else alert('❌ Error al guardar carrusel:\n' + await leerError(res));
  } catch (e) {
    alert('Error de conexión');
  }
}

// ============================================================
// BANNERS
// ============================================================
function renderBanners() {
  const container = document.getElementById('banners-container');
  if (!container) return;
  container.innerHTML = '';

  urlsBanners.forEach((url, i) => {
    container.appendChild(createBannerSlot(i, url));
  });

  // Slot vacío para agregar más
  container.appendChild(createBannerSlot(bannerCount++, ''));
}

function createBannerSlot(index, url) {
  const slot = document.createElement('div');
  slot.className = 'upload-slot';
  slot.dataset.index = index;
  slot.innerHTML = `
    <div class="file-input-wrapper">
      <label>Banner ${index + 1}</label>
      <img id="preview-banner-${index + 1}" class="preview-img-dinamica${url ? ' d-block' : ''}" src="${url || ''}" />
      <input type="file" id="file-banner-${index + 1}" accept="image/*" onchange="subirBanner(${index + 1})" />
      ${url ? `<button type="button" class="btn-eliminar-slot" onclick="eliminarBanner(${index})">🗑️</button>` : ''}
    </div>
  `;
  return slot;
}

async function subirBanner(index) {
  const file = document.getElementById('file-banner-' + index).files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('imagen', file);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      urlsBanners[index - 1] = data.url;
      renderBanners();
    } else {
      alert(`❌ Error al subir banner:\n${await leerError(res)}`);
    }
  } catch (e) {
    alert('Error de conexión');
  }
}

function eliminarBanner(index) {
  if (!confirm('¿Eliminar este banner?')) return;
  urlsBanners.splice(index, 1);
  renderBanners();
}

function agregarSlotBanner() {
  urlsBanners.push('');
  renderBanners();
}

async function guardarBanners() {
  const banners = urlsBanners.filter(url => url !== '').map(url => ({ url_imagen: url }));
  try {
    const res = await fetch('/api/admin/banners', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ banners })
    });
    if (res.ok) alert('✅ Banners guardados');
    else alert('❌ Error al guardar banners:\n' + await leerError(res));
  } catch (e) {
    alert('Error de conexión');
  }
}

// ============================================================
// PROMOS LATERALES
// ============================================================
function renderPromos() {
  const container = document.getElementById('promos-container');
  if (!container) return;
  container.innerHTML = '';

  urlsPromos.forEach((promo, i) => {
    container.appendChild(createPromoSlot(i, promo.url_imagen, promo.fecha));
  });
}

function createPromoSlot(index, url, fecha) {
  const slot = document.createElement('div');
  slot.className = 'upload-slot';
  slot.dataset.index = index;
  slot.innerHTML = `
    <div class="file-input-wrapper">
      <label>Promo ${index + 1}</label>
      <img id="preview-promo-${index + 1}" class="preview-img-dinamica${url ? ' d-block' : ''}" src="${url || ''}" />
      <input type="file" id="file-promo-${index + 1}" accept="image/*" onchange="subirPromo(${index + 1})" />
      <input type="text" id="fecha-promo-${index + 1}" class="input-fecha-promo" placeholder="Fecha (ej: 2026-12-31)" value="${fecha || ''}" />
      <button type="button" class="btn-eliminar-slot" onclick="eliminarPromo(${index})">🗑️ Eliminar</button>
    </div>
  `;
  return slot;
}

async function subirPromo(index) {
  const file = document.getElementById('file-promo-' + index).files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('imagen', file);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      urlsPromos[index - 1].url_imagen = data.url;
      renderPromos();
    } else {
      alert(`❌ Error al subir promo:\n${await leerError(res)}`);
    }
  } catch (e) {
    alert('Error de conexión');
  }
}

function eliminarPromo(index) {
  if (!confirm('¿Eliminar esta promo?')) return;
  urlsPromos.splice(index, 1);
  renderPromos();
}

function agregarSlotPromo() {
  urlsPromos.push({ url_imagen: '', fecha: '' });
  renderPromos();
}

async function guardarPromosLaterales() {
  const promos = urlsPromos
    .filter(p => p.url_imagen && p.url_imagen !== '')
    .map((p, i) => ({
      url_imagen: p.url_imagen,
      fecha: document.getElementById('fecha-promo-' + (i + 1))?.value || ''
    }));

  if (promos.length === 0) {
    return alert('⚠️ No hay promos con imagen para guardar.');
  }

  try {
    const res = await fetch('/api/admin/promos-laterales', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ promos })
    });
    if (res.ok) alert('✅ Promos guardadas');
    else alert('❌ Error al guardar promos:\n' + await leerError(res));
  } catch (e) {
    alert('Error de conexión');
  }
}

// ============================================================
// UTILS
// ============================================================
async function leerError(res) {
  try {
    const data = await res.json();
    return data.error || `HTTP ${res.status}`;
  } catch {
    try {
      const text = await res.text();
      return text || `HTTP ${res.status} - ${res.statusText}`;
    } catch {
      return `HTTP ${res.status} - Error desconocido`;
    }
  }
}