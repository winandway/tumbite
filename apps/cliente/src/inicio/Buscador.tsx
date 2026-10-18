import { Image, Pressable, Text, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { IMG } from './recursos';
import { textosInicio } from './textos';

/**
 * Barra de búsqueda del inicio (como en los grandes): al tocarla se abre la pantalla de búsqueda
 * real (restaurantes y platos del servidor). El botón de la derecha alterna «solo abiertos».
 */
export function Buscador({
  idioma,
  alTocar,
  soloAbiertos,
  alternarAbiertos,
}: {
  idioma: Idioma;
  alTocar: () => void;
  soloAbiertos: boolean;
  alternarAbiertos: () => void;
}) {
  const t = textosInicio(idioma);
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: -6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 999,
        paddingHorizontal: 14,
        height: 50,
        shadowColor: '#191919',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <Image
        source={IMG.iconoLupa}
        style={{ width: 20, height: 22 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Pressable
        onPress={alTocar}
        accessibilityRole="search"
        accessibilityLabel={t.buscar}
        testID="abrir-busqueda"
        style={{ flex: 1, marginLeft: 10, height: 50, justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 16, color: '#8A8A8A' }} numberOfLines={1}>
          {t.buscar}
        </Text>
      </Pressable>
      <Pressable
        onPress={alternarAbiertos}
        accessibilityRole="switch"
        accessibilityState={{ checked: soloAbiertos }}
        accessibilityLabel={t.soloAbiertos}
        hitSlop={8}
        style={{
          padding: 6,
          borderRadius: 10,
          backgroundColor: soloAbiertos ? '#FFE9E4' : 'transparent',
        }}
      >
        <Image
          source={IMG.iconoFiltros}
          style={{ width: 20, height: 20 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    </View>
  );
}
