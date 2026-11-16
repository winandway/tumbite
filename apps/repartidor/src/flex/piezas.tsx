import { type ReactNode } from 'react';
import {
  Pressable,
  Text as TextoRN,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { C, Deslizador, e } from '@tumbite/movil';

/**
 * Piezas visuales de «Mi ruta» (Divoox Flex): pastillas de estado, barra de progreso en verde,
 * pestañas, círculos numerados y marcas de listo dibujadas (sin emojis: candado C-SIN-EMOJIS).
 */

/**
 * C-FLEX-OSCURO (31 oct 2026, Richard con las capturas de un bloque real de Amazon Flex): las pantallas
 * de logística van en fondo oscuro, en el azul petróleo de logística, para no cansar la vista durante
 * horas de reparto. Toda la paleta de «Mi ruta» vive aquí.
 */
export const FONDO = '#0F1F2A';
export const TEXTO = '#FFFFFF';
export const GRIS = '#A9B9C6';
export const BORDE = '#2C4759';
export const SUAVE = '#1C3445';
/** Fondo de la parada actual: un tinte del azul de logística, sin franjas gruesas. */
export const RESALTE = '#17405A';
/** Verde de «hecho» que se lee bien sobre el fondo oscuro. */
export const VERDE = '#3CC07A';

/** Texto de «Mi ruta»: blanco por defecto sobre el fondo oscuro. */
export function Texto({ style, ...props }: TextProps) {
  return <TextoRN {...props} style={[{ color: TEXTO }, style]} />;
}
const Text = Texto;

export const tarjeta: StyleProp<ViewStyle> = [
  e.tarjeta,
  {
    borderWidth: 1,
    borderColor: BORDE,
    marginBottom: 0,
    backgroundColor: '#172C3A',
    shadowOpacity: 0,
    elevation: 0,
  },
];

type Tono = 'activo' | 'exito' | 'neutro' | 'problema';
const TONOS: Record<Tono, { fondo: string; texto: string }> = {
  activo: { fondo: C.logistica, texto: '#FFFFFF' },
  exito: { fondo: '#173D2A', texto: VERDE },
  neutro: { fondo: SUAVE, texto: GRIS },
  problema: { fondo: '#3D1A1E', texto: '#FF7A85' },
};

export function tonoRuta(estado: string): Tono {
  if (['en_curso', 'en_carga'].includes(estado)) return 'activo';
  if (estado === 'completada') return 'exito';
  if (['con_incidencias', 'cancelada'].includes(estado)) return 'problema';
  return 'neutro';
}
export function tonoPaquete(estado: string): Tono {
  if (['entregado', 'cargado', 'registrado_centro', 'devuelto'].includes(estado)) return 'exito';
  if (estado === 'entrega_fallida') return 'problema';
  return 'neutro';
}

export function Pastilla({ texto, tono }: { texto: string; tono: Tono }) {
  // eslint-disable-next-line security/detect-object-injection -- tono es uno de los cuatro fijos
  const c = TONOS[tono];
  return (
    <View
      style={{
        backgroundColor: c.fondo,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: c.texto, fontWeight: '700', fontSize: 12 }}>{texto}</Text>
    </View>
  );
}

/** Barra de progreso: siempre en verde (lo que avanza bien va en verde). */
export function Barra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(valor) ? valor : 0));
  return (
    <View
      style={{ height: 8, borderRadius: 4, backgroundColor: BORDE, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
    >
      <View style={{ width: `${v * 100}%`, height: '100%', backgroundColor: VERDE }} />
    </View>
  );
}

/** Pestañas segmentadas: la elegida en rojo. */
export function Pestanas<T extends string>({
  opciones,
  activa,
  alCambiar,
}: {
  opciones: { id: T; texto: string }[];
  activa: T;
  alCambiar: (id: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: SUAVE,
        borderRadius: 12,
        padding: 4,
        gap: 4,
      }}
      accessibilityRole="tablist"
    >
      {opciones.map((o) => {
        const si = o.id === activa;
        return (
          <Pressable
            key={o.id}
            onPress={() => alCambiar(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: si }}
            accessibilityLabel={o.texto}
            style={{
              flex: 1,
              paddingVertical: 9,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: si ? C.logisticaAccion : 'transparent',
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                textAlign: 'center',
                fontWeight: si ? '800' : '600',
                fontSize: opciones.length > 3 ? 12 : 13,
                color: si ? C.logisticaTexto : TEXTO,
              }}
            >
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Marca de listo dibujada: círculo verde con la palomita, o círculo vacío. */
export function Listo({ marcado, tamano = 22 }: { marcado: boolean; tamano?: number }) {
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        borderWidth: marcado ? 0 : 2,
        borderColor: '#5E7587',
        backgroundColor: marcado ? VERDE : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {marcado ? (
        <View
          style={{
            width: tamano * 0.45,
            height: tamano * 0.25,
            borderLeftWidth: 2.5,
            borderBottomWidth: 2.5,
            borderColor: '#FFFFFF',
            transform: [{ rotate: '-45deg' }],
            marginTop: -tamano * 0.08,
          }}
        />
      ) : null}
    </View>
  );
}

export type TonoParada = 'hecho' | 'actual' | 'pendiente' | 'fallida';
/** Círculo con el número de la parada. */
export function Numero({
  n,
  tono,
  tamano = 32,
}: {
  n: number | string;
  tono: TonoParada;
  tamano?: number;
}) {
  const fondo =
    tono === 'hecho'
      ? VERDE
      : tono === 'actual'
        ? C.logisticaAccion
        : tono === 'fallida'
          ? C.acento
          : '#4E6577';
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        backgroundColor: fondo,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: tamano * 0.44 }}>{n}</Text>
    </View>
  );
}

/** Caja dibujada (ícono de paquete) con los colores de la marca. */
export function Caja() {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: SUAVE,
        borderWidth: 1,
        borderColor: BORDE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 18,
          height: 14,
          borderRadius: 2,
          borderWidth: 2,
          borderColor: TEXTO,
          alignItems: 'center',
        }}
      >
        <View style={{ width: 2, height: '100%', backgroundColor: TEXTO }} />
      </View>
    </View>
  );
}

/** Cámara dibujada para el botón de la foto. */
export function Camara({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 8,
          height: 3,
          backgroundColor: color,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
        }}
      />
      <View
        style={{
          width: 24,
          height: 17,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: color }}
        />
      </View>
    </View>
  );
}

/** Fila de un resumen: etiqueta a la izquierda, valor a la derecha. */
export function Fila({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: ReactNode;
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 7,
        gap: 12,
      }}
    >
      <Text style={{ color: GRIS, flex: 1 }}>{etiqueta}</Text>
      <Text style={{ fontWeight: '800', color: color ?? TEXTO }}>{valor}</Text>
    </View>
  );
}

/** Botón de volver (texto con el signo ‹). */
export function Atras({ texto, alTocar }: { texto: string; alTocar: () => void }) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={{ alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 }}
    >
      <Text style={{ color: TEXTO, fontWeight: '700', fontSize: 15 }}>‹ {texto}</Text>
    </Pressable>
  );
}

/** Banner de resultado: verde si salió bien, gris si quedó esperando. */
export function Banner({
  titulo,
  ayuda,
  bien,
}: {
  titulo: string;
  ayuda?: string | null;
  bien: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        backgroundColor: bien ? '#173D2A' : SUAVE,
      }}
      accessibilityRole="summary"
    >
      {bien ? <Listo marcado tamano={30} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: TEXTO }}>{titulo}</Text>
        {ayuda ? <Text style={{ color: GRIS }}>{ayuda}</Text> : null}
      </View>
    </View>
  );
}

/**
 * C-FLEX-DESLIZAR (como «Deslice para finalizar» de Amazon Flex): terminar una entrega exige
 * deslizar, no un toque, para no cerrarla por error. Con lector de pantalla, la acción «activar».
 * Desde C-SERVICIOS-CONECTADOS (16 nov 2026, pantalla 03 de
 * DRIVER.md) es la pieza común `Deslizador` en el azul de logística: 60 de alto, pulgar blanco con
 * la flecha, brillo cada 2,4 s, umbral del 85 % y resorte. El gesto se arma una sola vez dentro de la
 * pieza (C-FLEX-DESLIZAR-SCROLL sigue cumplido).
 */
export function Deslizar({ texto, alTerminar }: { texto: string; alTerminar: () => void }) {
  return (
    <Deslizador
      variante="accion"
      tono="logistica"
      texto={texto}
      accionLector={texto}
      alConfirmar={alTerminar}
    />
  );
}
