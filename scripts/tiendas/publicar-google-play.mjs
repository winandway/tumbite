// Sube un .aab y lo deja como la versión de PRODUCCIÓN que revisa Google (reemplaza la anterior
// sin aprobar), en una sola edición. Con la cuenta de servicio de la empresa (29 oct 2026).
// Uso: node scripts/tiendas/publicar-google-play.mjs <paquete> <archivo.aab> <nombre-versión>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { googlePlay } from './google-play.mjs';
import { exigirSinFranja } from './sin-franja.mjs';

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
// C-FRANJA-SOLO-EN-PRUEBAS: nada se sube sin abrir antes la pantalla de entrar de ESTE archivo.
exigirSinFranja(paquete, aab);
const notas = [
  ['es-419', process.env.NOTAS_ES],
  ['en-US', process.env.NOTAS_EN],
]
  .filter(([, texto]) => texto)
  .map(([language, text]) => ({ language, text }));
const fraccion = process.env.FRACCION ? Number(process.env.FRACCION) : undefined;
if (fraccion !== undefined && !(fraccion > 0 && fraccion < 1)) {
  console.error('FRACCION tiene que ser mayor que 0 y menor que 1 (por ejemplo 0.2).');
  process.exit(2);
}
const { pedir, editar } = await googlePlay(paquete);
await editar(async (id) => {
  // YA_SUBIDA=<compilación>: el mismo archivo ya está en Play (por ejemplo en prueba interna) y solo
  // se promueve a producción; Play rechaza subir dos veces la misma compilación. La comprobación de
  // la franja de arriba corre igual sobre el archivo.
  const subido = process.env.YA_SUBIDA
    ? { versionCode: Number(process.env.YA_SUBIDA) }
    : await pedir(`/edits/${id}/bundles`, { subir: true, binario: readFileSync(aab) });
  console.log(
    `${process.env.YA_SUBIDA ? 'ya estaba subida' : 'subido'}: versión ${subido.versionCode}`,
  );
  await pedir(`/edits/${id}/tracks/production`, {
    metodo: 'PUT',
    json: {
      track: 'production',
      releases: [
        {
          name: nombre,
          // FRACCION=0.2: despliegue escalonado (24 nov 2026); sin ella, al 100 %.
          ...(fraccion
            ? { status: 'inProgress', userFraction: fraccion }
            : { status: 'completed' }),
          versionCodes: [String(subido.versionCode)],
          // Notas de la versión (aprobadas por el auditor), si se pasan: NOTAS_ES y NOTAS_EN.
          ...(notas.length ? { releaseNotes: notas } : {}),
        },
      ],
    },
  });
});
mkdirSync(join(homedir(), '.config', 'tumbite', 'play-en-revision'), { recursive: true });
writeFileSync(candado, `${new Date().toISOString()} versión ${nombre}\n`);
console.log(
  `listo: ${paquete} en producción (a revisión de Google); candado puesto hasta que la aprueben`,
);
