import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * C-DIRECCION-SUGERENCIAS (regla de Richard, 28 oct 2026): TODA casilla de dirección sugiere
 * direcciones reales mientras se escribe (Google Places por el servidor) y, al elegir una, trae las
 * coordenadas exactas. Vale para la portada, comida, Moto (recogida y destino), Flex, envíos de A a B
 * y cualquier casilla futura. Una sola pieza: la web y las apps usan este hook; cada plataforma solo
 * dibuja la lista.
 */
export type SugerenciaDireccion = {
  id: string;
  texto: string;
  /** C-DESTINO-RESULTADOS: nombre del lugar y su zona por separado, y la distancia a la persona. */
  principal?: string;
  secundario?: string;
  distanciaM?: number;
};
export type DireccionElegida = { punto: { lat: number; lng: number }; direccion: string };
export type PedirLugares = <R>(metodo: 'GET', ruta: string) => Promise<R>;

/** Lo mínimo para pedir sugerencias: 3 letras. */
export const MINIMO_SUGERENCIAS = 3;
const ESPERA_MS = 300;
/**
 * C-DESTINO-RESULTADOS: tope diario de búsquedas del mapa por teléfono (además de los topes del
 * proyecto en Google Cloud). Al pasarlo quedan los recientes, los populares y «Fijar en el mapa».
 */
export const TOPE_BUSQUEDAS_DIA = 150;
const usoDelDia = { dia: '', n: 0 };
/** Cuenta una búsqueda y dice si todavía quedan las de hoy. */
export function quedanBusquedas(ahora = new Date()): boolean {
  const dia = ahora.toISOString().slice(0, 10);
  if (usoDelDia.dia !== dia) {
    usoDelDia.dia = dia;
    usoDelDia.n = 0;
  }
  if (usoDelDia.n >= TOPE_BUSQUEDAS_DIA) return false;
  usoDelDia.n++;
  return true;
}

/** Token de sesión de Google (agrupa lo escrito y lo elegido en un solo cobro). */
export function nuevaSesionLugares(): string {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 24; i++) s += letras[Math.floor(Math.random() * letras.length)];
  return s;
}

/** La dirección de la consulta de sugerencias (pura, para probarla). */
export function rutaSugerencias(
  texto: string,
  sesion: string,
  op: { pais?: string | null; cerca?: { lat: number; lng: number } | null } = {},
): string {
  const p = new URLSearchParams({ q: texto.trim(), sesion });
  if (op.pais) p.set('pais', op.pais);
  if (op.cerca) {
    p.set('lat', String(op.cerca.lat));
    p.set('lng', String(op.cerca.lng));
  }
  return `/datos/lugares/sugerencias?${p.toString()}`;
}

export function useSugerenciasDireccion(op: {
  pedir: PedirLugares;
  pais?: string | null;
  cerca?: { lat: number; lng: number } | null;
  /** Desde cuántas letras se busca (3 por defecto; «¿A dónde vas?» desde la segunda). */
  minimo?: number;
  /** Con tope diario de búsquedas (solo «¿A dónde vas?»; las demás casillas no lo usan). */
  tope?: boolean;
}) {
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
  const [agotado, setAgotado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const sesion = useRef(nuevaSesionLugares());
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultima = useRef('');
  const opRef = useRef(op);
  useEffect(() => {
    opRef.current = op;
  });
  useEffect(
    () => () => {
      if (reloj.current) clearTimeout(reloj.current);
    },
    [],
  );

  /** Llamar en cada tecla: espera un respiro y pide las sugerencias de lo último escrito. */
  const buscar = useCallback((texto: string) => {
    ultima.current = texto;
    if (reloj.current) clearTimeout(reloj.current);
    if (texto.trim().length < (opRef.current.minimo ?? MINIMO_SUGERENCIAS)) {
      setSugerencias([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    reloj.current = setTimeout(() => {
      if (opRef.current.tope && !quedanBusquedas()) {
        setAgotado(true);
        setSugerencias([]);
        setBuscando(false);
        return;
      }
      // Día nuevo (o casilla sin tope): se puede volver a buscar.
      setAgotado(false);
      const { pedir, pais, cerca } = opRef.current;
      pedir<{ sugerencias: SugerenciaDireccion[] }>(
        'GET',
        rutaSugerencias(texto, sesion.current, { pais, cerca }),
      )
        .then((r) => {
          // Solo si sigue siendo lo último escrito (una respuesta vieja no pisa la nueva).
          if (ultima.current === texto) setSugerencias(r.sugerencias);
        })
        .catch(() => setSugerencias([]))
        .finally(() => {
          if (ultima.current === texto) setBuscando(false);
        });
    }, ESPERA_MS);
  }, []);

  /** La persona eligió una sugerencia: trae la dirección completa y su punto exacto. */
  const elegir = useCallback(async (id: string): Promise<DireccionElegida | null> => {
    setSugerencias([]);
    try {
      const r = await opRef.current.pedir<DireccionElegida>(
        'GET',
        `/datos/lugares/punto/${encodeURIComponent(id)}?sesion=${sesion.current}`,
      );
      return r;
    } catch {
      return null;
    } finally {
      sesion.current = nuevaSesionLugares();
    }
  }, []);

  const cerrar = useCallback(() => setSugerencias([]), []);
  return { sugerencias, buscar, elegir, cerrar, agotado, buscando };
}
