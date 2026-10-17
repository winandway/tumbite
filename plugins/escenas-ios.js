// Ciclo de vida por escenas en iPhone (C-ESCENAS-IOS, 17 oct 2026).
// iOS 27 cierra al abrir toda app que no adopte las escenas (UIScene). La plantilla nativa de
// Expo 57 todavía arranca sin ellas; la de Expo 58 ya las trae. Este complemento aplica lo mismo
// que la plantilla 58, usando ExpoAppSceneDelegate que Expo 57 ya incluye:
//   1. Info.plist declara la escena principal con SceneDelegate.
//   2. SceneDelegate.swift (hereda de ExpoAppSceneDelegate) entra al proyecto de Xcode.
//   3. AppDelegate deja de crear la ventana: la crea la escena.
// Se quita apenas el proyecto pase a Expo 58 (su plantilla ya lo hace).
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const ESCENA = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

const MANIFIESTO = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

/** El arranque sin ventana propia (el texto exacto de la plantilla de Expo 57). */
function conEscenas(codigo) {
  let c = codigo.replace(
    /class AppDelegate: ExpoAppDelegate \{/,
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
  );
  c = c.replace(
    /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n[\s\S]*?\)\n#endif\n/,
    '    // La ventana la crea SceneDelegate y ahí arranca React Native (escenas, exigidas por iOS 27).\n',
  );
  return c;
}

function escenasIos(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = MANIFIESTO;
    return c;
  });
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift')
      throw new Error('escenas-ios: se esperaba AppDelegate en Swift');
    const nuevo = conEscenas(c.modResults.contents);
    if (!nuevo.includes('ExpoReactNativeFactoryProvider') || nuevo.includes('UIWindow(frame:'))
      throw new Error('escenas-ios: la plantilla de AppDelegate cambió; revisar el complemento');
    c.modResults.contents = nuevo;
    return c;
  });
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const nombre = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
      // La ruta sale del propio proyecto de Expo, no de una entrada externa.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(
        path.join(c.modRequest.platformProjectRoot, nombre, 'SceneDelegate.swift'),
        ESCENA,
      );
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    const nombre = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
    const archivo = `${nombre}/SceneDelegate.swift`;
    if (!c.modResults.hasFile(archivo))
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: archivo,
        groupName: nombre,
        project: c.modResults,
      });
    return c;
  });
  return config;
}

module.exports = escenasIos;
module.exports.conEscenas = conEscenas;
module.exports.MANIFIESTO = MANIFIESTO;
