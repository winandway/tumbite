import { Image, Pressable, Text, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { IMG } from './recursos';
import { textosInicio } from './textos';

/**
 * Barra de búsqueda del inicio (como en los grandes): al tocarla se abre la pantalla de búsqueda
 * real (restaurantes y platos del servidor). Los filtros rápidos van debajo, en su propia fila
 * (POR-1, 2 nov 2026), y los dos quedan pegados arriba al bajar.
 */
export function Buscador({ idioma, alTocar }: { idioma: Idioma; alTocar: () => void }) {
  const t = textosInicio(idioma);
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="search"
      accessibilityLabel={t.buscarInicio}
      testID="abrir-busqueda"
      style={{
        marginHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F3F5',
        borderRadius: 999,
        paddingHorizontal: 14,
        height: 46,
      }}
    >
      <Image
        source={IMG.iconoLupa}
        style={{ width: 18, height: 20 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontSize: 15, color: '#666B73' }} numberOfLines={1}>
          {t.buscarInicio}
        </Text>
      </View>
    </Pressable>
  );
}
