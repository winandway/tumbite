import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type L from 'leaflet';
import { COLORES, crearMapa, punto as marca } from './mapaWeb';
import type { Punto } from './ubicacion';
import { MapaGoogleBajoDemanda } from '@tumbite/compartido/src/mapaWebGoogle';
import type { VistaMapa } from '@tumbite/compartido/src/mapaLlegada';
import { C, useSesion, Text } from '@tumbite/movil';
import { LLAVE_MAPA_WEB, MAP_ID_MAPA_WEB, proveedorMapaWeb } from './mapaGoogleWeb';
import { TEXTOS_SIN_CENTRO, useCentroParaElegir } from './centroMapa';

/**
 * Marcar el punto de entrega en la versión web: se toca el mapa y el pin va ahí.
 * La dirección escrita no se toca (en la web no se busca la calle por el pin).
 */
type Props = {
  punto: Punto | null;
  cambiarPunto: (p: Punto) => void;
  cambiarDireccion: (direccion: string) => void;
  direccionVacia?: boolean;
  /** La zona de lo que se está pidiendo (el local del carrito, la recogida): último recurso. */
  cerca?: Punto | null;
  textos: { ayuda: string; buscando: string; pin: string };
};

/**
 * C-MAPA-GOOGLE-WEB: con la llave del navegador se marca sobre el mapa de Google, plano y al tocar
 * «Ver en el mapa» (elegir un punto no es un viaje). Sin llave, Leaflet.
 * C-MAPA-ABRE-DONDE-ESTAS (14 nov 2026): el mapa abre donde está la persona (`useCentroParaElegir`),
 * nunca en una ciudad fija. Sin ningún dato, en vez del mapa se ofrece «Usar mi ubicación».
 */
export function ElegirEnMapa(props: Props) {
  const { idioma } = useSesion();
  const { vista, buscando, pedirUbicacion } = useCentroParaElegir(props.punto, props.cerca);
  const [sinPermiso, setSinPermiso] = useState(false);
  const t = TEXTOS_SIN_CENTRO[idioma === 'es' ? 'es' : 'en'];
  if (!vista)
    return (
      <View style={{ marginBottom: 12, gap: 8 }} testID="mapa-sin-centro">
        <Text style={{ color: '#666B73' }}>
          {buscando ? props.textos.buscando : sinPermiso ? t.no : t.sin}
        </Text>
        {!buscando ? (
          <Pressable
            accessibilityRole="button"
            testID="mapa-usar-mi-ubicacion"
            onPress={() => void pedirUbicacion().then((p) => setSinPermiso(!p))}
            style={{
              borderWidth: 1,
              borderColor: '#2a2a2a',
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '700', color: C.secundario }}>{t.usar}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  return proveedorMapaWeb(['google']) === 'google' ? (
    <ElegirEnMapaGoogle {...props} vista={vista} />
  ) : (
    <ElegirEnMapaLeaflet {...props} vista={vista} />
  );
}

function ElegirEnMapaGoogle({ punto, cambiarPunto, textos, vista }: Props & { vista: VistaMapa }) {
  const { idioma } = useSesion();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#666B73', marginBottom: 6 }}>{textos.ayuda}</Text>
      <MapaGoogleBajoDemanda
        llave={LLAVE_MAPA_WEB}
        mapId={MAP_ID_MAPA_WEB}
        idioma={idioma}
        centro={vista.centro}
        zoom={vista.zoom}
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

function ElegirEnMapaLeaflet({ punto, cambiarPunto, textos, vista }: Props & { vista: VistaMapa }) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const cambiar = useRef(cambiarPunto);
  useEffect(() => {
    cambiar.current = cambiarPunto;
  }, [cambiarPunto]);

  useEffect(() => {
    if (!caja.current || mapa.current) return;
    const m = crearMapa(caja.current, vista.centro, vista.zoom);
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

  // Sin punto marcado, el mapa sigue a la persona cuando llega su ubicación.
  useEffect(() => {
    if (punto) return;
    mapa.current?.setView([vista.centro.lat, vista.centro.lng], vista.zoom);
  }, [vista.centro.lat, vista.centro.lng, vista.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current;
    if (!m || !punto) return;
    pin.current?.remove();
    pin.current = marca(punto, COLORES.casa, 10, textos.pin).addTo(m);
    m.setView([punto.lat, punto.lng], Math.max(m.getZoom(), 16));
  }, [punto?.lat, punto?.lng, textos.pin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#666B73', marginBottom: 6 }}>{textos.ayuda}</Text>
      <div
        ref={caja}
        role="application"
        aria-label={textos.pin}
        style={{ height: 220, borderRadius: 16, overflow: 'hidden', zIndex: 0 }}
      />
    </View>
  );
}
