import { Image, Pressable, Text, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { ICONO_NAV, IMG } from './recursos';
import { textosInicio } from './textos';

export type Pestana = 'inicio' | 'pedidos' | 'favoritos' | 'cuenta';

const nombrePestana = (n: Record<Pestana, string>, p: Pestana) =>
  new Map(Object.entries(n) as [Pestana, string][]).get(p) ?? p;

/** Navegación inferior: Inicio, Pedidos, Favoritos (muy pronto) y Mi cuenta. */
export function BarraInferior({
  idioma,
  activa,
  alTocar,
  puntoCuenta = false,
}: {
  idioma: Idioma;
  activa: Pestana;
  alTocar: (p: Pestana) => void;
  puntoCuenta?: boolean;
}) {
  const t = textosInicio(idioma);
  const pestanas: Pestana[] = ['inicio', 'pedidos', 'favoritos', 'cuenta'];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 10,
        paddingBottom: 8,
        shadowColor: '#101010',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -3 },
        elevation: 8,
      }}
      accessibilityRole="tablist"
    >
      {pestanas.map((p) => {
        const esta = p === activa;
        return (
          <Pressable
            key={p}
            onPress={() => alTocar(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: esta }}
            aria-selected={esta}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
          >
            <View>
              <Image
                source={ICONO_NAV.get(p) ?? IMG.nav.inicio}
                // Un solo color por estado, como las barras de los grandes: la elegida en el color de
                // la marca y las demás en gris (antes «Inicio» quedaba azul aunque no estuviera elegida).
                style={{ width: 30, height: 30, tintColor: esta ? C.primario : '#8A8F98' }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              {p === 'cuenta' && puntoCuenta ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: C.primario,
                  }}
                />
              ) : null}
            </View>
            <Text
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: esta ? '800' : '600',
                // C-ACCESIBILIDAD-WEB: texto chico en el rojo oscuro de la marca (4,5:1).
                color: esta ? C.acento : '#5E5E5E',
              }}
            >
              {nombrePestana(t.nav, p)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
