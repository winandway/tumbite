import { datosPais } from './pais/paises';

/**
 * C-ZONA-POR-PAIS (19 nov 2026 — todos los países). La moneda en que se cobra y la hora de una
 * ciudad nueva salen de su país, nunca de un valor fijo: el formulario «Zonas» dejaba toda ciudad
 * nueva en dólares y con la hora de Nueva York, también una de Perú.
 *
 * Ojo: es la moneda de la ZONA (en la que se cotiza y se cobra ahí). Venezuela cobra en dólares y
 * muestra bolívares como referencia; Perú cobra en soles.
 */
/** La moneda y la hora con que nace una ciudad de ese país (C-DATOS-PAIS: salen de `PAISES`). */
export function zonaDeFabrica(pais: string | null | undefined): {
  moneda: string;
  zonaHoraria: string;
} {
  // Un país que Divoox todavía no conoce: dólares y Nueva York, como siempre (el formulario lo dice).
  const d = datosPais(pais) ?? datosPais('US');
  return { moneda: d?.monedaCobro ?? 'USD', zonaHoraria: d?.zonaHoraria ?? 'America/New_York' };
}
