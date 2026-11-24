let adminKey = '';
let globalData = {};

// --- AUTENTICACIÓN ---
function login() {
  const pass = document.getElementById('admin-pass').value;
  const btn = document.getElementById('btn-login');
  const errorMsg = document.getElementById('login-error');
  if (!pass) return alert('Ingresa la contraseña');
  
  btn.textContent = 'Verificando...'; btn.disabled = true; errorMsg.style.display = 'none';
  
  fetch('/api/admin/dashboard', { headers: { 'x-admin-key': pass } })
    .then(res => {
      if (res.ok) {
        adminKey = pass;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'flex';
        cargarDatosGlobales();
      } else {
        errorMsg.style.display = 'block';
        document.getElementById('admin-pass').value = '';
      }
    })
    .catch(() => alert('Error de conexión'))
    .finally(() => { btn.textContent = 'Ingresar al Panel'; btn.disabled = false; });
}

document.getElementById('admin-pass').addEventListener('keypress', function (e) { if (e.key === 'Enter') login(); });

function logout() { 
  adminKey = ''; 
  document.getElementById('admin-pass').value = ''; 
  document.getElementById('login-screen').style.display = 'flex'; 
  document.getElementById('admin-panel').style.display = 'none'; 
  cerrarSidebar(); // ✅ limpiar estado del sidebar al salir
}

// --- NAVEGACIÓN ---
function cambiarVista(viewId, element) {
  document.querySelectorAll('.section-view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');
  element.classList.add('active');
  const titles = { config: 'Configuración', banners: 'Banners y Promos', usuarios: 'Usuarios', sorteos: 'Sorteos', ventas: 'Ventas' };
  document.getElementById('page-title').textContent = titles[viewId];
}

// ✅ NUEVO: Control del sidebar responsivo (drawer en móvil/tablet)
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar.classList.contains('open')) {
    cerrarSidebar();
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // bloquea scroll de fondo
  }
}

function cerrarSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ✅ Cerrar sidebar con tecla ESC
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') cerrarSidebar();
});

// ✅ Al rotar el dispositivo de móvil a PC, cerrar sidebar
window.addEventListener('resize', function() {
  if (window.innerWidth >= 1024) cerrarSidebar();
});

// ✅ Actualiza el sidebar con el nombre y logo REAL de la marca
function actualizarSidebarMarca(brandName, logoUrl) {
  const brandEl = document.getElementById('sidebar-brand');
  const logoEl = document.getElementById('sidebar-logo');
  if (brandEl) brandEl.textContent = brandName || '🎰 Sorteos Pro';
  if (logoEl) {
    if (logoUrl) {
      logoEl.src = logoUrl;
      logoEl.style.display = 'block';
    } else {
      logoEl.src = '';
      logoEl.style.display = 'none';
    }
  }
}

// --- CARGA DE DATOS GLOBALES ---
async function cargarDatosGlobales() {
  const res = await fetch('/api/admin/dashboard', { headers: { 'x-admin-key': adminKey } });
  globalData = await res.json();
  
  console.log('🔧 Config cargada desde BD:', JSON.stringify(globalData.config, null, 2));
  
  // ✅ Actualizar sidebar con datos reales (nombre + logo)
  actualizarSidebarMarca(globalData.config.brand_name, globalData.config.logo_marca);

  // Identidad
  document.getElementById('config-brand').value = globalData.config.brand_name || '';
  document.getElementById('config-footer').value = globalData.config.footer_legal || '';
  
  // ✅ Logo de la marca (persistencia)
  const logoUrl = globalData.config.logo_marca || '';
  const logoPreview = document.getElementById('preview-logo-marca');
  if (logoPreview) {
    if (logoUrl) {
      logoPreview.src = logoUrl;
      logoPreview.classList.add('d-block');
    } else {
      logoPreview.src = '';
      logoPreview.classList.remove('d-block');
    }
  }
  
  // Contacto y Redes
  document.getElementById('config-telefono').value = globalData.config.contacto_telefono || '';
  document.getElementById('config-direccion').value = globalData.config.contacto_direccion || '';
  document.getElementById('config-facebook').value = globalData.config.redes_facebook || '';
  document.getElementById('config-youtube').value = globalData.config.redes_youtube || '';
  document.getElementById('config-tiktok').value = globalData.config.redes_tiktok || '';

  if (globalData.bolas_logos) {
    globalData.bolas_logos.forEach(b => {
      const img = document.getElementById('preview-bola-' + b.posicion);
      if (img) { img.src = b.url_imagen; img.classList.add('d-block'); }
    });
  }

  let htmlUsuarios = globalData.usuarios?.length > 0 ? globalData.usuarios.map(u => `<tr><td>${u.id}</td><td>${u.nombre}</td><td>${u.email}</td><td>${u.dni}</td><td>S/ ${u.saldo.toFixed(2)}</td></tr>`).join('') : `<tr><td colspan="5">No hay usuarios.</td></tr>`;
  document.getElementById('tbody-usuarios').innerHTML = htmlUsuarios;

  let htmlSorteos = ''; let optionsSorteos = '';
  globalData.sorteos.forEach(s => {
    const fechaLimite = s.fecha_sorteo ? new Date(s.fecha_sorteo).toLocaleString() : 'Sin fecha';
    htmlSorteos += `<tr>
      <td>${s.id}</td>
      <td>${s.nombre}</td>
      <td>${s.premio_descripcion || 'Sin premio'}</td>
      <td>S/ ${s.precio_jugada}</td>
      <td>${fechaLimite}</td>
      <td>${s.activo ? 'Activo' : 'Inactivo'}</td>
      <td><button onclick="editarSorteo(${s.id})" class="btn-edit">Editar</button></td>
    </tr>`;
    optionsSorteos += `<option value="${s.id}">${s.nombre} (S/ ${s.precio_jugada})</option>`;
  });
  document.getElementById('tbody-sorteos').innerHTML = htmlSorteos;
  
  const selectSorteo = document.getElementById('venta-sorteo');
  if (selectSorteo) {
    selectSorteo.innerHTML = optionsSorteos;
    selectSorteo.onchange = calcularTotal;
    document.getElementById('venta-cantidad').oninput = calcularTotal;
    calcularTotal();
  }

  if (typeof initVentas === 'function') initVentas();
  if (typeof initMedia === 'function') initMedia();
}

// ✅ Sube el logo de la marca y lo guarda en settings
async function subirLogoMarca() {
  const fileInput = document.getElementById('file-logo-marca');
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('imagen', file);

  try {
    const resUpload = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: formData
    });

    if (!resUpload.ok) {
      const err = await resUpload.json().catch(() => ({}));
      return alert('❌ Error al subir logo:\n' + (err.error || 'HTTP ' + resUpload.status));
    }

    const data = await resUpload.json();
    const url = data.url;
    console.log('📤 Logo subido, URL:', url);

    const preview = document.getElementById('preview-logo-marca');
    if (preview) {
      preview.src = url;
      preview.classList.add('d-block');
    }

    const resSave = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_marca: url })
    });

    if (resSave.ok) {
      alert('✅ Logo de la marca guardado correctamente');
      console.log('✅ logo_marca persistido en BD');
      actualizarSidebarMarca(globalData.config?.brand_name, url);
    } else {
      const err = await resSave.json().catch(() => ({}));
      alert('❌ Error al guardar logo en BD:\n' + (err.error || 'HTTP ' + resSave.status));
      console.error('❌ Error save logo:', err);
    }
  } catch (e) {
    console.error('Error de conexión al subir el logo:', e);
    alert('Error de conexión al subir el logo');
  }
}

// ✅ FUNCIÓN RENOMBRADA para NO colisionar con admin-media.js
async function guardarConfigGlobal() {
  const body = {
    brand_name: document.getElementById('config-brand').value,
    footer_legal: document.getElementById('config-footer').value,
    contacto_telefono: document.getElementById('config-telefono').value,
    contacto_direccion: document.getElementById('config-direccion').value,
    redes_facebook: document.getElementById('config-facebook').value,
    redes_youtube: document.getElementById('config-youtube').value,
    redes_tiktok: document.getElementById('config-tiktok').value
  };
  
  console.log('📤 Enviando a /api/admin/config:', JSON.stringify(body, null, 2));
  
  try {
    const res = await fetch('/api/admin/config', { 
      method: 'POST', 
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    });
    if (res.ok) {
      alert('✅ Configuración, contacto y redes guardados correctamente');
      actualizarSidebarMarca(body.brand_name, globalData.config?.logo_marca);
      await cargarDatosGlobales();
    } else {
      const data = await res.json().catch(() => ({}));
      alert('❌ Error:\n' + (data.error || 'HTTP ' + res.status));
    }
  } catch (e) {
    alert('Error de conexión');
  }
}

async function leerError(res) {
  try {
    const data = await res.json();
    return data.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status} - Error desconocido`;
  }
}

// --- UI HELPERS ---
function showPreview(e, url) {
  const preview = document.getElementById('hover-preview');
  const img = document.getElementById('hover-preview-img');
  if (!preview || !img) return;
  img.src = url;
  preview.style.display = 'block';
  const rect = e.target.getBoundingClientRect();
  preview.style.left = (rect.left - 100) + 'px';
  preview.style.top = (rect.top - 260) + 'px';
}

function hidePreview() {
  const preview = document.getElementById('hover-preview');
  if (preview) preview.style.display = 'none';
}

// --- FUNCIONES DE SORTEOS (modal) ---
function abrirModalSorteo(id) {
  const modal = document.getElementById('modal-sorteo');
  const titulo = document.getElementById('modal-sorteo-titulo');
  const form = document.getElementById('form-sorteo');
  
  if (id) {
    const sorteo = globalData.sorteos.find(s => s.id === id);
    if (!sorteo) return;
    titulo.textContent = 'Editar Sorteo';
    document.getElementById('sorteo-id').value = sorteo.id;
    document.getElementById('sorteo-nombre').value = sorteo.nombre || '';
    document.getElementById('sorteo-subtitulo').value = sorteo.subtitulo || '';
    document.getElementById('sorteo-premio').value = sorteo.premio_descripcion || '';
    document.getElementById('sorteo-precio').value = sorteo.precio_jugada || '';
    document.getElementById('sorteo-fecha').value = sorteo.fecha_sorteo ? sorteo.fecha_sorteo.split('T')[0] : '';
    document.getElementById('sorteo-hora').value = sorteo.hora_sorteo || '';
    document.getElementById('sorteo-activo').value = sorteo.activo !== undefined ? String(sorteo.activo) : '1';
    if (sorteo.imagen) {
      document.getElementById('sorteo-imagen-url').value = sorteo.imagen;
      const prev = document.getElementById('preview-sorteo');
      if (prev) { prev.src = sorteo.imagen; prev.classList.add('d-block'); }
    }
    if (sorteo.banner_lateral) {
      document.getElementById('sorteo-banner-url').value = sorteo.banner_lateral;
      const prev = document.getElementById('preview-banner');
      if (prev) { prev.src = sorteo.banner_lateral; prev.classList.add('d-block'); }
    }
  } else {
    titulo.textContent = 'Crear Sorteo';
    form.reset();
    document.getElementById('sorteo-id').value = '';
    document.getElementById('sorteo-imagen-url').value = '';
    document.getElementById('sorteo-banner-url').value = '';
    const prev1 = document.getElementById('preview-sorteo');
    const prev2 = document.getElementById('preview-banner');
    if (prev1) { prev1.src = ''; prev1.classList.remove('d-block'); }
    if (prev2) { prev2.src = ''; prev2.classList.remove('d-block'); }
  }
  
  modal.classList.remove('hidden');
}

function cerrarModalSorteo() {
  document.getElementById('modal-sorteo').classList.add('hidden');
}

function editarSorteo(id) {
  abrirModalSorteo(id);
}

async function subirImagenSorteo(tipo) {
  const fileInput = document.getElementById(tipo === 'imagen' ? 'sorteo-imagen' : 'sorteo-banner');
  const urlInput = document.getElementById(tipo === 'imagen' ? 'sorteo-imagen-url' : 'sorteo-banner-url');
  const previewId = tipo === 'imagen' ? 'preview-sorteo' : 'preview-banner';
  
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
    urlInput.value = data.url;
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.src = data.url;
      preview.classList.add('d-block');
    }
  } catch (e) {
    alert('Error de conexión al subir imagen');
  }
}

async function guardarSorteo(e) {
  e.preventDefault();
  
  const body = {
    id: document.getElementById('sorteo-id').value || undefined,
    nombre: document.getElementById('sorteo-nombre').value,
    slug: document.getElementById('sorteo-nombre').value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    subtitulo: document.getElementById('sorteo-subtitulo').value,
    premio_descripcion: document.getElementById('sorteo-premio').value,
    precio_jugada: Number(document.getElementById('sorteo-precio').value),
    fecha_sorteo: document.getElementById('sorteo-fecha').value,
    hora_sorteo: document.getElementById('sorteo-hora').value,
    imagen: document.getElementById('sorteo-imagen-url').value || null,
    banner_lateral: document.getElementById('sorteo-banner-url').value || null,
    activo: Number(document.getElementById('sorteo-activo').value)
  };

  try {
    const res = await fetch('/api/admin/sorteos', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      alert('✅ Sorteo guardado correctamente');
      cerrarModalSorteo();
      await cargarDatosGlobales();
    } else {
      const err = await res.json().catch(() => ({}));
      alert('❌ Error al guardar sorteo:\n' + (err.error || 'HTTP ' + res.status));
    }
  } catch (e) {
    alert('Error de conexión al guardar sorteo');
  }
}

// --- FUNCIONES DE VENTAS ---
function calcularTotal() {
  const sorteoId = Number(document.getElementById('venta-sorteo').value);
  const cant = Number(document.getElementById('venta-cantidad').value) || 1;
  const sorteo = globalData.sorteos?.find(s => s.id === sorteoId);
  const precio = sorteo ? sorteo.precio_jugada : 0;
  const totalEl = document.getElementById('venta-total');
  if (totalEl) totalEl.value = `S/ ${(precio * cant).toFixed(2)}`;
}

// initVentas e initMedia son llamadas desde cargarDatosGlobales pero definidas en otros archivos
// (admin-ventas.js y admin-media.js respectivamente)