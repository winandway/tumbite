import { Image, Pressable, Text, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { ICONO_SERVICIO, IMG } from './recursos';
import { textosInicio } from './textos';

export type Servicio = keyof typeof IMG.servicios;
const ORDEN: Servicio[] = [
  'comida',
  'mercado',
  'envios',
  'farmacia',
  'moto',
  'licores',
  'promos',
  'mas',
];

/** Cuadrícula de ocho servicios. Solo «Comida» funciona hoy; los demás avisan «Muy pronto». */
export function Servicios({ idioma, alTocar }: { idioma: Idioma; alTocar: (s: Servicio) => void }) {
  const t = textosInicio(idioma);
  const nombres = new Map(Object.entries(t.servicios) as [Servicio, string][]);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 10, marginTop: 18 }}>
      {ORDEN.map((s) => {
        const nombre = nombres.get(s) ?? s;
        return (
          <Pressable
            key={s}
            onPress={() => alTocar(s)}
            accessibilityRole="button"
            accessibilityLabel={nombre}
            style={({ pressed }) => ({
              width: '25%',
              alignItems: 'center',
              paddingVertical: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#191919',
                shadowOpacity: 0.08,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <Image
                source={ICONO_SERVICIO.get(s) ?? IMG.servicios.comida}
                style={{ width: 46, height: 46 }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>
            <Text style={{ marginTop: 6, fontWeight: '700', fontSize: 13, color: C.secundario }}>
              {nombre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
