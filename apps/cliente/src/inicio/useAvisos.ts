import { useCallback, useEffect, useState } from 'react';
import type { Api } from '@tumbite/compartido';

/** Lo que devuelve GET /datos/mis-avisos (apps/servidor/src/rutas/avisos.ts). */
export type Aviso =
  | {
      tipo: 'pedido';
      pedidoId: string;
      estado: string;
      restauranteId: string;
      restauranteNombre: string;
      creadoEn: string;
    }
  | {
      tipo: 'regalo';
      regalo: 'sellos' | 'vuelve';
      restauranteId: string;
      restauranteNombre: string;
      progreso: number;
      meta: number;
      pb: number | null;
    }
  | { tipo: 'apertura'; area: string; ciudad: string; apertura: string | null };
export type RespuestaAvisos = { avisos: Aviso[]; pendientes: number };

/** Avisos reales del cliente: se piden al entrar y cada vez que la pantalla lo pida. */
export function useAvisos(api: Api, punto: { lat: number; lng: number } | null, activo = true) {
  const [datos, setDatos] = useState<RespuestaAvisos | null>(null);
  const [error, setError] = useState(false);
  const lat = punto?.lat;
  const lng = punto?.lng;
  const pedir = useCallback(
    () =>
      api.pedir<RespuestaAvisos>(
        'GET',
        `/datos/mis-avisos${lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : ''}`,
      ),
    [api, lat, lng],
  );
  const recargar = useCallback(async () => {
    try {
      setDatos(await pedir());
      setError(false);
    } catch (e) {
      console.warn('avisos: no se pudieron cargar', e);
      setError(true);
    }
  }, [pedir]);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    void (async () => {
      try {
        const r = await pedir();
        if (!vivo) return;
        setDatos(r);
        setError(false);
      } catch (e) {
        console.warn('avisos: no se pudieron cargar', e);
        if (vivo) setError(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [pedir, activo]);
  return { datos, error, recargar };
}
