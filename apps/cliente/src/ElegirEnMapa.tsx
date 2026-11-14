import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, {
  Marker,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from 'react-native-maps';
import { C, useSesion } from '@tumbite/movil';
import { TEXTOS_SIN_CENTRO, useCentroParaElegir } from './centroMapa';
import type { Punto } from './ubicacion';

/**
 * Marcar la dirección de entrega en el mapa: se toca o se arrastra el pin y la dirección
 * escrita se rellena sola con la calle más cercana. Si la persona ya escribió una dirección,
 * no se le pisa: solo se rellena cuando está vacía o cuando mueve el pin.
 * C-CARRITO-UNA-DIRECCION (31 oct 2026): el mapa se mueve a la dirección elegida (una guardada o una
 * sugerencia) y, si ya hay ubicación y la casilla está vacía, la casilla se llena sola con esa calle.
 * C-MAPA-ABRE-DONDE-ESTAS (14 nov 2026): abre donde está la persona (`useCentroParaElegir`), nunca en
 * una ciudad fija; sin ningún dato, en vez del mapa ofrece «Usar mi ubicación» (igual que la web).
 */
export function ElegirEnMapa({
  punto,
  cambiarPunto,
  cambiarDireccion,
  direccionVacia = false,
  cerca,
  textos,
}: {
  punto: Punto | null;
  cambiarPunto: (p: Punto) => void;
  cambiarDireccion: (direccion: string) => void;
  direccionVacia?: boolean;
  /** La zona de lo que se está pidiendo (el local del carrito, la recogida): último recurso. */
  cerca?: Punto | null;
  textos: { ayuda: string; buscando: string; pin: string };
}) {
  const [buscando, setBuscando] = useState(false);
  const { idioma } = useSesion();
  const { vista, buscando: buscandoCentro, pedirUbicacion } = useCentroParaElegir(punto, cerca);
  const [sinPermiso, setSinPermiso] = useState(false);
  const mapa = useRef<MapView>(null);

  // Sin punto marcado, el mapa sigue a la persona cuando llega su ubicación.
  useEffect(() => {
    if (punto || !vista) return;
    const delta = vista.zoom >= 15 ? 0.02 : 0.12;
    mapa.current?.animateToRegion(
      {
        latitude: vista.centro.lat,
        longitude: vista.centro.lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      300,
    );
  }, [vista?.centro.lat, vista?.centro.lng, vista?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  async function leerCalle(p: Punto) {
    setBuscando(true);
    try {
      const [sitio] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
      const partes = [
        [sitio?.streetNumber, sitio?.street].filter(Boolean).join(' '),
        sitio?.city,
        sitio?.region,
        sitio?.postalCode,
      ].filter(Boolean);
      if (partes.length) cambiarDireccion(partes.join(', '));
    } catch (e) {
      console.warn('mapa: no se pudo leer la dirección del pin', e);
    } finally {
      setBuscando(false);
    }
  }

  // El mapa sigue al punto elegido fuera de él (dirección guardada o sugerencia).
  useEffect(() => {
    if (!punto) return;
    mapa.current?.animateToRegion(
      { latitude: punto.lat, longitude: punto.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      300,
    );
  }, [punto?.lat, punto?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hay ubicación y la casilla está vacía: se llena una vez con la calle de ese punto.
  const rellenado = useRef(false);
  useEffect(() => {
    if (!punto || !direccionVacia || rellenado.current) return;
    rellenado.current = true;
    void leerCalle(punto);
  }, [punto?.lat, punto?.lng, direccionVacia]); // eslint-disable-line react-hooks/exhaustive-deps

  async function mover(p: Punto) {
    cambiarPunto(p);
    await leerCalle(p);
  }
  const alTocar = (e: MapPressEvent) =>
    void mover({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
  const alSoltar = (e: MarkerDragStartEndEvent) =>
    void mover({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });

  const ts = TEXTOS_SIN_CENTRO[idioma === 'es' ? 'es' : 'en'];
  if (!vista)
    return (
      <View style={{ marginBottom: 12, gap: 8 }} testID="mapa-sin-centro">
        <Text style={{ color: '#5E5E5E' }}>
          {buscandoCentro ? textos.buscando : sinPermiso ? ts.no : ts.sin}
        </Text>
        {!buscandoCentro ? (
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
            <Text style={{ fontWeight: '700', color: C.secundario }}>{ts.usar}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  const centro = vista.centro;
  const delta = vista.zoom >= 15 ? 0.02 : 0.12;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#5E5E5E', marginBottom: 6 }}>
        {buscando ? textos.buscando : textos.ayuda}
      </Text>
      <View style={{ height: 220, borderRadius: 16, overflow: 'hidden' }}>
        <MapView
          ref={mapa}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: centro.lat,
            longitude: centro.lng,
            latitudeDelta: delta,
            longitudeDelta: delta,
          }}
          onPress={alTocar}
          showsUserLocation
          toolbarEnabled={false}
          accessibilityLabel={textos.pin}
        >
          {punto && (
            <Marker
              coordinate={{ latitude: punto.lat, longitude: punto.lng }}
              draggable
              onDragEnd={alSoltar}
              title={textos.pin}
              pinColor={C.primario}
            />
          )}
        </MapView>
      </View>
    </View>
  );
}
