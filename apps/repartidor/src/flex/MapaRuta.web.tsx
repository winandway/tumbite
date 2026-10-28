import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { COLORES, type Punto, crearMapa, punto } from '../piezas/mapaWeb';
import { COLOR_TONO, type PuntoRuta } from './colorTono';

export type { PuntoRuta };

/**
 * Mapa de la ruta Flex en la versión web (el mismo Leaflet con OpenStreetMap de la app): el centro
 * y las paradas con su número, unidos en orden con una línea punteada (orden de visita, no calles).
 */
export function MapaRuta({
  puntos,
  yo,
  alto = 380,
  etiqueta,
}: {
  puntos: PuntoRuta[];
  yo: Punto | null;
  alto?: number;
  etiqueta: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<L.Layer[]>([]);
  const todos = [...puntos.map((p) => p.punto), ...(yo ? [yo] : [])];
  const clave = [
    ...puntos.map((p) => `${p.id}:${p.tono}:${p.punto.lat},${p.punto.lng}`),
    yo ? `${yo.lat},${yo.lng}` : '',
  ].join('|');

  useEffect(() => {
    if (!caja.current || mapa.current) return;
    mapa.current = crearMapa(caja.current, todos[0] ?? { lat: 25.7743, lng: -80.1937 }, 13);
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
    // Se crea una sola vez; los puntos se actualizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    for (const c of capas.current) c.remove();
    const nuevas: L.Layer[] = [];
    if (puntos.length > 1)
      nuevas.push(
        L.polyline(
          puntos.map((p) => [p.punto.lat, p.punto.lng] as [number, number]),
          { color: '#8E9198', weight: 3, dashArray: '8 6' },
        ),
      );
    for (const p of puntos) {
      const icono = L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div style="min-width:30px;height:30px;padding:0 6px;box-sizing:border-box;border-radius:15px;background:${COLOR_TONO[p.tono]};border:2px solid #fff;color:#fff;font:800 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.25)">${p.numero.replace(/[^0-9A-Za-z]/g, '')}</div>`,
      });
      nuevas.push(L.marker([p.punto.lat, p.punto.lng], { icon: icono, title: p.nombre }));
    }
    if (yo) nuevas.push(punto(yo, COLORES.repartidor, 9));
    for (const c of nuevas) c.addTo(m);
    capas.current = nuevas;
    if (todos.length > 1)
      m.fitBounds(
        todos.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 16 },
      );
    else if (todos[0]) m.setView([todos[0].lat, todos[0].lng], 15);
    // Se redibuja cuando cambia algún punto o su estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return (
    <div
      ref={caja}
      style={{
        height: alto,
        width: '100%',
        overflow: 'hidden',
        borderRadius: 14,
        background: '#E9EEF5',
      }}
      aria-label={etiqueta}
    />
  );
}
