import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Idioma } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
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
  // C-COLORES-DRIVER (30 oct 2026): íconos vectoriales en los colores de la marca, como las barras de
  // los grandes (lleno el activo, de línea el resto). Las imágenes viejas venían en azul y con un punto
  // rojo pintado que parecía un aviso. Ganancias son tres barras dibujadas.
  const iconos = new Map<Pestana, [string, string]>([
    ['inicio', ['home', 'home-outline']],
    ['pedidos', ['receipt', 'receipt-outline']],
    ['perfil', ['person', 'person-outline']],
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
              <Ionicons
                name={(esta ? icono[0] : icono[1]) as keyof typeof Ionicons.glyphMap}
                size={28}
                color={color}
                testID={`nav-${p}`}
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
