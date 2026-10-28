import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * C-DIRECCION-SUGERENCIAS (regla de Richard, 28 oct 2026): TODA casilla de dirección sugiere
 * direcciones reales mientras se escribe (Google Places por el servidor) y, al elegir una, trae las
 * coordenadas exactas. Vale para la portada, comida, Moto (recogida y destino), Flex, envíos de A a B
 * y cualquier casilla futura. Una sola pieza: la web y las apps usan este hook; cada plataforma solo
 * dibuja la lista.
 */
export type SugerenciaDireccion = { id: string; texto: string };
export type DireccionElegida = { punto: { lat: number; lng: number }; direccion: string };
export type PedirLugares = <R>(metodo: 'GET', ruta: string) => Promise<R>;

/** Lo mínimo para pedir sugerencias: 3 letras. */
export const MINIMO_SUGERENCIAS = 3;
const ESPERA_MS = 300;

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
}) {
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
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
    if (texto.trim().length < MINIMO_SUGERENCIAS) {
      setSugerencias([]);
      return;
    }
    reloj.current = setTimeout(() => {
      const { pedir, pais, cerca } = opRef.current;
      pedir<{ sugerencias: SugerenciaDireccion[] }>(
        'GET',
        rutaSugerencias(texto, sesion.current, { pais, cerca }),
      )
        .then((r) => {
          // Solo si sigue siendo lo último escrito (una respuesta vieja no pisa la nueva).
          if (ultima.current === texto) setSugerencias(r.sugerencias);
        })
        .catch(() => setSugerencias([]));
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
  return { sugerencias, buscar, elegir, cerrar };
}
