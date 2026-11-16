import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';
import { PERIODO_MS, tramosBucle } from './serviciosLogica';

/**
 * Bucle continuo (SISTEMA-DE-DISENO.md, sección 8): UN reloj de 4,8 s del que cada pieza toma su
 * fase, así las animaciones nunca se cortan ni se desfasan entre ellas.
 *
 * En la web el «motor nativo» de animación no existe y React Native Web corta el bucle después de
 * la primera vuelta si se le pide; ahí el reloj corre con JavaScript (como C-ESPERA-ADELANTE).
 */
export const MOTOR_NATIVO = Platform.OS !== 'web';

/** «Reducir movimiento» del teléfono (iPhone, Android y navegador): con él, todo queda quieto. */
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

/** Un reloj: va de 0 a 1 una vez cada 4,8 s, lineal y sin fin, mientras `activo`. */
function useRelojPropio(activo: boolean): Animated.Value {
  const [reloj] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!activo) {
      reloj.setValue(0);
      return;
    }
    const bucle = Animated.loop(
      Animated.timing(reloj, {
        toValue: 1,
        duration: PERIODO_MS,
        easing: Easing.linear,
        useNativeDriver: MOTOR_NATIVO,
      }),
    );
    bucle.start();
    return () => bucle.stop();
  }, [activo, reloj]);
  return reloj;
}

/**
 * La fase de una pieza (diente de sierra de `cicloMs`, ya avanzada `retrasoMs`) llevada a
 * `desde`→`hasta`. Lineal dentro de cada vuelta, sin frenada al final (no se nota el corte).
 */
export function faseDe(
  reloj: Animated.Value,
  cicloMs: number,
  retrasoMs: number,
  desde: number,
  hasta: number,
): Animated.AnimatedInterpolation<number> {
  return reloj.interpolate({
    ...tramosBucle(cicloMs, retrasoMs, desde, hasta),
    extrapolate: 'clamp',
  });
}

const RelojComun = createContext<Animated.Value | null>(null);

/**
 * Todas las piezas de dentro (radar, luces, flechas, barridos) cuelgan del MISMO reloj: arrancan
 * juntas y nunca se desfasan. Con «reducir movimiento», el reloj no corre.
 */
export function ConRelojBucle({ children }: { children: ReactNode }) {
  const reducir = useReducirMovimiento();
  const reloj = useRelojPropio(!reducir);
  return <RelojComun.Provider value={reloj}>{children}</RelojComun.Provider>;
}

/** El reloj común si la pieza está dentro de `ConRelojBucle`; si no, uno propio. */
export function useRelojBucle(activo: boolean): Animated.Value {
  const comun = useContext(RelojComun);
  const propio = useRelojPropio(activo && !comun);
  return comun ?? propio;
}
