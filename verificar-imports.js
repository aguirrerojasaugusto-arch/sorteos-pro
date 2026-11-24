import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const carpetasIgnoradas = ['node_modules', '.git', 'data', 'public'];
let erroresEncontrados = 0;

function escanearCarpeta(directorio) {
    const archivos = fs.readdirSync(directorio);

    for (const archivo of archivos) {
        const rutaCompleta = path.join(directorio, archivo);
        const estadistica = fs.statSync(rutaCompleta);

        if (estadistica.isDirectory()) {
            if (!carpetasIgnoradas.includes(archivo)) {
                escanearCarpeta(rutaCompleta);
            }
        } else if (path.extname(archivo) === '.js') {
            const contenido = fs.readFileSync(rutaCompleta, 'utf8');
            const lineas = contenido.split('\n');

            lineas.forEach((linea, index) => {
                // 1. Buscar imports relativos sin .js
                if (linea.includes('import ') && linea.includes('from ')) {
                    const match = linea.match(/from\s+['"](\.[^'"]+)['"]/);
                    if (match) {
                        const rutaImportada = match[1];
                        // Si no termina en .js o .json, es un error en ESM
                        if (!rutaImportada.endsWith('.js') && !rutaImportada.endsWith('.json')) {
                            console.log(`❌ ERROR DE IMPORTACIÓN en: ${rutaCompleta.replace(__dirname, '')}`);
                            console.log(`   Línea ${index + 1}: ${linea.trim()}`);
                            console.log(`   👉 Solución: Agrega ".js" al final de la ruta.\n`);
                            erroresEncontrados++;
                        }
                    }
                }

                // 2. Buscar uso de __dirname o __filename
                if (linea.includes('__dirname') || linea.includes('__filename')) {
                    // Ignorar si es el server.js porque ahí ya lo solucionamos
                    if (!rutaCompleta.endsWith('server.js')) {
                        console.log(`⚠️ ADVERTENCIA (__dirname) en: ${rutaCompleta.replace(__dirname, '')}`);
                        console.log(`   Línea ${index + 1}: ${linea.trim()}`);
                        console.log(`   👉 Solución: Debes definir __dirname usando fileURLToPath o usar rutas relativas.\n`);
                        erroresEncontrados++;
                    }
                }
            });
        }
    }
}

console.log("🔍 Buscando errores de sintaxis ES Modules...\n");
escanearCarpeta(__dirname);

if (erroresEncontrados === 0) {
    console.log("✅ No se encontraron errores de importación en el código. El problema podría estar en otra parte (revisa los logs de Render).");
} else {
    console.log(`🚨 Se encontraron ${erroresEncontrados} posibles errores. Corrígelos antes de subir a Render.`);
}