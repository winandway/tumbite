// Carga en Google Play el nombre, la descripción corta y la larga de las tres apps, en inglés de
// EE. UU. (el principal) y en español (26 oct 2026). Los textos salen de docs/TIENDAS.md y viven
// en fichas-google-play.json. Uso: node scripts/tiendas/fichas-google-play.mjs [paquete]
// «contacto» no es un idioma: es el correo y la web de contacto de la ficha (C-FICHA-CONTACTO, 13 nov
// 2026), el buzón de soporte de cada app. Pasa por el auditor de tiendas antes de correrlo.
import { readFileSync } from 'node:fs';
import { googlePlay } from './google-play.mjs';

const FICHAS = JSON.parse(readFileSync(new URL('./fichas-google-play.json', import.meta.url)));
const solo = process.argv[2];
for (const [paquete, idiomas] of Object.entries(FICHAS)) {
  if (solo && solo !== paquete) continue;
  const { pedir, editar } = await googlePlay(paquete);
  const { contacto, ...porIdioma } = idiomas;
  await editar(async (id) => {
    if (contacto) await pedir(`/edits/${id}/details`, { metodo: 'PATCH', json: contacto });
    // Las fichas es-ES y es-US que ya existan en la consola llevan el mismo texto en español.
    const hay = ((await pedir(`/edits/${id}/listings`, { metodo: 'GET' })).listings ?? []).map(
      (l) => l.language,
    );
    const todas = Object.entries(porIdioma)
      .filter(([idioma]) => idioma !== 'contacto')
      .flatMap(([idioma, ficha]) =>
        idioma === 'es-419'
          ? ['es-419', ...['es-ES', 'es-US'].filter((i) => hay.includes(i))].map((i) => [i, ficha])
          : [[idioma, ficha]],
      );
    for (const [idioma, ficha] of todas)
      await pedir(`/edits/${id}/listings/${idioma}`, {
        metodo: 'PUT',
        json: { language: idioma, ...ficha },
      });
  });
  console.log(`ficha lista: ${paquete} (${Object.keys(porIdioma).join(', ')})`);
}
