// Firma de iPhone al compilar EN ESTA MAC (C-COMPILA-EN-ESTA-MAC, 18 nov 2026).
// En el llavero de la Mac hay un certificado «Apple Distribution: Windoce LLC» distinto del que Expo
// guarda y con el que está hecho el perfil de firma. Xcode elegía el del llavero y el archivado
// fallaba: «Provisioning profile … doesn't include signing certificate». En la nube no pasa.
// Arreglo sin tocar el llavero ni la cuenta de Apple: con DIVOOX_FIRMA_IOS_LOCAL=1 (lo ponen
// nuestros guiones al compilar iPhone aquí, nunca para el simulador ni en la nube) este complemento
// deja un Gymfile propio. Ese archivo busca, al momento de compilar, el perfil de App Store de esta
// app que Expo acaba de instalar, lee de ahí la huella de SU certificado y se la da a Xcode por
// huella exacta, tanto al archivar como al exportar. Sin la variable no hace nada.
const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod } = require('expo/config-plugins');

const gymfile = (esquema, paquete) => `# Generado por plugins/firma-ios-local.js. No editar a mano.
require 'digest'
require 'plist'

paquete = "${paquete}"
carpetas = [
  File.expand_path("~/Library/MobileDevice/Provisioning Profiles"),
  File.expand_path("~/Library/Developer/Xcode/UserData/Provisioning Profiles"),
]
perfiles = carpetas.flat_map { |c| Dir[File.join(c, "*.mobileprovision")] }.map do |ruta|
  datos = Plist.parse_xml(\`security cms -D -i "#{ruta}" 2>/dev/null\`) rescue nil
  next nil unless datos
  derechos = datos["Entitlements"] || {}
  next nil unless derechos["application-identifier"].to_s.end_with?(".#{paquete}")
  next nil if derechos["get-task-allow"] || datos["ProvisionedDevices"] || datos["ProvisionsAllDevices"]
  { ruta: ruta, datos: datos, hora: File.mtime(ruta) }
end.compact
perfil = perfiles.max_by { |p| p[:hora] }
UI.user_error!("No encontré el perfil de App Store de #{paquete} instalado por la compilación") unless perfil
certificado = perfil[:datos]["DeveloperCertificates"].first
huella = Digest::SHA1.hexdigest(certificado.respond_to?(:read) ? certificado.read : certificado.to_s).upcase
UI.message("Firma local: perfil «#{perfil[:datos]["Name"]}», certificado #{huella[0, 8]}…")

suppress_xcode_output(true)
clean(false)
scheme("${esquema}")
configuration("Release")
xcargs "CODE_SIGN_IDENTITY=#{huella}"
export_options({
  method: "app-store",
  signingStyle: "manual",
  signingCertificate: huella,
  provisioningProfiles: { paquete => perfil[:datos]["UUID"] },
})
disable_xcpretty(true)
derived_data_path("./build")
output_directory("./build")
`;

module.exports = function firmaIosLocal(config) {
  if (process.env.DIVOOX_FIRMA_IOS_LOCAL !== '1') return config;
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const esquema = IOSConfig.XcodeUtils.sanitizedName(c.name);
      const paquete = c.ios?.bundleIdentifier;
      if (!paquete) throw new Error('firma-ios-local: la app no tiene ios.bundleIdentifier');
      // La ruta es la carpeta de iPhone que arma Expo al compilar, no un dato de fuera.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(
        path.join(c.modRequest.platformProjectRoot, 'Gymfile'),
        gymfile(esquema, paquete),
      );
      return c;
    },
  ]);
};
module.exports.gymfile = gymfile;
