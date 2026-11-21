// Pantalla vertical NO obligatoria en Android (C-PANTALLA-VERTICAL-OPCIONAL, 21 nov 2026).
// Las apps van fijas en vertical («orientation: portrait»). De ahí Google Play deduce que la app EXIGE
// la pieza `android.hardware.screen.portrait` y avisa en cada envío (Driver 65 y clientes 58) que deja
// fuera a tabletas, Chromebooks y aparatos que no la declaran. La app funciona igual en ellos: se
// declara la pieza a mano como no obligatoria, que es lo que pide el aviso.
const { withAndroidManifest } = require('expo/config-plugins');

const NOMBRE = 'android.hardware.screen.portrait';

/** Deja en el manifiesto UNA sola declaración de la pantalla vertical, y como no obligatoria. */
function conPantallaOpcional(manifiesto) {
  const raiz = manifiesto.manifest;
  const piezas = Array.isArray(raiz['uses-feature']) ? raiz['uses-feature'] : [];
  const pieza = { $: { 'android:name': NOMBRE, 'android:required': 'false' } };
  const ya = piezas.findIndex((p) => p?.$?.['android:name'] === NOMBRE);
  raiz['uses-feature'] =
    ya === -1 ? [...piezas, pieza] : piezas.map((p, i) => (i === ya ? pieza : p));
  return manifiesto;
}

module.exports = function pantallaVerticalOpcional(config) {
  return withAndroidManifest(config, (c) => {
    c.modResults = conPantallaOpcional(c.modResults);
    return c;
  });
};
module.exports.conPantallaOpcional = conPantallaOpcional;
