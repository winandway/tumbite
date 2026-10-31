import { useEffect, useRef } from 'react';
import { Image, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { C } from '@tumbite/movil';
import { IMG } from './recursos';
import type { Punto, ZonaDemanda } from './mapaWeb';

/**
 * Mapa del repartidor (celular): su ubicación con la mascota, los restaurantes cercanos, el
 * restaurante del pedido y la casa del cliente con la línea de la ruta. iOS usa Apple Maps;
 * Android necesita la llave de Google Maps en app.json. Con `zonasDemanda`, las zonas con más
 * pedidos ahora (C-MAPA-DEMANDA) como círculos rojos translúcidos.
 */
export function Mapa({
  yo,
  restaurante,
  casa,
  marcadores = [],
  zonasDemanda = [],
  alto = 300,
  etiquetas,
}: {
  yo: Punto | null;
  restaurante?: Punto | null;
  casa?: Punto | null;
  marcadores?: { id: string; punto: Punto; nombre: string }[];
  zonasDemanda?: ZonaDemanda[];
  /** Solo lo usa la web (el círculo nativo no lleva texto). */
  etiquetaZona?: (pedidos: number) => string;
  alto?: number;
  etiquetas: { yo: string; restaurante: string; casa: string };
}) {
  const mapa = useRef<MapView>(null);
  const puntos = [yo, restaurante ?? null, casa ?? null].filter((p): p is Punto => p != null);
  useEffect(() => {
    // C-MAPA-SIGUE-AL-REPARTIDOR (31 oct 2026): con un solo punto (el repartidor, sin pedido) el mapa
    // se quedaba donde abrió (Miami) aunque estuviera en Michigan. Ahora va a ese punto.
    const [solo] = puntos;
    if (puntos.length === 1 && solo) {
      mapa.current?.animateToRegion(
        { latitude: solo.lat, longitude: solo.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        300,
      );
      return;
    }
    if (puntos.length < 2) return;
    mapa.current?.fitToCoordinates(
      puntos.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 80, right: 60, bottom: 160, left: 60 }, animated: true },
    );
    // Se reencuadra cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yo?.lat, yo?.lng, restaurante?.lat, restaurante?.lng, casa?.lat, casa?.lng]);
  const centro = yo ?? restaurante ?? casa ?? { lat: 25.7743, lng: -80.1937 };
  const ruta = restaurante && casa ? [restaurante, casa] : null;
  return (
    <View style={{ height: alto, overflow: 'hidden' }}>
      <MapView
        ref={mapa}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: centro.lat,
          longitude: centro.lng,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        showsUserLocation={false}
        toolbarEnabled={false}
        accessibilityLabel={etiquetas.yo}
      >
        {zonasDemanda.map((z) => (
          <Circle
            key={`${z.lat},${z.lng}`}
            center={{ latitude: z.lat, longitude: z.lng }}
            radius={600}
            strokeWidth={1}
            strokeColor="rgba(242,13,32,0.6)"
            fillColor={z.nivel === 'alta' ? 'rgba(242,13,32,0.35)' : 'rgba(242,13,32,0.18)'}
          />
        ))}
        {marcadores.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.punto.lat, longitude: m.punto.lng }}
            title={m.nombre}
            pinColor={C.primario}
          />
        ))}
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
        {yo && (
          <Marker
            coordinate={{ latitude: yo.lat, longitude: yo.lng }}
            title={etiquetas.yo}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: 'rgba(242, 13, 32, 0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                source={IMG.mascota}
                style={{ width: 36, height: 24 }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>
          </Marker>
        )}
        {ruta && (
          <Polyline
            coordinates={ruta.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={C.primario}
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
}
