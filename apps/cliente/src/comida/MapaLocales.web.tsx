import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { COLORES, crearMapa, punto } from '../mapaWeb';

export type Local = { id: string; nombre: string; lat: number; lng: number; detalle: string };

/** C-RECOGER-MAPA en la versión web: un punto por local; al tocarlo se abre su menú. */
export function MapaLocales({
  locales,
  alElegir,
}: {
  locales: Local[];
  alElegir: (id: string) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<L.Layer[]>([]);
  const primero = locales[0];

  useEffect(() => {
    if (!caja.current || mapa.current || !primero) return;
    mapa.current = crearMapa(caja.current, primero, 13);
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
    // Se crea una sola vez; los puntos se actualizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(primero)]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    for (const c of capas.current) c.remove();
    capas.current = locales.map((l) => {
      const c = punto(l, COLORES.restaurante, 9, `${l.nombre} · ${l.detalle}`);
      c.on('click', () => alElegir(l.id));
      c.addTo(m);
      return c;
    });
    if (locales.length > 1)
      m.fitBounds(
        locales.map((l) => [l.lat, l.lng] as [number, number]),
        { padding: [30, 30], maxZoom: 16 },
      );
  }, [locales, alElegir]);

  if (!primero) return null;
  return (
    <div
      ref={caja}
      role="img"
      aria-label="map"
      style={{ height: 260, borderRadius: 18, overflow: 'hidden', marginBottom: 12 }}
    />
  );
}
