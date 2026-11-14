import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import type L from 'leaflet';
import { COLORES, crearMapa, punto as marca } from './mapaWeb';
import type { Punto } from './ubicacion';
import { MapaGoogleBajoDemanda } from '@tumbite/compartido/src/mapaWebGoogle';
import { useSesion } from '@tumbite/movil';
import { LLAVE_MAPA_WEB, MAP_ID_MAPA_WEB, proveedorMapaWeb } from './mapaGoogleWeb';

/**
 * Marcar el punto de entrega en la versión web: se toca el mapa y el pin va ahí.
 * La dirección escrita no se toca (en la web no se busca la calle por el pin).
 */
type Props = {
  punto: Punto | null;
  cambiarPunto: (p: Punto) => void;
  cambiarDireccion: (direccion: string) => void;
  direccionVacia?: boolean;
  textos: { ayuda: string; buscando: string; pin: string };
};

/**
 * C-MAPA-GOOGLE-WEB: con la llave del navegador se marca sobre el mapa de Google, plano y al tocar
 * «Ver en el mapa» (elegir un punto no es un viaje). Sin llave, Leaflet.
 */
export function ElegirEnMapa(props: Props) {
  return proveedorMapaWeb(['google']) === 'google' ? (
    <ElegirEnMapaGoogle {...props} />
  ) : (
    <ElegirEnMapaLeaflet {...props} />
  );
}

function ElegirEnMapaGoogle({ punto, cambiarPunto, textos }: Props) {
  const { idioma } = useSesion();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#5E5E5E', marginBottom: 6 }}>{textos.ayuda}</Text>
      <MapaGoogleBajoDemanda
        llave={LLAVE_MAPA_WEB}
        mapId={MAP_ID_MAPA_WEB}
        idioma={idioma}
        centro={punto ?? { lat: 25.7617, lng: -80.1918 }}
        zoom={punto ? 16 : 12}
        alto={220}
        etiqueta={textos.pin}
        puntos={
          punto
            ? [{ id: 'pin', ...punto, color: COLORES.casa, radio: 10, etiqueta: textos.pin }]
            : []
        }
        alTocarMapa={cambiarPunto}
      />
    </View>
  );
}

function ElegirEnMapaLeaflet({ punto, cambiarPunto, textos }: Props) {
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
