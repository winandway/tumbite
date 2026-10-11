import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { C } from '@tumbite/movil';

export type Punto = { lat: number; lng: number };

/**
 * Mapa en vivo de la entrega: el restaurante, tu casa y el repartidor acercándose.
 * El repartidor se mueve con cada actualización (cada 5 s). iOS usa Apple Maps;
 * Android necesita la llave de Google Maps en app.json (pendiente de Richard).
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
  const mapa = useRef<MapView>(null);
  const puntos = [restaurante, casa, repartidor].filter((p): p is Punto => p != null);

  useEffect(() => {
    if (puntos.length < 1) return;
    mapa.current?.fitToCoordinates(
      puntos.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
    );
    // Se reencuadra cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurante?.lat, restaurante?.lng, casa?.lat, casa?.lng, repartidor?.lat, repartidor?.lng]);

  if (puntos.length === 0) return null;
  const centro = puntos[0] as Punto;
  const ruta = (repartidor ?? restaurante) && casa ? [repartidor ?? restaurante, casa] : null;

  return (
    <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
      <MapView
        ref={mapa}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: centro.lat,
          longitude: centro.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
        toolbarEnabled={false}
        accessibilityLabel={etiquetas.repartidor}
      >
        {restaurante && (
          <Marker
            coordinate={{ latitude: restaurante.lat, longitude: restaurante.lng }}
            title={etiquetas.restaurante}
            pinColor={C.secundario}
          />
        )}
        {casa && (
          <Marker
            coordinate={{ latitude: casa.lat, longitude: casa.lng }}
            title={etiquetas.casa}
            pinColor={C.primario}
          />
        )}
        {repartidor && (
          <Marker
            coordinate={{ latitude: repartidor.lat, longitude: repartidor.lng }}
            title={nombreRepartidor ?? etiquetas.repartidor}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: C.primario,
                borderWidth: 3,
                borderColor: '#fff',
              }}
            />
          </Marker>
        )}
        {ruta && ruta[0] && ruta[1] && (
          <Polyline
            coordinates={ruta.map((p) => ({
              latitude: (p as Punto).lat,
              longitude: (p as Punto).lng,
            }))}
            strokeColor={C.primario}
            strokeWidth={3}
            lineDashPattern={[6, 6]}
          />
        )}
      </MapView>
      {repartidor && nombreRepartidor ? (
        <View
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            backgroundColor: '#fff',
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text style={{ fontWeight: '700', color: C.secundario }}>{nombreRepartidor}</Text>
        </View>
      ) : null}
    </View>
  );
}
