// C-LUGARES-ALIAS (27 nov 2026, emergencia de Bolívar): GeoNames junta varios lugares en una sola fila
// («Ciudad Guayana») y la gente escribe el nombre que usa («Puerto Ordaz», «San Félix»). Cada alias
// es otra fila del catálogo con el MISMO id de GeoNames que su ciudad: el buscador la encuentra por
// el nombre que la persona escribe y el servidor la ubica en la misma zona. Se aplica a los archivos
// ya generados (sin bajar GeoNames otra vez) y lo llama también generar-catalogo.mjs al final.
// Uso: node scripts/lugares/alias.mjs
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: archivos fijos del catálogo del repositorio; filas de una lista fija */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** [país, estado, alias, ciudad del catálogo, lat, lng] — el punto es el del lugar real. */
export const ALIAS = [
  ['VE', 'F', 'Puerto Ordaz', 'Ciudad Guayana', 8.296, -62.711],
  ['VE', 'F', 'San Félix', 'Ciudad Guayana', 8.37, -62.645],
  ['VE', 'F', 'Unare', 'Ciudad Guayana', 8.3, -62.68],
  ['VE', 'F', 'Alta Vista', 'Ciudad Guayana', 8.288, -62.739],
];

const RAIZ = join(import.meta.dirname, '..', '..', 'apps', 'panel', 'public', 'lugares');

function aplicar(archivo, pais, estado, conEstado) {
  const d = JSON.parse(readFileSync(archivo, 'utf8'));
  let cambio = false;
  for (const [p, e, alias, ciudad, lat, lng] of ALIAS) {
    if (p !== pais || (!conEstado && e !== estado)) continue;
    if (d.f.some((f) => f[1] === alias)) continue;
    const i = d.f.findIndex((f) => f[1] === ciudad && (!conEstado || d.e?.[f[5]] === e));
    if (i < 0) throw new Error(`${archivo}: no está «${ciudad}» para el alias «${alias}»`);
    const base = d.f[i];
    const fila = [base[0], alias, base[2], Math.round(lat * 1000), Math.round(lng * 1000)];
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
