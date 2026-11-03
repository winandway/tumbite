import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
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

/**
 * POR-1 (2 nov 2026): la dirección de entrega que la persona eligió a mano en el inicio («Entregar
 * en ▾»). Mientras exista, manda sobre el GPS (como DoorDash: la dirección elegida no se cambia
 * sola). Se guarda en el teléfono con su texto, para mostrarla arriba al volver.
 */
const LLAVE_DIRECCION = 'tumbite.direccionEntrega';
export type DireccionEntrega = { texto: string; punto: Punto };

async function direccionGuardada(): Promise<DireccionEntrega | null> {
  try {
    const v = JSON.parse(
      (await almacenTelefono.leer(LLAVE_DIRECCION)) ?? 'null',
    ) as DireccionEntrega | null;
    return v && v.texto && Number.isFinite(v.punto?.lat) && Number.isFinite(v.punto?.lng)
      ? v
      : null;
  } catch {
    return null;
  }
}

/**
 * C-TIENDAS-VITRINA: los puntos de búsqueda para las tiendas, por separado para no frenar la lista
 * (C-UBICACION-NO-FRENA): primero el guardado, enseguida; después el GPS del momento.
 */
export const puntoGuardado = ubicacionGuardada;
export const puntoGps = gpsReciente;

export function useRestaurantes(api: Api, deUrl: Punto | null) {
  useEffect(() => {
    apiActual = api;
  }, [api]);
  const estado = useSyncExternalStore(lista.suscribir, lista.estado);
  const [elegido, setElegido] = useState<Punto | null>(null);
  const [direccion, setDireccion] = useState<DireccionEntrega | null>(null);
  const aMano = useRef(false);
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
      const elegida = await direccionGuardada();
      aMano.current = Boolean(elegida);
      if (elegida && vivo.current) setDireccion(elegida);
      const guardado = elegida?.punto ?? (await ubicacionGuardada());
      if (guardado && vivo.current) setElegido(guardado);
      const primera = lista.cargar(guardado);
      const gps = await gpsReciente();
      await primera;
      // Con una dirección elegida a mano, el GPS no la reemplaza.
      if (!gps || !vivo.current || aMano.current) return;
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

  // C-UBICACION-AL-VOLVER (31 oct 2026, visto en el emulador): si al abrir la app todavía no había
  // permiso o GPS, la lista quedaba en la ciudad inicial hasta cerrar la app. Al volver a la app
  // (por ejemplo, después de dar el permiso) se mira el GPS otra vez y, si cambió, se recarga.
  useEffect(() => {
    if (deUrl) return;
    const sub = AppState.addEventListener('change', (e) => {
      if (e !== 'active' || aMano.current) return;
      ultimoGps = null;
      void gpsReciente().then(async (gps) => {
        if (!gps || !vivo.current) return;
        setElegido(gps);
        await guardarUbicacion(gps);
        await lista.cargar(gps);
      });
    });
    return () => sub.remove();
  }, [deUrl]);

  const reintentar = useCallback(() => lista.cargar(punto, { forzar: true }), [punto]);
  /**
   * POR-1: «Entregar en ▾». Con una dirección, la lista se ordena desde ahí y queda guardada; con
   * null se vuelve a la ubicación actual (GPS).
   */
  const elegirDireccion = useCallback(async (d: DireccionEntrega | null) => {
    if (d) {
      aMano.current = true;
      setDireccion(d);
      setElegido(d.punto);
      try {
        await almacenTelefono.guardar(LLAVE_DIRECCION, JSON.stringify(d));
      } catch (e) {
        console.warn('dirección de entrega: no se pudo guardar', e);
      }
      await guardarUbicacion(d.punto);
      await lista.cargar(d.punto);
      return;
    }
    aMano.current = false;
    setDireccion(null);
    try {
      await almacenTelefono.borrar(LLAVE_DIRECCION);
    } catch (e) {
      console.warn('dirección de entrega: no se pudo borrar', e);
    }
    ultimoGps = null;
    const gps = await gpsReciente();
    if (!gps || !vivo.current) return;
    setElegido(gps);
    await guardarUbicacion(gps);
    await lista.cargar(gps);
  }, []);
  return useMemo(
    () => ({ ...estado, punto, reintentar, direccion, elegirDireccion }),
    [estado, punto, reintentar, direccion, elegirDireccion],
  );
}
