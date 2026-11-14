import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { C, MarcaIsotipo, usePropsMapaDivoox } from '@tumbite/movil';
import {
  altitudDeZoom,
  rotuloDestino,
  useVistaDeLlegada,
} from '@tumbite/compartido/src/mapaLlegada';
import { IMG_COMIDA } from './comida/recursos';

export type Punto = { lat: number; lng: number };

/**
 * Mapa en vivo de la entrega: el restaurante, tu casa y el repartidor acercándose.
 * El repartidor se mueve con cada actualización (cada 5 s). iOS usa Apple Maps;
 * Android necesita la llave de Google Maps en app.json (pendiente de Richard).
 * C-SEGUIMIENTO-HONESTO (BRE-2): sin señal del repartidor (más de 60 s) su punto se ve apagado y
 * sin la línea de ruta, para no presentar una ubicación vieja como si fuera en vivo.
 * C-MAPA-LLEGADA: a menos de 200 m de la casa el mapa se acerca solo y muestra la casa y el
 * repartidor juntos, con el número de la dirección a la vista (igual que en la web).
 * C-MAPA-DIA-NOCHE y C-MAPA-ISOTIPO: colores de día o de noche (`usePropsMapaDivoox`) y el repartidor
 * con el isotipo de Divoox (`MarcaIsotipo`), igual que en la web.
 */
export function MapaEntrega({
  restaurante,
  casa,
  repartidor,
  nombreRepartidor,
  etiquetas,
  sinSenal = false,
  direccion,
  meta = 'casa',
}: {
  restaurante: Punto | null;
  casa: Punto | null;
  repartidor: Punto | null;
  nombreRepartidor?: string;
  etiquetas: { restaurante: string; casa: string; repartidor: string };
  sinSenal?: boolean;
  /** La dirección de entrega (o el destino del viaje): su número se lee sobre el punto al llegar. */
  direccion?: string | null;
  /** Hacia dónde va ahora: tu casa (o el destino) o, en un viaje que viene a buscarte, la recogida. */
  meta?: 'casa' | 'restaurante';
}) {
  const mapa = useRef<MapView>(null);
  const puntos = [restaurante, casa, repartidor].filter((p): p is Punto => p != null);

  const llegada = useVistaDeLlegada(repartidor, meta === 'restaurante' ? restaurante : casa);
  const rotulo = llegada ? rotuloDestino(direccion) : '';
  const cerca = llegada != null;
  const { coloresMapa } = usePropsMapaDivoox(casa ?? restaurante ?? repartidor);

  // Estando cerca, la cámara se mueve solo al entrar al radio y en cada escalón de zoom
  // (`llegada.clave`), no en cada lectura de GPS (se puede mover el mapa con el dedo).
  const latMovil = cerca ? 0 : repartidor?.lat;
  const lngMovil = cerca ? 0 : repartidor?.lng;

  useEffect(() => {
    if (puntos.length < 1) return;
    if (llegada) {
      // Cerca de la casa no se encuadra todo el recorrido: la casa y el repartidor juntos, de cerca.
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
    mapa.current?.fitToCoordinates(
      puntos.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
    );
    // Se reencuadra cuando cambia algún punto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restaurante?.lat,
    restaurante?.lng,
    casa?.lat,
    casa?.lng,
    latMovil,
    lngMovil,
    llegada?.clave,
  ]);

  if (puntos.length === 0) return null;
  const centro = puntos[0] as Punto;
  const ruta =
    !sinSenal && (repartidor ?? restaurante) && casa ? [repartidor ?? restaurante, casa] : null;

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
        {...coloresMapa}
      >
        {restaurante && (
          <Marker
            coordinate={{ latitude: restaurante.lat, longitude: restaurante.lng }}
            title={etiquetas.restaurante}
            pinColor={C.secundario}
          />
        )}
        {casa && !(rotulo && meta === 'casa') && (
          <Marker
            coordinate={{ latitude: casa.lat, longitude: casa.lng }}
            title={etiquetas.casa}
            pinColor={C.primario}
          />
        )}
        {restaurante && rotulo && meta === 'restaurante' ? (
          <Marker
            coordinate={{ latitude: restaurante.lat, longitude: restaurante.lng }}
            anchor={{ x: 0.5, y: 1.6 }}
            tracksViewChanges={false}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 15,
                backgroundColor: C.secundario,
                borderWidth: 3,
                borderColor: '#fff',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{rotulo}</Text>
            </View>
          </Marker>
        ) : null}
        {casa && rotulo && meta === 'casa' ? (
          <Marker
            coordinate={{ latitude: casa.lat, longitude: casa.lng }}
            title={etiquetas.casa}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              testID="mapa-rotulo-casa"
              style={{
                minHeight: 30,
                paddingHorizontal: 10,
                borderRadius: 15,
                backgroundColor: C.primario,
                borderWidth: 3,
                borderColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{rotulo}</Text>
            </View>
          </Marker>
        ) : null}
        {repartidor && (
          <Marker
            coordinate={{ latitude: repartidor.lat, longitude: repartidor.lng }}
            title={nombreRepartidor ?? etiquetas.repartidor}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
          >
            <MarcaIsotipo fuente={IMG_COMIDA.mascota} apagado={sinSenal} />
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
