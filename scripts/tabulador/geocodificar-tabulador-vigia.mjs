#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: archivos fijos del repositorio y la caché que se le pasa; claves propias de la hoja */
/**
 * C-TABULADOR-VIGIA: ubica en el mapa cada destino del tabulador de El Vigía y escribe
 * `apps/servidor/src/tabuladorElVigia.ts` (los datos que siembra la base).
 *
 *   node scripts/tabulador/geocodificar-tabulador-vigia.mjs <cache.json>
 *
 * - Pregunta a Google Places (búsqueda de texto con sesgo a El Vigía) y mide la distancia real por
 *   carretera desde el centro con Routes. Guarda todo en <cache.json> (fuera del repositorio) para no
 *   volver a gastar consultas: si el archivo ya tiene un destino, no lo pregunta otra vez.
 * - Valida con sentido común: el lugar tiene que estar en el estado esperado y su distancia por
 *   carretera tiene que cuadrar con el precio (entre 0,15 y 3 dólares por km; las carreras cortas,
 *   dentro de 6 km). Lo que no cuadra, o no aparece, queda con `revisar: true` y un punto
 *   aproximado (AJUSTES, abajo) para corregirlo a mano en el panel.
 * - La llave sale de ~/.config/tumbite/google-places-key. NUNCA se escribe en el repo ni en la salida.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENTRO_VIGIA, DESTINOS, VIAS } from './destinos-vigia.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALIDA = join(RAIZ, 'apps/servidor/src/tabuladorElVigia.ts');
const cachePath = process.argv[2];
if (!cachePath) {
  console.error('Uso: node scripts/tabulador/geocodificar-tabulador-vigia.mjs <cache.json>');
  process.exit(1);
}
const llave = readFileSync(join(homedir(), '.config/tumbite/google-places-key'), 'utf8').trim();
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

/** Radio de cada tipo de lugar, en km. */
const RADIO = { barrio: 0.45, pueblo: 2, ciudad: 4 };
/** Estado esperado de cada vía (en la dirección de Google). */
const ESTADOS = {
  merida: ['Mérida'],
  zulia: ['Zulia', 'Mérida'],
  tachira: ['Táchira', 'Mérida'],
  panamericana: ['Mérida', 'Zulia', 'Trujillo'],
  cortas: ['Mérida'],
};

/**
 * Correcciones a mano después de mirar lo que devolvió Google (ver la salida del guion): punto
 * elegido y radio. `revisar` = el punto es aproximado y el equipo lo corrige en el panel.
 */
const AJUSTES = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ajustes-vigia.json'), 'utf8'),
);

async function places(texto) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': llave,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types',
    },
    body: JSON.stringify({
      textQuery: `${texto}, Venezuela`,
      locationBias: {
        circle: {
          center: { latitude: CENTRO_VIGIA.lat, longitude: CENTRO_VIGIA.lng },
          radius: 50000,
        },
      },
      languageCode: 'es',
      regionCode: 'VE',
      maxResultCount: 5,
    }),
  });
  if (!r.ok) throw new Error(`Places respondió ${r.status}`);
  const d = await r.json();
  return (d.places ?? []).map((p) => ({
    nombre: p.displayName?.text ?? '',
    direccion: p.formattedAddress ?? '',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    tipos: p.types ?? [],
  }));
}

export async function kmPorCarretera(destino) {
  const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': llave,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: CENTRO_VIGIA.lat, longitude: CENTRO_VIGIA.lng } } },
      destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
      travelMode: 'DRIVE',
    }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  const m = d.routes?.[0]?.distanceMeters;
  return typeof m === 'number' ? Math.round(m / 100) / 10 : null;
}

const clave = (via, nombre) => `${via}:${nombre}`;

for (const [via, nombre, , , buscar] of DESTINOS) {
  const k = clave(via, nombre);
  if (cache[k]?.candidatos) continue;
  const candidatos = await places(buscar);
  for (const c of candidatos.slice(0, 3)) if (c.lat != null) c.km = await kmPorCarretera(c);
  cache[k] = { buscar, candidatos };
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

const filas = [];
for (const [via, nombre, dolares, tipo] of DESTINOS) {
  const k = clave(via, nombre);
  const ajuste = AJUSTES[k];
  const c = cache[k]?.candidatos?.[0];
  let punto = null;
  let revisar = false;
  let km = null;
  let motivo = '';
  if (ajuste) {
    punto = { lat: ajuste.lat, lng: ajuste.lng };
    revisar = Boolean(ajuste.revisar);
    km = ajuste.km ?? null;
    motivo = ajuste.motivo ?? '';
  } else if (c && c.lat != null) {
    punto = { lat: c.lat, lng: c.lng };
    km = c.km ?? null;
    const estadoOk = ESTADOS[via].some((e) => c.direccion.includes(e));
    const pkm = km ? dolares / km : null;
    const cuadra =
      via === 'cortas' ? km != null && km <= 6 : pkm != null && pkm >= 0.15 && pkm <= 3;
    if (!estadoOk || !cuadra) {
      revisar = true;
      motivo = !estadoOk ? 'fuera del estado esperado' : 'la distancia no cuadra con el precio';
    }
  } else {
    revisar = true;
    motivo = 'Google no lo encontró';
  }
  if (!punto) throw new Error(`${k}: sin punto; agrégalo en ajustes-vigia.json`);
  filas.push({
    via,
    nombre,
    precio: dolares * 100,
    lat: Math.round(punto.lat * 1e5) / 1e5,
    lng: Math.round(punto.lng * 1e5) / 1e5,
    radioKm: ajuste?.radioKm ?? RADIO[tipo],
    revisar,
    km,
    motivo,
  });
}

const lineas = filas.map(
  (f) =>
    `  { via: '${f.via}', nombre: ${JSON.stringify(f.nombre)}, precio: ${f.precio}, lat: ${f.lat}, lng: ${f.lng}, radioKm: ${f.radioKm}, revisar: ${f.revisar} },`,
);
const ts = `// GENERADO por scripts/tabulador/geocodificar-tabulador-vigia.mjs — no se edita a mano.
// C-TABULADOR-VIGIA (25 nov 2026, Richard), Venezuela: el tabulador de moto taxi de El Vigía.
// Precios en centavos de dólar, EXACTOS de la hoja (los fija tabuladorElVigia.test.ts). El punto de
// cada destino salió de Google Places; los marcados \`revisar\` son aproximados y el equipo los
// corrige en el panel (Precios de la zona).

export const VIAS_TABULADOR = ${JSON.stringify(VIAS, null, 2).replace(/"([a-z]+)":/g, '$1:')} as const;
export type ViaTabulador = keyof typeof VIAS_TABULADOR;

export type DestinoTabulador = {
  via: ViaTabulador;
  nombre: string;
  /** Centavos de dólar. */
  precio: number;
  lat: number;
  lng: number;
  radioKm: number;
  /** El punto es aproximado: revisarlo en el mapa. */
  revisar: boolean;
};

/** El casco urbano de El Vigía: el «desde» de todo el tabulador (y el «hasta» de los regresos). */
export const CASCO_EL_VIGIA = { lat: ${CENTRO_VIGIA.lat}, lng: ${CENTRO_VIGIA.lng}, radioKm: 4, nombre: 'El Vigía (casco urbano)' } as const;

export const TABULADOR_EL_VIGIA: readonly DestinoTabulador[] = [
${lineas.join('\n')}
];
`;
writeFileSync(SALIDA, ts);
// Con el formato del repositorio (si no, el gancho de commit lo cambia y el otro guion no lo lee).
execFileSync('npx', ['prettier', '--write', SALIDA], { cwd: RAIZ, stdio: 'ignore' });
console.log(`Escrito ${SALIDA}: ${filas.length} destinos.`);
for (const f of filas)
  console.log(
    `${f.revisar ? 'REVISAR' : 'ok     '} ${VIAS[f.via].padEnd(17)} ${f.nombre.padEnd(26)} ${String(f.precio / 100).padStart(3)} $  ${f.km ?? '?'} km  ${f.motivo}`,
  );
