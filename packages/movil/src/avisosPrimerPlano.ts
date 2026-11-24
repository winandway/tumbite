import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { comoMostrarEnPrimerPlano } from './avisosPrimerPlanoRegla';

/**
 * C-AVISOS-PRIMER-PLANO (24 nov 2026, primera carrera real; todos los países). Con expo-notifications
 * un aviso que llega con la app ABIERTA se descarta si la app no tiene manejador (sin bandeja y sin
 * sonido). Driver y la app de clientes no lo tenían: con la app abierta, ningún aviso sonaba. Esta es
 * la pieza única que decide cómo se muestra un aviso con la app abierta:
 * - una oferta al conductor (viaje, envío, cliente fijo o comida) va a la bandeja sin el sonido del
 *   sistema: suena la alarma propia de la hoja de oferta, que Driver pinta en cualquier pantalla
 *   (C-OFERTA-EN-CUALQUIER-PANTALLA), y la app la trae al instante con `alOferta`;
 * - todo lo demás sale arriba, con su sonido, y queda en la bandeja.
 */

/**
 * Pone el manejador de avisos con la app abierta mientras la pantalla está montada. `alOferta` se
 * llama al llegar una oferta (para traerla sin esperar el sondeo). Solo en el celular.
 */
export function useAvisosPrimerPlano(app: 'repartidor' | 'cliente', alOferta?: () => void) {
  const oferta = useRef(alOferta);
  useEffect(() => {
    oferta.current = alOferta;
  }, [alOferta]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let vivo = true;
    let quitar: (() => void) | null = null;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (!vivo) return;
        Notifications.setNotificationHandler({
          handleNotification: async (n) =>
            comoMostrarEnPrimerPlano(n.request.content.data as Record<string, unknown>)
              .comportamiento,
        });
        const sub = Notifications.addNotificationReceivedListener((n) => {
          const r = comoMostrarEnPrimerPlano(n.request.content.data as Record<string, unknown>);
          if (r.esOferta) oferta.current?.();
        });
        quitar = () => {
          sub.remove();
          Notifications.setNotificationHandler(null);
        };
      } catch (e) {
        console.warn(`avisos (${app}): no se pudo poner el manejador con la app abierta`, e);
      }
    })();
    return () => {
      vivo = false;
      quitar?.();
    };
  }, [app]);
}
