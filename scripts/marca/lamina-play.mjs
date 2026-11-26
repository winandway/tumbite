// C-LAMINA-PLAY-COLOR-APP (26 nov 2026, Richard: «la aplicación es azul petróleo… debería la
// lámina ser azul petróleo… el cliente, esta es roja… esta lámina debe ser roja»). Todos los países.
// Lo que pasó: las tres láminas de 1024 × 500 de Google Play quedaron NEGRAS desde el 26 oct. El
// generador se cambió el 11 nov, pero las láminas viejas siguieron en la carpeta y nadie comprobó
// lo que se subía. Ahora el color de cada lámina sale del color de SU app (el fondo del ícono de
// Android en app.json, la misma fuente que pinta la app y su ícono), y una lámina que no lleve ese
// color no se genera ni se sube: `comprobarLamina` lo mide en los píxeles.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- rutas fijas del repositorio; índices numéricos de píxeles */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const RAIZ = join(import.meta.dirname, '..', '..');

export const ANCHO = 1024;
export const ALTO = 500;

/** Color de fondo de cada app: el del ícono adaptable de Android en su app.json. */
export function colorDeApp(app) {
  const json = JSON.parse(readFileSync(join(RAIZ, 'apps', app, 'app.json'), 'utf8'));
  const color = json?.expo?.android?.adaptiveIcon?.backgroundColor;
  if (!/^#[0-9A-Fa-f]{6}$/.test(color ?? ''))
    throw new Error(`${app}: app.json sin color de ícono`);
  return color.toUpperCase();
}

// Lo único que se escribe a mano es la frase y su resalte; el fondo SIEMPRE sale de la app.
// Frase: [inglés, español]; *palabras* van en el color de resalte.
export const LAMINAS = [
  {
    app: 'cliente',
    carpeta: 'Divoox (cliente)',
    paquete: 'com.windoce.tumbite',
    nombre: 'Divoox',
    etiqueta: ['FOR CUSTOMERS', 'PARA CLIENTES'],
    // Sobre el rojo, el resalte va en el negro de la marca (el rojo desaparecería).
    resalte: '#101010',
    // Auditor de tiendas (26 nov): Moto y Carro no están abiertos en todos los países, así que la
    // frase los nombra con «donde haya» (política de metadatos de Google Play).
    frase: [
      'Food, plus moto and car rides *where available*',
      'Comida, motos y carros *donde haya*',
    ],
  },
  {
    app: 'repartidor',
    carpeta: 'Divoox Driver (repartidor)',
    paquete: 'com.windoce.tumbite.driver',
    nombre: 'Divoox Driver',
    etiqueta: ['FOR DRIVERS', 'PARA CONDUCTORES'],
    resalte: '#4AA5DC',
    frase: ['Drive and deliver *on your schedule*', 'Conduce y reparte *a tu ritmo*'],
  },
  {
    app: 'restaurante',
    carpeta: 'Divoox Restaurants (restaurante)',
    paquete: 'com.windoce.tumbite.restaurants',
    nombre: 'Divoox Restaurants',
    etiqueta: ['FOR RESTAURANTS', 'PARA RESTAURANTES'],
    resalte: '#F20D20',
    frase: ['Orders for *your restaurant*', 'Pedidos para *tu restaurante*'],
  },
];

const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const cerca = (a, b, tol = 10) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

/**
 * Comprueba que una lámina de Google Play lleve el color de su app: 1024 × 500, sin
 * transparencia, el borde entero del color de la app y al menos la mitad de la lámina de ese
 * color. Falla con un mensaje claro si no. Devuelve las medidas para el reporte.
 */
export async function comprobarLamina(png, colorEsperado, nombre = 'lámina') {
  const meta = await sharp(png).metadata();
  if (meta.width !== ANCHO || meta.height !== ALTO)
    throw new Error(
      `${nombre}: mide ${meta.width}×${meta.height}, Google Play pide ${ANCHO}×${ALTO}`,
    );
  if (meta.hasAlpha) throw new Error(`${nombre}: tiene transparencia; Google Play no la acepta`);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const esperado = aRgb(colorEsperado);
  const px = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  let borde = 0;
  let bordeBien = 0;
  for (let x = 0; x < info.width; x += 2)
    for (const y of [0, 4, info.height - 5, info.height - 1]) {
      borde++;
      if (cerca(px(x, y), esperado)) bordeBien++;
    }
  for (let y = 0; y < info.height; y += 2)
    for (const x of [0, 4, info.width - 5, info.width - 1]) {
      borde++;
      if (cerca(px(x, y), esperado)) bordeBien++;
    }
  let total = 0;
  let deColor = 0;
  for (let y = 0; y < info.height; y += 3)
    for (let x = 0; x < info.width; x += 3) {
      total++;
      if (cerca(px(x, y), esperado)) deColor++;
    }
  const partBorde = bordeBien / borde;
  const partTotal = deColor / total;
  if (partBorde < 0.98 || partTotal < 0.5)
    throw new Error(
      `${nombre}: no lleva el color de su app ${colorEsperado} (borde ${Math.round(partBorde * 100)} %, lámina ${Math.round(partTotal * 100)} %)`,
    );
  return { borde: partBorde, lamina: partTotal };
}

/**
 * El ícono de 512 × 512 de la ficha lleva el color de su app en sus cuatro esquinas (el 26 nov
 * el de Driver seguía negro en Play aunque la app ya era azul petróleo).
 */
export async function comprobarIcono(png, colorEsperado, nombre = 'ícono') {
  const meta = await sharp(png).metadata();
  if (meta.width !== 512 || meta.height !== 512)
    throw new Error(`${nombre}: mide ${meta.width}×${meta.height}, Google Play pide 512×512`);
  // Google Play pide el ícono en PNG de 32 bits con alfa (opaco).
  if (meta.format !== 'png' || meta.channels !== 4)
    throw new Error(`${nombre}: Google Play pide un PNG de 32 bits con alfa`);
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const esperado = aRgb(colorEsperado);
  for (const [x, y] of [
    [4, 4],
    [507, 4],
    [4, 507],
    [507, 507],
  ]) {
    const i = (y * info.width + x) * info.channels;
    if (!cerca([data[i], data[i + 1], data[i + 2]], esperado))
      throw new Error(`${nombre}: no lleva el color de su app ${colorEsperado}`);
  }
}
