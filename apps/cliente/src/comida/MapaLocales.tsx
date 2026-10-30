import MapView, { Marker } from 'react-native-maps';
import { C } from '@tumbite/movil';

export type Local = { id: string; nombre: string; lat: number; lng: number; detalle: string };

/**
 * C-RECOGER-MAPA (29 oct 2026), como el «Pickup» de Uber Eats: los locales cercanos en el mapa
 * para pasar a buscar el pedido. Al tocar el globo de un local se abre su menú.
 */
export function MapaLocales({
  locales,
  alElegir,
}: {
  locales: Local[];
  alElegir: (id: string) => void;
}) {
  const primero = locales[0];
  if (!primero) return null;
  return (
    <MapView
      style={{ height: 260, borderRadius: 18, marginBottom: 12 }}
      initialRegion={{
        latitude: primero.lat,
        longitude: primero.lng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }}
      accessibilityLabel="map"
    >
      {locales.map((l) => (
        <Marker
          key={l.id}
          coordinate={{ latitude: l.lat, longitude: l.lng }}
          title={l.nombre}
          description={l.detalle}
          pinColor={C.primario}
          onCalloutPress={() => alElegir(l.id)}
        />
      ))}
    </MapView>
  );
}
