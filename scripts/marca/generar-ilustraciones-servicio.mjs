#!/usr/bin/env node
/**
 * Fase cero (16 nov 2026): las ilustraciones de los mosaicos de servicio, en el estilo de la flota de
 * marca (objeto realista blanco con detalles rojo Divoox, luz suave de frente, vista tres cuartos,
 * fondo transparente). SOLO con el modelo barato aprobado: Seedream 4 en fal.ai (unos 3 centavos por
 * imagen). Nunca un modelo caro, ni como respaldo: si falla, se cae y punto (regla global).
 * El fondo se quita con BiRefNet (fracción de centavo). Llave: ~/.config/tumbite/fal-key.
 *
 * Uso: node scripts/marca/generar-ilustraciones-servicio.mjs [comida|mercado|farmacia|envios ...]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MODELO = 'fal-ai/bytedance/seedream/v4/text-to-image';
const PERMITIDOS = new Set([MODELO, 'fal-ai/birefnet']);
// eslint-disable-next-line security/detect-non-literal-fs-filename -- ruta fija de la llave en la máquina
const LLAVE = readFileSync(join(homedir(), '.config/tumbite/fal-key'), 'utf8').trim();
const SALIDA = 'apps/cliente/assets/inicio';

const ESTILO =
  'single isolated object, product render, three-quarter view, soft frontal studio light, glossy white plastic with bright red (#F20D20) accents, clean modern brand illustration, centered with margin, plain pure white background, no text, no letters, no logos, no brand marks, no people';
const OBJETOS = {
  comida:
    'a closed white takeout food delivery paper bag with a red folded top band and red handle',
  mercado:
    'a red plastic grocery shopping basket with white handles filled with fresh fruit and vegetables',
  farmacia: 'a white first aid kit case with a red cross on the front and a red handle',
  envios: 'a closed white cardboard shipping box with a red tape strip across the top',
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

mkdirSync(SALIDA, { recursive: true });
const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(OBJETOS);
for (const id of pedidos) {
  const objeto = new Map(Object.entries(OBJETOS)).get(id);
  if (!objeto) throw new Error(`servicio desconocido: ${id}`);
  const img = await fal(MODELO, {
    prompt: `${objeto}. ${ESTILO}`,
    image_size: { width: 1024, height: 1024 },
    num_images: 1,
    enable_safety_checker: true,
  });
  const url = img.images?.[0]?.url;
  if (!url) throw new Error(`${id}: sin imagen`);
  const sin = await fal('fal-ai/birefnet', { image_url: url, output_format: 'png' });
  const png = Buffer.from(await (await fetch(sin.image.url)).arrayBuffer());
  const destino = join(SALIDA, `ilustracion-${id}.png`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- destino armado con un id de la lista cerrada
  writeFileSync(destino, png);
  console.log(`${id}: ${destino}`);
}
