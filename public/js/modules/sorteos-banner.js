import { state } from './sorteos-state.js';

export function inicializarBanner(banners) {
  const container = document.getElementById('banner-rotativo');
  if (!container) return;
  
  if (banners.length === 0) {
    container.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#999;">Sin banners configurados</div>';
    return;
  }
  
  container.innerHTML = banners.map((b, i) =>
    `<img src="${b.url_imagen}" class="${i === 0 ? 'active' : ''}" alt="Banner ${i+1}">`
  ).join('');
  
  const slides = container.querySelectorAll('img');
  if (slides.length > 1) {
    if (state.bannerTimer) clearInterval(state.bannerTimer);
    state.bannerIndex = 0;
    state.bannerTimer = setInterval(() => {
      slides[state.bannerIndex].classList.remove('active');
      state.bannerIndex = (state.bannerIndex + 1) % slides.length;
      slides[state.bannerIndex].classList.add('active');
    }, 4000);
  }
}