const state = { bootstrap: null, carruselIndex: 0, carruselTimer: null, sorteosTimer: null };

async function cargarBootstrap() {
  try {
    const res = await fetch('/api/public/bootstrap?t=' + Date.now());
    state.bootstrap = await res.json();
    inicializarHeaderYFooter();
    inicializarCarrusel();
    inicializarBolas();
    inicializarSorteos();
  } catch (e) {
    console.error('Error al cargar datos:', e);
  }
}

function inicializarHeaderYFooter() {
  const config = state.bootstrap.config || {};
  console.log('🔧 Config recibida del backend:', JSON.stringify(config, null, 2));
  
  const brandName = config.brand_name || 'Sorteos Pro';
  const brandEl = document.getElementById('header-brand-name');
  if (brandEl) brandEl.textContent = brandName;
  document.title = brandName;
  
  const logoUrl = (config.logo_marca || '').trim();
  const logoContainer = document.getElementById('header-logo-container');
  if (logoContainer) {
    if (logoUrl) {
      logoContainer.innerHTML = `<img src="${logoUrl}" alt="${brandName}" class="brand-logo-img">`;
      logoContainer.classList.remove('brand-logo-emoji');
    } else {
      logoContainer.innerHTML = '<span class="brand-logo-emoji-text">🦋</span>';
      logoContainer.classList.add('brand-logo-emoji');
    }
  }
  
  const direccion = (config.contacto_direccion || '').trim();
  const dirContainer = document.getElementById('header-direccion-container');
  const dirEl = document.getElementById('header-direccion');
  if (direccion && dirContainer && dirEl) {
    dirEl.textContent = direccion;
    dirContainer.style.display = 'flex';
  } else if (dirContainer) {
    dirContainer.style.display = 'none';
  }
  
  const telefono = (config.contacto_telefono || '').trim();
  const telContainer = document.getElementById('header-telefono-container');
  const telEl = document.getElementById('header-telefono');
  if (telefono && telContainer && telEl) {
    telEl.textContent = telefono;
    telContainer.style.display = 'flex';
  } else if (telContainer) {
    telContainer.style.display = 'none';
  }
  
  const footerLegal = config.footer_legal;
  const footerLegalEl = document.getElementById('footer-legal-text');
  if (footerLegal && footerLegalEl) {
    footerLegalEl.textContent = footerLegal;
  }
  
  const socialContainer = document.getElementById('social-links');
  if (socialContainer) {
    socialContainer.innerHTML = '';
    const redes = [
      { key: 'redes_facebook', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>', label: 'Facebook' },
      { key: 'redes_youtube', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.12 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>', label: 'YouTube' },
      { key: 'redes_tiktok', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67 .41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>', label: 'TikTok' }
    ];
    let hasSocial = false;
    redes.forEach(red => {
      let url = (config[red.key] || '').trim();
      if (url) {
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
        hasSocial = true;
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.className = 'social-icon'; a.title = red.label; a.innerHTML = red.icon;
        socialContainer.appendChild(a);
      }
    });
    socialContainer.style.display = hasSocial ? 'flex' : 'none';
  }
}

function inicializarCarrusel() {
  const container = document.getElementById('carrusel-container');
  const imagenes = state.bootstrap.carrusel || [];
  if (imagenes.length === 0) {
    container.innerHTML = '<div style="color: #666; font-size: 1.2rem;">Carrusel vacío.</div>';
    return;
  }
  container.innerHTML = imagenes.map((img, i) =>
    `<img src="${img.url_imagen}" class="carrusel-img ${i === 0 ? 'active' : ''}" alt="Promo">`
  ).join('');
  const slides = container.querySelectorAll('.carrusel-img');
  if (slides.length > 1) {
    if(state.carruselTimer) clearInterval(state.carruselTimer);
    state.carruselTimer = setInterval(() => {
      slides[state.carruselIndex].classList.remove('active');
      state.carruselIndex = (state.carruselIndex + 1) % slides.length;
      slides[state.carruselIndex].classList.add('active');
    }, 4000);
  }
}

function inicializarBolas() {
  const logos = state.bootstrap.bolas_logos || [];
  for (let i = 1; i <= 8; i++) {
    const bolaDiv = document.getElementById('bola-' + i);
    if (!bolaDiv) continue;
    const logoGuardado = logos.find(l => Number(l.posicion) === i);
    if (logoGuardado && logoGuardado.url_imagen) {
      bolaDiv.innerHTML = `<img src="${logoGuardado.url_imagen}" alt="Logo ${i}">`;
    } else {
      bolaDiv.innerHTML = `<span style="font-size: 10px; color: #999;">Sin logo</span>`;
    }
  }
}

function inicializarSorteos() {
  const contenedor = document.getElementById('lista-sorteos') || document.querySelector('.contenedor-sorteos');
  if (!contenedor) return;
  const sorteos = state.bootstrap.sorteos || [];
  if (sorteos.length <= 2) return;
  const tarjetasOriginales = Array.from(contenedor.children);
  tarjetasOriginales.forEach(tarjeta => {
    const clon = tarjeta.cloneNode(true);
    contenedor.appendChild(clon);
  });
  let scrollPos = 0;
  const velocidad = 1;
  const primeraTarjeta = contenedor.children[0];
  const gap = parseInt(window.getComputedStyle(contenedor).gap) || 16;
  const anchoTarjeta = primeraTarjeta.offsetWidth + gap;
  const limiteScroll = anchoTarjeta * sorteos.length;
  if (state.sorteosTimer) clearInterval(state.sorteosTimer);
  state.sorteosTimer = setInterval(() => {
    scrollPos += velocidad;
    if (scrollPos >= limiteScroll) {
      scrollPos = 0;
      contenedor.style.transition = 'none';
    } else {
      contenedor.style.transition = 'transform 0.1s linear';
    }
    contenedor.style.transform = `translateX(-${scrollPos}px)`;
  }, 30);
  contenedor.addEventListener('mouseenter', () => clearInterval(state.sorteosTimer));
  contenedor.addEventListener('mouseleave', () => {
    state.sorteosTimer = setInterval(() => {
      scrollPos += velocidad;
      if (scrollPos >= limiteScroll) {
        scrollPos = 0;
        contenedor.style.transition = 'none';
      } else {
        contenedor.style.transition = 'transform 0.1s linear';
      }
      contenedor.style.transform = `translateX(-${scrollPos}px)`;
    }, 30);
  });
}

/* ==========================================
   ✅ MODAL FLOTANTE DE TICKETS (CORREGIDO)
   ========================================== */
function inyectarModalTickets() {
  if (document.getElementById('modal-tickets')) return;
  
  const modalHTML = `
    <div id="modal-tickets" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>🎟️ Resumen de tus Tickets</h3>
          <button class="modal-close-btn" onclick="cerrarModalTickets()" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-user-info">
          <div class="info-card">
            <span class="info-icon">👤</span>
            <div class="info-text">
              <small>Nombre Completo</small>
              <strong id="modal-nombre">Cargando...</strong>
            </div>
          </div>
          <div class="info-card highlight">
            <span class="info-icon">🎫</span>
            <div class="info-text">
              <small>Total Comprados</small>
              <strong id="modal-total">0</strong>
            </div>
          </div>
        </div>
        <div class="modal-table-container">
          <table class="modal-table">
            <thead>
              <tr>
                <th>Sorteo</th>
                <th>Fecha del Sorteo</th>
                <th>Código de Ticket</th>
              </tr>
            </thead>
            <tbody id="modal-tickets-body"></tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-cerrar-modal" onclick="cerrarModalTickets()">Cerrar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function cerrarModalSiEsFondo(event) {
  if (event.target === event.currentTarget) cerrarModalTickets();
}

function cerrarModalTickets() {
  const modal = document.getElementById('modal-tickets');
  if (!modal) return;
  modal.classList.remove('active');
  modal.classList.add('hidden');
  const input = document.getElementById('input-buscar-ticket');
  if (input) input.value = '';
}

async function buscarMisTickets() {
  const input = document.getElementById('input-buscar-ticket');
  if (!input) { console.warn('⚠️ No existe #input-buscar-ticket'); return; }
  
  const q = input.value.trim();
  if (q.length < 3) {
    alert('Por favor, ingresa al menos 3 caracteres, un DNI (8 dígitos) o un celular (9 dígitos).');
    input.focus();
    return;
  }
  
  console.log('🔎 Buscando tickets para:', q);
  inyectarModalTickets();
  
  const modal = document.getElementById('modal-tickets');
  const tbody = document.getElementById('modal-tickets-body');
  if (!modal || !tbody) { console.error('❌ Modal o tbody no encontrados'); return; }
  
  document.getElementById('modal-nombre').textContent = 'Buscando...';
  document.getElementById('modal-total').textContent = '...';
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem;">🔍 Buscando tus tickets...</td></tr>';
  
  modal.classList.remove('hidden');
  modal.classList.add('active');
  
  try {
    const res = await fetch(`/api/public/consultar-tickets?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    console.log('📦 Respuesta del backend:', data);
    
    if (!res.ok) throw new Error(data.error || 'Error en la búsqueda');
    
    if (data.total === 0) {
      document.getElementById('modal-nombre').textContent = 'Sin resultados';
      document.getElementById('modal-total').textContent = '0';
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: #888;">😕 No encontramos tickets con ese dato.<br><small>Verifica que el DNI, celular o nombre estén bien escritos.</small></td></tr>';
      return;
    }
    
    const nombre = data.nombre || (data.tickets[0] && (data.tickets[0].cliente_nombre || data.tickets[0].nombre)) || 'Cliente';
    document.getElementById('modal-nombre').textContent = nombre;
    document.getElementById('modal-total').textContent = `${data.total}`;
    
    tbody.innerHTML = '';
    
    // ✅ NUEVO: Agrupar tickets por sorteo_id
    const ticketsPorSorteo = {};
    data.tickets.forEach(t => {
      const sid = t.sorteo_id || 'default';
      if (!ticketsPorSorteo[sid]) {
        ticketsPorSorteo[sid] = {
          nombre: t.nombre_sorteo || 'Sorteo',
          fechaSorteo: t.fecha_sorteo || null,
          codigos: []
        };
      }
      // ✅ Mostrar código de ticket real (últimos 5 dígitos si tiene guiones)
      const codigo = t.codigo_ticket ? String(t.codigo_ticket).split('-').pop() : '---';
      ticketsPorSorteo[sid].codigos.push(`#${codigo}`);
    });
    
    // ✅ Formatear fecha del sorteo de forma segura
    const formatearFechaSorteo = (fechaStr) => {
      if (!fechaStr) return 'Por definir';
      const normalizada = String(fechaStr).replace(' ', 'T');
      const d = new Date(normalizada);
      if (isNaN(d.getTime())) return 'Por definir';
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    
    // ✅ Generar una fila por sorteo con todos los códigos agrupados
    Object.values(ticketsPorSorteo).forEach(info => {
      const codigosUnidos = info.codigos.join(', ');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${info.nombre}</strong></td>
        <td>${formatearFechaSorteo(info.fechaSorteo)}</td>
        <td class="numeros-cell">${codigosUnidos}</td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (e) {
    console.error('Error buscando tickets:', e);
    document.getElementById('modal-nombre').textContent = 'Error';
    document.getElementById('modal-total').textContent = '❌';
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 2rem; color: #C8102E;">❌ Error: ${e.message}</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const inputBuscar = document.getElementById('input-buscar-ticket');
  if (inputBuscar) {
    inputBuscar.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        buscarMisTickets();
      }
    });
  }
});

cargarBootstrap();