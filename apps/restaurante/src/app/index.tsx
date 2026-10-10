import { ActivityIndicator, View } from 'react-native';
import { Acceso, C, useSesion } from '@tumbite/movil';
import { Inicio } from '../Inicio';

export default function Entrada() {
  const { cargando, usuario } = useSesion();
  if (cargando) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: C.secundario,
        }}
      >
        <ActivityIndicator color={C.acento} size="large" />
      </View>
    );
  }
  return usuario ? <Inicio /> : <Acceso />;
}
