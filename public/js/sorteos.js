import { state } from './modules/sorteos-state.js';
import { iniciarContadores } from './modules/sorteos-clock.js';
import { inicializarBusquedaDNI } from './modules/sorteos-dni.js';
import { inicializarBanner } from './modules/sorteos-banner.js';
import { inicializarPromos, scrollPromos, ajustarPromos } from './modules/sorteos-promos.js';
import { renderizarTarjetas, iniciarAutoScrollLento, scrollSorteos, construirCintaSorteos } from './modules/sorteos-carrusel.js';
import { abrirModal, cerrarModal, cambiarCantidad, actualizarTotal } from './modules/sorteos-modal.js';
import { inicializarCompra, comprarTickets } from './modules/sorteos-compra.js';

// ✅ Exponer funciones al window para que el HTML las encuentre
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
window.cambiarCantidad = cambiarCantidad;
window.scrollPromos = scrollPromos;
window.scrollSorteos = scrollSorteos;
window.comprarTickets = comprarTickets;

/* ============================================================
   ✅ FUNCIÓN PRINCIPAL: Cargar datos del backend
   ============================================================ */
async function cargarDatos() {
  try {
    console.log('🔄 Cargando datos del backend...');
    const res = await fetch('/api/public/bootstrap?t=' + Date.now());
    const data = await res.json();
    console.log('📦 Datos recibidos:', data);

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
    console.log('🖼️ Banners a mostrar:', bannersA_Mostrar.length);
    console.log('📢 Promos recibidas:', data.promos_laterales?.length || 0);

    inicializarBanner(bannersA_Mostrar);
    inicializarPromos(data.promos_laterales || []);
    renderizarTarjetas();
    iniciarAutoScrollLento();
    iniciarContadores();
    inicializarBusquedaDNI();
    inicializarCompra();

    console.log('✅ Datos cargados correctamente');
  } catch (e) {
    console.error('❌ Error al cargar datos:', e);
  }
}

/* ============================================================
   ✅ Event listener para resize
   ============================================================ */
window.addEventListener('resize', () => {
  const viewport = document.getElementById('promos-viewport');
  if (viewport && viewport.querySelector('.promo-card')) ajustarPromos();
  const ws = document.querySelector('.carrusel-sorteos-wrapper');
  if (ws && ws.querySelector('.card-sorteo')) {
    construirCintaSorteos();
  }
});

/* ============================================================
   ✅ Iniciar aplicación
   ============================================================ */
cargarDatos();