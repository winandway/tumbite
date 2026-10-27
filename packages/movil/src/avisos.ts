import { useEffect } from 'react';
import { Platform } from 'react-native';
import { CANAL_AVISOS, canalPedidos, type Api, type Usuario } from '@tumbite/compartido';

/**
 * Avisos al celular: pide permiso y registra el token del teléfono en el servidor.
 * Necesita el proyecto de EAS de la empresa (pendiente de Richard): sin él, no hace nada
 * y lo dice en consola. Las librerías se cargan tarde para que la app arranque igual sin ellas.
 */
/** Al cerrar sesión: el teléfono deja de recibir los avisos de esa cuenta. */
export async function darDeBajaAvisos(api: Api) {
  try {
    if (Platform.OS === 'web') return;
    const Notifications = await import('expo-notifications');
    const Constants = (await import('expo-constants')).default;
    const proyecto = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!proyecto) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: proyecto });
    await api.pedir('DELETE', '/datos/cuentas/dispositivo', { token, plataforma: Platform.OS });
  } catch (e) {
    console.warn('avisos: no se pudo dar de baja el teléfono', e);
  }
}

export function useAvisosCelular(api: Api, usuario: Usuario | null) {
  useEffect(() => {
    if (!usuario || Platform.OS === 'web') return;
    let vivo = true;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const Constants = (await import('expo-constants')).default;
        const proyecto =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!proyecto) {
          console.warn('avisos: falta el proyecto de EAS; los avisos al celular esperan.');
          return;
        }
        const permiso = await Notifications.getPermissionsAsync();
        const estado = permiso.granted ? permiso : await Notifications.requestPermissionsAsync();
        if (!estado.granted) return;
        if (Platform.OS === 'android')
          await Notifications.setNotificationChannelAsync(
            CANAL_AVISOS,
            canalPedidos(Constants.expoConfig?.extra, Notifications.AndroidImportance.MAX),
          );
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: proyecto });
        if (!vivo) return;
        await api.pedir('POST', '/datos/cuentas/dispositivo', { token, plataforma: Platform.OS });
      } catch (e) {
        console.warn('avisos: no se pudo registrar el teléfono', e);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [api, usuario]);
}

/**
 * Al tocar un aviso (con la app abierta, en segundo plano o cerrada): entrega sus datos para abrir
 * la pantalla que corresponde (por ejemplo, Flex abre «Mi ruta» en esa ruta). Fase 3 de Flex.
 */
export function useToqueAviso(alTocar: (datos: Record<string, unknown>) => void) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let vivo = true;
    let quitar: (() => void) | null = null;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        // Si la app se abrió desde el aviso (estaba cerrada), ese toque se atiende una vez.
        const ultimo = await Notifications.getLastNotificationResponseAsync();
        if (vivo && ultimo) alTocar(ultimo.notification.request.content.data ?? {});
        const sub = Notifications.addNotificationResponseReceivedListener((r) =>
          alTocar(r.notification.request.content.data ?? {}),
        );
        if (!vivo) sub.remove();
        else quitar = () => sub.remove();
      } catch (e) {
        console.warn('avisos: no se pudo escuchar el toque de los avisos', e);
      }
    })();
    return () => {
      vivo = false;
      quitar?.();
    };
  }, [alTocar]);
}
