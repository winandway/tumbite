import { Pressable, Text, View } from 'react-native';
import { C } from '@tumbite/movil';

/** Botón redondo con glifo dibujado (sin emojis) y nombre debajo: mapa, llamar, mensaje. */
export function BotonRedondo({
  glifo,
  nombre,
  alTocar,
  oscuro = false,
}: {
  glifo: 'mapa' | 'llamar' | 'mensaje';
  nombre: string;
  alTocar: () => void;
  oscuro?: boolean;
}) {
  const color = oscuro ? '#fff' : C.secundario;
  const dibujo =
    glifo === 'llamar' ? (
      <View
        style={{
          width: 18,
          height: 18,
          borderWidth: 2.5,
          borderColor: color,
          borderRadius: 9,
          borderTopColor: 'transparent',
          borderLeftColor: 'transparent',
          transform: [{ rotate: '-45deg' }],
        }}
      />
    ) : glifo === 'mensaje' ? (
      <View
        style={{ width: 20, height: 15, borderWidth: 2.5, borderColor: color, borderRadius: 6 }}
      />
    ) : (
      <View
        style={{
          width: 14,
          height: 14,
          borderWidth: 2.5,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
          borderRadius: 3,
        }}
      />
    );
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={nombre}
      style={{ alignItems: 'center', minWidth: 64 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: oscuro ? C.secundario : '#F4F5F7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {dibujo}
      </View>
      <Text
        style={{
          fontSize: 12,
          color: oscuro ? '#fff' : C.secundario,
          marginTop: 4,
          fontWeight: '600',
        }}
      >
        {nombre}
      </Text>
    </Pressable>
  );
}
