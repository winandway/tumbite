import { Text, View } from 'react-native';
import type { Punto } from './ubicacion';

/** En la vista web (solo para el programador) no hay mapa nativo: se dice dónde va cada cosa. */
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
  const fila = (nombre: string, p: Punto | null) =>
    p ? (
      <Text key={nombre} style={{ color: '#5E5E5E' }}>
        {nombre}: {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
      </Text>
    ) : null;
  return (
    <View style={{ padding: 12, borderRadius: 16, backgroundColor: '#f1f1f1', marginBottom: 12 }}>
      {fila(etiquetas.restaurante, restaurante)}
      {fila(etiquetas.casa, casa)}
      {fila(nombreRepartidor ?? etiquetas.repartidor, repartidor)}
    </View>
  );
}
