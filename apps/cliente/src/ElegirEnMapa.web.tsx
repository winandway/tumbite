import { Text } from 'react-native';
import type { Punto } from './ubicacion';

/** En la vista web no hay mapa nativo: la dirección se escribe a mano. */
export function ElegirEnMapa(_: {
  punto: Punto | null;
  cambiarPunto: (p: Punto) => void;
  cambiarDireccion: (direccion: string) => void;
  textos: { ayuda: string; buscando: string; pin: string };
}) {
  return <Text style={{ color: '#5E5E5E', marginBottom: 6 }}>{_.textos.ayuda}</Text>;
}
