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
  cerrarSidebar();
}

// --- NAVEGACIÓN ---
function cambiarVista(viewId, element) {
  document.querySelectorAll('.section-view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');
  element.classList.add('active');
  const titles = {
    config: 'Configuración',
    banners: 'Banners y Promos',
    usuarios: 'Usuarios',
    sorteos: 'Sorteos',
    ventas: 'Ventas',
    'revision-manual': '📋 Revisión Manual'
  };
  document.getElementById('page-title').textContent = titles[viewId] || viewId;

  // ✅ Si cambiamos a banners, reinicializar media por si acaso
  if (viewId === 'banners' && typeof initMedia === 'function') {
    setTimeout(() => initMedia(), 100);
  }

  // ✅ Si cambiamos a revisión manual, cargar datos
  if (viewId === 'revision-manual') {
    cargarRevisionManual();
  }

  cerrarSidebar();
}

// ✅ Control del sidebar responsivo
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar.classList.contains('open')) {
    cerrarSidebar();
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function cerrarSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') cerrarSidebar();
});

window.addEventListener('resize', function() {
  if (window.innerWidth >= 1024) cerrarSidebar();
});

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

  actualizarSidebarMarca(globalData.config.brand_name, globalData.config.logo_marca);

  // Identidad
  document.getElementById('config-brand').value = globalData.config.brand_name || '';
  document.getElementById('config-footer').value = globalData.config.footer_legal || '';

  // Logo de la marca
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

  let htmlUsuarios = globalData.usuarios?.length > 0
    ? globalData.usuarios.map(u => `<tr><td>${u.id}</td><td>${u.nombre}</td><td>${u.email}</td><td>${u.dni}</td><td>S/ ${u.saldo.toFixed(2)}</td></tr>`).join('')
    : `<tr><td colspan="5">No hay usuarios.</td></tr>`;
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

  // ✅ Cargar contador de revisión manual
  cargarContadorRevisionManual();
}

// ✅ NUEVO: Cargar contador de pagos en revisión manual
async function cargarContadorRevisionManual() {
  try {
    const res = await fetch('/api/admin/pagos/revision-manual/contador', {
      headers: { 'x-admin-key': adminKey }
    });
    if (!res.ok) return;
    const data = await res.json();
    const badge = document.getElementById('badge-revision');
    if (badge) {
      if (data.count > 0) {
        badge.textContent = data.count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Error cargando contador revisión manual:', e);
  }
}

// ✅ NUEVO: Cargar lista de pagos en revisión manual
async function cargarRevisionManual() {
  const tbody = document.getElementById('tbody-revision-manual');
  const emptyState = document.getElementById('revision-empty');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="10">Cargando...</td></tr>';
  if (emptyState) emptyState.style.display = 'none';

  try {
    const res = await fetch('/api/admin/pagos/revision-manual', {
      headers: { 'x-admin-key': adminKey }
    });
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="10">Error al cargar datos</td></tr>';
      return;
    }
    const data = await res.json();
    const pagos = data.pagos || [];

    if (pagos.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    tbody.innerHTML = pagos.map(p => {
      const fecha = p.creado_en ? new Date(p.creado_en).toLocaleString() : '-';
      const capturaHtml = p.captura_url
        ? `<button onclick="verCaptura('${p.token}', '${p.cliente_nombre}', '${p.cliente_dni}', ${p.monto_unico}, '${p.codigo_cliente_3d || ''}', '${p.captura_url}')" class="btn-edit">📸 Ver</button>`
        : '-';
      const codigo3d = p.codigo_cliente_3d || '-';
      const sorteoNombre = getSorteoNombre(p.sorteo_id);

      return `<tr>
        <td><code>${p.token.slice(0, 8)}...</code></td>
        <td>${p.cliente_dni || '-'}</td>
        <td>${p.cliente_nombre || '-'}</td>
        <td>${p.cliente_telefono || '-'}</td>
        <td>${sorteoNombre}</td>
        <td><strong>S/ ${Number(p.monto_unico).toFixed(2)}</strong></td>
        <td><code>${codigo3d}</code></td>
        <td>${capturaHtml}</td>
        <td>${fecha}</td>
        <td>
          <button onclick="aprobarPago('${p.token}')" class="btn-edit" style="background:#007B4B; color:white;">✅</button>
          <button onclick="rechazarPago('${p.token}')" class="btn-edit" style="background:#D31145; color:white;">❌</button>
        </td>
      </tr>`;
    }).join('');

    cargarContadorRevisionManual();
  } catch (e) {
    console.error('Error cargando revisión manual:', e);
    tbody.innerHTML = '<tr><td colspan="10">Error de conexión</td></tr>';
  }
}

function getSorteoNombre(sorteoId) {
  const sorteo = globalData.sorteos?.find(s => s.id === sorteoId);
  return sorteo ? sorteo.nombre : `Sorteo #${sorteoId}`;
}

function verCaptura(token, cliente, dni, monto, codigo3d, capturaUrl) {
  document.getElementById('captura-img').src = capturaUrl;
  document.getElementById('captura-cliente').textContent = cliente || '-';
  document.getElementById('captura-dni').textContent = dni || '-';
  document.getElementById('captura-monto').textContent = `S/ ${Number(monto).toFixed(2)}`;
  document.getElementById('captura-codigo').textContent = codigo3d || '-';

  document.getElementById('btn-aprobar-captura').onclick = () => {
    aprobarPago(token);
    cerrarModalCaptura();
  };
  document.getElementById('btn-rechazar-captura').onclick = () => {
    rechazarPago(token);
    cerrarModalCaptura();
  };

  document.getElementById('modal-captura').classList.remove('hidden');
}

function cerrarModalCaptura() {
  document.getElementById('modal-captura').classList.add('hidden');
}

async function aprobarPago(token) {
  if (!confirm('¿Confirmar aprobación de este pago? Se generarán los tickets.')) return;

  try {
    const res = await fetch(`/api/admin/pagos/${token}/aprobar`, {
      method: 'POST',
      headers: {
        'x-admin-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ operador: 'admin' })
    });

    if (res.ok) {
      alert('✅ Pago aprobado correctamente. Tickets generados.');
      cargarRevisionManual();
      await cargarDatosGlobales();
    } else {
      const err = await res.json().catch(() => ({}));
      alert('❌ Error: ' + (err.error || 'No se pudo aprobar'));
    }
  } catch (e) {
    console.error('Error aprobando pago:', e);
    alert('Error de conexión');
  }
}

async function rechazarPago(token) {
  const motivo = prompt('Motivo del rechazo (opcional):');
  if (motivo === null) return;

  try {
    const res = await fetch(`/api/admin/pagos/${token}/rechazar`, {
      method: 'POST',
      headers: {
        'x-admin-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ operador: 'admin', motivo: motivo || 'Rechazado por operador' })
    });

    if (res.ok) {
      alert('❌ Pago rechazado. Números liberados.');
      cargarRevisionManual();
    } else {
      const err = await res.json().catch(() => ({}));
      alert('❌ Error: ' + (err.error || 'No se pudo rechazar'));
    }
  } catch (e) {
    console.error('Error rechazando pago:', e);
    alert('Error de conexión');
  }
}

// ✅ NUEVO: Agregar promo dinámicamente
function agregarPromo() {
  const container = document.getElementById('promos-container');
  if (!container) return;

  const index = container.children.length;
  const slot = document.createElement('div');
  slot.className = 'upload-slot';
  slot.dataset.promoIndex = index;
  slot.innerHTML = `
    <div class="file-input-wrapper">
      <label>Promo ${index + 1}</label>
      <img class="preview-img-dinamica" data-preview="promo-${index}" />
      <input type="file" accept="image/*" onchange="subirImagenPromo(${index}, this)" />
      <input type="text" class="input-fecha-promo" placeholder="Fecha (ej: 2026-12-31)" data-fecha="promo-${index}" />
      <button class="btn-eliminar-promo" onclick="eliminarPromo(this)">🗑️ Eliminar</button>
    </div>
  `;
  container.appendChild(slot);
}

// ✅ NUEVO: Eliminar promo
function eliminarPromo(btn) {
  if (!confirm('¿Eliminar esta promo?')) return;
  const slot = btn.closest('.upload-slot');
  if (slot) slot.remove();
}

// ✅ NUEVO: Subir imagen de promo
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
    const preview = document.querySelector(`[data-preview="promo-${index}"]`);
    if (preview) {
      preview.src = data.url;
      preview.classList.add('d-block');
      preview.dataset.url = data.url;
    }
  } catch (e) {
    alert('Error de conexión al subir imagen');
  }
}

// ✅ NUEVO: Guardar promos (recoge todas las promos del contenedor)
async function guardarPromos() {
  const container = document.getElementById('promos-container');
  if (!container) return;

  const slots = container.querySelectorAll('.upload-slot');
  const promos = [];

  slots.forEach((slot, index) => {
    const preview = slot.querySelector(`[data-preview="promo-${index}"]`);
    const fechaInput = slot.querySelector(`[data-fecha="promo-${index}"]`);
    const url = preview?.dataset.url || preview?.src || '';
    const fecha = fechaInput?.value || '';

    if (url) {
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
      alert(`✅ ${promos.length} promo(s) guardada(s) correctamente.`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert('❌ Error:\n' + (err.error || 'HTTP ' + res.status));
    }
  } catch (e) {
    alert('Error de conexión');
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

// --- LOGO MARCA ---
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

// --- CONFIG GLOBAL ---
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