import { useEffect, useState } from 'react';
import {
  type Api,
  type RespuestaServicios,
  type ServicioCatalogo,
  ordenarServicios,
} from '@tumbite/compartido';

/**
 * Catálogo de servicios del inicio, tal como lo manda el servidor para la ciudad de la persona
 * (GET /datos/servicios). Mientras carga, o si falla, la app no se queda vacía: pinta los ocho
 * servicios conocidos sin estado y cada pantalla de servicio vuelve a preguntar.
 */
export function useServicios(api: Api, punto: { lat: number; lng: number } | null) {
  const [datos, setDatos] = useState<RespuestaServicios | null>(null);
  const lat = punto?.lat;
  const lng = punto?.lng;
  useEffect(() => {
    let vivo = true;
    const q = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : '';
    void api
      .pedir<RespuestaServicios>('GET', `/datos/servicios${q}`)
      .then((r) => {
        if (vivo) setDatos({ ...r, servicios: ordenarServicios(r.servicios) });
      })
      .catch((e: unknown) => console.warn('servicios: no se pudo cargar el catálogo', e));
    return () => {
      vivo = false;
    };
  }, [api, lat, lng]);
  return datos;
}

export type { ServicioCatalogo };
