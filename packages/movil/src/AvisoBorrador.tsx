import { Text } from 'react-native';
import { enIdioma, type Idioma } from '@tumbite/compartido';
import { e } from './ui';
import { TEXTOS_MOVIL } from './textos';

/**
 * La línea discreta que avisa que se recuperó un borrador, siempre con «Empezar de nuevo».
 * Nunca una ventana. Todas las pantallas de las apps la usan (regla de los formularios).
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
    <Text style={e.aviso}>
      {t.recuperado}{' '}
      <Text
        style={{ textDecorationLine: 'underline' }}
        accessibilityRole="button"
        onPress={() => void empezar()}
      >
        {t.empezarDeNuevo}
      </Text>
    </Text>
  );
}
