// C-VERIFICACIONES-EN-VIVO (23 nov 2026, Richard) — el sonido del panel cuando entra una verificación
// lista para revisar. ORIGINAL de Divoox: sale entero de esta síntesis (ninguna grabación ni sonido de
// otra app). Dos notas que suben (sol y re, una quinta), cada una con un armónico suave y una caída
// rápida, en menos de medio segundo: corto, limpio y distinto de la alarma de pedidos (alarma.wav) y
// del tono de ofertas de Driver (oferta_bucle.wav).
// Uso: node scripts/sonidos/generar-aviso-verificacion.mjs
// Escribe apps/panel/public/sonidos/verificacion.wav (mono, 22 050 Hz, 16 bits).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MUESTREO = 22_050;
const NOTAS = [
  // [frecuencia en Hz, empieza en s, dura en s]
  [783.99, 0, 0.18], // sol5
  [1174.66, 0.14, 0.3], // re6
];
const TOTAL = 0.46;
const VOLUMEN = 0.42;

const n = Math.round(TOTAL * MUESTREO);
const muestras = new Float32Array(n);
for (const [f, inicio, dura] of NOTAS) {
  const desde = Math.round(inicio * MUESTREO);
  const largo = Math.round(dura * MUESTREO);
  for (let i = 0; i < largo && desde + i < n; i++) {
    const t = i / MUESTREO;
    // Ataque de 6 ms (sin chasquido) y caída exponencial.
    const ataque = Math.min(1, t / 0.006);
    const caida = Math.exp(-t * 9);
    const onda =
      Math.sin(2 * Math.PI * f * t) +
      0.35 * Math.sin(2 * Math.PI * 2 * f * t) +
      0.12 * Math.sin(2 * Math.PI * 3 * f * t);
    muestras[desde + i] += (onda / 1.47) * ataque * caida;
  }
}
// Un final de 20 ms que baja a cero (sin chasquido al cortar).
const final = Math.round(0.02 * MUESTREO);
for (let i = 0; i < final; i++) muestras[n - 1 - i] *= i / final;

const datos = Buffer.alloc(n * 2);
muestras.forEach((m, i) =>
  datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, m * VOLUMEN)) * 32_767), i * 2),
);
const cabecera = Buffer.alloc(44);
cabecera.write('RIFF', 0);
cabecera.writeUInt32LE(36 + datos.length, 4);
cabecera.write('WAVE', 8);
cabecera.write('fmt ', 12);
cabecera.writeUInt32LE(16, 16);
cabecera.writeUInt16LE(1, 20); // PCM
cabecera.writeUInt16LE(1, 22); // mono
cabecera.writeUInt32LE(MUESTREO, 24);
cabecera.writeUInt32LE(MUESTREO * 2, 28);
cabecera.writeUInt16LE(2, 32);
cabecera.writeUInt16LE(16, 34);
cabecera.write('data', 36);
cabecera.writeUInt32LE(datos.length, 40);

const carpeta = join(import.meta.dirname, '..', '..', 'apps', 'panel', 'public', 'sonidos');
mkdirSync(carpeta, { recursive: true });
writeFileSync(join(carpeta, 'verificacion.wav'), Buffer.concat([cabecera, datos]));
console.log(`sonido: apps/panel/public/sonidos/verificacion.wav (${n} muestras, ${TOTAL} s)`);
