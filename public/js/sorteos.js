import { state } from './modules/sorteos-state.js';
import { iniciarContadores } from './modules/sorteos-clock.js';
import { inicializarBusquedaDNI } from './modules/sorteos-dni.js';
import { inicializarBanner } from './modules/sorteos-banner.js';
import { inicializarPromos, scrollPromos, ajustarPromosPublico } from './modules/sorteos-promos.js';
import { 
  renderizarTarjetas, 
  iniciarAutoScrollLento, 
  scrollSorteos,
  construirCintaPublico
} from './modules/sorteos-carrusel.js';
import { 
  abrirModal, 
  cerrarModal, 
  cambiarCantidad,
  actualizarTotal
} from './modules/sorteos-modal.js';
import { inicializarCompra, comprarTickets } from './modules/sorteos-compra.js';

// Hacer funciones globales para onclick en HTML
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
window.cambiarCantidad = cambiarCantidad;
window.scrollPromos = scrollPromos;
window.scrollSorteos = scrollSorteos;

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
      bannersA_Mostrar = state.sorteos
        .filter(s => s.banner_lateral)
        .map(s => ({ url_imagen: s.banner_lateral }));
    }

    inicializarBanner(bannersA_Mostrar);
    inicializarPromos(data.promos_laterales || []);
    renderizarTarjetas();
    iniciarAutoScrollLento();
    iniciarContadores();
    inicializarBusquedaDNI();
    inicializarCompra();
  } catch (e) { 
    console.error('Error al cargar:', e); 
  }
}

// Event listeners globales
window.addEventListener('resize', () => {
  const viewport = document.getElementById('promos-viewport');
  if (viewport && viewport.querySelector('.promo-card')) ajustarPromosPublico();
  const ws = document.querySelector('.carrusel-sorteos-wrapper');
  if (ws && ws.querySelector('.card-sorteo')) { 
    construirCintaPublico(); 
  }
});

// Inicializar
cargarDatos();