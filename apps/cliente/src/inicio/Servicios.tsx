import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
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
  // Como en la pantalla aprobada: cuatro losetas por fila, el ícono 3D grande llenando la loseta
  // y el nombre adentro, todo dentro de un panel claro redondeado.
  const ancho = useWindowDimensions().width;
  const loseta = Math.floor((ancho - 32 - 16 - 3 * 8) / 4);
  const icono = Math.round(loseta * 1.45);
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        shadowColor: '#191919',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      {ORDEN.map((s) => {
        const nombre = nombres.get(s) ?? s;
        return (
          <Pressable
            key={s}
            onPress={() => alTocar(s)}
            accessibilityRole="button"
            accessibilityLabel={nombre}
            style={({ pressed }) => ({
              width: loseta,
              height: Math.round(loseta * 1.05),
              borderRadius: 18,
              backgroundColor: '#F4F7FB',
              alignItems: 'center',
              justifyContent: 'flex-end',
              overflow: 'hidden',
              paddingBottom: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Image
              source={ICONO_SERVICIO.get(s) ?? IMG.servicios.comida}
              // El recorte trae aire alrededor: se agranda y la loseta lo recorta.
              style={{
                position: 'absolute',
                top: -Math.round(icono * 0.22),
                width: icono,
                height: icono,
              }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={{ fontWeight: '700', fontSize: 14, color: C.secundario }}>{nombre}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
