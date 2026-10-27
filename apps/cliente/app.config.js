// Avisos y mapa de Android (26 oct 2026). EAS entrega como secretos de la organización
// windoce-llc el google-services.json del proyecto divoox-apps (GOOGLE_SERVICES_JSON) y la llave
// del mapa restringida a nuestras apps (GOOGLE_MAPS_ANDROID_KEY). Ninguno va al repositorio.
// Sin las variables, la app compila igual pero sin avisos ni mapa en Android.
module.exports = ({ config }) => ({
  ...config,
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
