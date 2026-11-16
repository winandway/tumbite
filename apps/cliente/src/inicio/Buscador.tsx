import { Icono, Text } from '@tumbite/movil';
import { Pressable, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
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
        // Fase cero: buscador de 50, esquina 12, margen de pantalla 20.
        marginHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F6F6F6',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 50,
      }}
    >
      <Icono nombre="search-outline" tamano={22} color="#666B73" />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontSize: 16, color: '#666B73' }} numberOfLines={1}>
          {t.buscarInicio}
        </Text>
      </View>
    </Pressable>
  );
}
