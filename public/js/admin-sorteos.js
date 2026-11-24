function abrirModalSorteo() {
  document.getElementById('form-sorteo').reset();
  document.getElementById('sorteo-id').value = '';
  document.getElementById('sorteo-imagen-url').value = '';
  document.getElementById('sorteo-banner-url').value = '';
  document.getElementById('sorteo-imagen').value = '';
  document.getElementById('sorteo-banner').value = '';
  document.getElementById('preview-sorteo').classList.remove('d-block');
  document.getElementById('preview-banner').classList.remove('d-block');
  document.getElementById('modal-sorteo-titulo').textContent = 'Crear Sorteo';
  document.getElementById('modal-sorteo').classList.remove('hidden');
}

function cerrarModalSorteo() {
  document.getElementById('modal-sorteo').classList.add('hidden');
}

function editarSorteo(id) {
  const sorteo = globalData.sorteos.find(s => s.id === id);
  if (!sorteo) return;
  
  document.getElementById('sorteo-id').value = sorteo.id;
  document.getElementById('sorteo-nombre').value = sorteo.nombre;
  document.getElementById('sorteo-subtitulo').value = sorteo.subtitulo || '';
  document.getElementById('sorteo-premio').value = sorteo.premio_descripcion || '';
  document.getElementById('sorteo-precio').value = sorteo.precio_jugada;
  document.getElementById('sorteo-fecha').value = sorteo.fecha_sorteo ? sorteo.fecha_sorteo.split('T')[0] : '';
  document.getElementById('sorteo-hora').value = sorteo.hora_sorteo || '';
  document.getElementById('sorteo-activo').value = sorteo.activo;
  document.getElementById('sorteo-imagen-url').value = sorteo.imagen || '';
  document.getElementById('sorteo-banner-url').value = sorteo.banner_lateral || '';
  
  if (sorteo.imagen) {
    const preview = document.getElementById('preview-sorteo');
    preview.src = sorteo.imagen;
    preview.classList.add('d-block');
  } else {
    document.getElementById('preview-sorteo').classList.remove('d-block');
  }

  if (sorteo.banner_lateral) {
    const preview = document.getElementById('preview-banner');
    preview.src = sorteo.banner_lateral;
    preview.classList.add('d-block');
  } else {
    document.getElementById('preview-banner').classList.remove('d-block');
  }

  document.getElementById('modal-sorteo-titulo').textContent = 'Editar Sorteo';
  document.getElementById('modal-sorteo').classList.remove('hidden');
}

async function subirImagenSorteo(tipo) {
  const fileId = tipo === 'imagen' ? 'sorteo-imagen' : 'sorteo-banner';
  const urlId = tipo === 'imagen' ? 'sorteo-imagen-url' : 'sorteo-banner-url';
  const previewId = tipo === 'imagen' ? 'preview-sorteo' : 'preview-banner';
  
  const file = document.getElementById(fileId).files[0];
  if (!file) return;
  const formData = new FormData(); 
  formData.append('imagen', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      document.getElementById(urlId).value = data.url;
      const preview = document.getElementById(previewId);
      preview.src = data.url; 
      preview.classList.add('d-block');
    } else {
      let errorMsg = 'Error desconocido';
      try { const errData = await res.json(); errorMsg = errData.error; } catch {}
      alert(`❌ Error al subir imagen:\n${errorMsg}`);
    }
  } catch (e) { 
    alert('Error de conexión'); 
    console.error(e);
  }
}

async function guardarSorteo(e) {
  e.preventDefault();
  const id = document.getElementById('sorteo-id').value;
  const nombre = document.getElementById('sorteo-nombre').value;
  
  let slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  if (!id) {
    slug = slug + '-' + Date.now();
  } else {
    const sorteoOriginal = globalData.sorteos.find(s => s.id == id);
    if (sorteoOriginal && sorteoOriginal.slug) slug = sorteoOriginal.slug; 
  }
  
  const fecha = document.getElementById('sorteo-fecha').value;
  const hora = document.getElementById('sorteo-hora').value;
  const fechaSorteo = (fecha && hora) ? `${fecha}T${hora}:00.000Z` : null; 

  const body = {
    id: id ? Number(id) : undefined,
    nombre,
    slug,
    subtitulo: document.getElementById('sorteo-subtitulo').value,
    premio_descripcion: document.getElementById('sorteo-premio').value,
    precio_jugada: Number(document.getElementById('sorteo-precio').value),
    activo: Number(document.getElementById('sorteo-activo').value),
    imagen: document.getElementById('sorteo-imagen-url').value,
    banner_lateral: document.getElementById('sorteo-banner-url').value,
    fecha_sorteo: fechaSorteo,
    hora_sorteo: hora || null,
    min_bolillas: 6,
    max_numero: 51,
    moneda: 'S/'
  };

  try {
    const res = await fetch('/api/admin/sorteos', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      alert('✅ Sorteo guardado');
      cerrarModalSorteo();
      cargarDatosGlobales();
    } else {
      const errorData = await res.json();
      alert('❌ Error al guardar:\n' + (errorData.error || 'Error desconocido'));
    }
  } catch (err) {
    alert('❌ Error de conexión');
  }
}