// C-CAMILA-CONOCIMIENTO (18 nov 2026, Richard): Camila sabe TODO lo que dicen las guías públicas de
// Docs del cliente y del conductor, en los dos idiomas. Este guion lee las guías del sitio
// (apps/panel/src/sitio/docs/guias.ts) y escribe apps/servidor/src/camila/docsPublicos.ts, que es lo
// que el servidor consulta. Solo guías PÚBLICAS: nada de la ayuda interna.
// Uso: node scripts/camila/generar-docs.mjs          (escribe el archivo)
//      node scripts/camila/generar-docs.mjs --check  (falla si el archivo quedó viejo)
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..', '..');
const destino = join(raiz, 'apps', 'servidor', 'src', 'camila', 'docsPublicos.ts');
// Las secciones que le sirven a un cliente o a un conductor.
const SECCIONES = ['ordering', 'drivers', 'trust', 'account'];

const r = await build({
  entryPoints: [join(raiz, 'apps', 'panel', 'src', 'sitio', 'docs', 'guias.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
});
const { DOCS } = await import(
  `data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`
);

const corto = (t, max) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);
const guias = [];
for (const idioma of ['es', 'en']) {
  for (const s of idioma === 'en' ? DOCS.en : DOCS.es) {
    if (!SECCIONES.includes(s.id)) continue;
    for (const g of s.guias) {
      guias.push({
        idioma,
        ruta: `${s.id}/${g.id}`,
        titulo: g.titulo,
        resumen: g.resumen,
        preguntas: g.preguntas ?? [],
        pasos: (g.pasos ?? []).map((p) => corto(p, 320)),
        // Lo que explica la guía, para buscar por palabras (no se muestra entero).
        cuerpo: corto((g.explicacion ?? []).join(' '), 1600),
      });
    }
  }
}
const salida = `// GENERADO por scripts/camila/generar-docs.mjs a partir de las guías públicas de Docs. No editar a mano.
export type GuiaPublica = {
  idioma: 'es' | 'en';
  ruta: string;
  titulo: string;
  resumen: string;
  preguntas: string[];
  pasos: string[];
  cuerpo: string;
};
export const DOCS_PUBLICOS: readonly GuiaPublica[] = ${JSON.stringify(guias, null, 1)};
`;
if (process.argv.includes('--check')) {
  if (readFileSync(destino, 'utf8') !== salida) {
    console.error(
      'camila: docsPublicos.ts está viejo. Corre: node scripts/camila/generar-docs.mjs',
    );
    process.exit(1);
  }
  console.log(`camila: ${guias.length} guías al día`);
} else {
  writeFileSync(destino, salida);
  console.log(`camila: ${guias.length} guías escritas`);
}
