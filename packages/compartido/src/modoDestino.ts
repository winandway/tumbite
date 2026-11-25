import { distanciaKm } from './catalogo';

/**
 * C-MODO-DESTINO (BRE-6, 2 nov 2026), como «Driver Destinations» de Uber (REA de su ayuda pública,
 * ficha docs/investigaciones-rea/2026-11-02-promociones-y-destino.md): el repartidor pone una
 * dirección (su casa) y, hasta dos veces al día, solo recibe ofertas cuya entrega lo acerque a
 * ella. Se apaga solo al llegar o a mano. El contador vuelve a cero a medianoche, hora de su
 * ciudad. Todos los países.
 */
export const USOS_DESTINO_DIA = 2;
/** A esta distancia del destino se considera que llegó y el modo se apaga solo. */
export const LLEGADA_DESTINO_KM = 0.5;
/** Cuánto tiene que acercarlo la entrega para que la oferta le llegue. */
export const ACERCA_MINIMO_KM = 0.5;

type Punto = { lat: number; lng: number };

/** ¿La entrega lo deja más cerca de su destino que donde está ahora? */
export function acercaAlDestino(actual: Punto, entrega: Punto, destino: Punto): boolean {
  return distanciaKm(entrega, destino) <= distanciaKm(actual, destino) - ACERCA_MINIMO_KM;
}

export function llegoAlDestino(actual: Punto, destino: Punto): boolean {
  return distanciaKm(actual, destino) <= LLEGADA_DESTINO_KM;
}

/** La fecha «AAAA-MM-DD» en la zona horaria de su ciudad (para el contador diario). */
export function diaLocal(fecha: Date, zonaHoraria: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(fecha);
  } catch (e) {
    // BRE-R2: una zona horaria mal escrita no tumba el contador, pero queda anotada.
    console.error('modo destino: zona horaria no válida, se usa la fecha UTC', zonaHoraria, e);
    return fecha.toISOString().slice(0, 10);
  }
}

/**
 * C-REGRESO-PASAJERO (25 nov 2026; todos los países). «Voy de regreso a mi ciudad»: tras un viaje
 * largo, el conductor vuelve a su ciudad base con pasajero y no vacío. Ficha:
 * docs/investigaciones-rea/2026-11-25-regreso-con-pasajero.md. Como «Driver Destinations» de Uber
 * (dos usos al día, el uso empieza con el viaje) [DOC] y el filtro de rumbo de Lyft y DiDi [DOC].
 * Los números son nuestros [INF] y salen de los ajustes por país; estos son los de siempre.
 */
export const REGRESO = {
  /** Usos al día (como Uber). Se cuentan al ACEPTAR el primer viaje, no al encender. */
  usosDia: 2,
  /** Horas que dura encendido: después se apaga solo. */
  horasMaximo: 6,
  /** A esta distancia del centro de su ciudad base se considera que llegó. */
  llegadaKm: LLEGADA_DESTINO_KM,
} as const;

/** Lo que cada país puede ajustar desde el panel (con estos valores si no tocó nada). */
export type AjustesRegreso = {
  /** El botón aparece a más de esta distancia del centro de su ciudad base. */
  kmMinimo: number;
  /** El viaje tiene que ir hacia su casa: ángulo máximo entre los dos rumbos. */
  anguloMaximo: number;
  /** Cuánto lo tiene que acercar el viaje a su ciudad base, como mínimo. */
  acercaMinimoKm: number;
  /** Prioridad: pasa adelante si su recogida está a no más de la del más cercano + esto. */
  extraRecogidaKm: number;
};
export const AJUSTES_REGRESO_INICIALES: AjustesRegreso = {
  kmMinimo: 25,
  anguloMaximo: 45,
  acercaMinimoKm: 5,
  extraRecogidaKm: 3,
};
/** Los límites que acepta el panel (nada que deje el filtro sin sentido). */
export const LIMITES_AJUSTES_REGRESO = {
  kmMinimo: [5, 300],
  anguloMaximo: [10, 90],
  acercaMinimoKm: [1, 100],
  extraRecogidaKm: [0, 10],
} as const satisfies Record<keyof AjustesRegreso, readonly [number, number]>;

/** El rumbo en grados (0 = norte, 90 = este) de `a` hacia `b`, en el plano local de `ref`. */
function rumbo(a: Punto, b: Punto, ref: Punto): number | null {
  const x = (b.lng - a.lng) * Math.cos((ref.lat * Math.PI) / 180);
  const y = b.lat - a.lat;
  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12) return null;
  return (Math.atan2(x, y) * 180) / Math.PI;
}

/** Diferencia entre dos rumbos, de 0 a 180 grados. */
export function diferenciaRumbo(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * ¿Este viaje lo lleva de regreso a casa? Las tres cosas a la vez (la cercanía de la recogida, los
 * 15 km de siempre, la mira quien reparte):
 * 1. el viaje (recogida → destino) va en el rumbo de su casa (conductor → casa) con un ángulo de
 *    `anguloMaximo` o menos;
 * 2. el destino del viaje lo deja al menos `acercaMinimoKm` más cerca de su casa que donde está.
 */
export function rumboHaciaCasa(
  actual: Punto,
  recogida: Punto,
  destinoViaje: Punto,
  casa: Punto,
  ajustes: Pick<AjustesRegreso, 'anguloMaximo' | 'acercaMinimoKm'> = AJUSTES_REGRESO_INICIALES,
): boolean {
  const viaje = rumbo(recogida, destinoViaje, actual);
  const haciaCasa = rumbo(actual, casa, actual);
  if (viaje == null || haciaCasa == null) return false;
  // Una milésima de grado de holgura: «justo en 45°» cuenta como dentro.
  if (diferenciaRumbo(viaje, haciaCasa) > ajustes.anguloMaximo + 1e-3) return false;
  return distanciaKm(destinoViaje, casa) <= distanciaKm(actual, casa) - ajustes.acercaMinimoKm;
}

/**
 * Prioridad del regreso: de los conductores que ya pasaron todos los filtros (en su orden de siempre:
 * primero quien no vio la oferta, luego el más cercano), el que va de regreso con el rumbo bueno pasa
 * adelante, pero solo si su recogida está a no más de la del primero + `extraRecogidaKm` y está en el
 * mismo grupo (no salta a quien todavía no la vio). Sin ninguno así, manda el orden de siempre.
 */
export function elegirConRegreso<T extends { km: number; visto?: boolean }>(
  aptos: T[],
  vaDeRegreso: (c: T) => boolean,
  extraRecogidaKm: (c: T) => number,
): T | undefined {
  const primero = aptos[0];
  if (!primero) return undefined;
  const regreso = aptos.find(
    (c) =>
      vaDeRegreso(c) &&
      Boolean(c.visto) === Boolean(primero.visto) &&
      c.km <= primero.km + extraRecogidaKm(c),
  );
  return regreso ?? primero;
}
