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
}: {
  nombre: string;
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  alCampana: () => void;
  alCupon: () => void;
}) {
  const t = textosInicio(idioma);
  // Los íconos vienen ya con su círculo blanco y su sombra, recortados de la pantalla aprobada.
  const redondo = (imagen: number, etiqueta: string, alTocar: () => void) => (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={6}
      // Máscara redonda: el recorte es cuadrado y trae un pedacito del fondo en las esquinas.
      style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden' }}
    >
      <Image
        source={imagen}
        style={{ width: 46, height: 46 }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
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
          {redondo(IMG.iconoCampana, t.campana, alCampana)}
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
