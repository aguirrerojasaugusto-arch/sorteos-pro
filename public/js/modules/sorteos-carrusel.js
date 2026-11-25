import { state, SORTEO_SPEED } from './sorteos-state.js';
import { fechaObjetivoLima, fmtRestante } from './sorteos-clock.js';

let sorteosOffset = 0;
let sorteosVuelta = 0;
let sorteosRaf = null;
let sorteosPaused = false;
let sorteosLastTs = null;

function htmlTarjetas(sorteos) {
  const ahora = Date.now();
  return sorteos.map(s => {
    const imgUrl = s.imagen ? (s.imagen.startsWith('http') ? s.imagen : window.location.origin + s.imagen) : '/uploads/default.jpg';
    const objetivo = fechaObjetivoLima(s);
    const restanteMs = objetivo ? objetivo.getTime() - ahora : null;
    const bloqueado = objetivo && restanteMs <= 0;
    const fechaTexto = objetivo
      ? objetivo.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' })
      : 'Por definir';
    const cdHtml = objetivo
      ? `<div class="card-countdown ${restanteMs <= 0 ? 'expired' : (restanteMs < 3600000 ? 'warn' : '')}">${bloqueado ? '⛔ Sorteo finalizado' : '⏳ ' + fmtRestante(restanteMs)}</div>`
      : '';
    const btnHtml = bloqueado
      ? `<button class="btn-participar is-finalizado" disabled>Sorteo Finalizado</button>`
      : `<button class="btn-participar" onclick="abrirModal(${s.id})">Participar</button>`;
    const premioTexto = s.premio_descripcion ? s.premio_descripcion : 'Premio Sorpresa';
    
    return `
      <div class="card-sorteo" data-fecha="${s.fecha_sorteo || ''}">
        <img src="${imgUrl}" class="card-img" alt="${s.nombre}">
        <div class="card-content">
          <div>
            <div class="card-title">${s.nombre}</div>
            <div class="card-pozo" style="font-size: 1.1rem; color:#007B4B; margin-bottom: 0.5rem;">${premioTexto}</div>
            <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.3rem;">Cierra: ${fechaTexto}</div>
            ${cdHtml}
          </div>
          <div>
            <div class="card-precio">Ticket: S/ ${s.precio_jugada}</div>
            ${btnHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function renderizarTarjetas() {
  const grid = document.getElementById('grid-sorteos');
  if (!grid) return;
  
  if (state.sorteos.length === 0) {
    grid.innerHTML = '<p style="text-align:center; width:100%; color:#999;">No hay sorteos activos en este momento.</p>';
    sorteosVuelta = 0;
    return;
  }
  
  grid.innerHTML = htmlTarjetas(state.sorteos);
}

export function iniciarAutoScrollLento() { 
  iniciarCintaSorteos(); 
}

function construirCintaSorteos() {
  const wrapper = document.querySelector('.carrusel-sorteos-wrapper');
  const track = document.getElementById('grid-sorteos');
  if (!wrapper || !track || !state.sorteos.length) { 
    sorteosVuelta = 0; 
    return; 
  }
  
  const baseHTML = htmlTarjetas(state.sorteos);
  const gap = parseFloat(getComputedStyle(track).gap) || 24;
  const viewportW = wrapper.clientWidth;
  
  let unidadHTML = baseHTML;
  track.innerHTML = unidadHTML;
  let unidadW = track.scrollWidth;
  let guard = 0;
  
  while (unidadW < viewportW + gap && guard < 12) {
    unidadHTML += baseHTML;
    track.innerHTML = unidadHTML;
    unidadW = track.scrollWidth;
    guard++;
  }
  
  track.innerHTML = unidadHTML + unidadHTML;
  sorteosVuelta = unidadW + gap;
  
  while (sorteosOffset <= -sorteosVuelta) sorteosOffset += sorteosVuelta;
  while (sorteosOffset > 0) sorteosOffset -= sorteosVuelta;
  
  track.style.transform = `translateX(${sorteosOffset}px)`;
}

function iniciarCintaSorteos() {
  const wrapper = document.querySelector('.carrusel-sorteos-wrapper');
  const track = document.getElementById('grid-sorteos');
  if (!wrapper || !track) return;
  
  if (sorteosRaf) cancelAnimationFrame(sorteosRaf);
  construirCintaSorteos();
  
  wrapper.onmouseenter = () => sorteosPaused = true;
  wrapper.onmouseleave = () => sorteosPaused = false;
  sorteosLastTs = null;
  
  const step = (ts) => {
    if (sorteosLastTs == null) sorteosLastTs = ts;
    const dt = (ts - sorteosLastTs) / 1000;
    sorteosLastTs = ts;
    
    if (!sorteosPaused && sorteosVuelta > 0) {
      sorteosOffset -= SORTEO_SPEED * dt;
      if (sorteosOffset <= -sorteosVuelta) sorteosOffset += sorteosVuelta;
      track.style.transform = `translateX(${sorteosOffset}px)`;
    }
    
    sorteosRaf = requestAnimationFrame(step);
  };
  
  sorteosRaf = requestAnimationFrame(step);
}

export function scrollSorteos(direction) {
  const wrapper = document.querySelector('.carrusel-sorteos-wrapper');
  const track = document.getElementById('grid-sorteos');
  if (!wrapper || !track || !sorteosVuelta) return;
  
  const card = track.querySelector('.card-sorteo');
  if (!card) return;
  
  const gap = parseFloat(getComputedStyle(track).gap) || 24;
  sorteosOffset -= direction * (card.offsetWidth + gap);
  
  while (sorteosOffset <= -sorteosVuelta) sorteosOffset += sorteosVuelta;
  while (sorteosOffset > 0) sorteosOffset -= sorteosVuelta;
  
  track.style.transform = `translateX(${sorteosOffset}px)`;
}

export function construirCintaPublico() {
  construirCintaSorteos();
}