import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { C } from '@tumbite/movil';
import type { Punto } from '../piezas/mapaWeb';
import { COLOR_TONO, type PuntoRuta } from './colorTono';

export type { PuntoRuta };

/**
 * Mapa de la ruta Flex (celular, el mismo mapa nativo de la app): el centro y las paradas con su
 * número, unidos en orden con una línea punteada (es el orden de visita, no el camino por calles).
 */
export function MapaRuta({
  puntos,
  yo,
  alto = 380,
  etiqueta,
  area = null,
}: {
  puntos: PuntoRuta[];
  yo: Punto | null;
  alto?: number;
  etiqueta: string;
  /** C-FLEX-GEOCERCA: el círculo del área de entrega de la parada actual. */
  area?: { punto: Punto; metros: number } | null;
}) {
  const mapa = useRef<MapView>(null);
  const todos = [...puntos.map((p) => p.punto), ...(yo ? [yo] : [])];
  const clave = todos.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (todos.length < 2) return;
    mapa.current?.fitToCoordinates(
      todos.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true },
    );
    // Se reencuadra cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  const centro = todos[0] ?? { lat: 25.7743, lng: -80.1937 };
  return (
    <View style={{ height: alto, overflow: 'hidden', borderRadius: 14 }}>
      <MapView
        ref={mapa}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: centro.lat,
          longitude: centro.lng,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        showsUserLocation={false}
        toolbarEnabled={false}
        accessibilityLabel={etiqueta}
      >
        {puntos.length > 1 ? (
          <Polyline
            coordinates={puntos.map((p) => ({ latitude: p.punto.lat, longitude: p.punto.lng }))}
            strokeColor="#8E9198"
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        ) : null}
        {area ? (
          <Circle
            center={{ latitude: area.punto.lat, longitude: area.punto.lng }}
            radius={area.metros}
            strokeColor={C.logisticaAccion}
            fillColor="rgba(74, 165, 220, 0.18)"
            strokeWidth={2}
          />
        ) : null}
        {puntos.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.punto.lat, longitude: p.punto.lng }}
            title={p.nombre}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={{
                minWidth: 30,
                height: 30,
                paddingHorizontal: 6,
                borderRadius: 15,
                backgroundColor: COLOR_TONO[p.tono],
                borderWidth: 2,
                borderColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{p.numero}</Text>
            </View>
          </Marker>
        ))}
        {yo ? (
          <Marker coordinate={{ latitude: yo.lat, longitude: yo.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: C.logisticaAccion,
                borderWidth: 3,
                borderColor: '#FFFFFF',
              }}
            />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}
