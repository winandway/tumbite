import { Alert, Linking, Platform } from 'react-native';
import { appsDeMapa } from '@tumbite/compartido';

/**
 * C-ELEGIR-MAPAS (10 nov 2026) — todos los países. «Cómo llegar» en comida, viajes y Flex: el
 * repartidor elige su app de mapas (Google Maps, Waze y, en el iPhone, Apple Maps). Pieza única:
 * ninguna pantalla arma el enlace por su cuenta. En la web no hay otra app: abre Google Maps.
 */
const T = {
  es: { titulo: 'Elige la app de mapas', cancelar: 'Cancelar' },
  en: { titulo: 'Choose a maps app', cancelar: 'Cancel' },
};

export function comoLlegar(
  destino: { lat: number | null; lng: number | null; direccion?: string },
  /** El idioma, o los textos ya traducidos de la pantalla que llama. */
  textos: 'es' | 'en' | { titulo: string; cancelar: string },
) {
  const apps = appsDeMapa(Platform.OS, destino);
  const google = apps.find((a) => a.id === 'google');
  if (Platform.OS === 'web') {
    if (google) void Linking.openURL(google.url);
    return;
  }
  const t = typeof textos === 'string' ? (textos === 'en' ? T.en : T.es) : textos;
  Alert.alert(t.titulo, undefined, [
    ...apps.map((a) => ({ text: a.nombre, onPress: () => void Linking.openURL(a.url) })),
    { text: t.cancelar, style: 'cancel' as const },
  ]);
}
