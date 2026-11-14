import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { COLORES, type Punto, type ZonaDemanda, crearMapa, punto, zona } from './mapaWeb';
import { MapaGoogleBajoDemanda } from '@tumbite/compartido/src/mapaWebGoogle';
import { origenesMapaDriver } from '@tumbite/compartido/src/mapaDriverWeb';
import { useSesion } from '@tumbite/movil';
import { LLAVE_MAPA_WEB, proveedorMapaWeb } from '../flex/mapaGoogleWeb';

/**
 * Mapa del repartidor en la versión web (Leaflet con OpenStreetMap, sin llave): su ubicación en
 * escarlata, los restaurantes cercanos, el restaurante del pedido y la casa con la ruta. Con
 * `zonasDemanda`, las zonas con más pedidos ahora (C-MAPA-DEMANDA), debajo de todo lo demás.
 */
type PropsMapa = Parameters<typeof MapaLeaflet>[0];

/**
 * C-MAPA-GOOGLE-WEB: el restaurante, la casa y los restaurantes cercanos vienen de direcciones de
 * Google Places; con la llave del navegador el mapa es el de Google, abierto al tocar «Ver en el
 * mapa». Solo la ubicación del conductor (GPS) o sin llave: Leaflet, como siempre. Las zonas con
 * más pedidos se dibujan solo en Leaflet.
 */
export function Mapa(props: PropsMapa) {
  return proveedorMapaWeb(origenesMapaDriver(props)) === 'google' ? (
    <MapaGoogle {...props} />
  ) : (
    <MapaLeaflet {...props} />
  );
}

function MapaGoogle({ yo, restaurante, casa, marcadores = [], alto = 300, etiquetas }: PropsMapa) {
  const { idioma } = useSesion();
  const centro = yo ?? restaurante ?? casa ?? marcadores[0]?.punto;
  if (!centro) return null;
  const puntos = [
    ...marcadores.map((x) => ({
      id: `m-${x.id}`,
      ...x.punto,
      color: COLORES.restaurante,
      radio: 8,
      etiqueta: x.nombre,
    })),
    ...(restaurante
      ? [
          {
            id: 'restaurante',
            ...restaurante,
            color: COLORES.restaurante,
            radio: 9,
            etiqueta: etiquetas.restaurante,
          },
        ]
      : []),
    ...(casa
      ? [{ id: 'casa', ...casa, color: COLORES.casa, radio: 9, etiqueta: etiquetas.casa }]
      : []),
    ...(yo
      ? [{ id: 'yo', ...yo, color: COLORES.repartidor, radio: 12, etiqueta: etiquetas.yo }]
      : []),
  ];
  return (
    <MapaGoogleBajoDemanda
      llave={LLAVE_MAPA_WEB}
      idioma={idioma}
      centro={centro}
      puntos={puntos}
      alto={alto}
      etiqueta={etiquetas.yo}
    />
  );
}

function MapaLeaflet({
  yo,
  restaurante,
  casa,
  marcadores = [],
  zonasDemanda = [],
  etiquetaZona = (n: number) => String(n),
  alto = 300,
  etiquetas,
}: {
  yo: Punto | null;
  restaurante?: Punto | null;
  casa?: Punto | null;
  marcadores?: { id: string; punto: Punto; nombre: string }[];
  zonasDemanda?: ZonaDemanda[];
  etiquetaZona?: (pedidos: number, pico?: number) => string;
  alto?: number;
  etiquetas: { yo: string; restaurante: string; casa: string };
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<L.Layer[]>([]);
  const centro = yo ?? restaurante ?? casa ?? { lat: 25.7743, lng: -80.1937 };
  const firmaZonas = zonasDemanda.map((z) => `${z.lat},${z.lng},${z.pedidos}`).join('|');

  useEffect(() => {
    if (!caja.current || mapa.current) return;
    mapa.current = crearMapa(caja.current, centro, 14);
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
    for (const z of zonasDemanda) nuevas.push(zona(z, etiquetaZona(z.pedidos, z.pico)));
    for (const x of marcadores) nuevas.push(punto(x.punto, COLORES.restaurante, 8, x.nombre));
    if (restaurante) nuevas.push(punto(restaurante, COLORES.restaurante, 9, etiquetas.restaurante));
    if (casa) nuevas.push(punto(casa, COLORES.casa, 9, etiquetas.casa));
    if (yo) nuevas.push(punto(yo, COLORES.repartidor, 12, etiquetas.yo));
    for (const c of nuevas) c.addTo(m);
    capas.current = nuevas;
    const todos = [yo, restaurante ?? null, casa ?? null].filter((p): p is Punto => p != null);
    const separados =
      todos.length > 1 &&
      todos.some((p) => Math.abs(p.lat - todos[0]!.lat) + Math.abs(p.lng - todos[0]!.lng) > 0.0005);
    if (separados)
      m.fitBounds(
        todos.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 16 },
      );
    else if (todos[0]) m.setView([todos[0].lat, todos[0].lng], 15);
    // Se redibuja cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    yo?.lat,
    yo?.lng,
    restaurante?.lat,
    restaurante?.lng,
    casa?.lat,
    casa?.lng,
    marcadores.length,
    firmaZonas,
  ]);

  return (
    <div
      ref={caja}
      style={{ height: alto, width: '100%', overflow: 'hidden', background: '#E9EEF5' }}
      aria-label={etiquetas.yo}
    />
  );
}
