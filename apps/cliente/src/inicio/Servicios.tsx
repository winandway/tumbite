import { Image, Pressable, ScrollView, Text } from 'react-native';
import { type Idioma, ORDEN_SERVICIOS, type ServicioCatalogo } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { ICONO_SERVICIO, IMG } from './recursos';
import { textosInicio } from './textos';

export type Servicio = keyof typeof IMG.servicios;

/**
 * POR-1 (2 nov 2026): servicios en una fila de chips que se desliza a lo ancho, como Uber Eats.
 * El orden lo fija ORDEN_SERVICIOS y el estado lo dice el servidor (GET /datos/servicios): en la
 * portada solo salen los que están disponibles en la ciudad, más «Más» al final. Los que vienen
 * NO llevan «Pronto» aquí: viven dentro de «Más», con su franja de estado (C-EXPLORAR).
 * Comida sale siempre (es la puerta de entrada; si no está, abre su pantalla con la franja).
 */
export function Servicios({
  idioma,
  catalogo,
  alTocar,
}: {
  idioma: Idioma;
  catalogo: ServicioCatalogo[] | null;
  alTocar: (s: ServicioCatalogo) => void;
}) {
  const t = textosInicio(idioma);
  const nombres = new Map(Object.entries(t.servicios) as [Servicio, string][]);
  const sinEstado = (id: string, i: number): ServicioCatalogo => ({
    id,
    nombre: nombres.get(id as Servicio) ?? id,
    descripcion: '',
    icono: `servicio-${id}`,
    orden: i,
    estado: 'proximamente',
    accion: 'muy_pronto',
  });
  const todos: ServicioCatalogo[] = catalogo ?? ORDEN_SERVICIOS.map(sinEstado);
  const visibles = [
    todos.find((s) => s.id === 'comida') ?? sinEstado('comida', 0),
    ...todos.filter((s) => s.id !== 'comida' && s.id !== 'mas' && s.accion === 'abrir'),
    todos.find((s) => s.id === 'mas') ?? sinEstado('mas', ORDEN_SERVICIOS.length),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 10 }}
      testID="servicios-inicio"
    >
      {visibles.map((s) => {
        // El nombre de la app manda si lo conoce (es/en ya resueltos); si no, el del servidor.
        const nombre = nombres.get(s.id as Servicio) ?? s.nombre;
        return (
          <Pressable
            key={s.id}
            onPress={() => alTocar(s)}
            accessibilityRole="button"
            accessibilityLabel={nombre}
            testID={`servicio-${s.id}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 6,
              paddingRight: 14,
              height: 44,
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E3E5E8',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Image
              source={ICONO_SERVICIO.get(s.id as Servicio) ?? IMG.servicios.mas}
              style={{ width: 32, height: 32, borderRadius: 16 }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            {/* C-MOSAICO-UNA-LINEA: el nombre en una sola línea, también con la letra grande. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={1.3}
              style={{ fontWeight: '700', fontSize: 14, color: C.secundario }}
            >
              {nombre}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
