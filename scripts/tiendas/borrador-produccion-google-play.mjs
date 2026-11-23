// Sube un .aab a la pista de PRODUCCIÓN de Google Play como BORRADOR (status «draft»), SIN enviarlo a
// revisión: el envío lo hace Gerencia en la consola después de revisar la ficha (23 nov 2026).
// Conserva la versión que ya está en vivo (las «completed» de la pista) y reemplaza cualquier otro
// borrador. Las notas van en todos los idiomas de la ficha que correspondan:
//   NOTAS_EN → en-US (y en-GB si existe); NOTAS_ES → es-419 y, si la ficha los tiene, es-ES y es-US.
// Uso: NOTAS_EN="…" NOTAS_ES="…" node scripts/tiendas/borrador-produccion-google-play.mjs <paquete> <archivo.aab> <nombre-versión>
// C-PLAY-NO-CANCELAR: si la app tiene una revisión en curso (candado play-en-revision), no se toca.
// C-FRANJA-SOLO-EN-PRUEBAS: nada sube sin abrir antes la pantalla de entrar de ESTE archivo.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { googlePlay } from './google-play.mjs';
import { exigirSinFranja } from './sin-franja.mjs';

const [paquete, aab, nombre] = process.argv.slice(2);
if (!paquete || !aab || !nombre || !existsSync(aab)) {
  console.error(
    'Uso: NOTAS_EN="…" NOTAS_ES="…" node scripts/tiendas/borrador-produccion-google-play.mjs <paquete> <archivo.aab> <nombre-versión>',
  );
  process.exit(2);
}
if (existsSync(join(homedir(), '.config', 'tumbite', 'play-en-revision', paquete))) {
  console.error(`NO SE SUBE: ${paquete} tiene una revisión en curso (C-PLAY-NO-CANCELAR).`);
  process.exit(3);
}
if (!process.env.NOTAS_EN || !process.env.NOTAS_ES) {
  console.error('Faltan las notas de la versión (NOTAS_EN y NOTAS_ES).');
  process.exit(2);
}
exigirSinFranja(paquete, aab);

const { pedir, editar } = await googlePlay(paquete);
await editar(async (id) => {
  const fichas = (await pedir(`/edits/${id}/listings`, { metodo: 'GET' })).listings ?? [];
  const idiomas = new Set(fichas.map((f) => f.language));
  const notas = [
    ['en-US', process.env.NOTAS_EN],
    ...(idiomas.has('en-GB') ? [['en-GB', process.env.NOTAS_EN]] : []),
    ['es-419', process.env.NOTAS_ES],
    ...(idiomas.has('es-ES') ? [['es-ES', process.env.NOTAS_ES]] : []),
    ...(idiomas.has('es-US') ? [['es-US', process.env.NOTAS_ES]] : []),
  ].map(([language, text]) => ({ language, text }));
  const subido = await pedir(`/edits/${id}/bundles`, { subir: true, binario: readFileSync(aab) });
  console.log(`subido: versión ${subido.versionCode}`);
  const pista = await pedir(`/edits/${id}/tracks/production`, { metodo: 'GET' });
  const enVivo = (pista.releases ?? []).filter((r) => r.status === 'completed');
  await pedir(`/edits/${id}/tracks/production`, {
    metodo: 'PUT',
    json: {
      track: 'production',
      releases: [
        ...enVivo,
        {
          name: nombre,
          status: 'draft',
          versionCodes: [String(subido.versionCode)],
          releaseNotes: notas,
        },
      ],
    },
  });
  console.log(
    `notas en: ${notas.map((n) => n.language).join(', ')} · en vivo se conserva: ${enVivo.map((r) => r.versionCodes?.join('+')).join(', ') || 'ninguna'}`,
  );
});
console.log(
  `listo: ${paquete} ${nombre} quedó como BORRADOR en producción (sin enviar a revisión).`,
);
