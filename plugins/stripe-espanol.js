// Texto del mandato de la hoja de pago de Stripe en español latino (C-STRIPE-ES419, 31 oct 2026).
// La traducción es-419 del SDK de Stripe para iPhone trae «permites que {%@} cargue en tu tarjeta…»
// con llaves de más, y en pantalla salía «{Divoox}». El texto es de Stripe, no nuestro: este
// complemento agrega al Podfile un paso que, después de instalar los Pods, corrige esa línea del
// archivo de traducciones (solo quita las llaves alrededor de %@). Se quita cuando Stripe lo arregle.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARCA = '# C-STRIPE-ES419';
const PASO = `
  ${MARCA}: Stripe trae «{%@}» en el mandato de la tarjeta en español latino; se corrige aquí.
  Dir.glob(File.join(installer.sandbox.root, 'StripePaymentSheet', '**', '*.lproj', 'Localizable.strings')).each do |archivo|
    texto = File.read(archivo)
    arreglado = texto.gsub('{%@}', '%@')
    File.write(archivo, arreglado) if arreglado != texto
  end
`;

/** Agrega el paso dentro del post_install del Podfile (una sola vez). */
function conPaso(podfile) {
  if (podfile.includes(MARCA)) return podfile;
  const ancla = 'post_install do |installer|';
  if (!podfile.includes(ancla)) throw new Error('stripe-espanol: el Podfile no tiene post_install');
  return podfile.replace(ancla, `${ancla}${PASO}`);
}

module.exports = function stripeEspanol(config) {
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const archivo = path.join(c.modRequest.platformProjectRoot, 'Podfile');
      // La ruta es la del Podfile del proyecto que arma Expo, no un dato de afuera.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const podfile = fs.readFileSync(archivo, 'utf8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(archivo, conPaso(podfile));
      return c;
    },
  ]);
};
module.exports.conPaso = conPaso;
