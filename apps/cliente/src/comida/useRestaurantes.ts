import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { type Api, type RespuestaRestaurantes, crearListaRestaurantes } from '@tumbite/compartido';
import { almacenTelefono } from '@tumbite/movil';
import { type Punto, miUbicacion } from '../ubicacion';

/**
 * Hito 1 · C-CATALOGO-ESTABLE: el inicio y «Comida» comparten UNA lista de restaurantes
 * (listaRestaurantes en @tumbite/compartido), así que pasar de una pantalla a otra no repite la
 * consulta, una respuesta vieja nunca pisa a la nueva y la carga no depende de que cambien la
 * sesión o el idioma (la lista es pública y trae los dos idiomas).
 *
 * El punto de búsqueda, en este orden: el que trae la portada (?lat=&lng=), el último guardado en
 * el teléfono (GPS o dirección elegida) y el GPS del momento. La lista sale enseguida con lo que
 * haya, sin esperar al GPS (C-UBICACION-NO-FRENA).
 */
const LLAVE_UBICACION = 'tumbite.ubicacion';
const GPS_CADA_MS = 5 * 60_000;

let apiActual: Api | null = null;
const lista = crearListaRestaurantes({
  pedir: (p) => {
    if (!apiActual) return Promise.reject(new Error('sin conexión'));
    const q = p ? `?lat=${p.lat}&lng=${p.lng}` : '';
    return apiActual.pedir<RespuestaRestaurantes>('GET', `/datos/restaurantes${q}`);
  },
});
let ultimoGps: { p: Punto; en: number } | null = null;

export async function guardarUbicacion(p: Punto): Promise<void> {
  try {
    await almacenTelefono.guardar(LLAVE_UBICACION, JSON.stringify({ lat: p.lat, lng: p.lng }));
  } catch (e) {
    console.warn('ubicación: no se pudo guardar', e);
  }
}

async function ubicacionGuardada(): Promise<Punto | null> {
  try {
    const v = JSON.parse((await almacenTelefono.leer(LLAVE_UBICACION)) ?? 'null') as Punto | null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch {
    return null;
  }
}

async function gpsReciente(): Promise<Punto | null> {
  if (ultimoGps && Date.now() - ultimoGps.en < GPS_CADA_MS) return ultimoGps.p;
  const p = await miUbicacion();
  if (p) ultimoGps = { p, en: Date.now() };
  return p;
}

export function useRestaurantes(api: Api, deUrl: Punto | null) {
  useEffect(() => {
    apiActual = api;
  }, [api]);
  const estado = useSyncExternalStore(lista.suscribir, lista.estado);
  const [elegido, setElegido] = useState<Punto | null>(null);
  const punto = deUrl ?? elegido;
  const vivo = useRef(true);

  const claveUrl = deUrl ? `${deUrl.lat},${deUrl.lng}` : '';
  useEffect(() => {
    vivo.current = true;
    void (async () => {
      if (deUrl) {
        await guardarUbicacion(deUrl);
        return lista.cargar(deUrl);
      }
      const guardado = await ubicacionGuardada();
      if (guardado && vivo.current) setElegido(guardado);
      const primera = lista.cargar(guardado);
      const gps = await gpsReciente();
      await primera;
      if (!gps || !vivo.current) return;
      setElegido(gps);
      await guardarUbicacion(gps);
      await lista.cargar(gps);
    })();
    return () => {
      vivo.current = false;
    };
    // Solo cuando cambia la ubicación de la portada: NO con la sesión ni con el idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveUrl]);

  const reintentar = useCallback(() => lista.cargar(punto, { forzar: true }), [punto]);
  return useMemo(() => ({ ...estado, punto, reintentar }), [estado, punto, reintentar]);
}
