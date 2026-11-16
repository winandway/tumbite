import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop, Circle, Line } from 'react-native-svg';
import { COLOR } from '@tumbite/movil';
import { IMG_COMIDA } from '../comida/recursos';
import {
  CARRO,
  EDIFICIOS,
  GIRO_RUEDA_GRADOS,
  RUEDA,
  VUELTA_RUEDA_MS,
  capas,
  debeAnimar,
  ventanas,
} from './escenaBuscando';

/**
 * C-ESPERA-ADELANTE (fase cero, aprobada por Richard el 16 nov 2026) — todos los países. La escena
 * de «Buscando tu conductor»: el carrito de marca en dibujo de líneas va HACIA ADELANTE (mira a la
 * derecha, ruedas en el sentido del reloj) mientras la ciudad, los postes y la carretera pasan hacia
 * atrás. Con «reducir movimiento» del teléfono, todo queda quieto. Los números viven en
 * ./escenaBuscando (con su prueba).
 */
const ALTO = 280;
const TINTA = '#101010';
const ESCALA = CARRO.ancho / CARRO.lienzo;
const ALTO_CARRO = CARRO.alto * ESCALA;

/**
 * En la web el «motor nativo» de animación no existe y React Native Web corta el bucle después de
 * la primera vuelta si se le pide; ahí se anima con JavaScript (C-ESPERA-ADELANTE).
 */
const NATIVO = Platform.OS !== 'web';

function bucle(valor: Animated.Value, ms: number, curva = Easing.linear) {
  return Animated.loop(
    Animated.timing(valor, { toValue: 1, duration: ms, easing: curva, useNativeDriver: NATIVO }),
  );
}

/** «Reducir movimiento» del teléfono (iPhone, Android y navegador). */
function useReducirMovimiento(): boolean {
  const [reducir, setReducir] = useState(false);
  useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => vivo && setReducir(r))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducir);
    return () => {
      vivo = false;
      sub?.remove();
    };
  }, []);
  return reducir;
}

function Rueda({ cx, giro }: { cx: number; giro: Animated.Value }) {
  const lado = RUEDA.radio * 2 * ESCALA + 4;
  const rotate = giro.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${GIRO_RUEDA_GRADOS}deg`],
  });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cx * ESCALA - lado / 2,
        top: RUEDA.centroY * ESCALA - lado / 2,
        width: lado,
        height: lado,
        transform: [{ rotate }],
      }}
    >
      <Svg width={lado} height={lado} viewBox="-20 -20 40 40">
        <Circle r={18} fill={TINTA} />
        <Circle r={12.5} fill="#FFFFFF" />
        <Circle r={14.6} fill="none" stroke={COLOR.marca} strokeWidth={1.8} />
        {[0, 72, 144, 216, 288].map((a, i) => (
          // Un rayo rojo rompe la simetría para que el ojo vea hacia dónde gira.
          <Line
            key={a}
            x1={0}
            y1={0}
            x2={0}
            y2={-10.5}
            stroke={i === 0 ? COLOR.marca : TINTA}
            strokeWidth={i === 0 ? 3.6 : 3}
            strokeLinecap="round"
            transform={`rotate(${a})`}
          />
        ))}
        <Circle r={3.4} fill={COLOR.marca} />
      </Svg>
    </Animated.View>
  );
}

/** El carrito de marca: mira a la DERECHA (capó largo y faro adelante, piloto rojo atrás). */
function Carrito({ giro, rebote }: { giro: Animated.Value; rebote: Animated.Value }) {
  const y = rebote.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -2, 0] });
  return (
    <View style={{ width: CARRO.ancho, height: ALTO_CARRO }} testID="buscando-carrito">
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        <Svg width={CARRO.ancho} height={ALTO_CARRO} viewBox={`0 0 ${CARRO.lienzo} ${CARRO.alto}`}>
          <Defs>
            <LinearGradient id="haz" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFD45C" stopOpacity={0.9} />
              <Stop offset="1" stopColor="#FFE9A8" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d="M210 61 L262 52 L262 80 L210 69 Z" fill="url(#haz)" />
          <Path
            d="M22 86 Q14 86 14 78 L14 62 Q14 54 22 53 L48 51 Q56 34 70 29 Q78 26 92 26 L118 26 Q130 26 140 33 L164 50 L196 53 Q212 55 212 67 L212 79 Q212 86 205 86 Z"
            fill="#FFFFFF"
            stroke={TINTA}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          <Path d="M56 51 Q62 37 72 33.5 L99 33 L99 51 Z" fill={TINTA} />
          <Path d="M105 33 L120 33 Q128 33 135 38.5 L151 51 L105 51 Z" fill={TINTA} />
          <Path d="M102 54 L102 82" stroke={TINTA} strokeWidth={1.5} />
          <Path d="M146 46 L154 46 L156 51 L148 51 Z" fill={TINTA} />
          {/* Faro adelante (derecha) y piloto rojo atrás (izquierda). */}
          <Rect
            x={199}
            y={59}
            width={13}
            height={8}
            rx={3}
            fill="#FFE9A8"
            stroke={TINTA}
            strokeWidth={2}
          />
          <Rect x={14} y={58} width={8} height={9} rx={2.5} fill={COLOR.marca} />
        </Svg>
        <Image
          source={IMG_COMIDA.mascota}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: 114 * ESCALA,
            top: 57 * ESCALA,
            width: 21 * ESCALA,
            height: 20 * ESCALA,
          }}
        />
      </Animated.View>
      <Rueda cx={RUEDA.trasera} giro={giro} />
      <Rueda cx={RUEDA.delantera} giro={giro} />
    </View>
  );
}

function Ciudad() {
  return (
    <Svg width={780} height={116} viewBox="0 0 780 116">
      {EDIFICIOS.map(([x, h, w]) => (
        <G key={x}>
          <Rect
            x={x}
            y={116 - h}
            width={w}
            height={h}
            rx={3}
            fill="#FFFFFF"
            stroke={TINTA}
            strokeWidth={2.5}
          />
          {ventanas(x, h, w).map((v) => (
            <Rect
              key={`${v.x}-${v.y}`}
              x={v.x}
              y={v.y}
              width={5}
              height={7}
              rx={1}
              fill={v.roja ? COLOR.marca : '#FFFFFF'}
              stroke={TINTA}
              strokeWidth={1.5}
            />
          ))}
        </G>
      ))}
    </Svg>
  );
}

function Poste() {
  return (
    <Svg width={300} height={110} viewBox="0 0 300 110">
      <Path
        d="M40 110 V22 Q40 12 50 12 H62"
        stroke={TINTA}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={58} y={10} width={14} height={6} rx={3} fill="#FFE9A8" stroke={TINTA} />
      <Path d="M34 110 H46" stroke={TINTA} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export function BuscandoConductor({ ancho }: { ancho: number }) {
  const reducir = useReducirMovimiento();
  const animar = debeAnimar(reducir);
  const plan = useMemo(() => capas(ancho), [ancho]);
  // Los valores animados nacen una sola vez (estado perezoso, no se leen refs al dibujar).
  const [v] = useState(() => ({
    giro: new Animated.Value(0),
    rebote: new Animated.Value(0),
    carretera: new Animated.Value(0),
    postes: new Animated.Value(0),
    ciudad: new Animated.Value(0),
    nubes: new Animated.Value(0.35),
    lineas: new Animated.Value(0),
  }));

  useEffect(() => {
    if (!animar) return;
    const todas = [
      bucle(v.giro, VUELTA_RUEDA_MS),
      bucle(v.rebote, 500, Easing.inOut(Easing.ease)),
      bucle(v.carretera, plan.carretera.ms),
      bucle(v.postes, plan.postes.ms),
      bucle(v.ciudad, plan.ciudad.ms),
      bucle(v.nubes, plan.nubes.ms),
      bucle(v.lineas, 600),
    ];
    todas.forEach((a) => a.start());
    return () => todas.forEach((a) => a.stop());
  }, [animar, plan, v]);

  const mover = (valor: Animated.Value, c: { desde: number; hasta: number }) =>
    valor.interpolate({ inputRange: [0, 1], outputRange: [c.desde, c.hasta] });
  const lineaX = v.lineas.interpolate({ inputRange: [0, 1], outputRange: [16, -30] });
  const lineaO = v.lineas.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
  const centro = ancho / 2;

  return (
    <View
      style={[s.escena, { width: ancho }]}
      testID={animar ? 'buscando-escena' : 'buscando-escena-quieta'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={ancho} height={ALTO} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF1F2" />
            <Stop offset="0.92" stopColor="#FFFFFF" />
          </LinearGradient>
        </Defs>
        <Rect width={ancho} height={ALTO} fill="url(#cielo)" />
      </Svg>
      <View style={[s.sol, { right: 40 }]} />
      {[
        { top: 40, w: 70, desfase: 0 },
        { top: 86, w: 46, desfase: 0.5 },
      ].map((n) => (
        <Animated.View
          key={n.top}
          style={[
            s.nube,
            {
              top: n.top,
              width: n.w,
              transform: [
                {
                  translateX: Animated.modulo(Animated.add(v.nubes, n.desfase), 1).interpolate({
                    inputRange: [0, 1],
                    outputRange: [plan.nubes.desde, plan.nubes.hasta],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      <Animated.View
        style={[s.capa, { bottom: 74, transform: [{ translateX: mover(v.ciudad, plan.ciudad) }] }]}
      >
        <Ciudad />
        <Ciudad />
      </Animated.View>
      <View style={s.suelo} />
      <Animated.View
        style={[s.capa, { bottom: 70, transform: [{ translateX: mover(v.postes, plan.postes) }] }]}
      >
        {Array.from({ length: Math.ceil(ancho / 300) + 2 }, (_, i) => (
          <Poste key={i} />
        ))}
      </Animated.View>
      <Animated.View
        style={[
          s.capa,
          { bottom: 34, transform: [{ translateX: mover(v.carretera, plan.carretera) }] },
        ]}
      >
        <Svg width={ancho + 88} height={4}>
          {Array.from({ length: Math.ceil((ancho + 88) / 44) }, (_, i) => (
            <Rect key={i} x={i * 44} y={0} width={22} height={4} fill={TINTA} />
          ))}
        </Svg>
      </Animated.View>
      {/* Líneas de velocidad DETRÁS del carro (a su izquierda), yéndose hacia atrás. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: centro - CARRO.ancho / 2 - 44,
          bottom: 84,
          opacity: lineaO,
          transform: [{ translateX: lineaX }],
          gap: 10,
        }}
      >
        <View style={[s.linea, { width: 34 }]} />
        <View style={[s.linea, { width: 24, marginLeft: 12 }]} />
      </Animated.View>
      <View style={{ position: 'absolute', left: centro - CARRO.ancho / 2, bottom: 40 }}>
        <Carrito giro={v.giro} rebote={v.rebote} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  escena: { height: ALTO, overflow: 'hidden', borderRadius: 16, alignSelf: 'center' },
  sol: {
    position: 'absolute',
    top: 34,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLOR.marca,
    opacity: 0.14,
  },
  nube: {
    position: 'absolute',
    left: 0,
    height: 16,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: TINTA,
  },
  capa: { position: 'absolute', left: 0, flexDirection: 'row' },
  suelo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 3,
    borderTopColor: TINTA,
  },
  linea: {
    height: 3.5,
    borderRadius: 2,
    backgroundColor: TINTA,
  },
});
