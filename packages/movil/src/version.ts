import Constants from 'expo-constants';
import { crearInfoVersion, type InfoVersion } from '@tumbite/compartido';

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
