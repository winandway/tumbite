/**
 * C-QUIEN-PAGA-VIAJES (23 nov 2026, orden de Richard): quién paga la comisión de Divoox en los
 * VIAJES (Moto y Carro). Tres valores, configurables desde el superadmin por país y por ciudad:
 *
 * - `conductor`: como siempre. El pasajero paga el precio del viaje y la comisión sale de la ganancia
 *   del conductor (de su saldo prepago).
 * - `cliente`: al precio se le suma una línea APARTE, «Tarifa de servicio de Divoox», igual a la
 *   comisión. El conductor se queda con el precio completo del viaje.
 * - `mitad`: el pasajero paga la mitad de la comisión como tarifa de servicio y la otra mitad sale de
 *   la ganancia del conductor.
 *
 * El porcentaje de Divoox NO cambia: siempre se calcula sobre el precio del viaje. Solo cambia quién
 * lo carga. Como en Venezuela el pasajero paga en mano al conductor, la tarifa de servicio pasa por
 * el conductor y el saldo prepago entrega a Divoox la comisión entera (la tarifa del cliente más la
 * parte del conductor). Puro: lo usan el servidor, el panel y las apps.
 */

export const QUIEN_PAGA = ['conductor', 'cliente', 'mitad'] as const;
export type QuienPaga = (typeof QUIEN_PAGA)[number];

export const esQuienPaga = (v: unknown): v is QuienPaga =>
  typeof v === 'string' && (QUIEN_PAGA as readonly string[]).includes(v);

export type RepartoComision = {
  /** Lo que se le suma al pasajero como «Tarifa de servicio de Divoox» (unidad menor). */
  tarifaServicio: number;
  /** Lo que sale de la ganancia del conductor (unidad menor). */
  parteConductor: number;
};

/**
 * Reparte la comisión de Divoox de un viaje (en la unidad menor, entera) según quién paga. En
 * «mitad», si la comisión es impar, el centavo de más lo pone el conductor (a favor del pasajero):
 * así la tarifa de servicio nunca pasa de la mitad exacta.
 */
export function repartirComision(comision: number, quien: QuienPaga): RepartoComision {
  const c = Math.max(0, Math.floor(comision));
  if (quien === 'cliente') return { tarifaServicio: c, parteConductor: 0 };
  if (quien === 'mitad') {
    const tarifaServicio = Math.floor(c / 2);
    return { tarifaServicio, parteConductor: c - tarifaServicio };
  }
  return { tarifaServicio: 0, parteConductor: c };
}

/**
 * Lo que ve el conductor al cobrar en mano: cuánto cobra, cuánto es suyo y cuánto es de Divoox. Lo de
 * Divoox es la comisión entera (sale de su saldo prepago al terminar), y lo suyo es el resto.
 */
export function cuentaDelConductor(p: {
  /** Lo que paga el pasajero (precio del viaje + tarifa de servicio). */
  total: number;
  /** La comisión entera de Divoox (tarifa de servicio + parte del conductor). */
  comision: number;
  tarifaServicio: number;
}): { cobra: number; tuyo: number; deDivoox: number; tarifaServicio: number } {
  const cobra = Math.max(0, Math.floor(p.total));
  const deDivoox = Math.min(cobra, Math.max(0, Math.floor(p.comision)));
  return {
    cobra,
    tuyo: cobra - deDivoox,
    deDivoox,
    tarifaServicio: Math.min(deDivoox, Math.max(0, Math.floor(p.tarifaServicio))),
  };
}
