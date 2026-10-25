/* global document */
// Capturas de las fichas de las tiendas con su frase arriba, como las de las apps grandes
// (25 oct 2026). Toma las capturas reales de capturas-tiendas/ (npm run recorrido:tiendas) y
// arma cada imagen al MISMO tamaño exacto de la tienda: fondo negro de Divoox, la frase en
// blanco con una palabra en rojo y la pantalla real debajo, sin estirarla.
// Salen en capturas-tiendas-con-titulo/ (misma estructura de carpetas).
// Uso: node scripts/marca/fichas-tiendas.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..');
const ORIGEN = join(RAIZ, 'capturas-tiendas');
const DESTINO = join(RAIZ, 'capturas-tiendas-con-titulo');

// Frase de cada pantalla, por el prefijo del archivo. [inglés, español]; *palabra* va en rojo.
const FRASES = {
  'Divoox (cliente)': {
    '01-': ['Your favorite *local* restaurants', 'Tus restaurantes *favoritos*, cerca'],
    '02-': ['Order in a *few taps*', 'Pide en *pocos toques*'],
    '03-': ['See the *full price* before you pay', 'Ves el *precio completo* antes de pagar'],
    '05-': ['Follow your order *live*', 'Sigue tu pedido *en vivo*'],
    '08-': ['Delivered, with *photo proof*', 'Entregado, *con foto*'],
  },
  'Divoox Driver (repartidor)': {
    '02-': ['See your *pay* before you accept', 'Ves cuánto *ganas* antes de aceptar'],
    '01-': ['Go online *whenever* you want', 'Conéctate *cuando quieras*'],
    '04-': ['Directions in *one tap*', 'Cómo llegar, con *un toque*'],
    '06-': ['Keep *100%* of your tips', 'El *100 %* de la propina es tuyo'],
    '07-': ['Cash out to your *bank*', 'Retira a tu *banco*'],
  },
  'Divoox Restaurants (restaurante)': {
    '01-': ['Never miss an *order*', 'No se te pasa ningún *pedido*'],
    '02-': ['Every order *on time*', 'Cada pedido *a tiempo*'],
    '03-': ['Hand off with *photo proof*', 'Entrega al repartidor *con foto*'],
  },
};

// Ancho y alto de un PNG (vienen en la cabecera, bytes 16 a 23).
const imageSize = (b) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });

const archivos = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? archivos(r) : n.endsWith('.png') ? [r] : [];
  });

const frase = (texto) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*([^*]+)\*/g, '<b>$1</b>');

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
let hechas = 0;
for (const ruta of archivos(ORIGEN).sort()) {
  const partes = relative(ORIGEN, ruta).split('/');
  const [app, , idioma, formato, nombre] = partes;
  const lista = new Map(Object.entries(new Map(Object.entries(FRASES)).get(app) ?? {}));
  const clave = [...lista.keys()].find((k) => nombre?.startsWith(k));
  if (!clave) continue;
  const [en, es] = lista.get(clave);
  const { width: w, height: h } = imageSize(readFileSync(ruta));
  const tableta = formato === 'Tableta';
  const datos = `data:image/png;base64,${readFileSync(ruta).toString('base64')}`;
  // Celular: la pantalla ocupa el 74 % del alto; tableta: el 76 %. Nunca se estira.
  const alto = Math.round(h * (tableta ? 0.76 : 0.74));
  const tituloPx = Math.round(w * (tableta ? 0.042 : 0.078));
  await pagina.setViewportSize({ width: w, height: h });
  await pagina.setContent(
    `<!doctype html><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap');
html,body{margin:0;width:${w}px;height:${h}px;background:#101010;overflow:hidden}
.t{box-sizing:border-box;height:${h - alto}px;display:flex;align-items:center;justify-content:center;
  padding:0 ${Math.round(w * 0.07)}px;font-family:Poppins,sans-serif;font-weight:800;color:#fff;
  font-size:${tituloPx}px;line-height:1.12;text-align:center}
.t b{color:#F20D20}
.p{display:flex;justify-content:center}
.p img{height:${alto}px;width:auto;border-radius:${Math.round(w * (tableta ? 0.018 : 0.05))}px ${Math.round(w * (tableta ? 0.018 : 0.05))}px 0 0;
  box-shadow:0 0 0 ${Math.round(w * 0.012)}px #2a2a2a}
</style><div class="t"><span>${frase(idioma === 'Español' ? es : en)}</span></div><div class="p"><img src="${datos}"></div>`,
    { waitUntil: 'networkidle' },
  );
  await pagina.evaluate(() => document.fonts.ready);
  const salida = join(DESTINO, ...partes);
  mkdirSync(dirname(salida), { recursive: true });
  await pagina.screenshot({ path: salida });
  hechas++;
}
await navegador.close();
console.log(`fichas: ${hechas} capturas con su frase en capturas-tiendas-con-titulo/`);
