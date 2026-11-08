// Avisos de Android (Firebase, 26 oct 2026): el google-services.json del proyecto divoox-apps
// lo entrega EAS como archivo secreto (variable GOOGLE_SERVICES_JSON de la organización
// windoce-llc). Nunca va al repositorio. Sin la variable, la app compila igual pero sin avisos
// en Android.
// C-APK-PRUEBAS (8 nov 2026): las compilaciones del perfil «pruebas» (apuntan a staging) llevan
// «PRUEBAS» en el nombre visible para no confundirlas con las de la tienda. Producción no cambia.
const esPruebas = process.env.EAS_BUILD_PROFILE === 'pruebas';

module.exports = ({ config }) => ({
  ...config,
  name: esPruebas ? `${config.name} PRUEBAS` : config.name,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
