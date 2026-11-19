import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { C, MarcaIsotipo, usePropsMapaDivoox, useCapturaMarcador, Text } from '@tumbite/movil';
import {
  altitudDeZoom,
  rotuloDestino,
  useVistaDeLlegada,
} from '@tumbite/compartido/src/mapaLlegada';
import { IMG } from './recursos';
import type { Punto, ZonaDemanda } from './mapaWeb';

/**
 * Mapa del repartidor (celular): su ubicación con el isotipo de Divoox (C-MAPA-ISOTIPO), los restaurantes cercanos, el
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
  etiquetaZona,
  alto = 300,
  etiquetas,
  direccionDestino,
  vistaPrevia = false,
}: {
  yo: Punto | null;
  restaurante?: Punto | null;
  casa?: Punto | null;
  marcadores?: { id: string; punto: Punto; nombre: string }[];
  zonasDemanda?: ZonaDemanda[];
  /** En el celular solo se dibuja sobre las zonas con pago pico (C-PAGO-PICO). */
  etiquetaZona?: (pedidos: number, pico?: number) => string;
  alto?: number;
  etiquetas: { yo: string; restaurante: string; casa: string };
  /** La dirección del destino de ahora (el local o la casa): su número se lee al llegar. */
  direccionDestino?: string | null;
  /**
   * C-MAPA-VISTA-PREVIA (paquete 13): el mapa pequeño de la oferta y del viaje. Como Uber Driver y
   * DoorDash Dasher no se toca (sin gestos y sin robar el toque a la hoja que se desplaza) y queda
   * siempre encuadrado en la recogida, el destino y el conductor.
   */
  vistaPrevia?: boolean;
}) {
  const mapa = useRef<MapView>(null);
  const puntos = [yo, restaurante ?? null, casa ?? null].filter((p): p is Punto => p != null);
  // C-MAPA-ENCUADRE (31 oct 2026): el encuadre corre al cambiar un punto Y cuando el mapa termina
  // de cargar; antes corría una sola vez, con el mapa todavía sin cargar, y en la entrega se veía
  // solo al repartidor sin el restaurante ni la casa.
  const [listo, setListo] = useState(false);
  // C-MAPA-LLEGADA: a menos de 200 m del destino (el local o la casa) el mapa se acerca solo y el
  // punto muestra el número de la dirección (igual que en la web).
  const destino = casa ?? restaurante ?? null;
  const vistaLlegada = useVistaDeLlegada(yo, destino);
  const llegada = vistaPrevia ? null : vistaLlegada;
  const rotulo = llegada ? rotuloDestino(direccionDestino) : '';
  const cerca = llegada != null;
  // C-MAPA-DIA-NOCHE: colores de día o de noche, como todos los mapas.
  const { coloresMapa } = usePropsMapaDivoox(yo ?? restaurante ?? casa);
  // C-MARCADOR-ANDROID: la foto de los marcadores con vista propia se toma cuando ya se dibujaron.
  const vista = useCapturaMarcador(`${rotulo}|${zonasDemanda.length}`);
  // Cada marcador con vista propia se registra para repintarse (`redraw()`, segunda vuelta).
  const { marcador } = vista;
  // Estando cerca, la cámara se mueve solo al entrar al radio y en cada escalón de zoom
  // (`llegada.clave`), no en cada lectura de GPS (se puede mover el mapa con el dedo).
  const latMovil = cerca ? 0 : yo?.lat;
  const lngMovil = cerca ? 0 : yo?.lng;
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
      { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true },
    );
    // Se reencuadra cuando cambia algún punto o cuando el mapa termina de cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    listo,
    latMovil,
    lngMovil,
    restaurante?.lat,
    restaurante?.lng,
    casa?.lat,
    casa?.lng,
    llegada?.clave,
  ]);
  // C-MAPA-ABRE-DONDE-ESTAS: sin ningún punto todavía no hay mapa (nunca una ciudad fija): queda el
  // hueco gris del mismo alto hasta que llega la ubicación.
  const centro = yo ?? restaurante ?? casa ?? marcadores[0]?.punto ?? zonasDemanda[0] ?? null;
  const ruta = restaurante && casa ? [restaurante, casa] : null;
  if (!centro)
    return (
      <View testID="mapa-sin-ubicacion" style={{ height: alto, backgroundColor: '#E9EEF5' }} />
    );
  return (
    <View
      style={{ height: alto, overflow: 'hidden' }}
      pointerEvents={vistaPrevia ? 'none' : 'auto'}
    >
      <MapView
        ref={mapa}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: centro.lat,
          longitude: centro.lng,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        onMapReady={() => {
          setListo(true);
          vista.listo();
        }}
        showsUserLocation={false}
        toolbarEnabled={false}
        scrollEnabled={!vistaPrevia}
        zoomEnabled={!vistaPrevia}
        rotateEnabled={!vistaPrevia}
        pitchEnabled={!vistaPrevia}
        zoomTapEnabled={!vistaPrevia}
        moveOnMarkerPress={!vistaPrevia}
        accessibilityLabel={etiquetas.yo}
        {...coloresMapa}
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
        {zonasDemanda
          .filter((z) => z.pico)
          .map((z) => (
            <Marker
              key={`pico-${z.lat},${z.lng}`}
              coordinate={{ latitude: z.lat, longitude: z.lng }}
              tracksViewChanges={vista.seguir}
              ref={marcador}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={{
                  backgroundColor: C.secundario,
                  borderRadius: 14,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                  {etiquetaZona?.(z.pedidos, z.pico) ?? ''}
                </Text>
              </View>
            </Marker>
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
        {destino && rotulo ? (
          <Marker
            coordinate={{ latitude: destino.lat, longitude: destino.lng }}
            anchor={{ x: 0.5, y: 1.6 }}
            tracksViewChanges={vista.seguir}
            ref={marcador}
          >
            <View
              testID="mapa-rotulo-destino"
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 15,
                backgroundColor: casa ? C.primario : C.secundario,
                borderWidth: 3,
                borderColor: '#fff',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{rotulo}</Text>
            </View>
          </Marker>
        ) : null}
        {yo && (
          <Marker
            coordinate={{ latitude: yo.lat, longitude: yo.lng }}
            title={etiquetas.yo}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
            tracksViewChanges={vista.seguir}
            ref={marcador}
          >
            <MarcaIsotipo fuente={IMG.mascota} alCargar={vista.listo} />
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
