import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Text } from 'react-native';
import { crearInfoVersion, textoVersion, type InfoVersion } from '@tumbite/compartido';
import { useSesion } from './sesion';

/**
 * Versión de la app INSTALADA (C-VERSION-DEL-ARTEFACTO). El número sale de app.json, grabado en la
 * compilación; el commit, de EXPO_PUBLIC_COMMIT, que Expo pega dentro del paquete al compilar
 * (en la web lo pone scripts/empaquetar.sh; en las tiendas, el gancho eas-build-post-install).
 * Sin actualizaciones por aire: lo que dice es lo que el teléfono tiene instalado.
 */
export const VERSION_APP: InfoVersion = crearInfoVersion(
  Constants.expoConfig?.version,
  process.env.EXPO_PUBLIC_COMMIT,
);

/**
 * C-VERSION-VISIBLE (SIG-7): la compilación de la tienda (buildNumber de iOS, versionCode de
 * Android) la pone EAS al compilar (appVersionSource «remote»), así que solo el binario la sabe:
 * se lee de expo-application. En la web no existe y no se muestra.
 */
export const COMPILACION_APP: string | null = Application.nativeBuildVersion ?? null;

/** «Versión 1.0.1 (compilación 10) · a74309f», discreta y en gris, para soporte. */
export function VersionInstalada() {
  const { idioma } = useSesion();
  return (
    <Text
      testID="version-app"
      selectable
      style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#9a9a9a' }}
    >
      {textoVersion(VERSION_APP, idioma, COMPILACION_APP)}
    </Text>
  );
}
