import { Image, Pressable, Text, View } from 'react-native';
import { C, SelectorIdioma } from '@tumbite/movil';
import type { Idioma } from '@tumbite/compartido';
import { IMG } from './recursos';
import { textosInicio } from './textos';

/**
 * Cabecera del inicio: logotipo, hamburguesa decorativa, campana, cupón y el selector de idioma
 * de siempre (estilo Amazon). Debajo, el saludo con el nombre real del cliente.
 */
export function Cabecera({
  nombre,
  idioma,
  cambiarIdioma,
  alCampana,
  alCupon,
  avisos = 0,
}: {
  nombre: string;
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  alCampana: () => void;
  alCupon: () => void;
  avisos?: number;
}) {
  const t = textosInicio(idioma);
  const redondo = (imagen: number, etiqueta: string, alTocar: () => void, punto = false) => (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={6}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#191919',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Image
        source={imagen}
        style={{ width: 22, height: 24 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      {punto ? (
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 9,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: C.primario,
          }}
        />
      ) : null}
    </Pressable>
  );
  return (
    <View
      style={{
        backgroundColor: '#F3F6FB',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Image
          source={IMG.logo}
          style={{ width: 150, height: 41 }}
          resizeMode="contain"
          accessibilityLabel="Tumbite"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {redondo(IMG.iconoCampana, t.campana, alCampana, avisos > 0)}
          {redondo(IMG.iconoCupon, t.cupon, alCupon)}
          <View style={{ backgroundColor: C.primario, borderRadius: 999, paddingHorizontal: 2 }}>
            <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} />
          </View>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <Text
          style={{
            fontSize: 30,
            fontWeight: '900',
            color: C.secundario,
            flex: 1,
            paddingBottom: 8,
          }}
          numberOfLines={1}
        >
          {t.hola}, {nombre}!
        </Text>
        <Image
          source={IMG.heroHamburguesa}
          style={{ width: 150, height: 93, marginRight: -8 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}
