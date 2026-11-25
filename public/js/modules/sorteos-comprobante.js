import { mostrarErrorComprobante } from './sorteos-modal.js';

export function inicializarValidadorComprobante() {
  const inp = document.getElementById('inp-comprobante');
  const preview = document.getElementById('preview-comprobante');
  
  if (inp) {
    inp.addEventListener('change', (e) => {
      mostrarErrorComprobante('');
      const file = e.target.files[0];
      
      if (file && preview) {
        if (file.size > 5 * 1024 * 1024) {
          mostrarErrorComprobante('❌ El comprobante supera el máximo de 5MB.');
          inp.value = '';
          preview.style.display = 'none';
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (ev) => {
          preview.src = ev.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else if (preview) {
        preview.style.display = 'none';
        preview.src = '';
      }
    });
  }
}

export async function validarComprobanteYapePlin(file) {
  const nombreKeyword = /yape|plin|comprobante|pago|voucher|recibo|transferencia|transacci|captura|screenshot|pantalla/i.test(file.name);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = 200, H = 200;
      const canvas = document.createElement('canvas');
      canvas.width = W; 
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      
      const data = ctx.getImageData(0, 0, W, H).data;
      let morado = 0, cian = 0, total = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        total++;
        if (a < 128) continue;
        if (b > g && r > g && (b - g) > 30 && b > 110 && r < 230 && g < 160) morado++;
        else if (b > 150 && g > 120 && r < 120 && b > r && g > r) cian++;
      }
      
      const pctMorado = (morado / total) * 100;
      const pctCian = (cian / total) * 100;
      const hayColorMarca = pctMorado >= 0.3 || pctCian >= 0.3;
      const ratio = img.naturalHeight / img.naturalWidth;
      const esVertical = ratio >= 1.0;
      const esValido = esVertical && (nombreKeyword || hayColorMarca);
      
      resolve({ esValido, nombreKeyword, hayColorMarca, esVertical, ratio, pctMorado, pctCian });
    };
    img.onerror = () => resolve({ esValido: false, error: true });
    img.src = URL.createObjectURL(file);
  });
}