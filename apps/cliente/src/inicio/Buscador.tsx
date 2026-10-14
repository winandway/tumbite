import { Image, Pressable, TextInput, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { IMG } from './recursos';
import { textosInicio } from './textos';

/** Barra de búsqueda: filtra los restaurantes reales mientras se escribe; el filtro = solo abiertos. */
export function Buscador({
  idioma,
  valor,
  cambiar,
  soloAbiertos,
  alternarAbiertos,
}: {
  idioma: Idioma;
  valor: string;
  cambiar: (x: string) => void;
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
      <TextInput
        value={valor}
        onChangeText={cambiar}
        placeholder={t.buscar}
        placeholderTextColor="#8A8A8A"
        accessibilityLabel={t.buscar}
        style={{ flex: 1, marginLeft: 10, fontSize: 16, color: C.texto }}
        returnKeyType="search"
      />
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
