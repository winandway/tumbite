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
  pendientes = 0,
}: {
  nombre: string;
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  alCampana: () => void;
  alCupon: () => void;
  /** Avisos que pasan ahora (pedidos en curso): punto rojo sobre la campana. */
  pendientes?: number;
}) {
  const t = textosInicio(idioma);
  // Los íconos vienen ya con su círculo blanco y su sombra, recortados de la pantalla aprobada.
  const redondo = (imagen: number, etiqueta: string, alTocar: () => void, punto = 0) => (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={6}
      // Máscara redonda: el recorte es cuadrado y trae un pedacito del fondo en las esquinas.
      style={{ width: 46, height: 46 }}
    >
      <Image
        source={imagen}
        style={{ width: 46, height: 46, borderRadius: 23 }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {punto > 0 ? (
        <View
          testID="campana-punto"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            paddingHorizontal: 4,
            backgroundColor: C.primario,
            borderWidth: 2,
            borderColor: '#F3F6FB',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{punto}</Text>
        </View>
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
          {redondo(
            IMG.iconoCampana,
            pendientes ? `${t.campana} (${pendientes})` : t.campana,
            alCampana,
            pendientes,
          )}
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
          style={{ width: 176, height: 109, marginRight: -16, marginBottom: -14 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}
