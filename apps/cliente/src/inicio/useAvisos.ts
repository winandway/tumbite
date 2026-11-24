import { useCallback, useEffect, useState } from 'react';
import type { Api } from '@tumbite/compartido';

/**
 * C-CAMPANA-SE-VACIA: cada aviso trae cuándo pasó (`en`) y si esa persona ya lo vio (`leido`); los
 * servidores viejos no los traen.
 */
type Lectura = { en?: string; leido?: boolean };

/** Lo que devuelve GET /datos/mis-avisos (apps/servidor/src/rutas/avisos.ts). */
export type Aviso = Lectura &
  (
    | {
        tipo: 'pedido';
        pedidoId: string;
        estado: string;
        /** Revisor B3: el estado a mostrar («enviado» con pago al recibir); los servidores viejos no lo traen. */
        estadoVisible?: string;
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
    | { tipo: 'apertura'; area: string; ciudad: string; apertura: string | null }
  );
/** `sinLeer` es el número de la campana (va a cero al abrirla); `pendientes`, lo de antes. */
export type RespuestaAvisos = { avisos: Aviso[]; pendientes: number; sinLeer?: number };

/**
 * Avisos reales del cliente: se piden al entrar y cada vez que la pantalla lo pida. C-SIN-SESION-
 * SIN-401 (robot, 18 nov 2026): sin sesión no se piden (daban 401); `conSesion` es obligatorio.
 */
export function useAvisos(
  api: Api,
  punto: { lat: number; lng: number } | null,
  conSesion: boolean,
) {
  const activo = conSesion;
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
    if (!activo) return;
    try {
      setDatos(await pedir());
      setError(false);
    } catch (e) {
      console.warn('avisos: no se pudieron cargar', e);
      setError(true);
    }
  }, [pedir, activo]);
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
