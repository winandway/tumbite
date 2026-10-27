// Sube un .aab a Google Play (por defecto a pruebas internas, como borrador) con la cuenta de
// servicio de la empresa (26 oct 2026).
// Uso: node scripts/tiendas/subir-google-play.mjs <paquete> <archivo.aab> [pista]
import { readFileSync } from 'node:fs';
import { googlePlay } from './google-play.mjs';

const [paquete, aab, pista = 'internal'] = process.argv.slice(2);
if (!paquete || !aab) {
  console.error('Uso: node scripts/tiendas/subir-google-play.mjs <paquete> <archivo.aab> [pista]');
  process.exit(1);
}
const { pedir, editar } = await googlePlay(paquete);
await editar(async (id) => {
  const subido = await pedir(`/edits/${id}/bundles`, { subir: true, binario: readFileSync(aab) });
  console.log(`subido: versión ${subido.versionCode}`);
  await pedir(`/edits/${id}/tracks/${pista}`, {
    metodo: 'PUT',
    json: {
      track: pista,
      releases: [{ status: 'draft', versionCodes: [String(subido.versionCode)] }],
    },
  });
});
console.log(`listo: ${paquete} en la pista «${pista}» como borrador`);
