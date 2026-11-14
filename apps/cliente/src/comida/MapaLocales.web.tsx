import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { COLORES, crearMapa, punto } from '../mapaWeb';
import { MapaGoogleBajoDemanda } from '@tumbite/compartido/src/mapaWebGoogle';
import { useSesion } from '@tumbite/movil';
import { LLAVE_MAPA_WEB, MAP_ID_MAPA_WEB, proveedorMapaWeb } from '../mapaGoogleWeb';

export type Local = { id: string; nombre: string; lat: number; lng: number; detalle: string };

type Props = { locales: Local[]; alElegir: (id: string) => void };

/**
 * C-RECOGER-MAPA en la versión web: un punto por local; al tocarlo se abre su menú. Las direcciones
 * de los locales vienen de Google Places: con la llave del navegador, mapa de Google plano y bajo
 * demanda (C-MAPA-GOOGLE-WEB); sin llave, Leaflet.
 */
export function MapaLocales(props: Props) {
  return proveedorMapaWeb(['google']) === 'google' ? (
    <MapaLocalesGoogle {...props} />
  ) : (
    <MapaLocalesLeaflet {...props} />
  );
}

function MapaLocalesGoogle({ locales, alElegir }: Props) {
  const { idioma } = useSesion();
  const primero = locales[0];
  if (!primero) return null;
  return (
    <MapaGoogleBajoDemanda
      llave={LLAVE_MAPA_WEB}
      mapId={MAP_ID_MAPA_WEB}
      idioma={idioma}
      centro={primero}
      zoom={13}
      etiqueta="map"
      puntos={locales.map((l) => ({
        id: l.id,
        lat: l.lat,
        lng: l.lng,
        color: COLORES.restaurante,
        radio: 9,
        etiqueta: `${l.nombre} · ${l.detalle}`,
        alTocar: () => alElegir(l.id),
      }))}
    />
  );
}

function MapaLocalesLeaflet({ locales, alElegir }: Props) {
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
