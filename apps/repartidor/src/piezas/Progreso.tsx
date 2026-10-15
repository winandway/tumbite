import { Text, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { textosDriver } from './textos';

/** Recoger → Entregar → Completar: tres puntos unidos por una línea; lo hecho va en escarlata. */
export function Progreso({ idioma, paso }: { idioma: Idioma; paso: 0 | 1 | 2 }) {
  const t = textosDriver(idioma);
  const nombres = [t.pasos.recoger, t.pasos.entregar, t.pasos.completar];
  const avance = paso === 0 ? '0%' : paso === 1 ? '50%' : '100%';
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
      <View style={{ position: 'relative' }}>
        <View
          style={{
            position: 'absolute',
            top: 7,
            left: '16.6%',
            right: '16.6%',
            height: 3,
            backgroundColor: '#E6E6E6',
            borderRadius: 2,
          }}
        >
          <View
            style={{ width: avance, height: 3, backgroundColor: C.primario, borderRadius: 2 }}
          />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {nombres.map((n, i) => (
            <View key={n} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: i <= paso ? C.primario : '#D6D6D6',
                  borderWidth: 3,
                  borderColor: '#fff',
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
          ))}
        </View>
      </View>
    </View>
  );
}
