#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: archivos fijos del repositorio y la caché que se le pasa; claves propias de la hoja */
/**
 * C-TABULADOR-VIGIA: aprende la tarifa por km de moto en El Vigía con el tabulador de la calle.
 *
 *   node scripts/tabulador/aprender-tarifa-vigia.mjs <cache-km.json>
 *
 * - Mide con Google Routes la distancia real por carretera desde el centro de El Vigía hasta el
 *   punto de cada destino (apps/servidor/src/tabuladorElVigia.ts). Guarda las medidas en
 *   <cache-km.json> (fuera del repo) para no repetir consultas.
 * - Escribe docs/TABULADOR-EL-VIGIA.md: el tabulador por vía, la tabla destino / km / precio / $ por
 *   km, el promedio y la mediana por vía, y la tarifa resultante.
 * - La tarifa (base + por km, por minuto en 0, mínimo 1 $): ver la regla junto a TARIFA, abajo.
 * - La llave sale de ~/.config/tumbite/google-places-key y nunca se imprime.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENTRO_VIGIA, DESTINOS, VIAS } from './destinos-vigia.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cachePath = process.argv[2];
if (!cachePath) {
  console.error('Uso: node scripts/tabulador/aprender-tarifa-vigia.mjs <cache-km.json>');
  process.exit(1);
}
const llave = readFileSync(join(homedir(), '.config/tumbite/google-places-key'), 'utf8').trim();
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

const src = readFileSync(join(RAIZ, 'apps/servidor/src/tabuladorElVigia.ts'), 'utf8');
const puntos = [
  ...src.matchAll(
    /\{\s*via: '([a-z]+)',\s*nombre: ('[^']*'|"[^"]*"),\s*precio: (\d+),\s*lat: ([-\d.]+),\s*lng: ([-\d.]+),\s*radioKm: ([\d.]+),\s*revisar: (true|false),?\s*\}/g,
  ),
].map((m) => ({
  via: m[1],
  nombre: m[2].slice(1, -1),
  precio: Number(m[3]),
  lat: Number(m[4]),
  lng: Number(m[5]),
  revisar: m[7] === 'true',
}));
if (puntos.length !== DESTINOS.length)
  throw new Error(
    `tabuladorElVigia.ts tiene ${puntos.length} destinos; la hoja ${DESTINOS.length}`,
  );

async function ruta(destino) {
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
  return typeof m === 'number' ? m : null;
}

for (const p of puntos) {
  const k = `${p.lat},${p.lng}`;
  if (k in cache) continue;
  cache[k] = await ruta(p);
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}
for (const p of puntos) {
  const m = cache[`${p.lat},${p.lng}`];
  p.km = m == null ? null : Math.round(m / 100) / 10;
  p.porKm = p.km ? p.precio / 100 / p.km : null;
}

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};
const promedio = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const f2 = (x) => (x == null ? '—' : x.toFixed(2).replace('.', ','));
const f1 = (x) => (x == null ? '—' : x.toFixed(1).replace('.', ','));

// Los puntos que entran al cálculo: afuera de las carreras cortas, con km medido.
const medidos = puntos.filter((p) => p.via !== 'cortas' && p.km != null && p.km > 0);

// Mínimos cuadrados (para comparar) y envolvente de abajo (la que se usa).
const n = medidos.length;
const sx = medidos.reduce((a, p) => a + p.km, 0);
const sy = medidos.reduce((a, p) => a + p.precio, 0);
const sxx = medidos.reduce((a, p) => a + p.km * p.km, 0);
const sxy = medidos.reduce((a, p) => a + p.km * p.precio, 0);
const pendienteMc = (n * sxy - sx * sy) / (n * sxx - sx * sx);
const baseMc = (sy - pendienteMc * sx) / n;

/**
 * La regla (decidida el 25 nov 2026): base 0 (el mínimo de 1 $ cubre lo corto, así ningún viaje urbano
 * se encarece) y el por-km MÁS ALTO que deja el calculado por debajo o igual a la calle en al menos el
 * 90 % de los destinos medidos con punto seguro, sin pasar 1,10 $ a 3 km. El 10 % que queda por encima
 * son tramos que la calle cobra barato (la vía Táchira): ahí manda el precio fijo de la hoja.
 * También se guarda la envolvente estricta (ningún destino por encima), solo para comparar.
 */
const seguros = medidos.filter((p) => !p.revisar);
const encimaCon = (base, porKm) =>
  seguros.filter((p) => Math.max(100, base + porKm * p.km) > p.precio).length;
let estricta = null;
for (let porKm = 80; porKm >= 10 && !estricta; porKm--)
  if (encimaCon(0, porKm) === 0) estricta = porKm;
let elegido = null;
for (let porKm = 80; porKm >= 10 && !elegido; porKm--)
  if (encimaCon(0, porKm) <= Math.floor(seguros.length * 0.1) && 3 * porKm <= 110) elegido = porKm;
if (!elegido) throw new Error('No hay tarifa que cumpla la regla');
const TARIFA = { base: 0, porKm: elegido, porMinuto: 0, minimo: 100 };
const calculado = (km) => Math.max(TARIFA.minimo, Math.round(TARIFA.base + TARIFA.porKm * km));

let md = `# Tabulador de El Vigía (moto taxi) y la tarifa aprendida

> C-TABULADOR-VIGIA · Venezuela · zona \`VE-MER-ELVIGIA\` · generado por
> \`scripts/tabulador/aprender-tarifa-vigia.mjs\` (no se edita a mano: se corre otra vez).

Encargo de Richard del 25 nov 2026: Divoox cobra como la calle de El Vigía, no más. La hoja que se
transcribe aquí es el «Tabulador de Carreras Urbanas y Extra Urbanas de Moto Taxis». Los precios son en
dólares, desde El Vigía. De noche (9 pm a 6 am, hora de Venezuela) llevan un recargo del 30 %.

## 1. El tabulador, tal cual, por vía

`;
for (const [via, nombre] of Object.entries(VIAS)) {
  md += `### ${nombre}\n\n`;
  md += DESTINOS.filter((d) => d[0] === via)
    .map((d) => `- ${d[1]}: ${d[2]} $`)
    .join('\n');
  md += '\n\n';
}
md += `## 2. Distancia real por carretera y dólares por kilómetro

Distancia medida con Google Routes desde el centro de El Vigía (Plaza Bolívar, 8,6219 / -71,6506)
hasta el punto de cada destino. «Revisar» = el punto es aproximado (Google no lo ubicó con confianza):
su km también lo es. En el panel se corrige el punto y queda desmarcado.

| Vía | Destino | km | Precio | $ por km | Punto |
|---|---|---:|---:|---:|---|
`;
for (const p of puntos)
  md += `| ${VIAS[p.via]} | ${p.nombre} | ${f1(p.km)} | ${p.precio / 100} $ | ${f2(p.porKm)} | ${p.revisar ? 'revisar' : 'ok'} |\n`;

md += `\n## 3. Promedio y mediana por vía ($ por km)\n\n| Vía | Destinos medidos | Promedio | Mediana |\n|---|---:|---:|---:|\n`;
for (const [via, nombre] of Object.entries(VIAS)) {
  const xs = puntos.filter((p) => p.via === via && p.porKm != null).map((p) => p.porKm);
  md += `| ${nombre} | ${xs.length} | ${f2(promedio(xs))} | ${f2(mediana(xs))} |\n`;
}
const todos = medidos.map((p) => p.porKm);
md += `| Todas, sin carreras cortas | ${todos.length} | ${f2(promedio(todos))} | ${f2(mediana(todos))} |\n`;

const encima = seguros.filter((p) => calculado(p.km) > p.precio);
const cortosMedidos = puntos.filter((p) => p.via === 'cortas' && p.km != null);
const encimaCortas = cortosMedidos.filter((p) => calculado(p.km) > p.precio);
md += `
## 4. La tarifa de moto de El Vigía (para los destinos que no están en la lista)

- **Mínimo: ${f2(TARIFA.minimo / 100)} $** (la carrera corta de la hoja).
- **Base: ${f2(TARIFA.base / 100)} $** y **${f2(TARIFA.porKm / 100)} $ por km** por carretera.
- **Por minuto: 0** (el precio no depende del tráfico: como en la calle, se sabe antes de salir).
- Recargo nocturno: +30 % de 9 pm a 6 am (C-RECARGO-NOCHE).

Cómo se eligió: base 0 (el mínimo de 1 $ ya cubre lo corto, así ningún viaje urbano se encarece) y
el por km más alto que deja el calculado por debajo o igual a la calle en al menos el 90 % de los
${seguros.length} destinos medidos con punto seguro (sin las carreras cortas ni los puntos «revisar»), sin
pasar 1,10 $ a 3 km. Por mínimos cuadrados habría salido base ${f2(baseMc / 100)} $ y ${f2(pendienteMc / 100)} $
por km, pero esa recta pasa el precio de la calle en la mitad de los destinos, y Richard pidió lo
contrario: que la app nunca cobre más que la calle. La recta que no pasa NINGÚN destino sería de
${f2((estricta ?? 0) / 100)} $ por km: con ella el calculado gana en casi todos los destinos de la lista (gana
siempre el más bajo) y el conductor cobraría bastante menos que en la calle en los viajes largos.

Destinos con punto seguro donde el calculado pasaría el tabulador (ahí manda el precio fijo de la hoja): ${encima.length ? encima.map((p) => p.nombre).join(', ') : 'ninguno'}.
En las carreras cortas (dentro del casco) el calculado pasa la hoja en: ${encimaCortas.length ? encimaCortas.map((p) => `${p.nombre} (${f2(calculado(p.km) / 100)} $ contra ${p.precio / 100} $)`).join(', ') : 'ninguna'};
ahí manda el precio fijo de la hoja (gana siempre el más bajo).

Por qué una sola recta y no una por tramo: el modelo de tarifa tiene un solo por-km. La calle cobra
unos 0,40-0,50 $ por km en los tramos largos de Mérida, El Zulia y la Panamericana, y menos en la vía
Táchira (mediana 0,36); dentro del casco cobra 1 $ hasta unos 4 o 5 km. Se eligió el valor que no
encarece los viajes urbanos (con base 0, hasta 3 km sale el mínimo de 1 $) y que queda por debajo de la
calle en casi todos los destinos; en los viajes largos el calculado queda algo más barato que la calle,
y en los destinos de la lista el pasajero paga el más bajo de los dos.

### Calculado contra calle (destinos medidos)

| Destino | km | Calle | Calculado |
|---|---:|---:|---:|
`;
for (const p of medidos)
  md += `| ${p.nombre} | ${f1(p.km)} | ${p.precio / 100} $ | ${f2(calculado(p.km) / 100)} $ |\n`;

writeFileSync(join(RAIZ, 'docs/TABULADOR-EL-VIGIA.md'), md);
// Con el formato del repositorio (si no, el gancho de commit lo cambia).
execFileSync('npx', ['prettier', '--write', 'docs/TABULADOR-EL-VIGIA.md'], {
  cwd: RAIZ,
  stdio: 'ignore',
});
console.log(
  'TARIFA',
  JSON.stringify(TARIFA),
  'mínimos cuadrados',
  baseMc.toFixed(1),
  pendienteMc.toFixed(2),
  'estricta',
  estricta,
);
for (const [via, nombre] of Object.entries(VIAS)) {
  const xs = puntos.filter((p) => p.via === via && p.porKm != null).map((p) => p.porKm);
  console.log(nombre, 'promedio', f2(promedio(xs)), 'mediana', f2(mediana(xs)));
}
console.log('encima', encima.map((p) => p.nombre).join(', ') || 'ninguno');
