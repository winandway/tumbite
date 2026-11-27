// C-REGISTRO-TODO-EL-PAIS · cajas de los estados (26 nov 2026, pedido del revisor de calidad).
//
// El servidor no puede confiar en el `lat`/`lng` que manda la app: alguien podría decir «Maracaibo»
// con el punto de Miami y caer en una zona ajena. Sin base de datos y sin bajar el catálogo en el
// servidor, cada estado tiene su caja (mínimos y máximos de latitud y longitud de TODOS sus lugares
// publicados) y `lugarEnSuEstado` rechaza un punto fuera de la caja de su estado (con un margen).
//
// Se calcula de los archivos YA publicados (apps/panel/public/lugares), así la caja coincide al
// milésimo con los puntos que la app manda. Lo llama `generar-catalogo.mjs` al terminar, y se puede
// correr solo con `node scripts/lugares/generar-cajas.mjs` (sin red).
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: solo lee la carpeta fija del catálogo del repositorio y escribe un archivo fijo de packages/compartido */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** { 'VE-V': [minLat, maxLat, minLng, maxLng], … } en grados, a 3 decimales. */
export function cajasDesdeCatalogo(carpeta) {
  const cajas = {};
  for (const pais of ['VE', 'US']) {
    for (const nombre of readdirSync(join(carpeta, pais)).sort()) {
      if (!nombre.endsWith('.json') || nombre === 'principales.json') continue;
      const estado = nombre.replace(/\.json$/, '');
      const a = JSON.parse(readFileSync(join(carpeta, pais, nombre), 'utf8'));
      if (a.v !== 2 || !Array.isArray(a.f) || !a.f.length)
        throw new Error(`${pais}/${nombre}: formato desconocido o vacío`);
      let [minLat, maxLat, minLng, maxLng] = [Infinity, -Infinity, Infinity, -Infinity];
      for (const f of a.f) {
        minLat = Math.min(minLat, f[3]);
        maxLat = Math.max(maxLat, f[3]);
        minLng = Math.min(minLng, f[4]);
        maxLng = Math.max(maxLng, f[4]);
      }
      cajas[`${pais}-${estado}`] = [minLat, maxLat, minLng, maxLng].map((x) => x / 1000);
    }
  }
  return cajas;
}

export function escribirCajas(cajas, destino) {
  const lineas = Object.entries(cajas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  '${k}': [${v.join(', ')}],`);
  const texto = `// GENERADO por scripts/lugares/cajas.mjs (generar-catalogo.mjs o generar-cajas.mjs). No editar a mano.
// C-REGISTRO-TODO-EL-PAIS: la caja de cada estado (mínimos y máximos de latitud y longitud de todos
// sus lugares del catálogo), para rechazar un lugar con coordenadas falsas. Ver lugarEnSuEstado.ts.

/** «PAÍS-ESTADO» → [latitud mínima, latitud máxima, longitud mínima, longitud máxima], en grados. */
export const CAJAS_ESTADOS: Readonly<Record<string, readonly [number, number, number, number]>> = {
${lineas.join('\n')}
};
`;
  writeFileSync(destino, texto);
  return Object.keys(cajas).length;
}
