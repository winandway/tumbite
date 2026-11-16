import { Image, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Idioma } from '@tumbite/compartido';
import { C, SelectorIdioma, Text } from '@tumbite/movil';
import { IMG } from './recursos';
import { textosDriver } from './textos';

/** Cabecera blanca del diseño: menú, logotipo con «Driver», campana y el selector de idioma. */
const redondo = {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#F6F6F6',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export function CabeceraDriver({
  idioma,
  cambiarIdioma,
  alMenu,
  alCampana,
  punto = false,
}: {
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  alMenu: () => void;
  alCampana: () => void;
  punto?: boolean;
}) {
  const t = textosDriver(idioma);
  return (
    <View
      style={{
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#D6D8DC',
      }}
    >
      <Pressable
        onPress={alMenu}
        accessibilityRole="button"
        accessibilityLabel={t.menu}
        hitSlop={8}
        style={{ padding: 0 }}
      >
        <View style={redondo}>
          <Ionicons name="menu" size={24} color={C.secundario} />
        </View>
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Image
          source={IMG.logo}
          style={{ width: 132, height: 36 }}
          resizeMode="contain"
          accessibilityLabel="Divoox"
        />
        <Text
          style={{
            fontWeight: '700',
            color: C.secundario,
            fontSize: 12,
            marginTop: -4,
            letterSpacing: 0.5,
          }}
        >
          {t.driver}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable
          onPress={alCampana}
          accessibilityRole="button"
          accessibilityLabel={t.avisos}
          hitSlop={6}
          style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }}
        >
          {/* C-COLORES-DRIVER: campana vectorial en negro de la marca; el punto rojo solo si hay avisos. */}
          <View
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 20,
              backgroundColor: '#F6F6F6',
            }}
          >
            <Ionicons name="notifications-outline" size={24} color={C.secundario} />
          </View>
          {punto ? (
            <View
              style={{
                position: 'absolute',
                top: 6,
                right: 7,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: C.primario,
              }}
            />
          ) : null}
        </Pressable>
        <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} sobreClaro />
      </View>
    </View>
  );
}
