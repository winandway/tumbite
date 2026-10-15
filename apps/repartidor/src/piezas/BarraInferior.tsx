import { Image, Pressable, Text, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { IMG } from './recursos';
import { textosDriver } from './textos';

export type Pestana = 'inicio' | 'pedidos' | 'ganancias' | 'perfil';

/** Barra inferior del diseño: Inicio, Pedidos, Ganancias y Perfil. */
export function BarraInferior({
  idioma,
  activa,
  alTocar,
}: {
  idioma: Idioma;
  activa: Pestana;
  alTocar: (p: Pestana) => void;
}) {
  const t = textosDriver(idioma);
  const nombres = new Map(Object.entries(t.nav) as [Pestana, string][]);
  const iconos = new Map<Pestana, number | null>([
    ['inicio', IMG.navInicio],
    ['pedidos', IMG.navPedidos],
    ['ganancias', IMG.navGanancias],
    ['perfil', IMG.navCuenta],
  ]);
  const pestanas: Pestana[] = ['inicio', 'pedidos', 'ganancias', 'perfil'];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#EEF0F3',
        paddingTop: 8,
        paddingBottom: 6,
      }}
      accessibilityRole="tablist"
    >
      {pestanas.map((p) => {
        const esta = p === activa;
        const color = esta ? C.primario : '#5E5E5E';
        const icono = iconos.get(p);
        return (
          <Pressable
            key={p}
            onPress={() => alTocar(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: esta }}
            accessibilityLabel={nombres.get(p) ?? p}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
          >
            {icono ? (
              <Image
                source={icono}
                style={{ width: 30, height: 30, opacity: esta ? 1 : 0.65 }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            ) : (
              // Ganancias: tres barras dibujadas, como el ícono del diseño.
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  gap: 3,
                  height: 30,
                  paddingBottom: 4,
                }}
              >
                {[12, 20, 16].map((h, i) => (
                  <View
                    key={i}
                    style={{ width: 6, height: h, borderRadius: 2, backgroundColor: color }}
                  />
                ))}
              </View>
            )}
            <Text style={{ marginTop: 3, fontSize: 12, fontWeight: esta ? '800' : '600', color }}>
              {nombres.get(p) ?? p}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
