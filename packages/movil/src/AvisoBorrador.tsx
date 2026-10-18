import { Pressable, Text, View } from 'react-native';
import { enIdioma, type Idioma } from '@tumbite/compartido';
import { e } from './ui';
import { TEXTOS_MOVIL } from './textos';

/**
 * La línea discreta que avisa que se recuperó un borrador, siempre con «Empezar de nuevo».
 * Nunca una ventana. Todas las pantallas de las apps la usan (regla de los formularios).
 * «Empezar de nuevo» es un Pressable de verdad: un Text anidado con onPress no respondía al toque
 * en el iPhone (visto en el simulador el 17 y 18 oct 2026).
 */
export function AvisoBorrador({
  visible,
  idioma,
  empezar,
}: {
  visible: boolean;
  idioma: Idioma;
  empezar: () => void | Promise<void>;
}) {
  if (!visible) return null;
  const t = enIdioma(TEXTOS_MOVIL, idioma);
  return (
    <View
      style={[e.aviso, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }]}
      accessibilityRole="summary"
    >
      <Text>{t.recuperado}</Text>
      <Pressable
        onPress={() => void empezar()}
        accessibilityRole="button"
        accessibilityLabel={t.empezarDeNuevo}
        hitSlop={8}
        testID="empezar-de-nuevo"
      >
        <Text style={{ textDecorationLine: 'underline', fontWeight: '700' }}>
          {t.empezarDeNuevo}
        </Text>
      </Pressable>
    </View>
  );
}
