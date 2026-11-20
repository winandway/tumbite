import { useEffect, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { COLOR, Icono, MOTOR_NATIVO, useReducirMovimiento } from '@tumbite/movil';
import type { ClaseDibujo } from './logica';

/**
 * C-ASISTENTE-DRIVER: las hormas del asistente, calcadas del borrador aprobado
 * (`progreso/borrador-registro`, función `dibujo()`). Cada foto tiene SU figura: el documento por
 * delante (foto y renglones), por detrás (renglones y código de barras), la licencia (con su franja
 * arriba), la póliza del seguro y el óvalo de la cara. La misma figura sale gris antes de tomar la
 * foto, blanca como marco dentro de la cámara y en la tira de pasos.
 */
const GRIS = '#B4B9C0';

type Trazo = { linea: string; relleno: string; punteado: boolean };

function carita(cx: number, cy: number, k: number, linea: string) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={13 * k} fill={linea} opacity={0.55} />
      <Path
        d={`M${cx - 22 * k} ${cy + 40 * k}c0-${16 * k} ${10 * k}-${23 * k} ${22 * k}-${23 * k}s${22 * k} ${7 * k} ${22 * k} ${23 * k}z`}
        fill={linea}
        opacity={0.55}
      />
    </>
  );
}

const raya = (x: number, y: number, w: number, linea: string) => (
  <Rect key={`${x}-${y}`} x={x} y={y} width={w} height={5} rx={2.5} fill={linea} />
);

function Tarjeta({ t }: { t: Trazo }) {
  return (
    <Rect
      x={1.5}
      y={1.5}
      width={157}
      height={97}
      rx={10}
      fill={t.relleno}
      stroke={t.linea}
      strokeWidth={2}
      strokeDasharray={t.punteado ? '6 5' : undefined}
    />
  );
}

/** El dibujo de una horma. `blanco` = dentro de la cámara, sobre la imagen en vivo. */
export function DibujoHorma({ clase, blanco = false }: { clase: ClaseDibujo; blanco?: boolean }) {
  const linea = blanco ? '#FFFFFF' : GRIS;
  const t: Trazo = { linea, relleno: blanco ? 'none' : '#F4F5F7', punteado: true };
  if (clase === 'cara')
    return (
      <Svg viewBox="0 0 120 150" width="100%" height="100%">
        <Ellipse
          cx={60}
          cy={75}
          rx={57}
          ry={72}
          fill={t.relleno}
          stroke={linea}
          strokeWidth={2}
          strokeDasharray="6 5"
        />
        <Circle cx={60} cy={62} r={24} fill={linea} opacity={0.5} />
        <Path d="M22 138c0-27 17-40 38-40s38 13 38 40z" fill={linea} opacity={0.5} />
      </Svg>
    );
  const licencia = clase === 'licF' || clase === 'licR';
  if (clase === 'docF' || clase === 'licF')
    return (
      <Svg viewBox="0 0 160 100" width="100%" height="100%">
        <Tarjeta t={t} />
        {licencia ? (
          <>
            <Rect x={1.5} y={1.5} width={157} height={18} rx={10} fill={linea} opacity={0.45} />
            <Path d="M128 13h18l-3-6h-12z" fill="#FFFFFF" opacity={0.9} />
          </>
        ) : (
          <Rect x={12} y={10} width={46} height={6} rx={3} fill={linea} />
        )}
        <Rect
          x={12}
          y={28}
          width={44}
          height={56}
          rx={5}
          fill="none"
          stroke={linea}
          strokeWidth={2}
        />
        {carita(34, 50, 0.72, linea)}
        {raya(68, 32, 76, linea)}
        {raya(68, 45, 58, linea)}
        {raya(68, 58, 66, linea)}
        {raya(68, 71, 40, linea)}
      </Svg>
    );
  if (clase === 'docR' || clase === 'licR')
    return (
      <Svg viewBox="0 0 160 100" width="100%" height="100%">
        <Tarjeta t={t} />
        {raya(14, 14, 90, linea)}
        {raya(14, 26, 120, linea)}
        {raya(14, 38, 70, linea)}
        {licencia ? (
          <Rect
            x={112}
            y={34}
            width={34}
            height={18}
            rx={3}
            fill="none"
            stroke={linea}
            strokeWidth={2}
          />
        ) : null}
        {Array.from({ length: 30 }, (_, i) => (
          <Rect key={i} x={14 + i * 4.4} y={62} width={i % 3 ? 1.6 : 3} height={24} fill={linea} />
        ))}
      </Svg>
    );
  // La póliza del seguro: el escudo con su visto y los renglones con las fechas.
  return (
    <Svg viewBox="0 0 160 100" width="100%" height="100%">
      <Tarjeta t={t} />
      <Path d="M40 26l18 6v16c0 12-8 20-18 24-10-4-18-12-18-24V32z" fill={linea} opacity={0.55} />
      <Path
        d="M32 46l6 6 11-12"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {raya(74, 28, 68, linea)}
      {raya(74, 42, 52, linea)}
      {raya(74, 56, 62, linea)}
      {raya(74, 70, 36, linea)}
    </Svg>
  );
}

/** La marca verde de «lista», con un saltito al aparecer. */
export function MarcaLista({ lado = 18, animada = false }: { lado?: number; animada?: boolean }) {
  const reducir = useReducirMovimiento();
  const [escala] = useState(() => new Animated.Value(animada && !reducir ? 0 : 1));
  useEffect(() => {
    if (!animada || reducir) return;
    Animated.spring(escala, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: MOTOR_NATIVO,
    }).start();
  }, [animada, reducir, escala]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        right: -lado * 0.22,
        bottom: -lado * 0.22,
        width: lado,
        height: lado,
        borderRadius: lado,
        backgroundColor: COLOR.exito,
        borderWidth: Math.max(2, lado * 0.1),
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: escala }],
      }}
    >
      <Icono nombre="checkmark" tamano={lado * 0.58} color="#FFFFFF" />
    </Animated.View>
  );
}

/**
 * Una miniatura: la foto de verdad si ya se tomó (en círculo la cara, en tarjeta lo demás) o el
 * dibujo de la horma si falta. Es la pieza que se repite en la tira de pasos, en «Revisa tus
 * papeles», en «Tus papeles» y en la tarjeta de perfil.
 */
export function Mini({
  clase,
  uri,
  alto,
  lista = false,
  conMarca = lista,
  animada = false,
}: {
  clase: ClaseDibujo;
  uri?: string | null;
  alto: number;
  lista?: boolean;
  conMarca?: boolean;
  animada?: boolean;
}) {
  const redonda = clase === 'cara';
  const ancho = redonda ? alto : Math.round(alto * 1.586);
  const radio = redonda ? alto : Math.max(6, alto * 0.14);
  return (
    <View style={{ width: ancho, height: alto }}>
      <View
        style={{
          width: ancho,
          height: alto,
          borderRadius: radio,
          overflow: 'hidden',
          backgroundColor: '#F1F2F4',
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: ancho, height: alto }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : redonda ? (
          <Silueta lado={alto} />
        ) : (
          <DibujoHorma clase={clase} />
        )}
      </View>
      {conMarca ? <MarcaLista lado={Math.max(14, alto * 0.3)} animada={animada} /> : null}
    </View>
  );
}

/** La silueta que ocupa el círculo de la cara antes de tomar la foto. */
export function Silueta({ lado }: { lado: number }) {
  return (
    <Svg viewBox="0 0 120 120" width={lado} height={lado}>
      <Rect width={120} height={120} fill="#EEF0F3" />
      <Circle cx={60} cy={50} r={22} fill={GRIS} opacity={0.7} />
      <Path d="M18 124c0-28 19-42 42-42s42 14 42 42z" fill={GRIS} opacity={0.7} />
    </Svg>
  );
}

/**
 * La tarjeta de perfil que se va armando: su cara en círculo dentro de un anillo verde que avanza
 * («3 de 6 listos»), con una animación corta cada vez que completa un paso.
 */
export function AnilloPerfil({
  uri,
  hechas,
  total,
  lado = 78,
}: {
  uri?: string | null;
  hechas: number;
  total: number;
  lado?: number;
}) {
  const reducir = useReducirMovimiento();
  const pct = total > 0 ? Math.min(1, hechas / total) : 0;
  const r = 34;
  const largo = 2 * Math.PI * r;
  // El anillo avanza con un Animated.Value que se escucha y se pinta en un círculo normal: un
  // círculo de SVG animado directo deja atributos de React Native en la web («collapsable»).
  const [avance] = useState(() => new Animated.Value(pct));
  const [hecho, setHecho] = useState(pct);
  useEffect(() => {
    const id = avance.addListener(({ value }) => setHecho(value));
    return () => avance.removeListener(id);
  }, [avance]);
  useEffect(() => {
    if (reducir) {
      avance.setValue(pct);
      return;
    }
    Animated.timing(avance, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, reducir, avance]);
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        viewBox="0 0 78 78"
        width={lado}
        height={lado}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle cx={39} cy={39} r={r} stroke="#E6E7EA" strokeWidth={5} fill="none" />
        <Circle
          cx={39}
          cy={39}
          r={r}
          stroke={COLOR.exito}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${largo}`}
          strokeDashoffset={largo * (1 - hecho)}
        />
      </Svg>
      <Mini clase="cara" uri={uri} alto={lado - 18} lista={Boolean(uri)} conMarca={false} />
    </View>
  );
}
