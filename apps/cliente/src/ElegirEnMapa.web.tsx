import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import type L from 'leaflet';
import { COLORES, crearMapa, punto as marca } from './mapaWeb';
import type { Punto } from './ubicacion';

/**
 * Marcar el punto de entrega en la versión web: se toca el mapa y el pin va ahí.
 * La dirección escrita no se toca (en la web no se busca la calle por el pin).
 */
export function ElegirEnMapa({
  punto,
  cambiarPunto,
  textos,
}: {
  punto: Punto | null;
  cambiarPunto: (p: Punto) => void;
  cambiarDireccion: (direccion: string) => void;
  direccionVacia?: boolean;
  textos: { ayuda: string; buscando: string; pin: string };
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const cambiar = useRef(cambiarPunto);
  useEffect(() => {
    cambiar.current = cambiarPunto;
  }, [cambiarPunto]);

  useEffect(() => {
    if (!caja.current || mapa.current) return;
    const m = crearMapa(caja.current, punto ?? { lat: 25.7617, lng: -80.1918 }, punto ? 16 : 12);
    m.on('click', (e: L.LeafletMouseEvent) =>
      cambiar.current({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
    // Se crea una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !punto) return;
    pin.current?.remove();
    pin.current = marca(punto, COLORES.casa, 10, textos.pin).addTo(m);
    m.setView([punto.lat, punto.lng], Math.max(m.getZoom(), 16));
  }, [punto?.lat, punto?.lng, textos.pin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#5E5E5E', marginBottom: 6 }}>{textos.ayuda}</Text>
      <div
        ref={caja}
        role="application"
        aria-label={textos.pin}
        style={{ height: 220, borderRadius: 16, overflow: 'hidden', zIndex: 0 }}
      />
    </View>
  );
}
