import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Easing,
  PanResponder,
  Platform,
  Vibration,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Icono, Text } from './diseno';
import { faseDe, useReducirMovimiento, useRelojBucle } from './movimiento';
import { MOVIMIENTO, cruzaUmbral, debeConfirmar } from './serviciosLogica';
import { COLOR, FUENTE, RADIO } from './tokens';

/**
 * C-SERVICIOS-CONECTADOS (DRIVER.md §3, «Deslizar para desconectar»): la pieza ÚNICA de deslizar
 * del Driver, en dos formas:
 *   - 'tarjeta': la tarjeta de un servicio conectado. Se arrastra el pulgar a la derecha; detrás el
 *     fondo pasa a gris y dice «Suelta para desconectar». Se confirma solo pasando el 85 %.
 *   - 'accion': «Desliza al llegar» y «Desliza al entregar» (60 de alto, rojo de la marca o azul de
 *     logística dentro de Flex), con un brillo que la cruza cada 2,4 s.
 * Si se suelta antes del 85 %, vuelve con un resorte de 300 ms. Vibra corto al cruzar el 85 %. Con
 * lector de pantalla, la acción personalizada hace lo mismo (en la tarjeta, después de confirmar):
 * el gesto nunca es la única vía.
 */
export const ALTO_TARJETA = 68;
const PULGAR_TARJETA = 56;
const ALTO_ACCION = 60;
const PULGAR_ACCION = 52;
const MARGEN = 6;

/** Pregunta sí/no con la ventana del sistema (en la web, la del navegador). */
export function confirmarConSistema(pregunta: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web')
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(pregunta) : false);
  return new Promise((resolver) =>
    Alert.alert('Divoox', pregunta, [
      { text: no, style: 'cancel', onPress: () => resolver(false) },
      { text: si, style: 'destructive', onPress: () => resolver(true) },
    ]),
  );
}

type Comun = {
  /** Lo que hace al confirmar (desconectar, llegar, entregar). */
  alConfirmar: () => unknown;
  /** Nombre de la acción para el lector de pantalla («Desconectar Comida»). */
  accionLector: string;
  habilitado?: boolean;
  testID?: string;
};

export function Deslizador(
  props: Comun &
    (
      | {
          variante: 'tarjeta';
          /** Lo que va dentro del pulgar (el ícono del servicio). */
          pulgar: ReactNode;
          /** El contenido de la tarjeta; `arrastrando` cambia el texto a «Suelta para desconectar». */
          contenido: (arrastrando: boolean) => ReactNode;
          /** Pregunta de confirmación para el lector de pantalla. */
          confirmar: { pregunta: string; si: string; no: string };
          fondo: string;
          borde: string;
          /** Barrido verde abajo y su desfase (índice de la tarjeta). */
          barrido?: { indice: number };
        }
      | {
          variante: 'accion';
          texto: string;
          tono?: 'marca' | 'logistica';
          ocupado?: boolean;
        }
    ),
) {
  const habilitado = props.habilitado !== false;
  // Mientras se cierra la acción (subiendo, completando) no se vuelve a deslizar.
  const activo = habilitado && !(props.variante === 'accion' && props.ocupado);
  const [ancho, setAncho] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [x] = useState(() => new Animated.Value(0));
  const reducir = useReducirMovimiento();
  const reloj = useRelojBucle(!reducir && habilitado);
  const pulgar = props.variante === 'tarjeta' ? PULGAR_TARJETA : PULGAR_ACCION;
  const margen = props.variante === 'tarjeta' ? MARGEN : 4;
  const recorrido = Math.max(0, ancho - pulgar - margen * 2);
  const vivo = useRef(true);
  useEffect(
    () => () => {
      vivo.current = false;
    },
    [],
  );

  const volver = () =>
    Animated.timing(x, {
      toValue: 0,
      duration: MOVIMIENTO.resorte,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: false,
    }).start(() => vivo.current && setArrastrando(false));

  async function confirmar() {
    try {
      await props.alConfirmar();
    } finally {
      if (vivo.current) {
        x.setValue(0);
        setArrastrando(false);
      }
    }
  }

  // Lo que el gesto lee cambia con cada render; el gesto se arma UNA vez y lo lee de aquí
  // (C-FLEX-DESLIZAR-SCROLL: si se rearmaba, el iPhone se quedaba con el ancho 0 del primero).
  const actual = useRef({ habilitado: activo, recorrido, confirmar, ultimo: 0 });
  useEffect(() => {
    actual.current = { ...actual.current, habilitado: activo, recorrido, confirmar };
  });
  // La referencia solo se lee dentro de los manejadores del toque, nunca al dibujar.
  // eslint-disable-next-line react-hooks/refs
  const [gesto] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => actual.current.habilitado,
      onMoveShouldSetPanResponder: (_e, g) => actual.current.habilitado && Math.abs(g.dx) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        actual.current.ultimo = 0;
        setArrastrando(true);
      },
      onPanResponderMove: (_e, g) => {
        const tope = actual.current.recorrido;
        const dx = Math.min(tope, Math.max(0, g.dx));
        if (cruzaUmbral(actual.current.ultimo, dx, tope)) {
          try {
            Vibration.vibrate(12);
          } catch {
            // Sin vibración (algunos navegadores): el gesto sigue igual.
          }
        }
        actual.current.ultimo = dx;
        x.setValue(dx);
      },
      onPanResponderRelease: (_e, g) => {
        const tope = actual.current.recorrido;
        if (debeConfirmar(Math.min(tope, g.dx), tope))
          Animated.timing(x, { toValue: tope, duration: 120, useNativeDriver: false }).start(
            () => void actual.current.confirmar(),
          );
        else volver();
      },
      // Si pierde el gesto, vuelve al inicio (nunca se queda a medio camino).
      onPanResponderTerminate: volver,
    }),
  );

  const medir = (ev: LayoutChangeEvent) => setAncho(ev.nativeEvent.layout.width);

  if (props.variante === 'tarjeta') {
    const relleno = x.interpolate({
      inputRange: [0, Math.max(1, recorrido)],
      outputRange: [0, Math.max(1, recorrido)],
      extrapolate: 'clamp',
    });
    const barridoX = props.barrido
      ? faseDe(
          reloj,
          MOVIMIENTO.barrido,
          // Cada tarjeta va desfasada 0,8 s de la anterior (retraso negativo en la maqueta).
          (props.barrido.indice * MOVIMIENTO.barridoDesfase) % MOVIMIENTO.barrido,
          -0.4 * ancho,
          ancho,
        )
      : null;
    return (
      <View
        testID={props.testID}
        onLayout={medir}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={props.accionLector}
        accessibilityActions={[{ name: 'desconectar', label: props.accionLector }]}
        onAccessibilityAction={(ev) => {
          if (ev.nativeEvent.actionName !== 'desconectar') return;
          void confirmarConSistema(
            props.confirmar.pregunta,
            props.confirmar.si,
            props.confirmar.no,
          ).then((si) => {
            if (si) void confirmar();
          });
        }}
        style={{
          height: ALTO_TARJETA,
          borderRadius: RADIO.l,
          backgroundColor: props.fondo,
          borderWidth: 1.5,
          borderColor: props.borde,
          overflow: 'hidden',
          justifyContent: 'center',
        }}
      >
        {/* Detrás del pulgar, lo recorrido se vuelve gris: se ve que se está apagando. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: Animated.add(relleno, pulgar + margen * 2),
            backgroundColor: arrastrando ? COLOR.superficieFuerte : 'transparent',
          }}
        />
        {/* Al arrastrar, el pulgar deja su sitio y el texto pasa al borde izquierdo (pantalla 04). */}
        <View
          style={{
            position: 'absolute',
            left: arrastrando ? 20 : pulgar + margen * 2 + 8,
            right: 12,
          }}
        >
          {props.contenido(arrastrando)}
        </View>
        {barridoX && !reducir ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: 3,
              width: '40%',
              borderRadius: 2,
              backgroundColor: COLOR.exito,
              opacity: arrastrando ? 0 : 0.55,
              transform: [{ translateX: barridoX }],
            }}
          />
        ) : null}
        <Animated.View
          {...gesto.panHandlers}
          testID={props.testID ? `${props.testID}-pulgar` : undefined}
          style={{
            position: 'absolute',
            left: margen,
            width: pulgar,
            height: pulgar,
            borderRadius: RADIO.m,
            backgroundColor: COLOR.blanco,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateX: x }],
            shadowColor: '#0D7A3A',
            shadowOpacity: 0.25,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
            // En la web el puntero dice que se puede arrastrar.
            ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : {}),
          }}
        >
          {props.pulgar}
        </Animated.View>
      </View>
    );
  }

  // ───────── 'accion': «Desliza al llegar» / «Desliza al entregar» ─────────
  const fondo = !habilitado
    ? COLOR.superficieFuerte
    : props.tono === 'logistica'
      ? COLOR.logistica
      : COLOR.marca;
  const colorTexto = !habilitado ? COLOR.textoSuave : COLOR.blanco;
  const brilloX = faseDe(reloj, MOVIMIENTO.brillo, 0, -120, Math.max(1, ancho));
  return (
    <View
      testID={props.testID}
      onLayout={medir}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={props.texto}
      accessibilityState={{ disabled: !habilitado, busy: Boolean(props.ocupado) }}
      accessibilityActions={[{ name: 'activate', label: props.accionLector }]}
      onAccessibilityAction={(ev) => {
        if (ev.nativeEvent.actionName === 'activate' && activo) void confirmar();
      }}
      style={{
        height: ALTO_ACCION,
        borderRadius: RADIO.m,
        backgroundColor: fondo,
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {habilitado && !reducir && !props.ocupado ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 120,
            backgroundColor: 'rgba(255,255,255,0.16)',
            transform: [{ translateX: brilloX }, { skewX: '-18deg' }],
          }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          position: 'absolute',
          left: pulgar + 16,
          right: 16,
          textAlign: 'center',
          fontFamily: FUENTE.tituloMedio,
          fontSize: 17,
          lineHeight: 22,
          color: colorTexto,
        }}
      >
        {props.texto}
      </Text>
      <Animated.View
        {...gesto.panHandlers}
        testID={props.testID ? `${props.testID}-pulgar` : 'deslizar-bola'}
        style={{
          position: 'absolute',
          left: margen,
          width: pulgar,
          height: pulgar,
          borderRadius: RADIO.m - 2,
          backgroundColor: COLOR.blanco,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: x }],
          ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : {}),
        }}
      >
        <Icono
          nombre="chevron-forward"
          tamano={24}
          color={
            !habilitado
              ? COLOR.iconoApagado
              : props.tono === 'logistica'
                ? COLOR.logistica
                : COLOR.marca
          }
        />
      </Animated.View>
    </View>
  );
}
