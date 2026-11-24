import { useEffect, useState } from 'react';
import { useSesion } from './sesion';

/**
 * C-FOTO-CONDUCTOR-SE-VE (24 nov 2026) — todos los países. Una foto privada (la del conductor, la
 * propia) se pide con la sesión por `api.verFoto`, como las de comida y del conductor de confianza,
 * y se entrega ya leída (data URI) a `<Image>`. Nunca `<Image source={{ headers }}>`: así pedida, el
 * pasajero de la carrera del 23 nov vio la inicial aunque la foto estaba aprobada.
 *
 * Devuelve la foto, `null` mientras llega y `false` si no hay o no cargó (se dibuja la inicial).
 * Atada a su ruta: la de un viaje anterior nunca se muestra en otro.
 */
export function useFotoPrivada(ruta: string | null): string | null | false {
  const { api } = useSesion();
  const [leida, setLeida] = useState<{ ruta: string; uri: string | false } | null>(null);
  useEffect(() => {
    if (!ruta) return;
    let vivo = true;
    api
      .verFoto(ruta)
      .then((uri) => {
        if (vivo) setLeida({ ruta, uri });
      })
      .catch(() => {
        if (vivo) setLeida({ ruta, uri: false });
      });
    return () => {
      vivo = false;
    };
  }, [api, ruta]);
  if (!ruta) return false;
  return leida?.ruta === ruta ? leida.uri : null;
}
