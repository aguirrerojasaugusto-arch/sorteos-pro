import { PROMO_SPEED, PROMO_VISIBLE } from './sorteos-state.js';

let promosBase = [];
let trackOffset = 0;
let trackVuelta = 0;
let promosRaf = null;
let promosPaused = false;
let promosLastTs = null;

export function inicializarPromos(promos) {
  const viewport = document.getElementById('promos-viewport');
  const track = document.getElementById('promos-track');
  if (!viewport || !track) return;
  
  promosBase = (promos || []).filter(p => p && p.url_imagen);
  if (promosBase.length === 0) {
    viewport.innerHTML = '<p style="text-align:center; color:#999; padding: 2rem;">Sin promociones</p>';
    return;
  }
  
  let base = promosBase.slice();
  while (base.length < PROMO_VISIBLE) base = base.concat(promosBase);
  const lista = base.concat(base);
  
  track.innerHTML = lista.map(p =>
    `<div class="promo-card">
       <img src="${p.url_imagen}" alt="Promo">
       <div class="promo-fecha">${p.fecha || ''}</div>
     </div>`
  ).join('');
  
  viewport.onmouseenter = () => promosPaused = true;
  viewport.onmouseleave = () => promosPaused = false;
  requestAnimationFrame(() => { ajustarPromos(); iniciarPromosLoop(); });
}

function ajustarPromos() {
  const viewport = document.getElementById('promos-viewport');
  const track = document.getElementById('promos-track');
  if (!viewport || !track) return;
  
  const cards = track.querySelectorAll('.promo-card');
  if (!cards.length) return;
  
  const H = viewport.clientHeight;
  const gap = parseFloat(getComputedStyle(track).gap) || 12;
  const cardH = (H - (PROMO_VISIBLE - 1) * gap) / PROMO_VISIBLE;
  
  cards.forEach(c => { c.style.height = cardH + 'px'; });
  
  const perCopy = cards.length / 2;
  trackVuelta = perCopy * (cardH + gap);
  
  if (trackVuelta > 0) {
    while (trackOffset <= -trackVuelta) trackOffset += trackVuelta;
    while (trackOffset > 0) trackOffset -= trackVuelta;
  }
  
  track.style.transform = `translateY(${trackOffset}px)`;
}

function iniciarPromosLoop() {
  if (promosRaf) cancelAnimationFrame(promosRaf);
  promosLastTs = null;
  
  const step = (ts) => {
    if (promosLastTs == null) promosLastTs = ts;
    const dt = (ts - promosLastTs) / 1000;
    promosLastTs = ts;
    
    if (!promosPaused && trackVuelta > 0) {
      trackOffset -= PROMO_SPEED * dt;
      if (trackOffset <= -trackVuelta) trackOffset += trackVuelta;
      const track = document.getElementById('promos-track');
      if (track) track.style.transform = `translateY(${trackOffset}px)`;
    }
    
    promosRaf = requestAnimationFrame(step);
  };
  
  promosRaf = requestAnimationFrame(step);
}

export function scrollPromos(direction) {
  const viewport = document.getElementById('promos-viewport');
  const track = document.getElementById('promos-track');
  if (!viewport || !track || !trackVuelta) return;
  
  const cards = track.querySelectorAll('.promo-card');
  if (!cards.length) return;
  
  const cardH = cards[0].offsetHeight;
  const gap = parseFloat(getComputedStyle(track).gap) || 12;
  
  trackOffset -= direction * (cardH + gap);
  while (trackOffset <= -trackVuelta) trackOffset += trackVuelta;
  while (trackOffset > 0) trackOffset -= trackVuelta;
  
  track.style.transform = `translateY(${trackOffset}px)`;
}

export function ajustarPromosPublico() {
  ajustarPromos();
}