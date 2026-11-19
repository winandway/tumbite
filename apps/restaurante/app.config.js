// Avisos de Android (Firebase, 26 oct 2026): el google-services.json del proyecto divoox-apps
// lo entrega EAS como archivo secreto (variable GOOGLE_SERVICES_JSON de la organización
// windoce-llc). Nunca va al repositorio. Sin la variable, la app compila igual pero sin avisos
// en Android.
// C-APK-PRUEBAS (8 nov 2026): las compilaciones del perfil «pruebas» (apuntan a staging) llevan
// «PRUEBAS» en el nombre visible para no confundirlas con las de la tienda. Producción no cambia.
const esPruebas = process.env.EAS_BUILD_PROFILE === 'pruebas';

// C-VERSION-VISIBLE (18 nov 2026): la versión visible de la tienda es 0.1.<número de compilación>
// (0.1.47 para la compilación 47), con el MISMO número que versionCode / buildNumber. Ese número lo
// pone EAS al compilar (appVersionSource «remote» + autoIncrement); los guiones de compilar
// (scripts/tiendas/numero-compilacion.mjs) lo consultan antes y lo pasan en DIVOOX_NUMERO_COMPILACION.
// Sin la variable (nube de Expo, compilaciones a mano), la de app.json; lo que se lee en la app
// sigue siendo exacto porque sale del número nativo (packages/movil/src/version.tsx).
const versionDeCompilacion = (version) => {
  const n = process.env.DIVOOX_NUMERO_COMPILACION;
  return /^\d{1,9}$/.test(n ?? '') && /^\d+\.\d+\.\d+$/.test(version ?? '')
    ? version.replace(/\.\d+$/, `.${n}`)
    : version;
};

module.exports = ({ config }) => ({
  ...config,
  version: versionDeCompilacion(config.version),
  name: esPruebas ? `${config.name} PRUEBAS` : config.name,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
