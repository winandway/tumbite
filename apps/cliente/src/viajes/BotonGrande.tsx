import { ActivityIndicator, Pressable } from 'react-native';
import { C, Text } from '@tumbite/movil';

/**
 * C-INICIO-NUEVO: el botón rojo grande del borrador («Elige tu destino», «Solicitar moto»,
 * «Guardar»). Apagado se ve rojo pálido y no hace nada; con «cargando» muestra la ruedita.
 */
export function BotonGrande({
  texto,
  alTocar,
  apagado = false,
  cargando = false,
  testID,
}: {
  texto: string;
  alTocar: () => void;
  apagado?: boolean;
  cargando?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={() => !apagado && !cargando && alTocar()}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: apagado, busy: cargando }}
      testID={testID}
      style={({ pressed }) => ({
        backgroundColor: apagado ? '#F7A1A8' : pressed ? C.acento : C.primario,
        borderRadius: 16,
        minHeight: 56,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
      })}
    >
      {cargando ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18 }}>{texto}</Text>
      )}
    </Pressable>
  );
}
