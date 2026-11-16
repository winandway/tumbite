import { Image, Pressable, StyleSheet, View } from 'react-native';
import {
  type Idioma,
  type ServicioCatalogo,
  hayMasServicios,
  serviciosTerminados,
} from '@tumbite/compartido';
import { COLOR, LETRA, MARGEN, RADIO, Text } from '@tumbite/movil';
import { DIBUJO_SERVICIO, ICONO_SERVICIO, IMG } from './recursos';
import { textosInicio } from './textos';

export type Servicio = keyof typeof IMG.servicios;

/**
 * Fase cero (16 nov 2026): servicios en mosaicos con su dibujo, como Uber y Grab (un solo rojo; cada
 * servicio se distingue por su dibujo). Antes (POR-1): una fila de chips que se deslizaba.
 * El orden lo fija ORDEN_SERVICIOS y el estado lo dice el servidor (GET /datos/servicios): en la
 * portada solo salen los que están disponibles en la ciudad, más «Más» al final. Lo que viene no
 * se muestra en ninguna parte hasta que esté terminado (C-SOLO-LO-TERMINADO, 3 nov).
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
  // C-SOLO-LO-TERMINADO: solo lo que se puede usar ya; «Más» solo si hay algo más que Comida.
  const todos: ServicioCatalogo[] = catalogo ?? [];
  const listos = serviciosTerminados(todos);
  const visibles = [
    ...(listos.length ? listos : [sinEstado('comida', 0)]),
    ...(hayMasServicios(todos) ? [todos.find((s) => s.id === 'mas') ?? sinEstado('mas', 99)] : []),
  ];
  // Fase cero: Comida y Viajes (Carro) en mosaicos grandes; el resto, chicos de cuatro en fila.
  const grandes = visibles.filter((s) => GRANDES.has(s.id));
  const chicos = visibles.filter((s) => !GRANDES.has(s.id));
  const nombreDe = (s: ServicioCatalogo, grande: boolean) =>
    grande && s.id === 'carro' ? t.viajes : (nombres.get(s.id as Servicio) ?? s.nombre);
  return (
    <View style={m.contenedor} testID="servicios-inicio">
      {grandes.length ? (
        <View style={m.fila}>
          {grandes.map((s) => (
            <Mosaico key={s.id} s={s} nombre={nombreDe(s, true)} grande alTocar={alTocar} />
          ))}
        </View>
      ) : null}
      {chicos.length ? (
        <View style={[m.fila, { flexWrap: 'wrap' }]}>
          {chicos.map((s) => (
            <Mosaico key={s.id} s={s} nombre={nombreDe(s, false)} alTocar={alTocar} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Los dos que van en grande (sección 9 del sistema de diseño). */
const GRANDES = new Set(['comida', 'carro']);

/**
 * Mosaico de servicio: gris #F6F6F6, esquina 16, el nombre arriba a la izquierda y el dibujo del
 * servicio asomando por la esquina de abajo a la derecha (flota de marca para carro y moto).
 */
function Mosaico({
  s,
  nombre,
  grande,
  alTocar,
}: {
  s: ServicioCatalogo;
  nombre: string;
  grande?: boolean;
  alTocar: (s: ServicioCatalogo) => void;
}) {
  const dibujo =
    DIBUJO_SERVICIO.get(s.id) ?? ICONO_SERVICIO.get(s.id as Servicio) ?? IMG.servicios.mas;
  const vehiculo = s.id === 'carro' || s.id === 'moto';
  return (
    <Pressable
      onPress={() => alTocar(s)}
      accessibilityRole="button"
      accessibilityLabel={nombre}
      testID={`servicio-${s.id}`}
      style={({ pressed }) => [
        m.mosaico,
        grande ? m.grande : m.chico,
        pressed && { backgroundColor: COLOR.superficieFuerte },
      ]}
    >
      {/* C-MOSAICO-UNA-LINEA: el nombre en una sola línea, también con la letra grande. */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        maxFontSizeMultiplier={1.3}
        style={grande ? LETRA.titulo : [LETRA.tarjeta, { fontSize: 14 }]}
      >
        {nombre}
      </Text>
      <Image
        source={dibujo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        style={
          grande
            ? vehiculo
              ? m.dibujoVehiculoGrande
              : m.dibujoGrande
            : vehiculo
              ? m.dibujoVehiculoChico
              : m.dibujoChico
        }
      />
    </Pressable>
  );
}

const m = StyleSheet.create({
  contenedor: { paddingHorizontal: MARGEN.pantalla, gap: 10 },
  fila: { flexDirection: 'row', gap: 10 },
  mosaico: {
    backgroundColor: COLOR.superficie,
    borderRadius: RADIO.l,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  grande: { flex: 1, height: 112 },
  chico: { flexGrow: 1, flexBasis: '22%', maxWidth: '25%', height: 96, paddingHorizontal: 10 },
  dibujoGrande: { position: 'absolute', right: 4, bottom: 0, width: 92, height: 80 },
  dibujoVehiculoGrande: { position: 'absolute', right: -28, bottom: 2, width: 150, height: 56 },
  dibujoChico: { position: 'absolute', right: 6, bottom: 4, width: 52, height: 52 },
  dibujoVehiculoChico: { position: 'absolute', right: -12, bottom: 6, width: 80, height: 34 },
});
