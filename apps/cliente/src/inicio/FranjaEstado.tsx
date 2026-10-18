import { Text, View } from 'react-native';

/**
 * Franja discreta de estado (regla de Richard: nunca una ventana ni un pop-up). Con «enProceso»
 * lleva una barrita gris de avance a medias: lo pendiente va en gris, el verde es solo para lo
 * que ya salió bien.
 */
export function FranjaEstado({ texto, enProceso }: { texto: string; enProceso: boolean }) {
  return (
    <View
      accessibilityRole="summary"
      testID="franja-estado"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E3E6EB',
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: '#3A3A3A', fontSize: 14 }}>{texto}</Text>
      {enProceso ? (
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: '#E9ECF1',
            marginTop: 8,
            overflow: 'hidden',
          }}
        >
          <View style={{ width: '45%', height: 4, backgroundColor: '#B9BFC9' }} />
        </View>
      ) : null}
    </View>
  );
}
