import { type ReactNode, memo, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { COLOR } from '@tumbite/movil';
import { IMG_COMIDA } from '../comida/recursos';
import {
  CAPAS,
  CORRIMIENTO,
  EDIFICIOS,
  ESCALA,
  ESCENA,
  GIRO_RUEDA_GRADOS,
  LIENZO_CON_HAZ,
  NUBES,
  PERIODO_MS,
  RETRASOS,
  TIEMPOS,
  datosVehiculo,
  type VehiculoEspera,
  copias,
  debeAnimar,
  faseDeRetraso,
  ventanas,
  vueltasEnPeriodo,
} from './escenaBuscando';

/**
 * C-ESPERA-ADELANTE, C-ESPERA-BUCLE, C-ESPERA-CARRIL y C-ESPERA-VEHICULO (fase cero, aprobada por
 * Richard el 16 nov 2026) — todos los países. La escena de la espera: el vehículo del servicio pedido
 * (carro, moto con pasajero, envío en moto o en carro) va HACIA ADELANTE por su carril derecho
 * mientras la ciudad, los postes y la carretera pasan hacia atrás. Un solo reloj de 4,8 s mueve todo:
 * cada pieza toma su fase de él, así el bucle nunca se siente cortado. Con «reducir movimiento» del
 * teléfono, todo queda quieto. Los números viven en ./escenaBuscando (con su prueba).
 */
const TINTA = '#101010';
const BLANCO = '#FFFFFF';
const ROJO = COLOR.marca;
const FARO = '#FFE9A8';

/**
 * En la web el «motor nativo» de animación no existe y React Native Web corta el bucle después de
 * la primera vuelta si se le pide; ahí se anima con JavaScript (C-ESPERA-ADELANTE).
 */
const NATIVO = Platform.OS !== 'web';

/** «Reducir movimiento» del teléfono (iPhone, Android y navegador), al día si lo cambian. */
export function useReducirMovimiento(): boolean {
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

type Reloj = Animated.Value;

/** La fase (0 a 1) de una pieza de ciclo `ms`, tomada del reloj común, adelantada `adelanto`. */
function fase(reloj: Reloj, ms: number, adelanto = 0): Animated.AnimatedInterpolation<number> {
  const vueltas = Animated.multiply(reloj, vueltasEnPeriodo(ms));
  return Animated.modulo(adelanto ? Animated.add(vueltas, adelanto) : vueltas, 1).interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
}

/** Muestras de una curva para interpolar (la animación nativa solo sabe de tramos rectos). */
function muestras(
  f: (p: number) => number,
  n = 12,
): { inputRange: number[]; outputRange: number[] } {
  const inputRange = Array.from({ length: n + 1 }, (_, i) => i / n);
  return { inputRange, outputRange: inputRange.map(f) };
}
/** Ida y vuelta suave (0 → 1 → 0) en un ciclo. */
const idaVuelta = (p: number) => (1 - Math.cos(2 * Math.PI * p)) / 2;
/** Sale rápido y frena (como el humo). */
const frena = (p: number) => 1 - (1 - p) * (1 - p);

/* ---------------------------------------------------------------- vehículos */

function Rueda({
  cx,
  cy,
  radio,
  y0,
  reloj,
}: {
  cx: number;
  cy: number;
  radio: number;
  y0: number;
  reloj: Reloj;
}) {
  const lado = (radio + 2) * 2 * ESCALA;
  const rotate = fase(reloj, TIEMPOS.ruedaVuelta).interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${GIRO_RUEDA_GRADOS}deg`],
  });
  const aro = radio === 19 ? 14.8 : 14.6;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cx * ESCALA - lado / 2,
        top: (cy - y0) * ESCALA - lado / 2,
        width: lado,
        height: lado,
        transform: [{ rotate }],
      }}
    >
      <Svg
        width={lado}
        height={lado}
        viewBox={`${-radio - 2} ${-radio - 2} ${(radio + 2) * 2} ${(radio + 2) * 2}`}
      >
        <Circle r={radio} fill={TINTA} />
        <Circle r={12.5} fill={BLANCO} />
        <Circle r={aro} fill="none" stroke={ROJO} strokeWidth={1.8} />
        {[0, 72, 144, 216, 288].map((a, i) => (
          // Un rayo rojo rompe la simetría para que el ojo vea hacia dónde gira.
          <Line
            key={a}
            x1={0}
            y1={0}
            x2={0}
            y2={-10.5}
            stroke={i === 0 ? ROJO : TINTA}
            strokeWidth={i === 0 ? 3.6 : 3}
            strokeLinecap="round"
            transform={`rotate(${a})`}
          />
        ))}
        <Circle r={3.4} fill={ROJO} />
      </Svg>
    </Animated.View>
  );
}

/** Un casco blanco con visera tinta y raya roja (kit.js, función `casco`). */
function Casco({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={BLANCO} stroke={TINTA} strokeWidth={3.5} />
      <Path
        d={`M${cx + 1} ${cy - r * 0.45} Q${cx + r * 1.02} ${cy - r * 0.5} ${cx + r * 0.98} ${cy + r * 0.2} L${cx + 1} ${cy + r * 0.25} Z`}
        fill={TINTA}
      />
      <Path
        d={`M${cx - r * 0.75} ${cy - r * 0.55} Q${cx} ${cy - r * 1.05} ${cx + r * 0.6} ${cy - r * 0.75}`}
        fill="none"
        stroke={ROJO}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </G>
  );
}

const TRAZO = {
  stroke: TINTA,
  strokeWidth: 3.5,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

/** La carrocería del carrito (mira a la DERECHA: capó largo adelante, maletero corto atrás). */
function CuerpoCarro({ conCarga }: { conCarga: boolean }) {
  return (
    <G>
      <Path
        d="M22 86 Q14 86 14 78 L14 62 Q14 54 22 53 L48 51 Q56 34 70 29 Q78 26 92 26 L118 26 Q130 26 140 33 L164 50 L196 53 Q212 55 212 67 L212 79 Q212 86 205 86 Z"
        fill={BLANCO}
        stroke={TINTA}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <Path d="M56 51 Q62 37 72 33.5 L99 33 L99 51 Z" fill={TINTA} />
      <Path d="M105 33 L120 33 Q128 33 135 38.5 L151 51 L105 51 Z" fill={TINTA} />
      <Path d="M102 54 L102 82" stroke={TINTA} strokeWidth={1.5} />
      <Path d="M146 46 L154 46 L156 51 L148 51 Z" fill={TINTA} />
      <Rect
        x={199}
        y={59}
        width={13}
        height={8}
        rx={3}
        fill={FARO}
        stroke={TINTA}
        strokeWidth={2}
      />
      <Rect x={14} y={58} width={8} height={9} rx={2.5} fill={ROJO} />
      {conCarga ? (
        // Las amarras de la caja del techo (la caja da su saltito aparte).
        <Path
          d="M66 26 L66 20 M124 26 L124 20 M58 20 L132 20"
          stroke={TINTA}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ) : null}
    </G>
  );
}

/** La scooter de la flota en línea (kit.js, función `moto`), con lo que lleva atrás. */
function CuerpoMoto({ envio }: { envio: boolean }) {
  return (
    <G>
      {envio ? (
        <G>
          <Path d="M10 86 L62 86" stroke={TINTA} strokeWidth={3} strokeLinecap="round" />
          <Rect x={10} y={42} width={54} height={42} rx={6} fill={BLANCO} {...TRAZO} />
          <Path d="M10 42 L18 26" stroke={TINTA} strokeWidth={3.5} strokeLinecap="round" />
        </G>
      ) : (
        <Path d="M14 84 L46 84" stroke={TINTA} strokeWidth={3} strokeLinecap="round" />
      )}
      <Path d="M16 112 Q12 94 30 90 L112 86 Q122 86 122 96 L122 112 Z" fill={BLANCO} {...TRAZO} />
      <Rect x={40} y={78} width={70} height={11} rx={5.5} fill={TINTA} />
      <Rect x={12} y={96} width={9} height={9} rx={2.5} fill={ROJO} />
      <Path d="M118 104 L160 104 L160 114 L118 114 Z" fill={BLANCO} {...TRAZO} />
      <Path
        d="M150 112 L166 62 Q168 55 175 57 L181 59 Q186 61 184 68 L170 112 Z"
        fill={BLANCO}
        {...TRAZO}
      />
      <Rect
        x={180}
        y={68}
        width={10}
        height={8}
        rx={3}
        fill={FARO}
        stroke={TINTA}
        strokeWidth={2}
      />
      <Path
        d="M156 112 Q176 92 198 108"
        fill="none"
        stroke={TINTA}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Path d="M174 58 L170 40" stroke={TINTA} strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M160 40 L176 40" stroke={TINTA} strokeWidth={5} strokeLinecap="round" />
      <Path
        d="M172 40 L178 28 L184 28"
        fill="none"
        stroke={TINTA}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M86 82 L94 46 Q97 36 108 36 L116 38 Q124 42 121 52 L112 84 Z"
        fill={BLANCO}
        {...TRAZO}
      />
      <Path
        d="M110 48 L140 56 L162 42"
        fill="none"
        stroke={TINTA}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M96 82 L130 86 L138 104 L150 104"
        fill="none"
        stroke={TINTA}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Casco cx={110} cy={22} r={15} />
    </G>
  );
}

/** Lo que va cargado (paquete o casco extra): da un saltito sobre el rebote de la carrocería. */
function Carga({ vehiculo }: { vehiculo: VehiculoEspera }) {
  if (vehiculo === 'moto-pasajero') return <Casco cx={30} cy={70} r={13} />;
  if (vehiculo === 'moto-envio')
    return (
      <G>
        <Rect x={22} y={30} width={26} height={18} rx={2.5} fill={BLANCO} {...TRAZO} />
        <Path d="M35 30 L35 48" stroke={ROJO} strokeWidth={4} />
      </G>
    );
  if (vehiculo === 'carro-envio')
    return (
      <G>
        <Rect
          x={72}
          y={-4}
          width={46}
          height={24}
          rx={3}
          fill={BLANCO}
          stroke={TINTA}
          strokeWidth={3}
        />
        <Path d="M95 -4 L95 20" stroke={ROJO} strokeWidth={4} />
        <Path d="M80 4 L88 4" stroke={TINTA} strokeWidth={2} strokeLinecap="round" />
      </G>
    );
  return null;
}

/** Dónde va el isotipo de Divoox en cada vehículo: [x, y, ancho, alto] en el lienzo. */
const ISOTIPO: Record<VehiculoEspera, readonly [number, number, number, number]> = {
  carro: [114, 57, 21, 20],
  'carro-envio': [114, 57, 21, 20],
  'moto-pasajero': [60, 94, 18, 17],
  'moto-envio': [26, 52, 22, 21],
};

function Vehiculo({ vehiculo, reloj }: { vehiculo: VehiculoEspera; reloj: Reloj }) {
  const d = datosVehiculo(vehiculo);
  const ancho = LIENZO_CON_HAZ * ESCALA;
  const alto = d.alto * ESCALA;
  const caja = `0 ${d.y0} ${LIENZO_CON_HAZ} ${d.alto}`;
  const esMoto = vehiculo.startsWith('moto');
  const capa = { position: 'absolute' as const, left: 0, top: 0 };

  const rebote = fase(reloj, TIEMPOS.rebote).interpolate(muestras((p) => -2 * idaVuelta(p)));
  const saltito = fase(reloj, TIEMPOS.saltito).interpolate(muestras((p) => -1.5 * idaVuelta(p)));
  const brillo = fase(reloj, TIEMPOS.haz).interpolate(muestras((p) => 0.75 + 0.25 * idaVuelta(p)));
  const [ix, iy, iw, ih] = new Map(Object.entries(ISOTIPO)).get(vehiculo) ?? ISOTIPO.carro;
  // El haz sale del faro hacia adelante; la sombra va debajo, sin rebotar.
  const faroY = esMoto ? 72 : 61;
  const haz = esMoto
    ? `M190 ${faroY} L272 58 L272 98 L190 80 Z`
    : `M210 ${faroY} L292 46 L292 86 L210 69 Z`;

  return (
    <View style={{ width: ancho, height: alto }} testID={`buscando-vehiculo-${vehiculo}`}>
      <Svg width={ancho} height={alto} viewBox={caja} style={capa}>
        <Ellipse
          cx={esMoto ? 114 : 112}
          cy={esMoto ? 143 : 104}
          rx={92}
          ry={5}
          fill="#000"
          opacity={0.22}
        />
      </Svg>
      <Animated.View
        style={[capa, { width: ancho, height: alto, transform: [{ translateY: rebote }] }]}
      >
        <Animated.View style={[capa, { opacity: brillo }]}>
          <Svg width={ancho} height={alto} viewBox={caja}>
            <Defs>
              <LinearGradient id={`haz-${vehiculo}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFD45C" stopOpacity={0.9} />
                <Stop offset="1" stopColor={FARO} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={haz} fill={`url(#haz-${vehiculo})`} />
          </Svg>
        </Animated.View>
        <Animated.View style={[capa, { transform: [{ translateY: saltito }] }]}>
          <Svg width={ancho} height={alto} viewBox={caja}>
            <Carga vehiculo={vehiculo} />
          </Svg>
        </Animated.View>
        <Svg width={ancho} height={alto} viewBox={caja} style={capa}>
          {esMoto ? (
            <CuerpoMoto envio={vehiculo === 'moto-envio'} />
          ) : (
            <CuerpoCarro conCarga={vehiculo === 'carro-envio'} />
          )}
        </Svg>
        <Image
          source={IMG_COMIDA.mascota}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: ix * ESCALA,
            top: (iy - d.y0) * ESCALA,
            width: iw * ESCALA,
            height: ih * ESCALA,
          }}
        />
      </Animated.View>
      <Rueda
        cx={d.rueda.trasera}
        cy={d.rueda.centroY}
        radio={d.rueda.radio}
        y0={d.y0}
        reloj={reloj}
      />
      <Rueda
        cx={d.rueda.delantera}
        cy={d.rueda.centroY}
        radio={d.rueda.radio}
        y0={d.y0}
        reloj={reloj}
      />
    </View>
  );
}

/* ---------------------------------------------------------------- fondo */

function Ciudad() {
  return (
    <Svg width={CAPAS.ciudad.mosaico} height={116} viewBox="0 0 390 116">
      {EDIFICIOS.map(([x, h, w]) => (
        <G key={x}>
          <Rect
            x={x}
            y={116 - h}
            width={w}
            height={h}
            rx={3}
            fill={BLANCO}
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
              fill={v.roja ? ROJO : BLANCO}
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
    <Svg width={CAPAS.postes.mosaico} height={110} viewBox="0 0 352 110">
      <Path
        d="M40 110 V22 Q40 12 50 12 H62"
        stroke={TINTA}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <Rect
        x={58}
        y={10}
        width={14}
        height={6}
        rx={3}
        fill={FARO}
        stroke={TINTA}
        strokeWidth={2.5}
      />
      <Path d="M34 110 H46" stroke={TINTA} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function MosaicoNubes() {
  return (
    <View style={{ width: CAPAS.nubes.mosaico, height: 90 }}>
      {NUBES.map(([izq, arriba, ancho]) => (
        <View key={izq} style={[s.nube, { left: izq, top: arriba, width: ancho }]} />
      ))}
    </View>
  );
}

/** Una capa de fondo: N mosaicos pegados que se trasladan de 0 a −mosaico, lineal. */
function CapaQueCorre({
  reloj,
  capa,
  ancho,
  estilo,
  children,
}: {
  reloj: Reloj;
  capa: { mosaico: number; ms: number };
  ancho: number;
  estilo: object;
  children: () => ReactNode;
}) {
  const x = fase(reloj, capa.ms).interpolate({
    inputRange: [0, 1],
    outputRange: [0, -capa.mosaico],
  });
  return (
    <Animated.View style={[s.capa, estilo, { transform: [{ translateX: x }] }]}>
      {Array.from({ length: copias(ancho, capa.mosaico) }, (_, i) => (
        <View key={i}>{children()}</View>
      ))}
    </Animated.View>
  );
}

function EscenaBuscando({
  ancho,
  vehiculo = 'carro',
}: {
  ancho: number;
  vehiculo?: VehiculoEspera;
}) {
  const reducir = useReducirMovimiento();
  const animar = debeAnimar(reducir);
  // Un solo reloj de 4,8 s para toda la escena (nace una vez; no se leen refs al dibujar).
  const [reloj] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!animar) return;
    reloj.setValue(0);
    const bucle = Animated.loop(
      Animated.timing(reloj, {
        toValue: 1,
        duration: PERIODO_MS,
        easing: Easing.linear,
        useNativeDriver: NATIVO,
      }),
    );
    bucle.start();
    return () => {
      bucle.stop();
      // Si se activa «reducir movimiento» a mitad de la vuelta, la escena queda en su cuadro inicial.
      reloj.setValue(0);
    };
  }, [animar, reloj]);

  const centro = ancho / 2;
  const d = datosVehiculo(vehiculo);
  // El dibujo empieza 112 a la izquierda del centro: el vehículo queda corrido 26 (CORRIMIENTO).
  const izquierdaVehiculo = centro - (CORRIMIENTO + (ESCALA * 224) / 2);

  return (
    <View
      style={[s.escena, { width: ancho }]}
      testID={animar ? 'buscando-escena' : 'buscando-escena-quieta'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={ancho} height={ESCENA.alto} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`cielo-${vehiculo}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF1F2" />
            <Stop offset="0.92" stopColor={BLANCO} />
          </LinearGradient>
        </Defs>
        <Rect width={ancho} height={ESCENA.alto} fill={`url(#cielo-${vehiculo})`} />
      </Svg>
      <View style={s.sol} />
      <CapaQueCorre reloj={reloj} capa={CAPAS.nubes} ancho={ancho} estilo={{ top: 74 }}>
        {() => <MosaicoNubes />}
      </CapaQueCorre>
      <CapaQueCorre
        reloj={reloj}
        capa={CAPAS.ciudad}
        ancho={ancho}
        estilo={{ bottom: ESCENA.ciudad }}
      >
        {() => <Ciudad />}
      </CapaQueCorre>
      {/* Carril derecho: suelo con la orilla de enfrente a 100, acera de 0 a 14, raya del centro a 64. */}
      <View style={s.suelo} testID="buscando-orilla" />
      <View style={s.acera} />
      <CapaQueCorre
        reloj={reloj}
        capa={CAPAS.carretera}
        ancho={ancho}
        estilo={{ bottom: ESCENA.raya }}
      >
        {() => (
          <View style={{ width: 44, height: 4 }}>
            <View style={{ width: 22, height: 4, backgroundColor: TINTA }} />
          </View>
        )}
      </CapaQueCorre>
      <CapaQueCorre
        reloj={reloj}
        capa={CAPAS.postes}
        ancho={ancho}
        estilo={{ bottom: ESCENA.postes }}
      >
        {() => <Poste />}
      </CapaQueCorre>
      {/* Líneas de velocidad DETRÁS del vehículo, con borde blanco, yéndose hacia atrás. */}
      <View style={{ position: 'absolute', left: centro - 158, bottom: ESCENA.lineas }}>
        {[
          { w: 34, ml: 0 },
          { w: 24, ml: 12 },
          { w: 30, ml: 4 },
        ].map((l, i) => {
          const p = fase(
            reloj,
            TIEMPOS.lineas,
            faseDeRetraso(RETRASOS.lineas.at(i) ?? 0, TIEMPOS.lineas),
          );
          return (
            <Animated.View
              key={l.w}
              style={[
                s.lineaBorde,
                {
                  width: l.w + 5,
                  marginLeft: l.ml,
                  opacity: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [16, -30] }) },
                  ],
                },
              ]}
            >
              <View style={s.linea} />
            </Animated.View>
          );
        })}
      </View>
      {/* Humo: tres bolitas salen por detrás, crecen y se quedan atrás. */}
      <View
        style={{
          position: 'absolute',
          left: centro - 104,
          bottom: ESCENA.humo,
          width: 12,
          height: 12,
        }}
      >
        {RETRASOS.humo.map((r) => {
          const p = fase(reloj, TIEMPOS.humo, faseDeRetraso(r, TIEMPOS.humo));
          return (
            <Animated.View
              key={r}
              style={[
                s.humo,
                {
                  opacity: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { translateX: p.interpolate(muestras((q) => -58 * frena(q))) },
                    { translateY: p.interpolate(muestras((q) => -10 * frena(q))) },
                    { scale: p.interpolate(muestras((q) => 0.5 + 0.9 * frena(q))) },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
      <View style={{ position: 'absolute', left: izquierdaVehiculo, bottom: d.abajo }}>
        <Vehiculo vehiculo={vehiculo} reloj={reloj} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  escena: { height: ESCENA.alto, overflow: 'hidden', borderRadius: 16, alignSelf: 'center' },
  sol: {
    position: 'absolute',
    right: 54,
    top: 74,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLOR.marca,
    opacity: 0.14,
  },
  nube: {
    position: 'absolute',
    height: 16,
    borderRadius: 9,
    backgroundColor: BLANCO,
    borderWidth: 2,
    borderColor: TINTA,
  },
  capa: { position: 'absolute', left: 0, flexDirection: 'row' },
  suelo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ESCENA.orilla,
    backgroundColor: BLANCO,
    borderTopWidth: 3,
    borderTopColor: TINTA,
  },
  acera: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ESCENA.acera,
    backgroundColor: COLOR.superficie,
    borderTopWidth: 3,
    borderTopColor: TINTA,
  },
  lineaBorde: {
    height: 8.5,
    borderRadius: 4,
    backgroundColor: BLANCO,
    padding: 2.5,
    marginBottom: 5,
  },
  linea: { flex: 1, borderRadius: 2, backgroundColor: TINTA },
  humo: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: TINTA,
    backgroundColor: BLANCO,
  },
});

/** Sin volver a dibujar cuando la pantalla se refresca (el viaje se consulta cada pocos segundos). */
export const BuscandoConductor = memo(EscenaBuscando);
