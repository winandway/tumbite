/**
 * Cuándo se le ofrece un pedido a un repartidor (la regla de «los 7 minutos» de Uber Eats, pero
 * con la distancia real): se ofrece cuando el tiempo que le toma llegar al restaurante, más un
 * margen, ya alcanza lo que falta para que la comida esté lista. Así llega cuando la bolsa está
 * en el mostrador, no 25 minutos antes a esperar sin cobrar. Si el restaurante ya tocó «Listo»,
 * se ofrece al instante.
 */
export const MARGEN_DESPACHO_MIN = 3;
/** Velocidad de ciudad con la que se estima el viaje (la misma del tiempo estimado al cliente). */
export const KM_POR_HORA_CIUDAD = 25;
/** Un viaje nunca se estima en menos de esto (salir, montarse, estacionar). */
export const VIAJE_MINIMO_MIN = 2;

export function minutosDeViaje(km: number): number {
  return Math.max(VIAJE_MINIMO_MIN, Math.round((km / KM_POR_HORA_CIUDAD) * 60));
}

/** Minutos que faltan para que el pedido esté listo (0 si ya está listo o ya pasó la hora). */
export function minutosParaListo(
  estado: string,
  aceptadoEn: string | null,
  tiempoPrepMin: number | null,
  ahora = Date.now(),
): number {
  if (estado !== 'aceptado' || !aceptadoEn) return 0;
  const aceptado = Date.parse(`${aceptadoEn.replace(' ', 'T')}Z`);
  if (Number.isNaN(aceptado)) return 0;
  const listo = aceptado + (tiempoPrepMin ?? 20) * 60_000;
  return Math.max(0, Math.round((listo - ahora) / 60_000));
}

/** ¿Ya es hora de ofrecérselo a un repartidor que está a estos km? */
export function debeOfrecer(minutosQueFaltan: number, km: number): boolean {
  return minutosQueFaltan <= minutosDeViaje(km) + MARGEN_DESPACHO_MIN;
}

/** Rechazos (o vencimientos) seguidos a partir de los cuales el pedido se ofrece a todos con bono. */
export const RECHAZOS_PARA_ABRIR = 3;
/** Bono (centavos) que paga Tumbite al repartidor que toma un pedido que nadie quiso. */
export const BONO_OFERTA_ABIERTA = 100;
/** Minutos extra que el restaurante puede sumar con «cocina ocupada». */
export const OPCIONES_COCINA_OCUPADA = [0, 10, 20] as const;
/** Cuántos pedidos entregados se miran para el promedio real de cocina. */
export const PEDIDOS_PARA_PROMEDIO = 20;

/**
 * Tiempo de preparación sugerido al aceptar: el promedio real de los últimos pedidos (de aceptado
 * a listo), redondeado a 5 y entre 10 y 60; con menos de 3 pedidos de historial, el que el
 * restaurante tiene configurado. «Cocina ocupada» le suma sus minutos.
 */
export function prepSugerida(minutosReales: number[], porDefecto = 20, extra = 0): number {
  const base =
    minutosReales.length >= 3
      ? minutosReales.reduce((a, b) => a + b, 0) / minutosReales.length
      : porDefecto;
  const redondo = Math.round(base / 5) * 5;
  return Math.min(120, Math.min(60, Math.max(10, redondo)) + extra);
}
