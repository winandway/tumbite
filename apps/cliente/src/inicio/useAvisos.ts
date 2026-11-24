import { useCallback, useEffect, useState } from 'react';
import type { Api } from '@tumbite/compartido';

/** Lo que devuelve GET /datos/mis-avisos (apps/servidor/src/rutas/avisos.ts). */
export type Aviso =
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
  | { tipo: 'apertura'; area: string; ciudad: string; apertura: string | null };
export type RespuestaAvisos = { avisos: Aviso[]; pendientes: number };

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
        // C-AVISOS-GUARDADOS: `historial=1` trae también lo que le llegó al teléfono, con su hora.
        `/datos/mis-avisos?historial=1${lat != null && lng != null ? `&lat=${lat}&lng=${lng}` : ''}`,
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

/**
 * C-AVISOS-GUARDADOS (24 nov 2026): un aviso que le llegó al teléfono (su conductor llegó, mensajes,
 * viaje cancelado…), con su hora. Solo viene si la app lo pide con `historial=1`.
 */
export type AvisoGuardado = {
  tipo: 'aviso';
  tipoAviso: string;
  titulo: string;
  cuerpo: string;
  datos: Record<string, unknown>;
  en: string;
};
export const esAvisoGuardado = (a: unknown): a is AvisoGuardado =>
  typeof a === 'object' && a !== null && (a as { tipo?: unknown }).tipo === 'aviso';

/** La hora de un aviso («24 nov, 9:05 p. m.»), en el idioma de la app. */
export const horaAviso = (en: string, idioma: string) =>
  new Date(`${en.replace(' ', 'T')}Z`).toLocaleString(idioma === 'en' ? 'en-US' : 'es-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
