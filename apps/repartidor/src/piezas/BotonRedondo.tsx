import { Image, Pressable, Text, View } from 'react-native';
import { C } from '@tumbite/movil';
import { IMG } from './recursos';

/** Botón redondo con el ícono del diseño y el nombre debajo: mapa, llamar, mensaje. */
export function BotonRedondo({
  glifo,
  nombre,
  alTocar,
}: {
  glifo: 'mapa' | 'llamar' | 'mensaje';
  nombre: string;
  alTocar: () => void;
}) {
  const imagen =
    glifo === 'mapa' ? IMG.iconoMapa : glifo === 'llamar' ? IMG.iconoLlamar : IMG.iconoMensaje;
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={nombre}
      style={{ alignItems: 'center', minWidth: 72 }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: '#F4F5F7',
        }}
      >
        <Image
          source={imagen}
          style={{ width: 48, height: 48 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>
      <Text style={{ fontSize: 12, color: C.secundario, marginTop: 4, fontWeight: '600' }}>
        {nombre}
      </Text>
    </Pressable>
  );
}
