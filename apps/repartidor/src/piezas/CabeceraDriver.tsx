import { Image, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Idioma } from '@tumbite/compartido';
import { C, SelectorIdioma } from '@tumbite/movil';
import { IMG } from './recursos';
import { textosDriver } from './textos';

/** Cabecera blanca del diseño: menú, logotipo con «Driver», campana y el selector de idioma. */
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
        borderBottomWidth: 1,
        borderBottomColor: '#EEF0F3',
      }}
    >
      <Pressable
        onPress={alMenu}
        accessibilityRole="button"
        accessibilityLabel={t.menu}
        hitSlop={8}
        style={{ padding: 6 }}
      >
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: 22,
              height: 3,
              borderRadius: 2,
              backgroundColor: C.secundario,
              marginVertical: 2.5,
            }}
          />
        ))}
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Image
          source={IMG.logo}
          style={{ width: 132, height: 36 }}
          resizeMode="contain"
          accessibilityLabel="Divoox"
        />
        <Text style={{ fontWeight: '800', color: C.secundario, fontSize: 13, marginTop: -4 }}>
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
              borderWidth: 1,
              borderColor: '#E3E3E3',
              backgroundColor: '#FFFFFF',
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
        <View style={{ backgroundColor: C.primario, borderRadius: 999 }}>
          <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} />
        </View>
      </View>
    </View>
  );
}
