// C-PRUEBAS-OTRO-PAQUETE (18 nov 2026, aprobado por Gerencia) — todos los países. Richard instaló por
// enlace la app de PRUEBAS de Android y después Google Play no pudo poner encima la de la tienda (mismo
// paquete, otra firma): seguía abriendo la de pruebas. Desde ahora el perfil «pruebas» de Android
// compila con OTRO paquete y otro nombre visible, con su ícono marcado «PRUEBAS»; producción e iPhone
// no cambian. La pieza la usan los tres app.config.js.
const { existsSync, readFileSync } = require('node:fs');

/** El paquete de pruebas: el de la tienda con «.pruebas» al final. */
const SUFIJO_PRUEBAS = '.pruebas';

/** El nombre visible de cada app de pruebas (por el paquete de la tienda). */
const NOMBRES_PRUEBAS = new Map([
  ['com.windoce.tumbite', 'Divoox Pruebas'],
  ['com.windoce.tumbite.driver', 'Driver Pruebas'],
  ['com.windoce.tumbite.restaurants', 'Restaurants Pruebas'],
]);

/** ¿Esta compilación es la de pruebas de Android? (EAS lo dice en la nube y en esta Mac). */
function esPruebasAndroid(env = process.env) {
  return env.EAS_BUILD_PROFILE === 'pruebas' && env.EAS_BUILD_PLATFORM === 'android';
}

/** Los paquetes que trae un google-services.json. */
function paquetesDe(contenido) {
  const d = JSON.parse(contenido);
  return (d.client ?? []).map((c) => c?.client_info?.android_client_info?.package_name);
}

/**
 * El archivo de avisos de Android de las pruebas TIENE que traer el paquete de pruebas; si no, la
 * compilación se detiene con un mensaje en palabras (nunca sale una app de pruebas sin avisos).
 */
function revisarServicios(paquete, archivo) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- la ruta la pone la compilación (GOOGLE_SERVICES_JSON)
  if (!archivo || !existsSync(archivo))
    throw new Error(
      `La app de pruebas (${paquete}) necesita el archivo de avisos de Android (google-services.json) y no está. No se compila.`,
    );
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- la misma ruta de la compilación
  if (!paquetesDe(readFileSync(archivo, 'utf8')).includes(paquete))
    throw new Error(
      `El archivo de avisos de Android (${archivo}) no trae el paquete ${paquete}. Hay que darlo de alta en Firebase (proyecto de las apps) y bajar el archivo nuevo a ~/.config/tumbite. No se compila.`,
    );
}

/**
 * La configuración de Expo para el perfil «pruebas» de Android: otro paquete, otro nombre y el ícono
 * marcado. Fuera de ese perfil devuelve la configuración tal cual.
 */
function conPerfilPruebas(config, env = process.env) {
  if (!esPruebasAndroid(env)) return config;
  const tienda = config.android?.package;
  const nombre = NOMBRES_PRUEBAS.get(tienda ?? '');
  if (!tienda || !nombre) throw new Error(`No hay nombre de pruebas para el paquete ${tienda}.`);
  const paquete = `${tienda}${SUFIJO_PRUEBAS}`;
  revisarServicios(paquete, env.GOOGLE_SERVICES_JSON);
  return {
    ...config,
    name: nombre,
    icon: './assets/pruebas/icon.png',
    android: {
      ...config.android,
      package: paquete,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: './assets/pruebas/android-icon-foreground.png',
      },
    },
  };
}

module.exports = {
  SUFIJO_PRUEBAS,
  NOMBRES_PRUEBAS,
  esPruebasAndroid,
  paquetesDe,
  revisarServicios,
  conPerfilPruebas,
};
