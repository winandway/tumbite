// Capturas ORIGINALES para la guía «Instalar Divoox desde el navegador del celular»
// (C-GUIA-INSTALAR-NAVEGADOR, 13 nov 2026) — todos los países. Contra el sitio local del recorrido
// (node scripts/recorrido/preparar.mjs y el servidor en PUERTO_RECORRIDO, 8790 por defecto), con el
// navegador en tamaño de celular. El menú «Agregar a pantalla de inicio» es del sistema y no se puede
// capturar: se capturan las tres apps abiertas en el navegador y la zona de descargas con la nota del
// iPhone. La pantalla completa (display-mode: standalone) no se puede emular en Chromium sin ventana
// (el protocolo de depuración no acepta esa característica), así que no se inventa esa captura.
// Uso: node scripts/recorrido/capturas-instalar-navegador.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const raiz = join(import.meta.dirname, '..', '..');
const base = `http://localhost:${process.env.PUERTO_RECORRIDO ?? '8790'}`;
const carpeta = join(raiz, 'docs', 'capturas', 'recorrido');
const publica = join(raiz, 'apps', 'panel', 'public', 'docs');
mkdirSync(carpeta, { recursive: true });

const TOMAS = [
  { nombre: 'instalar-cliente-navegador', ruta: '/app/' },
  { nombre: 'instalar-driver-navegador', ruta: '/driver/' },
  { nombre: 'instalar-restaurante-navegador', ruta: '/restaurant/' },
  { nombre: 'instalar-descargas', ruta: '/download', web: true },
];

const navegador = await chromium.launch();
for (const idioma of ['es', 'en']) {
  for (const t of TOMAS) {
    const contexto = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: idioma === 'es' ? 'es-US' : 'en-US',
    });
    // Las apps guardan el idioma elegido; la web lo lleva en la dirección.
    await contexto.addInitScript((i) => {
      try {
        localStorage.setItem('tumbite.idioma', i);
      } catch {
        // sin almacenamiento: queda el idioma del navegador
      }
    }, idioma);
    const pagina = await contexto.newPage();
    const ruta = t.web && idioma === 'es' ? `/es${t.ruta}` : t.ruta;
    await pagina.goto(`${base}${ruta}`, { waitUntil: 'networkidle' });
    await pagina.waitForTimeout(1500);
    if (t.web) await pagina.getByTestId('descargas-navegador').scrollIntoViewIfNeeded();
    const png = join(carpeta, `${t.nombre}-${idioma}.png`);
    await pagina.screenshot({ path: png });
    console.log(`captura: ${t.nombre}-${idioma}`);
    await contexto.close();
  }
}
await navegador.close();

// WebP para Docs, del mismo original y como scripts/recorrido/a-docs.mjs (celular a 540 de ancho).
for (const idioma of ['es', 'en'])
  for (const t of TOMAS)
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '82',
      '-resize',
      '540',
      '0',
      join(carpeta, `${t.nombre}-${idioma}.png`),
      '-o',
      join(publica, `recorrido-${t.nombre}-${idioma}.webp`),
    ]);
console.log('capturas para instalar desde el navegador: listas');
