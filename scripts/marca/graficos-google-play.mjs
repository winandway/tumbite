/* global document */
// Ícono (512x512) y gráfico destacado (1024x500) de Google Play para las tres apps (26 oct 2026).
// El ícono sale del icon.png de cada app (que se genera de los vectores de identidad-divoox/); el
// gráfico destacado lleva el logo oficial para fondo oscuro y el subtítulo de la ficha, sin estirar
// nada. Salen en capturas-tiendas-con-titulo/<app>/Google Play/ (fuera de git).
// Uso: node scripts/marca/graficos-google-play.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..');
const LOGO = readFileSync(
  join(RAIZ, 'identidad-divoox', 'Divoox_Vectoriales', '02_Logo_Completo_Fondo_Oscuro.svg'),
  'utf8',
);
const APPS = [
  [
    'cliente',
    'Divoox (cliente)',
    ['Local food, *delivered fast*', 'Comida local, *rápido a tu puerta*'],
  ],
  [
    'repartidor',
    'Divoox Driver (repartidor)',
    ['Deliver on *your schedule*', 'Reparte *a tu ritmo*'],
  ],
  [
    'restaurante',
    'Divoox Restaurants (restaurante)',
    ['Orders for *your restaurant*', 'Pedidos para *tu restaurante*'],
  ],
];
const frase = (t) => t.replace(/\*([^*]+)\*/g, '<b>$1</b>');

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
for (const [app, carpeta, [en, es]] of APPS) {
  const destino = join(RAIZ, 'capturas-tiendas-con-titulo', carpeta, 'Google Play');
  mkdirSync(destino, { recursive: true });
  const icono = readFileSync(join(RAIZ, 'apps', app, 'assets', 'icon.png')).toString('base64');
  await pagina.setViewportSize({ width: 512, height: 512 });
  await pagina.setContent(
    `<style>html,body{margin:0}</style><img src="data:image/png;base64,${icono}" width="512" height="512">`,
  );
  await pagina.screenshot({ path: join(destino, 'icono-512.png'), omitBackground: false });
  for (const [idioma, texto] of [
    ['English', en],
    ['Español', es],
  ]) {
    await pagina.setViewportSize({ width: 1024, height: 500 });
    await pagina.setContent(
      `<!doctype html><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap');
html,body{margin:0;width:1024px;height:500px;background:#101010;overflow:hidden}
.c{height:500px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px}
.c svg{width:440px;height:auto}
.t{font-family:Poppins,sans-serif;font-weight:700;font-size:46px;color:#fff}
.t b{color:#F20D20}
</style><div class="c">${LOGO}<div class="t">${frase(texto)}</div></div>`,
      { waitUntil: 'networkidle' },
    );
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: join(destino, `grafico-destacado-${idioma}.png`) });
  }
}
await navegador.close();
console.log('gráficos de Google Play listos');
