import { useState } from 'react';
import { Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, {
  Marker,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from 'react-native-maps';
import { C } from '@tumbite/movil';
import type { Punto } from './ubicacion';

/**
 * Marcar la dirección de entrega en el mapa: se toca o se arrastra el pin y la dirección
 * escrita se rellena sola con la calle más cercana. Si la persona ya escribió una dirección,
 * no se le pisa: solo se rellena cuando está vacía o cuando mueve el pin.
 */
export function ElegirEnMapa({
  punto,
  cambiarPunto,
  cambiarDireccion,
  textos,
}: {
  punto: Punto | null;
  cambiarPunto: (p: Punto) => void;
  cambiarDireccion: (direccion: string) => void;
  textos: { ayuda: string; buscando: string; pin: string };
}) {
  const [buscando, setBuscando] = useState(false);
  const centro = punto ?? { lat: 25.7617, lng: -80.1918 }; // Miami si no hay ubicación todavía

  async function mover(p: Punto) {
    cambiarPunto(p);
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
  const alTocar = (e: MapPressEvent) =>
    void mover({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
  const alSoltar = (e: MarkerDragStartEndEvent) =>
    void mover({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#5E5E5E', marginBottom: 6 }}>
        {buscando ? textos.buscando : textos.ayuda}
      </Text>
      <View style={{ height: 220, borderRadius: 16, overflow: 'hidden' }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: centro.lat,
            longitude: centro.lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
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
