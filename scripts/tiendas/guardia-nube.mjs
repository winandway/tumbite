// C-COMPILA-EN-ESTA-MAC (18 nov 2026, Richard vía Gerencia): Expo marcó 317 dólares en compilaciones
// en un período contra 45 incluidos. Desde ese día TODA compilación se hace en esta Mac
// (`eas build --local`, gratis). La nube de Expo solo si lo local falla, con la bandera explícita
// `--nube` y avisando. Esta pieza es la única puerta: niega la nube sin la bandera y cuenta las
// compilaciones de cada día en ~/.config/tumbite/compilaciones/AAAA-MM-DD.txt.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const BANDERA_NUBE = '--nube';

const carpeta = () =>
  process.env.DIVOOX_COMPILACIONES_DIR ?? join(homedir(), '.config', 'tumbite', 'compilaciones');
const hoy = (ahora = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
};

/** ¿Pidieron la nube a propósito? Solo vale la bandera escrita en el comando. */
export const pidioNube = (argumentos = process.argv.slice(2)) => argumentos.includes(BANDERA_NUBE);

/** Las compilaciones de un día: cuántas en esta Mac y cuántas en la nube. */
export function contarDelDia(ahora = new Date()) {
  const archivo = join(carpeta(), `${hoy(ahora)}.txt`);
  const lineas = existsSync(archivo)
    ? readFileSync(archivo, 'utf8').split('\n').filter(Boolean)
    : [];
  const nube = lineas.filter((l) => l.split(' ')[1] === 'nube').length;
  return { local: lineas.length - nube, nube, total: lineas.length };
}

/**
 * Se llama ANTES de lanzar cualquier compilación. `donde` es 'local' o 'nube'. La nube sin la
 * bandera se niega con un error; todo lo que pasa queda anotado y contado.
 */
export function autorizarCompilacion({ donde, app, plataforma, perfil, argumentos, ahora }) {
  if (donde !== 'local' && donde !== 'nube') throw new Error(`Lugar desconocido: ${donde}`);
  if (donde === 'nube' && !pidioNube(argumentos))
    throw new Error(
      `Compilación en la nube de Expo NEGADA (${app}, ${plataforma}, ${perfil}): cuesta dinero. ` +
        `Se compila en esta Mac. Solo si lo local falla, repite el comando con ${BANDERA_NUBE} ` +
        'y avisa a Gerencia (C-COMPILA-EN-ESTA-MAC).',
    );
  mkdirSync(carpeta(), { recursive: true, mode: 0o700 });
  const momento = ahora ?? new Date();
  appendFileSync(
    join(carpeta(), `${hoy(momento)}.txt`),
    `${momento.toISOString()} ${donde} ${app} ${plataforma} ${perfil}\n`,
    { mode: 0o600 },
  );
  const cuenta = contarDelDia(momento);
  console.log(
    `Compilaciones de hoy: ${cuenta.total} (${cuenta.local} en esta Mac, ${cuenta.nube} en la nube de Expo).`,
  );
  if (donde === 'nube')
    console.log('AVISO: esta compilación va a la nube de Expo y se cobra. Avisa a Gerencia.');
  return cuenta;
}
