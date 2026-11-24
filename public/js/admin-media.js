let urlsCarrusel = ['', '', '', '', ''];
let urlsBanners = ['', '', '', '', ''];
let urlsPromos = ['', '', '', '', ''];

function initMedia() {
  if (globalData.banners) {
    globalData.banners.forEach((b, i) => {
      if (i < 5) {
        urlsBanners[i] = b.url_imagen;
        const img = document.getElementById('preview-banner-' + (i+1));
        if (img) { img.src = b.url_imagen; img.classList.add('d-block'); }
      }
    });
  }
  if (globalData.promos_laterales) {
    globalData.promos_laterales.forEach((p, i) => {
      if (i < 5) {
        urlsPromos[i] = p.url_imagen;
        const img = document.getElementById('preview-promo-' + (i+1));
        const fecha = document.getElementById('fecha-promo-' + (i+1));
        if (img) { img.src = p.url_imagen; img.classList.add('d-block'); }
        if (fecha) { fecha.value = p.fecha; }
      }
    });
  }
  for (let i = 0; i < 5; i++) {
    const url = globalData.carrusel?.[i]?.url_imagen || '';
    urlsCarrusel[i] = url;
    actualizarPreview(i, url);
  }
}

function actualizarPreview(index, url) {
  const img = document.getElementById('preview-' + index);
  if (url) { 
    img.src = url; 
    img.classList.add('d-block'); 
  } else { 
    img.src = ''; 
    img.classList.remove('d-block'); 
  }
}

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
      actualizarPreview(index, data.url); 
    } else {
      alert(`❌ Error al subir imagen:\n${await leerError(res)}`);
    }
  } catch (e) { 
    alert('Error de conexión con el servidor'); 
  }
}

async function subirLogoBola(posicion) {
  const file = document.getElementById('file-bola-' + posicion).files[0];
  if (!file) return;
  const formData = new FormData(); 
  formData.append('imagen', file);
  try {
    const resUpload = await fetch('/api/upload', { 
      method: 'POST', 
      headers: { 'x-admin-key': adminKey },
      body: formData 
    });
    if (resUpload.ok) {
      const data = await resUpload.json();
      const resSave = await fetch('/api/admin/bolas', {
        method: 'POST', 
        headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ posicion, url_imagen: data.url })
      });
      if (resSave.ok) {
        const img = document.getElementById('preview-bola-' + posicion);
        img.src = data.url; 
        img.classList.add('d-block');
        alert('✅ Logo guardado');
      } else {
        alert(`Error al guardar en BD: ${await leerError(resSave)}`);
      }
    } else {
      alert(`❌ Error al subir archivo:\n${await leerError(resUpload)}`);
    }
  } catch (e) { 
    alert('Error de conexión'); 
  }
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
      urlsBanners[index-1] = data.url; 
      const img = document.getElementById('preview-banner-' + index); 
      img.src = data.url; 
      img.classList.add('d-block'); 
    } else {
      alert(`❌ Error al subir banner:\n${await leerError(res)}`);
    }
  } catch (e) { 
    alert('Error de conexión'); 
  }
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
      urlsPromos[index-1] = data.url; 
      const img = document.getElementById('preview-promo-' + index); 
      img.src = data.url; 
      img.classList.add('d-block'); 
    } else {
      alert(`❌ Error al subir promo:\n${await leerError(res)}`);
    }
  } catch (e) { 
    alert('Error de conexión'); 
  }
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

async function guardarConfig() {
  const body = { brand_name: document.getElementById('config-brand').value, footer_legal: document.getElementById('config-footer').value };
  try {
    const res = await fetch('/api/admin/config', { 
      method: 'POST', 
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    });
    if (res.ok) alert('✅ Configuración guardada');
    else alert('❌ Error:\n' + await leerError(res));
  } catch (e) {
    alert('Error de conexión');
  }
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

async function guardarPromosLaterales() {
  const promos = [];
  for (let i = 1; i <= 5; i++) {
    const url = urlsPromos[i-1];
    const fecha = document.getElementById('fecha-promo-' + i).value || '';
    if (url) promos.push({ url_imagen: url, fecha });
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