// ============================================================
// admin-media.js
// Gestión completa de Carrusel, Banners y Promos Laterales
// Los slots se generan dinámicamente dentro de los contenedores
// ============================================================

let urlsCarrusel = [];
let urlsBanners = [];
let urlsPromos = [];

// ============================================================
// INICIALIZACIÓN (llamada desde admin.js al cargar o cambiar vista)
// ============================================================
function initMedia() {
  if (!globalData) return;

  // Carrusel
  urlsCarrusel = (globalData.carrusel || []).map(c => c.url_imagen || '');
  renderCarrusel();

  // Banners
  urlsBanners = (globalData.banners || []).map(b => b.url_imagen || '');
  renderBanners();

  // Promos
  urlsPromos = (globalData.promos_laterales || []).map(p => ({
    url_imagen: p.url_imagen || '',
    fecha: p.fecha || ''
  }));
  renderPromos();
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

  // Slot vacío al final para agregar más
  container.appendChild(createCarruselSlot(urlsCarrusel.length, ''));
}

function createCarruselSlot(index, url) {
  const slot = document.createElement('div');
  slot.className = 'upload-slot';
  slot.dataset.index = index;
  slot.innerHTML = `
    <div class="file-input-wrapper">
      <label>Imagen ${index + 1}</label>
      <img class="preview-img-dinamica${url ? ' d-block' : ''}"
           data-preview="carrusel-${index}"
           data-url="${url || ''}"
           src="${url || ''}" />
      <input type="file" accept="image/*"
             onchange="subirImagenCarrusel(${index}, this)" />
      ${url ? `<button type="button" class="btn-eliminar-promo"
                onclick="eliminarCarrusel(${index})">🗑️</button>` : ''}
    </div>
  `;
  return slot;
}

async function subirImagenCarrusel(index, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('imagen', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert('❌ Error al subir imagen:\n' + (err.error || 'HTTP ' + res.status));
    }
    const data = await res.json();
    urlsCarrusel[index] = data.url;
    renderCarrusel();
  } catch (e) {
    alert('Error de conexión al subir imagen');
  }
}

function eliminarCarrusel(index) {
  if (!confirm('¿Eliminar esta imagen del carrusel?')) return;
  urlsCarrusel.splice(index, 1);
  renderCarrusel();
}

async function guardarCarrusel() {
  const imagenes = urlsCarrusel
    .filter(url => url && url.trim() !== '')
    .map(url => ({ url_imagen: url.trim() }));

  if (imagenes.length === 0) {
    return alert('⚠️ No hay imágenes para guardar.');
  }

  try {
    const res = await fetch('/api/admin/carrusel', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagenes })
    });
    if (res.ok) {
      alert('✅ Carrusel actualizado correctamente');
      if (typeof cargarDatosGlobales === 'function') await cargarDatosGlobales();
    } else {
      const err = await res.json().catch(() => ({}));
      alert('❌ Error al guardar carrusel:\n' + (err.error || 'HTTP ' + res.status));
    }
  } catch (e) {
    alert('Error de conexión');
  }
}

// ============================================================
// BANNERS IZQUIERDOS
// ============================================================
function renderBanners() {
  const container = document.getElementById('banners-container');
  if (!container) return;
  container.innerHTML = '';

  urlsBanners.forEach((url, i) => {
    container.appendChild(createBannerSlot(i, url));
  });

  // Slot vacío al final
  container.appendChild(createBannerSlot(urlsBanners.length, ''));
}

function createBannerSlot(index, url) {
  const slot = document.createElement('div');
  slot.className = 'upload-slot';
  slot.dataset.index = index;
  slot.innerHTML = `
    <div class="file-input-wrapper">
      <label>Banner ${index + 1}</label>
      <img class="preview-img-dinamica${url ? ' d-block' : ''}"
           data-preview="banner-${index}"
           data-url="${url || ''}"
           src="${url || ''}" />
      <input type="file" accept="image/*"
             onchange="subirImagenBanner(${index}, this)" />
      ${url ? `<button type="button" class="btn-eliminar-promo"
                onclick="eliminarBanner(${index})">🗑️</button>` : ''}
    </div>
  `;
  return slot;
}

async function subirImagenBanner(index, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('imagen', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert('❌ Error al subir banner:\n' + (err.error || 'HTTP ' + res.status));
    }
    const data = await res.json();
    urlsBanners[index] = data.url;
    renderBanners();
  } catch (e) {
    alert('Error de conexión al subir banner');
  }
}

function eliminarBanner(index) {
  if (!confirm('¿Eliminar este banner?')) return;
  urlsBanners.splice(index, 1);
  renderBanners();
}

async function guardarBanners() {
  const banners = urlsBanners
    .filter(url => url && url.trim() !== '')
    .map(url => ({ url_imagen: url.trim() }));

  if (banners.length === 0) {
    return alert('⚠️ No hay banners para guardar.');
  }

  try {
    const res = await fetch('/api/admin/banners', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ banners })
    });
    if (res.ok) {
      alert('✅ Banners guardados correctamente');
      if (typeof cargarDatosGlobales === 'function') await cargarDatosGlobales();
    } else {
      const err = await res.json().catch(() => ({}));
      alert('❌ Error al guardar banners:\n' + (err.error || 'HTTP ' + res.status));
    }
  } catch (e) {
    alert('Error de conexión');
  }
}

// ============================================================
// PROMOS LATERALES (cantidad ilimitada con botón "➕ Agregar Promo")
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
      <img class="preview-img-dinamica${url ? ' d-block' : ''}"
           data-preview="promo-${index}"
           data-url="${url || ''}"
           src="${url || ''}" />
      <input type="file" accept="image/*"
             onchange="subirImagenPromo(${index}, this)" />
      <input type="text" class="input-fecha-promo"
             placeholder="Fecha (ej: 2026-12-31)"
             data-fecha="promo-${index}"
             value="${fecha || ''}" />
      <button type="button" class="btn-eliminar-promo"
              onclick="eliminarPromoSlot(this)">🗑️ Eliminar</button>
    </div>
  `;
  return slot;
}

function agregarPromo() {
  const container = document.getElementById('promos-container');
  if (!container) return;

  const index = urlsPromos.length;
  urlsPromos.push({ url_imagen: '', fecha: '' });
  container.appendChild(createPromoSlot(index, '', ''));
}

function eliminarPromoSlot(btn) {
  if (!confirm('¿Eliminar esta promo?')) return;
  const slot = btn.closest('.upload-slot');
  if (!slot) return;
  const index = parseInt(slot.dataset.index);
  urlsPromos.splice(index, 1);
  renderPromos(); // Re-render para actualizar índices
}

async function subirImagenPromo(index, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('imagen', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert('❌ Error al subir imagen:\n' + (err.error || 'HTTP ' + res.status));
    }
    const data = await res.json();
    if (urlsPromos[index]) {
      urlsPromos[index].url_imagen = data.url;
    }
    renderPromos();
  } catch (e) {
    alert('Error de conexión al subir imagen');
  }
}

async function guardarPromos() {
  const container = document.getElementById('promos-container');
  if (!container) return;

  const slots = container.querySelectorAll('.upload-slot');
  const promos = [];

  slots.forEach((slot) => {
    const preview = slot.querySelector('.preview-img-dinamica');
    const fechaInput = slot.querySelector('.input-fecha-promo');
    const url = preview?.dataset.url || '';
    const fecha = fechaInput?.value || '';

    if (url && url.startsWith('http')) {
      promos.push({ url_imagen: url, fecha });
    }
  });

  if (promos.length === 0) {
    return alert('⚠️ No hay promos con imagen para guardar.');
  }

  try {
    const res = await fetch('/api/admin/promos-laterales', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ promos })
    });
    if (res.ok) {
      alert(`✅ ${promos.length} promo(s) guardada(s) correctamente`);
      if (typeof cargarDatosGlobales === 'function') await cargarDatosGlobales();
    } else {
      const err = await res.json().catch(() => ({}));
      alert('❌ Error al guardar promos:\n' + (err.error || 'HTTP ' + res.status));
    }
  } catch (e) {
    alert('Error de conexión');
  }
}

// Alias para compatibilidad con HTML original (si alguien lo usa)
const guardarPromosLaterales = guardarPromos;