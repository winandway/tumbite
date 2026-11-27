#!/usr/bin/env node
/**
 * C-CABECERAS-MARCA (27 nov 2026, orden de Richard vía Gerencia) — todos los países. Genera las
 * imágenes de las diez cabeceras de marca del inicio del cliente y el ícono nuevo de «Moto» (una moto
 * de trabajo de 150 cc, nunca una Vespa: C-MOTO-SERIA).
 *
 * SOLO con el modelo barato aprobado: Seedream 4 en fal.ai (unos 3 centavos por imagen). Nunca un
 * modelo caro, ni como respaldo: si falla, se cae y punto (regla global). El fondo se quita con
 * BiRefNet (fracción de centavo). Llave: ~/.config/tumbite/fal-key (fuera del repositorio).
 * Sin marcas reales, sin personas y sin la marca de ningún fabricante de motos.
 *
 * Uso: node scripts/banners/generar-cabeceras.mjs <carpeta-salida> [id ...] [--variantes N]
 * Deja <id>-<n>.png (recortado, fondo transparente). La elección y el paso a WebP los hace
 * scripts/banners/preparar-cabeceras.mjs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const MODELO = 'fal-ai/bytedance/seedream/v4/text-to-image';
const PERMITIDOS = new Set([MODELO, 'fal-ai/birefnet']);
// eslint-disable-next-line security/detect-non-literal-fs-filename -- ruta fija de la llave en la máquina
const LLAVE = readFileSync(join(homedir(), '.config/tumbite/fal-key'), 'utf8').trim();

const FOTO =
  'photorealistic commercial product photography, single isolated subject, sharp focus, soft studio light, centered with generous margin, plain pure white background, no text, no letters, no numbers, no logos, no brand names, no brand marks, no license plate text, no people, no hands';
const ICONO =
  'single isolated object, glossy 3D product render, three-quarter front view facing left, soft frontal studio light, clean modern app icon illustration, centered with margin, plain pure white background, no text, no letters, no logos, no brand marks, no people';

export const PEDIDOS = {
  moto: `a modern 150cc naked street commuter motorcycle of the kind used as motorcycle taxis in Latin America, glossy red and black fuel tank, black engine and exhaust, round headlight, alloy wheels, long two-person seat with rear grab rail, rear luggage rack, three-quarter front view facing left, realistic proportions, unbranded generic motorcycle. ${FOTO}`,
  carro: `a modern white compact sedan car, clean and new, three-quarter front view facing left, realistic, unbranded generic car without badge or emblem, blank license plate. ${FOTO}`,
  farmacia: `a neat arrangement of pharmacy products: white medicine bottles with blank red labels, blister packs of pills, a vitamin jar, a digital thermometer and a small white first aid box with a red cross, all generic unbranded packaging. ${FOTO}`,
  licores: `a premium arrangement of drinks: an unlabeled dark wine bottle, an unlabeled amber rum bottle with blank label, two crystal glasses with ice and amber drink, generic unbranded, elegant. ${FOTO}`,
  ferreteria: `a hardware store arrangement of tools and materials: a red cordless power drill, a claw hammer, a yellow tape measure, an adjustable wrench, a box of screws, a can of paint and a small stack of wooden boards, all generic unbranded without any logos. ${FOTO}`,
  envios: `a neat stack of three closed cardboard shipping boxes of different sizes sealed with red tape, with a white padded envelope leaning on them, generic unbranded, no shipping labels text. ${FOTO}`,
  billetera: `a sleek black smartphone lying at an angle next to a glossy red payment card and a black leather wallet, the phone screen dark and blank, generic unbranded, premium fintech product shot. ${FOTO}`,
  aliados: `a charming modern small local storefront facade with a red awning, a display window with bread, fruit and groceries, a potted plant by the glass door, miniature diorama style but realistic materials, three-quarter view, blank sign without letters. ${FOTO}`,
  comida: `a whole fresh pepperoni pizza with melted mozzarella on a wooden board with one slice pulled out with stretching cheese, appetizing. ${FOTO}`,
  mercado: `a red plastic grocery shopping basket with handles filled with fresh fruit, vegetables, a baguette, a carton of eggs and a bottle of milk with blank label, generic unbranded. ${FOTO}`,
  'icono-moto': `a modern 150cc naked street commuter motorcycle, glossy red fuel tank and red body panels with black engine and black seat, round headlight, alloy wheels, rear grab rail, sturdy realistic motorcycle taxi, unbranded. ${ICONO}`,
};

async function fal(modelo, cuerpo) {
  if (!PERMITIDOS.has(modelo)) throw new Error(`modelo no aprobado: ${modelo}`);
  const r = await fetch(`https://fal.run/${modelo}`, {
    method: 'POST',
    headers: { Authorization: `Key ${LLAVE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`${modelo}: ${r.status} ${await r.text()}`);
  return r.json();
}

const args = process.argv.slice(2);
const salida = resolve(args[0] ?? 'cabeceras-generadas');
const iv = args.indexOf('--variantes');
const variantes = iv >= 0 ? Math.min(3, Math.max(1, Number(args[iv + 1]) || 1)) : 1;
const ids = args.slice(1).filter((a, i, l) => a !== '--variantes' && l[i - 1] !== '--variantes');
const pedidos = ids.length ? ids : Object.keys(PEDIDOS);
// eslint-disable-next-line security/detect-non-literal-fs-filename -- carpeta de salida elegida al llamar
mkdirSync(salida, { recursive: true });

await Promise.all(
  pedidos.map(async (id) => {
    const prompt = new Map(Object.entries(PEDIDOS)).get(id);
    if (!prompt) throw new Error(`cabecera desconocida: ${id}`);
    const img = await fal(MODELO, {
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: variantes,
      enable_safety_checker: true,
    });
    const urls = (img.images ?? []).map((i) => i.url).filter(Boolean);
    if (!urls.length) throw new Error(`${id}: sin imagen`);
    await Promise.all(
      urls.map(async (url, n) => {
        const sin = await fal('fal-ai/birefnet', { image_url: url, output_format: 'png' });
        const png = Buffer.from(await (await fetch(sin.image.url)).arrayBuffer());
        const destino = join(salida, `${id}-${n + 1}.png`);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- id de la lista cerrada
        writeFileSync(destino, png);
        console.log(`${id}: ${destino}`);
      }),
    );
  }),
);
