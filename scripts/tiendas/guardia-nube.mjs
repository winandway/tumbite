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

/**
 * Lo que la nube de Expo le pone a cada compilación y esta Mac no tiene sola: el archivo de avisos
 * de Android (google-services.json) y la llave del mapa. Sin ellos la app compila, pero sale SIN
 * mapa (queda el texto de relleno en el manifiesto) y SIN avisos al celular: pasó el 18 nov con las
 * primeras compilaciones locales. Se leen de ~/.config/tumbite y, si falta alguno, NO se compila.
 */
export function entornoLocal(base = process.env) {
  const dir = base.DIVOOX_CONFIG_DIR ?? join(homedir(), '.config', 'tumbite');
  const servicios = join(dir, 'google-services.json');
  const llave = join(dir, 'google-maps-android-key');
  for (const f of [servicios, llave, join(dir, 'expo-token')])
    if (!existsSync(f))
      throw new Error(
        `Falta ${f}: sin ese archivo la app saldría sin mapa o sin avisos. No se compila.`,
      );
  const mapa = readFileSync(llave, 'utf8').trim();
  if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(mapa))
    throw new Error(`La llave del mapa guardada en ${llave} no parece una llave de Google.`);
  return {
    ...base,
    EXPO_TOKEN: readFileSync(join(dir, 'expo-token'), 'utf8').trim(),
    GOOGLE_SERVICES_JSON: servicios,
    GOOGLE_MAPS_ANDROID_KEY: mapa,
    JAVA_HOME: base.JAVA_HOME ?? '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
    ANDROID_HOME: base.ANDROID_HOME ?? join(homedir(), 'Library', 'Android', 'sdk'),
    EXPO_NO_CAPABILITY_SYNC: '1',
  };
}

/** El texto de relleno que queda en el manifiesto cuando la app se compiló sin la llave del mapa. */
export const RELLENO_MAPA = 'PON_AQUI_LA_LLAVE_DE_GOOGLE_MAPS';

/** ¿El archivo compilado de Android lleva el relleno en vez de la llave? (APK o AAB, ya en memoria). */
export function llevaRelleno(bytesDelManifiesto) {
  const b = Buffer.from(bytesDelManifiesto);
  return (
    b.includes(Buffer.from(RELLENO_MAPA, 'utf8')) ||
    b.includes(Buffer.from(RELLENO_MAPA, 'utf16le'))
  );
}
