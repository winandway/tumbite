import { Text, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { textosDriver } from './textos';

/** Recoger → Entregar → Completar, con el paso actual en escarlata. */
export function Progreso({ idioma, paso }: { idioma: Idioma; paso: 0 | 1 | 2 }) {
  const t = textosDriver(idioma);
  const nombres = [t.pasos.recoger, t.pasos.entregar, t.pasos.completar];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      {nombres.map((n, i) => (
        <View key={n} style={{ flexDirection: 'row', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: i <= paso ? C.primario : '#D6D6D6',
              }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: i === paso ? '800' : '600',
                color: i <= paso ? C.primario : '#8A8A8A',
                marginTop: 4,
              }}
            >
              {n}
            </Text>
          </View>
          {i < 2 ? (
            <View
              style={{
                flex: 1,
                height: 3,
                backgroundColor: i < paso ? C.primario : '#E6E6E6',
                marginHorizontal: 6,
                marginBottom: 18,
              }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
