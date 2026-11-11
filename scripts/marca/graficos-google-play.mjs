/* global document */
// Ícono (512x512) y gráfico destacado (1024x500) de Google Play para las tres apps (26 oct 2026).
// El ícono sale del icon.png de cada app (que se genera de los vectores de identidad-divoox/).
// C-ICONOS-POR-APP (11 nov 2026): el gráfico destacado lleva el color de cada app (cliente rojo,
// Driver azul de logística, Restaurants negro), su ícono, su nombre y para quién es, igual que las
// capturas con título, para que las tres fichas no se vean iguales. Nada se estira. Salen en capturas-tiendas-con-titulo/<app>/Google Play/ (fuera de git).
// Uso: node scripts/marca/graficos-google-play.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..');
const APPS = [
  [
    'cliente',
    'Divoox (cliente)',
    {
      nombre: 'Divoox',
      fondo: '#F20D20',
      resalte: '#101010',
      etiqueta: ['FOR CUSTOMERS', 'PARA CLIENTES'],
    },
    ['Local food, *delivered fast*', 'Comida local, *rápido a tu puerta*'],
  ],
  [
    'repartidor',
    'Divoox Driver (repartidor)',
    {
      nombre: 'Divoox Driver',
      fondo: '#1F4D69',
      resalte: '#4AA5DC',
      etiqueta: ['FOR DRIVERS', 'PARA REPARTIDORES'],
    },
    ['Deliver on *your schedule*', 'Reparte *a tu ritmo*'],
  ],
  [
    'restaurante',
    'Divoox Restaurants (restaurante)',
    {
      nombre: 'Divoox Restaurants',
      fondo: '#101010',
      resalte: '#F20D20',
      etiqueta: ['FOR RESTAURANTS', 'PARA RESTAURANTES'],
    },
    ['Orders for *your restaurant*', 'Pedidos para *tu restaurante*'],
  ],
];
const frase = (t) => t.replace(/\*([^*]+)\*/g, '<b>$1</b>');

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
for (const [app, carpeta, tema, [en, es]] of APPS) {
  const destino = join(RAIZ, 'capturas-tiendas-con-titulo', carpeta, 'Google Play');
  mkdirSync(destino, { recursive: true });
  const icono = readFileSync(join(RAIZ, 'apps', app, 'assets', 'icon.png')).toString('base64');
  await pagina.setViewportSize({ width: 512, height: 512 });
  await pagina.setContent(
    `<style>html,body{margin:0}</style><img src="data:image/png;base64,${icono}" width="512" height="512">`,
  );
  await pagina.screenshot({ path: join(destino, 'icono-512.png'), omitBackground: false });
  for (const [idioma, texto, etiqueta] of [
    ['English', en, tema.etiqueta[0]],
    ['Español', es, tema.etiqueta[1]],
  ]) {
    await pagina.setViewportSize({ width: 1024, height: 500 });
    await pagina.setContent(
      `<!doctype html><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap');
html,body{margin:0;width:1024px;height:500px;background:${tema.fondo};overflow:hidden}
.c{height:500px;display:flex;align-items:center;gap:44px;padding:0 70px;box-sizing:border-box}
.c img{width:270px;height:270px;border-radius:60px;border:3px solid rgba(255,255,255,.28);flex:none}
.e{font-family:Poppins,sans-serif;font-weight:700;font-size:24px;letter-spacing:3px;color:${tema.resalte}}
.n{font-family:Poppins,sans-serif;font-weight:700;font-size:62px;line-height:1.1;color:#fff;margin:6px 0 14px}
.t{font-family:Poppins,sans-serif;font-weight:700;font-size:36px;line-height:1.2;color:#fff}
.t b{color:${tema.resalte}}
</style><div class="c"><img src="data:image/png;base64,${icono}"><div><div class="e">${etiqueta}</div><div class="n">${tema.nombre}</div><div class="t">${frase(texto)}</div></div></div>`,
      { waitUntil: 'networkidle' },
    );
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: join(destino, `grafico-destacado-${idioma}.png`) });
  }
}
await navegador.close();
console.log('gráficos de Google Play listos');
