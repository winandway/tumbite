/* global document */
// Capturas de las fichas de las tiendas con su frase arriba, como las de las apps grandes
// (25 oct 2026). Toma las capturas reales de capturas-tiendas/ (npm run recorrido:tiendas) y
// arma cada imagen al MISMO tamaño exacto de la tienda: el fondo del color de cada app, arriba
// para quién es, la frase en blanco con una palabra resaltada y la pantalla real debajo, sin estirarla.
// Salen en capturas-tiendas-con-titulo/ (misma estructura de carpetas).
// Uso: node scripts/marca/fichas-tiendas.mjs   (SOLO_TIENDA='Google Play' para una sola tienda)
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..');
const ORIGEN = join(RAIZ, 'capturas-tiendas');
const DESTINO = join(RAIZ, 'capturas-tiendas-con-titulo');

// Frase de cada pantalla, por el nombre del archivo SIN su número (así cada idioma ordena sus
// capturas como quiera). [inglés, español]; *palabra* va en rojo. Tercera auditoría de tiendas
// (18 nov 2026): las frases dicen solo lo que muestra la captura; en inglés, solo Comida (lo único
// abierto hoy en Estados Unidos): nada de viajes ni de «todo en una app».
const FRASES = {
  'Divoox (cliente)': {
    inicio: ['Local food, *delivered*', 'Comida, viajes y envíos en *una sola app*'],
    'restaurantes-cercanos': ['Restaurants *near you*', 'Restaurantes *cerca de ti*'],
    'menu-del-restaurante': ['Order in a *few taps*', 'Pide en *pocos toques*'],
    'elige-tamano-y-extras': ['Pick the size and *extras*', 'Elige el tamaño y los *extras*'],
    'carrito-con-el-precio-completo': [
      'See the *full price* before you pay',
      'Ves el *precio completo* antes de pagar',
    ],
    'moto-con-destino-y-precio': ['Your ride in *3 taps*', 'Tu moto en *3 toques*'],
    'seguimiento-del-viaje': ['Follow your ride *live*', 'Sigue tu viaje *en vivo*'],
    'pedido-en-vivo-en-el-mapa': ['Follow your order *live*', 'Sigue tu pedido *en vivo*'],
    'direcciones-guardadas': ['Home, work and *your places*', 'Casa, trabajo y *tus lugares*'],
  },
  'Divoox Driver (repartidor)': {
    'conectado-buscando-pedidos': ['Go online *whenever* you want', 'Conéctate *cuando quieras*'],
    'oferta-con-el-pago-antes-de-aceptar': [
      'See your *pay* before you accept',
      'Ves cuánto *ganas* antes de aceptar',
    ],
    'en-camino-como-llegar': ['Directions in *one tap*', 'Cómo llegar, con *un toque*'],
    ganancias: ['Your earnings, *order by order*', 'Tus ganancias, *pedido por pedido*'],
    'saldo-y-regalos': ['Your balance and *gifts*', 'Tu saldo y tus *regalos*'],
  },
  'Divoox Restaurants (restaurante)': {
    'pedido-nuevo-y-tiempo-para-aceptar': [
      'Never miss an *order*',
      'No se te pasa ningún *pedido*',
    ],
    'pedido-en-preparacion': ['Every order *on time*', 'Cada pedido *a tiempo*'],
    'confirmar-con-la-foto-del-repartidor': [
      'Hand off with *photo proof*',
      'Entrega al repartidor *con foto*',
    ],
  },
};

// C-ICONOS-POR-APP (3 nov 2026, lámina aprobada por Richard): cada app con su color y una etiqueta
// de para quién es, para que las tres no se vean iguales en las tiendas (Apple 4.3).
const TEMAS = {
  'Divoox (cliente)': {
    fondo: '#F20D20',
    resalte: '#101010',
    etiqueta: ['FOR CUSTOMERS', 'PARA CLIENTES'],
    color: '#FFFFFF',
  },
  'Divoox Driver (repartidor)': {
    fondo: '#1F4D69',
    resalte: '#4AA5DC',
    etiqueta: ['FOR DRIVERS', 'PARA REPARTIDORES'],
    color: '#4AA5DC',
  },
  'Divoox Restaurants (restaurante)': {
    fondo: '#101010',
    resalte: '#F20D20',
    etiqueta: ['FOR RESTAURANTS', 'PARA RESTAURANTES'],
    color: '#F20D20',
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
  // `SOLO_TIENDA=Google Play` arma solo las piezas de esa tienda (las de Apple no se tocan).
  if (process.env.SOLO_TIENDA && partes[1] !== process.env.SOLO_TIENDA) continue;
  const sinNumero = (nombre ?? '').replace(/^\d+[a-z]?-/, '').replace(/\.png$/, '');
  const clave = [...lista.keys()].find((k) => sinNumero === k);
  if (!clave) continue;
  const [en, es] = lista.get(clave);
  const tema = new Map(Object.entries(TEMAS)).get(app) ?? TEMAS['Divoox Restaurants (restaurante)'];
  const etiqueta = tema.etiqueta[idioma === 'Español' ? 1 : 0];
  const origen = imageSize(readFileSync(ruta));
  const tableta = formato === 'Tableta';
  // Google Play rechaza capturas cuyo lado largo pase del doble del corto. Las capturas nuevas de
  // teléfono (1206x2622, 1082x2202) pasan de eso: la pieza de celular de Google Play sale SIEMPRE
  // en 1080x1920 (9:16) y la pantalla se encaja adentro sin estirarla.
  const fija = partes[1] === 'Google Play' && !tableta;
  const w = fija ? 1080 : origen.width;
  const h = fija ? 1920 : origen.height;
  const datos = `data:image/png;base64,${readFileSync(ruta).toString('base64')}`;
  // Celular: la pantalla ocupa el 74 % del alto; tableta: el 76 %. Nunca se estira.
  const alto = Math.round(h * (tableta ? 0.76 : 0.74));
  const tituloPx = Math.round(w * (tableta ? 0.042 : 0.078));
  await pagina.setViewportSize({ width: w, height: h });
  await pagina.setContent(
    `<!doctype html><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap');
html,body{margin:0;width:${w}px;height:${h}px;background:${tema.fondo};overflow:hidden}
.t{box-sizing:border-box;height:${h - alto}px;display:flex;align-items:center;justify-content:center;
  padding:0 ${Math.round(w * 0.07)}px;font-family:Poppins,sans-serif;font-weight:800;color:#fff;
  font-size:${tituloPx}px;line-height:1.12;text-align:center;flex-direction:column;gap:${Math.round(tituloPx * 0.35)}px}
.t i{font-style:normal;font-size:${Math.round(tituloPx * 0.42)}px;letter-spacing:.08em;color:${tema.color}}
.t b{color:${tema.resalte}}
.p{display:flex;justify-content:center}
.p img{height:${alto}px;width:auto;border-radius:${Math.round(w * (tableta ? 0.018 : 0.05))}px ${Math.round(w * (tableta ? 0.018 : 0.05))}px 0 0;
  box-shadow:0 0 0 ${Math.round(w * 0.012)}px #2a2a2a}
</style><div class="t"><i>${etiqueta}</i><span>${frase(idioma === 'Español' ? es : en)}</span></div><div class="p"><img src="${datos}"></div>`,
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
