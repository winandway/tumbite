// C-LUGARES-ALIAS (27 nov 2026, emergencia de Bolívar): GeoNames junta varios lugares en una sola fila
// («Ciudad Guayana») y la gente escribe el nombre que usa («Puerto Ordaz», «San Félix»). Cada alias
// es otra fila del catálogo con el MISMO id de GeoNames que su ciudad: el buscador la encuentra por
// el nombre que la persona escribe y el servidor la ubica en la misma zona. Se aplica a los archivos
// ya generados (sin bajar GeoNames otra vez) y lo llama también generar-catalogo.mjs al final.
// Uso: node scripts/lugares/alias.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: archivos fijos del catálogo del repositorio; filas de una lista fija */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESTINOS } from '../tabulador/destinos-vigia.mjs';

/** [país, estado, alias, ciudad del catálogo, lat, lng] — el punto es el del lugar real. */
export const ALIAS = [
  ['VE', 'F', 'Puerto Ordaz', 'Ciudad Guayana', 8.296, -62.711],
  ['VE', 'F', 'San Félix', 'Ciudad Guayana', 8.37, -62.645],
  ['VE', 'F', 'Unare', 'Ciudad Guayana', 8.3, -62.68],
  ['VE', 'F', 'Alta Vista', 'Ciudad Guayana', 8.288, -62.739],
  // Sectores del tabulador de Ciudad Guayana (28 nov 2026): el punto es el centro de la ciudad, que
  // cae en su zona. Si GeoNames ya trae el sector con su punto real, ese manda (no se duplica).
  ...[
    'Castillito',
    'Villa Asia',
    'Los Olivos',
    'Campo B',
    'Villa Colombia',
    'Cuchivero',
    'Villa Alianza',
    'Campo A',
    'Cachamay',
    'Chilemex',
    'Las Américas',
    'Core 8',
    'Guaiparo',
    'Vista al Sol',
    'Matanzas',
    'El Roble',
    'Dalla Costa',
    'UD-145',
    'Moscú',
    'Las Malvinas',
    'Chirica',
  ].map((n) => ['VE', 'F', n, 'Ciudad Guayana', 8.296, -62.711]),
  // Barrios de El Vigía: los del tabulador marcados «barrio» y los que la gente ya pidió.
  ...['12 de Octubre', 'Doce de Octubre'].map((n) => ['VE', 'L', n, 'El Vigía', 8.622, -71.651]),
  ...DESTINOS.filter((d) => d[3] === 'barrio').map((d) => [
    'VE',
    'L',
    d[1],
    'El Vigía',
    8.622,
    -71.651,
  ]),
];

/** 900 000 000 + un número fijo del nombre: no choca con GeoNames (sus números van por 13 millones). */
export function idAlias(estado, alias) {
  let h = 0;
  for (const ch of `${estado}|${alias}`) h = (h * 31 + ch.codePointAt(0)) % 99_999_989;
  return 900_000_000 + h;
}
const cerca = (f, lat, lng) =>
  Math.hypot(
    (f[3] / 1000 - lat) * 111,
    (f[4] / 1000 - lng) * 111 * Math.cos((lat * Math.PI) / 180),
  ) < 20;

const RAIZ = join(import.meta.dirname, '..', '..', 'apps', 'panel', 'public', 'lugares');

function aplicar(archivo, pais, estado, conEstado) {
  const d = JSON.parse(readFileSync(archivo, 'utf8'));
  let cambio = false;
  for (const [p, e, alias, ciudad, lat, lng] of ALIAS) {
    if (p !== pais || (!conEstado && e !== estado)) continue;
    // Ya está con su punto real cerca (un barrio de GeoNames): ese manda. Uno lejos con el mismo
    // nombre (otro pueblo) no cuenta: el sector se agrega igual.
    if (d.f.some((f) => f[1] === alias && cerca(f, lat, lng))) continue;
    const i = d.f.findIndex((f) => f[1] === ciudad && (!conEstado || d.e?.[f[5]] === e));
    if (i < 0) throw new Error(`${archivo}: no está «${ciudad}» para el alias «${alias}»`);
    const base = d.f[i];
    // Un número propio y fijo por sector: dos sectores de la misma ciudad («La Vega I» y «La Vega II»)
    // no se tapan en el buscador, que muestra un lugar por número.
    const fila = [
      idAlias(e, alias),
      alias,
      base[2],
      Math.round(lat * 1000),
      Math.round(lng * 1000),
    ];
    if (conEstado) fila.push(base[5]);
    d.f.splice(i + 1, 0, fila);
    cambio = true;
  }
  if (cambio) writeFileSync(archivo, JSON.stringify(d));
  return cambio;
}

export function aplicarAlias(raiz = RAIZ) {
  const paises = [...new Set(ALIAS.map((a) => a[0]))];
  for (const pais of paises) {
    for (const estado of new Set(ALIAS.filter((a) => a[0] === pais).map((a) => a[1])))
      aplicar(join(raiz, pais, `${estado}.json`), pais, estado, false);
    aplicar(join(raiz, pais, 'principales.json'), pais, null, true);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  aplicarAlias();
  console.log('alias aplicados');
}
