import { state } from './modules/sorteos-state.js';
import { iniciarContadores } from './modules/sorteos-clock.js';
import { inicializarBusquedaDNI } from './modules/sorteos-dni.js';
import { inicializarBanner } from './modules/sorteos-banner.js';
import { inicializarPromos, scrollPromos, ajustarPromos } from './modules/sorteos-promos.js';
import { renderizarTarjetas, iniciarAutoScrollLento, scrollSorteos, construirCintaSorteos } from './modules/sorteos-carrusel.js';
import { abrirModal, cerrarModal, cambiarCantidad, actualizarTotal } from './modules/sorteos-modal.js';
import { inicializarCompra, comprarTickets } from './modules/sorteos-compra.js';

// ✅ CRUCIAL: Exponer funciones al objeto global window para que el HTML las encuentre
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
window.cambiarCantidad = cambiarCantidad;
window.scrollPromos = scrollPromos;
window.scrollSorteos = scrollSorteos;
window.comprarTickets = comprarTickets; // <-- ESTO ES CLAVE

// ... resto de tu código de inicialización (cargarDatos, event listeners, etc.)