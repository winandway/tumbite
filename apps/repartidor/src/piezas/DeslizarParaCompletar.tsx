import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { enIdioma } from '@tumbite/compartido';
import { C, Text } from '@tumbite/movil';

/**
 * C-DESLIZAR-ENTREGA (15 nov 2026, primera prueba real de Richard en Novi): el cierre de la
 * entrega es un deslizador, como «Swipe to complete delivery» de Uber Driver y el cierre de
 * DoorDash Dasher después de la foto. Un deslizamiento a propósito evita cerrar sin querer con un
 * toque en el bolsillo. Se habilita con la foto de la puerta ya tomada; el servidor confirma además
 * que el GPS esté en la dirección. Con lector de pantalla basta con activarlo (doble toque).
 */
const T = {
  es: {
    deslizar: 'Desliza para completar',
    primeroFoto: 'Primero toma la foto',
    completando: 'Completando…',
  },
  en: {
    deslizar: 'Slide to complete delivery',
    primeroFoto: 'Take the photo first',
    completando: 'Completing…',
  },
};

const PERILLA = 56;
const ALTO = 64;

export function DeslizarParaCompletar({
  idioma,
  listo,
  ocupado = false,
  alCompletar,
  testID = 'deslizar-completar',
}: {
  idioma: 'es' | 'en';
  /** La foto ya está tomada (y el pedido sigue en la puerta). */
  listo: boolean;
  /** Mientras sube la foto o se cierra el pedido. */
  ocupado?: boolean;
  alCompletar: () => Promise<unknown>;
  testID?: string;
}) {
  const t = enIdioma(T, idioma);
  const [ancho, setAncho] = useState(0);
  const [cerrando, setCerrando] = useState(false);
  // El valor animado y el gesto viven todo el tiempo del componente (se crean una sola vez).
  const [x] = useState(() => new Animated.Value(0));
  const vivo = useRef(true);
  useEffect(
    () => () => {
      vivo.current = false;
    },
    [],
  );
  const habilitado = listo && !ocupado && !cerrando;
  const max = Math.max(0, ancho - PERILLA - 8);

  async function completar() {
    setCerrando(true);
    try {
      await alCompletar();
    } finally {
      if (vivo.current) {
        setCerrando(false);
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      }
    }
  }
  // Los valores que lee el gesto cambian con cada render; el gesto los lee de esta referencia.
  const actual = useRef({ habilitado, max, completar });
  useEffect(() => {
    actual.current = { habilitado, max, completar };
  });

  // Igual que «Deslizar» de Mi ruta (C-FLEX-DESLIZAR-SCROLL): el gesto se arma UNA vez y la
  // referencia solo se lee dentro de los manejadores del toque, nunca al dibujar.
  // eslint-disable-next-line react-hooks/refs
  const [gesto] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => actual.current.habilitado,
      onMoveShouldSetPanResponder: (_e, g) => actual.current.habilitado && Math.abs(g.dx) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => x.setValue(Math.min(actual.current.max, Math.max(0, g.dx))),
      onPanResponderRelease: (_e, g) => {
        const { max: tope } = actual.current;
        if (tope > 0 && g.dx >= tope * 0.85) {
          Animated.timing(x, { toValue: tope, duration: 120, useNativeDriver: false }).start();
          void actual.current.completar();
        } else Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
    }),
  );

  const texto = cerrando ? t.completando : listo ? t.deslizar : t.primeroFoto;
  const fondo = habilitado || cerrando ? C.exito : '#E3E5E8';
  const relleno = x.interpolate({
    inputRange: [0, Math.max(1, max)],
    outputRange: [PERILLA + 8, Math.max(PERILLA + 8, ancho)],
    extrapolate: 'clamp',
  });

  return (
    <View
      testID={testID}
      onLayout={(ev: LayoutChangeEvent) => setAncho(ev.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: !habilitado, busy: cerrando }}
      accessibilityActions={[{ name: 'activate', label: t.deslizar }]}
      onAccessibilityAction={(ev) => {
        if (ev.nativeEvent.actionName === 'activate' && habilitado) void completar();
      }}
      style={{
        height: ALTO,
        borderRadius: ALTO / 2,
        backgroundColor: fondo,
        justifyContent: 'center',
        overflow: 'hidden',
        marginTop: 8,
      }}
    >
      {/* Lo recorrido se oscurece un poco: se ve cuánto falta. */}
      {habilitado || cerrando ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: relleno,
            backgroundColor: 'rgba(0,0,0,0.12)',
          }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          position: 'absolute',
          left: PERILLA + 16,
          right: 16,
          textAlign: 'center',
          fontWeight: '800',
          fontSize: 16,
          color: habilitado || cerrando ? '#FFFFFF' : '#666B73',
        }}
      >
        {texto}
      </Text>
      <Animated.View
        {...gesto.panHandlers}
        style={{
          position: 'absolute',
          left: 4,
          width: PERILLA,
          height: PERILLA,
          borderRadius: PERILLA / 2,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: x }],
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        {cerrando ? (
          <ActivityIndicator color={C.exito} />
        ) : (
          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: habilitado ? C.exito : '#A3A7AE',
              marginTop: -2,
            }}
          >
            ›
          </Text>
        )}
      </Animated.View>
    </View>
  );
}
