import { state } from './sorteos-state.js';

export function fechaObjetivoLima(s) {
  const fecha = String(s.fecha_sorteo || '').trim();
  if (!fecha) return null;
  const m = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = m[1], mo = m[2], d = m[3];
  let hora = '00:00';
  if (s.hora_sorteo) {
    const hm = String(s.hora_sorteo).match(/(\d{1,2}):(\d{2})/);
    if (hm) hora = hm[1].padStart(2, '0') + ':' + hm[2];
  } else {
    const ht = fecha.match(/[T](\d{2}):(\d{2})/);
    if (ht) hora = ht[1] + ':' + ht[2];
  }
  return new Date(`${y}-${mo}-${d}T${hora}:00-05:00`);
}

export function fmtRestante(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function iniciarContadores() {
  if (window._cdTimer) clearInterval(window._cdTimer);
  const tick = () => {
    document.querySelectorAll('.card-sorteo').forEach(card => {
      const fecha = card.dataset.fecha;
      if (!fecha) return;
      const objetivo = new Date(fecha);
      const restante = objetivo.getTime() - Date.now();
      const cd = card.querySelector('.card-countdown');
      const btn = card.querySelector('.btn-participar');
      if (restante <= 0) {
        if (cd) { cd.textContent = '⛔ Sorteo finalizado'; cd.classList.add('expired'); }
        if (btn && !btn.disabled) {
          btn.disabled = true;
          btn.textContent = 'Sorteo Finalizado';
          btn.classList.add('is-finalizado');
          btn.onclick = null;
        }
      } else {
        if (cd) {
          cd.textContent = '⏳ ' + fmtRestante(restante);
          cd.classList.toggle('warn', restante < 3600000);
        }
      }
    });
  };
  tick();
  window._cdTimer = setInterval(tick, 1000);
}