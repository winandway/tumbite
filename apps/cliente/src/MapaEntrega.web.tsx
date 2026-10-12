import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { COLORES, crearMapa, punto } from './mapaWeb';
import type { Punto } from './ubicacion';

/**
 * Mapa en vivo de la entrega en la versión web: restaurante (gris oscuro), tu casa (escarlata)
 * y el repartidor (escarlata grande) que se mueve con cada actualización.
 */
export function MapaEntrega({
  restaurante,
  casa,
  repartidor,
  nombreRepartidor,
  etiquetas,
}: {
  restaurante: Punto | null;
  casa: Punto | null;
  repartidor: Punto | null;
  nombreRepartidor?: string;
  etiquetas: { restaurante: string; casa: string; repartidor: string };
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<L.Layer[]>([]);
  const centro = repartidor ?? restaurante ?? casa;

  useEffect(() => {
    if (!caja.current || mapa.current || !centro) return;
    mapa.current = crearMapa(caja.current, centro);
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
    // Se crea una sola vez; los puntos se actualizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(centro)]);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    for (const c of capas.current) c.remove();
    const nuevas: L.Layer[] = [];
    if (restaurante) nuevas.push(punto(restaurante, COLORES.restaurante, 9, etiquetas.restaurante));
    if (casa) nuevas.push(punto(casa, COLORES.casa, 8, etiquetas.casa));
    if (repartidor)
      nuevas.push(
        punto(repartidor, COLORES.repartidor, 12, nombreRepartidor ?? etiquetas.repartidor),
      );
    for (const c of nuevas) c.addTo(m);
    capas.current = nuevas;
    const todos = [restaurante, casa, repartidor].filter((p): p is Punto => p != null);
    if (todos.length > 1)
      m.fitBounds(
        todos.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 17 },
      );
    else if (todos[0]) m.setView([todos[0].lat, todos[0].lng], 16);
    // Se redibuja cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurante?.lat, restaurante?.lng, casa?.lat, casa?.lng, repartidor?.lat, repartidor?.lng]);

  if (!centro) return null;
  return (
    <div
      ref={caja}
      role="img"
      aria-label={etiquetas.repartidor}
      style={{ height: 260, borderRadius: 16, overflow: 'hidden', marginBottom: 12, zIndex: 0 }}
    />
  );
}
