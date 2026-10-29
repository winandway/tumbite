// Sube un .aab y lo deja como la versión de PRODUCCIÓN que revisa Google (reemplaza la anterior
// sin aprobar), en una sola edición. Con la cuenta de servicio de la empresa (29 oct 2026).
// Uso: node scripts/tiendas/publicar-google-play.mjs <paquete> <archivo.aab> <nombre-versión>
import { readFileSync } from 'node:fs';
import { googlePlay } from './google-play.mjs';

const [paquete, aab, nombre] = process.argv.slice(2);
if (!paquete || !aab || !nombre) {
  console.error(
    'Uso: node scripts/tiendas/publicar-google-play.mjs <paquete> <archivo.aab> <nombre>',
  );
  process.exit(1);
}
const { pedir, editar } = await googlePlay(paquete);
await editar(async (id) => {
  const subido = await pedir(`/edits/${id}/bundles`, { subir: true, binario: readFileSync(aab) });
  console.log(`subido: versión ${subido.versionCode}`);
  await pedir(`/edits/${id}/tracks/production`, {
    metodo: 'PUT',
    json: {
      track: 'production',
      releases: [{ name: nombre, status: 'completed', versionCodes: [String(subido.versionCode)] }],
    },
  });
});
console.log(`listo: ${paquete} en producción (a revisión de Google)`);
