import { useEffect } from 'react';
import { lecturaSiHayPermiso } from '../ubicacion';

/** Cada cuánto manda su ubicación el teléfono del pasajero durante un viaje con regalo. */
export const CADA_UBICACION_REGALO_MS = 60_000;

type Api = {
  pedir: <T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
  ) => Promise<T>;
};

/**
 * C-REGALO-VIAJE-REAL (19 nov 2026): durante un viaje con regalo de Divoox EN CURSO, la app manda al
 * servidor dónde está el pasajero, una vez por minuto, para comprobar que viaja con el conductor.
 * Solo si la persona ya dio el permiso de ubicación (nunca abre la pregunta), solo con regalo y solo
 * con el viaje en curso. Si falla, no pasa nada: nunca frena el viaje ni muestra un error.
 */
export function useUbicacionConRegalo(
  api: Api,
  viaje: { id: string; estado: string; regalo?: unknown; saldoDivoox?: number } | null,
) {
  const id = viaje?.id ?? null;
  // C-SALDO-CLIENTE: también con el viaje pagado con Saldo Divoox (mismas protecciones).
  const activo =
    (Boolean(viaje?.regalo) || (viaje?.saldoDivoox ?? 0) > 0) && viaje?.estado === 'en_curso';
  useEffect(() => {
    if (!id || !activo) return;
    let vivo = true;
    const mandar = async () => {
      const p = await lecturaSiHayPermiso();
      if (!p || !vivo) return;
      await api
        .pedir('POST', `/datos/viajes/${id}/mi-ubicacion`, {
          lat: p.lat,
          lng: p.lng,
          precision: p.precision,
        })
        .catch((e: unknown) => console.warn('viaje: no se pudo mandar la ubicación', e));
    };
    void mandar();
    const reloj = setInterval(() => void mandar(), CADA_UBICACION_REGALO_MS);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [api, id, activo]);
}
