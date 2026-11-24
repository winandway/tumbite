// Sube al 100 % una versión de producción de Google Play que está en despliegue escalonado
// (24 nov 2026). Solo cuando Google YA la aprobó: tocar la pista mientras está en revisión
// cambia el envío. Uso: node scripts/tiendas/completar-despliegue.mjs <paquete> <versionCode>
import { googlePlay } from './google-play.mjs';

const [paquete, codigo] = process.argv.slice(2);
if (!paquete || !codigo) {
  console.error('Uso: node scripts/tiendas/completar-despliegue.mjs <paquete> <versionCode>');
  process.exit(2);
}
const { pedir, editar } = await googlePlay(paquete);
await editar(async (id) => {
  const pista = await pedir(`/edits/${id}/tracks/production`, { metodo: 'GET' });
  const version = pista.releases?.find((r) => r.versionCodes?.includes(String(codigo)));
  if (!version) throw new Error(`la versión ${codigo} no está en producción`);
  if (version.status === 'completed') {
    console.log(`${paquete} ${codigo} ya estaba al 100 %`);
    return;
  }
  const resto = { ...version };
  delete resto.userFraction;
  await pedir(`/edits/${id}/tracks/production`, {
    metodo: 'PUT',
    json: { track: 'production', releases: [{ ...resto, status: 'completed' }] },
  });
  console.log(`${paquete} ${codigo} al 100 %`);
});
