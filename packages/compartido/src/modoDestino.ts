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
  } catch {
    return fecha.toISOString().slice(0, 10);
  }
}
