import { Pressable } from 'react-native';
import { sugerirCorreo, textoSugerenciaCorreo, type Idioma } from '@tumbite/compartido';
import { Text } from './diseno';
import { C } from './ui';

/**
 * C-CORREO-SUGERENCIA: «¿Quisiste decir …@gmail.com?» debajo de la casilla del correo. Se toca y
 * se corrige; si no, no pasa nada (solo sugiere).
 */
export function SugerenciaCorreo({
  correo,
  idioma,
  aceptar,
}: {
  correo: string;
  idioma: Idioma;
  aceptar: (correo: string) => void;
}) {
  const sugerido = sugerirCorreo(correo);
  if (!sugerido) return null;
  return (
    <Pressable
      accessibilityRole="button"
      testID="sugerencia-correo"
      hitSlop={8}
      onPress={() => aceptar(sugerido)}
      style={{ marginTop: -4, marginBottom: 8 }}
    >
      <Text style={{ color: C.primario, fontWeight: '700' }}>
        {textoSugerenciaCorreo(idioma === 'en' ? 'en' : 'es', sugerido)}
      </Text>
    </Pressable>
  );
}
