import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { C } from '@tumbite/movil';
import type { Punto } from '../piezas/mapaWeb';
import { COLOR_TONO, type PuntoRuta } from './colorTono';

export type { PuntoRuta };

/**
 * C-FLEX-MAPA-ENCUADRE: la región que cubre todos los puntos, con margen. El mapa nace ya mostrando
 * el centro y todas las paradas (en el iPhone, encuadrar después no siempre se aplica).
 */
export function regionDe(puntos: Punto[]) {
  if (!puntos.length)
    return { latitude: 25.7743, longitude: -80.1937, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lng);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01),
  };
}

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
  // C-FLEX-MAPA-ENCUADRE: encuadrar antes de que el mapa termine de cargar no hace nada.
  const [listo, setListo] = useState(false);
  const todos = [...puntos.map((p) => p.punto), ...(yo ? [yo] : [])];
  const clave = todos.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (!listo || todos.length < 2) return;
    mapa.current?.fitToCoordinates(
      todos.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true },
    );
    // Se reencuadra cuando el mapa termina de cargar y cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, listo]);
  const inicial = regionDe(todos);
  return (
    <View style={{ height: alto, overflow: 'hidden', borderRadius: 14 }}>
      <MapView
        ref={mapa}
        style={{ flex: 1 }}
        initialRegion={inicial}
        onMapReady={() => setListo(true)}
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
