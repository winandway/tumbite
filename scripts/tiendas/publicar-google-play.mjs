// Sube un .aab y lo deja como la versión de PRODUCCIÓN que revisa Google (reemplaza la anterior
// sin aprobar), en una sola edición. Con la cuenta de servicio de la empresa (29 oct 2026).
// Uso: node scripts/tiendas/publicar-google-play.mjs <paquete> <archivo.aab> <nombre-versión>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { googlePlay } from './google-play.mjs';

const [paquete, aab, nombre] = process.argv.slice(2);
if (!paquete || !aab || !nombre) {
  console.error(
    'Uso: node scripts/tiendas/publicar-google-play.mjs <paquete> <archivo.aab> <nombre>',
  );
  process.exit(1);
}
// C-PLAY-NO-CANCELAR (30 oct 2026): cada versión nueva CANCELA el envío que Google está revisando y
// la fila vuelve a empezar (las apps Divoox y Driver tenían 9 envíos cancelados así). Mientras una app
// espera su primera aprobación no se sube nada: el candado es ~/.config/tumbite/play-en-revision/<paquete>.
// Se quita a mano cuando Google la aprueba. FORZAR=1 sube igual (solo si Richard lo pide).
const candado = join(homedir(), '.config', 'tumbite', 'play-en-revision', paquete);
if (existsSync(candado) && process.env.FORZAR !== '1') {
  console.error(
    `NO SE SUBE ${paquete}: está en revisión de Google desde ${readFileSync(candado, 'utf8').trim()}. ` +
      'Subir otra versión cancelaría esa revisión. Los cambios esperan a que Google la apruebe.',
  );
  process.exit(3);
}
// C-FRANJA-SOLO-EN-PRUEBAS (18 nov 2026): la 46 y la 42 se publicaron pintando la franja «PRUEBAS».
// Nada se sube sin abrir antes la pantalla de entrar de ESTE archivo en el emulador. Sin salida de
// emergencia: si el emulador no está, se enciende; no se salta.
const APP_DE_PAQUETE = {
  'com.windoce.tumbite': 'cliente',
  'com.windoce.tumbite.driver': 'repartidor',
  'com.windoce.tumbite.restaurants': 'restaurante',
};
const appDelPaquete = new Map(Object.entries(APP_DE_PAQUETE)).get(paquete);
if (!appDelPaquete) {
  console.error(`NO SE SUBE ${paquete}: no es un paquete de la tienda conocido.`);
  process.exit(4);
}
try {
  execFileSync('bash', ['scripts/tiendas/comprobar-franja.sh', appDelPaquete, aab], {
    stdio: 'inherit',
  });
} catch {
  console.error(`NO SE SUBE ${paquete}: no pasó la comprobación de la pantalla de entrar.`);
  process.exit(4);
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
mkdirSync(join(homedir(), '.config', 'tumbite', 'play-en-revision'), { recursive: true });
writeFileSync(candado, `${new Date().toISOString()} versión ${nombre}\n`);
console.log(
  `listo: ${paquete} en producción (a revisión de Google); candado puesto hasta que la aprueben`,
);
