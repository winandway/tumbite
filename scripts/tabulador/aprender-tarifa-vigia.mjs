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
 * La regla (decidida por el coordinador el 25 nov 2026, devolución del revisor): base 0, por minuto
 * 0, mínimo 1 $ y el por-km = la MEDIANA de los dólares por km de los destinos con punto seguro (sin
 * las carreras cortas ni los puntos «revisar»), redondeada al centavo. Con la mediana, donde el
 * calculado pasa la hoja gana el fijo (el pasajero paga la hoja) y donde queda por debajo queda
 * cerca: el tabulador se usa de verdad y el conductor cobra como en la calle. La regla anterior (el
 * por-km más alto que deja el 90 % por debajo de la calle: 0,33 $) dejaba el calculado entre un 25 y
 * un 50 % por debajo de la hoja en unos 70 destinos: el tabulador casi no se usaba.
 */
const seguros = medidos.filter((p) => !p.revisar);
const medianaSegura = mediana(seguros.map((p) => p.porKm));
const TARIFA = { base: 0, porKm: Math.round(medianaSegura * 100), porMinuto: 0, minimo: 100 };
const calculado = (km) => Math.max(TARIFA.minimo, Math.round(TARIFA.base + TARIFA.porKm * km));
/** Lo que cobra la app de día: el menor entre la hoja y el calculado (umbral 0 en El Vigía). */
const cobraApp = (p) => (p.km == null ? p.precio : Math.min(p.precio, calculado(p.km)));
let estricta = null;
for (let porKm = 80; porKm >= 10 && !estricta; porKm--)
  if (seguros.every((p) => Math.max(100, porKm * p.km) <= p.precio)) estricta = porKm;

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

«Cobra la app» = lo que paga el pasajero de día desde el centro: el menor entre la hoja y el calculado
con la tarifa de la sección 4 (en El Vigía el fijo gana siempre que no sea más caro). «Contra la calle»
= cuánto menos que la hoja (0 = igual que la calle). De noche, las dos columnas llevan un 30 % más.

| Vía | Destino | km | Hoja | $ por km | Cobra la app | Contra la calle | Punto |
|---|---|---:|---:|---:|---:|---:|---|
`;
for (const p of puntos) {
  const app = cobraApp(p);
  const dif = app - p.precio;
  md += `| ${VIAS[p.via]} | ${p.nombre} | ${f1(p.km)} | ${p.precio / 100} $ | ${f2(p.porKm)} | ${f2(app / 100)} $ | ${dif === 0 ? '0' : `${f2(dif / 100)} $ (${Math.round((dif / p.precio) * 100)} %)`} | ${p.revisar ? 'revisar' : 'ok'} |\n`;
}

md += `\n## 3. Promedio y mediana por vía ($ por km)\n\n| Vía | Destinos medidos | Promedio | Mediana |\n|---|---:|---:|---:|\n`;
for (const [via, nombre] of Object.entries(VIAS)) {
  const xs = puntos.filter((p) => p.via === via && p.porKm != null).map((p) => p.porKm);
  md += `| ${nombre} | ${xs.length} | ${f2(promedio(xs))} | ${f2(mediana(xs))} |\n`;
}
const todos = medidos.map((p) => p.porKm);
md += `| Todas, sin carreras cortas | ${todos.length} | ${f2(promedio(todos))} | ${f2(mediana(todos))} |\n`;
md += `| Con punto seguro, sin carreras cortas | ${seguros.length} | ${f2(promedio(seguros.map((p) => p.porKm)))} | ${f2(medianaSegura)} |\n`;

md += `\n### Precio de la app contra la hoja, por vía (de día, desde el centro)\n\n| Vía | Destinos | Igual a la hoja | Por debajo | Suma de la hoja | Suma de la app | La app cobra |\n|---|---:|---:|---:|---:|---:|---:|\n`;
for (const [via, nombre] of Object.entries(VIAS)) {
  const xs = puntos.filter((p) => p.via === via);
  const hoja = xs.reduce((a, p) => a + p.precio, 0);
  const app = xs.reduce((a, p) => a + cobraApp(p), 0);
  md += `| ${nombre} | ${xs.length} | ${xs.filter((p) => cobraApp(p) === p.precio).length} | ${xs.filter((p) => cobraApp(p) < p.precio).length} | ${f2(hoja / 100)} $ | ${f2(app / 100)} $ | ${Math.round((app / hoja) * 100)} % de la hoja |\n`;
}

const encima = seguros.filter((p) => calculado(p.km) > p.precio);
const cortosMedidos = puntos.filter((p) => p.via === 'cortas' && p.km != null);
const encimaCortas = cortosMedidos.filter((p) => calculado(p.km) > p.precio);
md += `
## 4. La tarifa de moto de El Vigía (para los destinos que no están en la lista)

- **Mínimo: ${f2(TARIFA.minimo / 100)} $** (la carrera corta de la hoja).
- **Base: ${f2(TARIFA.base / 100)} $** y **${f2(TARIFA.porKm / 100)} $ por km** por carretera.
- **Por minuto: 0** (el precio no depende del tráfico: como en la calle, se sabe antes de salir).
- Recargo nocturno: +30 % de 9 pm a 6 am (C-RECARGO-NOCHE).

Cómo se eligió: el por km es la MEDIANA de los dólares por km de los ${seguros.length} destinos con punto
seguro (sin las carreras cortas ni los puntos «revisar»): ${medianaSegura.toFixed(4).replace('.', ',')} $, redondeada al
centavo. Base 0 y por minuto 0 (como en la calle, el precio se sabe antes de salir) y mínimo 1 $ (la
carrera corta de la hoja). En El Vigía el pasajero paga el MENOR entre la hoja y el calculado: con la
mediana, en la mitad de los destinos el calculado pasa la hoja y gana el fijo (el pasajero paga
exactamente el tabulador), y en la otra mitad el calculado queda cerca, apenas por debajo. Así el
tabulador se usa de verdad y el conductor cobra como en la calle.

Por qué no otras rectas: la de mínimos cuadrados (base ${f2(baseMc / 100)} $ y ${f2(pendienteMc / 100)} $ por km) cobra
1 $ de base aun en lo corto. La más alta que no pasa NINGÚN destino (${f2((estricta ?? 0) / 100)} $ por km) y la que dejaba
el 90 % por debajo de la calle (0,33 $, la primera versión) dejaban el calculado muy por debajo de la
hoja en la mayoría de los destinos: casi nunca se cobraba el tabulador y el conductor perdía.

Lo que no cubre una sola recta: la vía Táchira cobra menos por km (mediana 0,36) y ahí el fijo gana
casi siempre; dentro del casco la calle cobra 1 $ hasta unos 4 km, y un viaje urbano FUERA de la lista
sale por km (por ejemplo 3 km = ${f2(calculado(3) / 100)} $): los barrios de la lista sí cobran su precio de la hoja.

Destinos con punto seguro donde el calculado pasa la hoja (ahí la app cobra la hoja): ${encima.length}.
En las carreras cortas el calculado pasa la hoja en ${encimaCortas.length} de ${cortosMedidos.length}; ahí también
cobra la hoja.

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
  'mediana segura',
  medianaSegura,
);
for (const [via, nombre] of Object.entries(VIAS)) {
  const xs = puntos.filter((p) => p.via === via && p.porKm != null).map((p) => p.porKm);
  console.log(nombre, 'promedio', f2(promedio(xs)), 'mediana', f2(mediana(xs)));
}
console.log('encima', encima.map((p) => p.nombre).join(', ') || 'ninguno');
