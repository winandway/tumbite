// Sube un .aab a Google Play (por defecto a pruebas internas, como borrador) con la cuenta de
// servicio de la empresa (26 oct 2026).
// Uso: node scripts/tiendas/subir-google-play.mjs <paquete> <archivo.aab> [pista] [nombre]
// Con [nombre] la versión queda completa en esa pista (los probadores la reciben); sin él, borrador.
// La pista de producción no se sube por aquí: va por publicar-google-play.mjs (candado de revisión).
import { readFileSync } from 'node:fs';
import { googlePlay } from './google-play.mjs';
import { exigirSinFranja } from './sin-franja.mjs';

const [paquete, aab, pista = 'internal', nombre] = process.argv.slice(2);
if (!paquete || !aab) {
  console.error(
    'Uso: node scripts/tiendas/subir-google-play.mjs <paquete> <archivo.aab> [pista] [nombre]',
  );
  process.exit(1);
}
if (pista === 'production') {
  console.error('Producción se sube con publicar-google-play.mjs, no con este guion.');
  process.exit(1);
}
// C-FRANJA-SOLO-EN-PRUEBAS: tampoco la prueba interna recibe un archivo que pinte la franja.
exigirSinFranja(paquete, aab);
const { pedir, editar } = await googlePlay(paquete);
await editar(async (id) => {
  const subido = await pedir(`/edits/${id}/bundles`, { subir: true, binario: readFileSync(aab) });
  console.log(`subido: versión ${subido.versionCode}`);
  await pedir(`/edits/${id}/tracks/${pista}`, {
    metodo: 'PUT',
    json: {
      track: pista,
      releases: [
        nombre
          ? {
              name: `${nombre} (${subido.versionCode})`,
              status: 'completed',
              versionCodes: [String(subido.versionCode)],
            }
          : { status: 'draft', versionCodes: [String(subido.versionCode)] },
      ],
    },
  });
});
console.log(`listo: ${paquete} en la pista «${pista}»${nombre ? '' : ' como borrador'}`);
