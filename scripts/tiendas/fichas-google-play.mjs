// Carga en Google Play el nombre, la descripción corta y la larga de las tres apps, en inglés de
// EE. UU. (el principal) y en español (26 oct 2026). Los textos salen de docs/TIENDAS.md y viven
// en fichas-google-play.json. Uso: node scripts/tiendas/fichas-google-play.mjs [paquete]
import { readFileSync } from 'node:fs';
import { googlePlay } from './google-play.mjs';

const FICHAS = JSON.parse(readFileSync(new URL('./fichas-google-play.json', import.meta.url)));
const solo = process.argv[2];
for (const [paquete, idiomas] of Object.entries(FICHAS)) {
  if (solo && solo !== paquete) continue;
  const { pedir, editar } = await googlePlay(paquete);
  await editar(async (id) => {
    for (const [idioma, ficha] of Object.entries(idiomas))
      await pedir(`/edits/${id}/listings/${idioma}`, {
        metodo: 'PUT',
        json: { language: idioma, ...ficha },
      });
  });
  console.log(`ficha lista: ${paquete} (${Object.keys(idiomas).join(', ')})`);
}
