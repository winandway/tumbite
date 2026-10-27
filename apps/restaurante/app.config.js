// Avisos de Android (Firebase, 26 oct 2026): el google-services.json del proyecto divoox-apps
// lo entrega EAS como archivo secreto (variable GOOGLE_SERVICES_JSON de la organización
// windoce-llc). Nunca va al repositorio. Sin la variable, la app compila igual pero sin avisos
// en Android.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
