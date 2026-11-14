import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { C, MarcaIsotipo, usePropsMapaDivoox } from '@tumbite/movil';
import {
  altitudDeZoom,
  rotuloDestino,
  useVistaDeLlegada,
} from '@tumbite/compartido/src/mapaLlegada';
import type { Punto } from '../piezas/mapaWeb';
import { IMG } from '../piezas/recursos';
import { COLOR_TONO, type PuntoRuta } from './colorTono';

export type { PuntoRuta };

/**
 * C-FLEX-MAPA-ENCUADRE: la región que cubre todos los puntos, con margen. El mapa nace ya mostrando
 * el centro y todas las paradas (en el iPhone, encuadrar después no siempre se aplica).
 */
export function regionDe(puntos: Punto[]) {
  // C-MAPA-ABRE-DONDE-ESTAS: sin puntos no hay región (nunca una ciudad fija): el mapa no se dibuja.
  if (!puntos.length) return null;
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
  // C-MAPA-LLEGADA: a menos de 200 m de la parada actual el mapa se acerca solo y la parada muestra,
  // junto a su número, el número de la dirección (igual que en la web).
  const parada = puntos.find((p) => p.tono === 'actual') ?? null;
  const llegada = useVistaDeLlegada(yo, parada?.punto);
  const rotulo = llegada ? rotuloDestino(parada?.direccion) : '';
  // Estando cerca, la cámara se mueve solo al entrar al radio y en cada escalón de zoom.
  const clave = llegada?.clave
    ? `llegada:${parada?.id}:${llegada.clave}`
    : todos.map((p) => `${p.lat},${p.lng}`).join('|');
  // C-MAPA-DIA-NOCHE: colores de día o de noche, como todos los mapas.
  const { coloresMapa } = usePropsMapaDivoox(todos[0]);
  useEffect(() => {
    if (!listo) return;
    if (llegada) {
      mapa.current?.animateCamera(
        {
          center: { latitude: llegada.centro.lat, longitude: llegada.centro.lng },
          zoom: llegada.zoom,
          altitude: altitudDeZoom(llegada.zoom),
        },
        { duration: 600 },
      );
      return;
    }
    if (todos.length < 2) return;
    mapa.current?.fitToCoordinates(
      todos.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true },
    );
    // Se reencuadra cuando el mapa termina de cargar y cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, listo]);
  const inicial = regionDe(todos);
  if (!inicial) return null;
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
        {...coloresMapa}
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
            // La marca no se vuelve a pintar en cada lectura de GPS; cambia de llave cuando cambia lo
            // que muestra (su estado o el rótulo de llegada).
            key={`${p.id}:${p.tono}:${p === parada ? rotulo : ''}`}
            tracksViewChanges={false}
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
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                {p === parada && rotulo ? `${p.numero} · ${rotulo}` : p.numero}
              </Text>
            </View>
          </Marker>
        ))}
        {yo ? (
          <Marker
            coordinate={{ latitude: yo.lat, longitude: yo.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
          >
            {/* C-MAPA-ISOTIPO: el conductor es el isotipo de Divoox. */}
            <MarcaIsotipo fuente={IMG.mascota} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}
