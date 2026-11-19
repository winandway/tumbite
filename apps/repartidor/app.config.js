// Avisos y mapa de Android (26 oct 2026). EAS entrega como secretos de la organización
// windoce-llc el google-services.json del proyecto divoox-apps (GOOGLE_SERVICES_JSON) y la llave
// del mapa restringida a nuestras apps (GOOGLE_MAPS_ANDROID_KEY). Ninguno va al repositorio.
// Sin las variables, la app compila igual pero sin avisos ni mapa en Android.
// C-APK-PRUEBAS (8 nov 2026): las compilaciones del perfil «pruebas» (apuntan a staging) llevan
// «PRUEBAS» en el nombre visible para no confundirlas con las de la tienda. Producción no cambia.
// C-PRUEBAS-OTRO-PAQUETE (18 nov 2026): en Android, el perfil «pruebas» compila con otro paquete
// («.pruebas»), otro nombre y el ícono marcado (scripts/tiendas/perfil-pruebas.cjs), para que la de la
// tienda se pueda instalar al lado. En iPhone sigue como estaba.
const { conPerfilPruebas, esPruebasAndroid } = require('../../scripts/tiendas/perfil-pruebas.cjs');

const esPruebas = process.env.EAS_BUILD_PROFILE === 'pruebas';

module.exports = ({ config }) => conPerfilPruebas(base(config));

const base = (config) => ({
  ...config,
  name: esPruebas && !esPruebasAndroid() ? `${config.name} PRUEBAS` : config.name,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
    config: {
      ...config.android?.config,
      ...(process.env.GOOGLE_MAPS_ANDROID_KEY
        ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } }
        : {}),
    },
  },
});
