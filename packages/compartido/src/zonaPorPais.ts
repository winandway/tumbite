/**
 * C-ZONA-POR-PAIS (19 nov 2026 — todos los países). La moneda en que se cobra y la hora de una
 * ciudad nueva salen de su país, nunca de un valor fijo: el formulario «Zonas» dejaba toda ciudad
 * nueva en dólares y con la hora de Nueva York, también una de Perú.
 *
 * Ojo: es la moneda de la ZONA (en la que se cotiza y se cobra ahí). Venezuela cobra en dólares y
 * muestra bolívares como referencia; Perú cobra en soles.
 */
const ZONAS = new Map<string, { moneda: string; zonaHoraria: string }>([
  ['US', { moneda: 'USD', zonaHoraria: 'America/New_York' }],
  ['VE', { moneda: 'USD', zonaHoraria: 'America/Caracas' }],
  ['PE', { moneda: 'PEN', zonaHoraria: 'America/Lima' }],
  ['CO', { moneda: 'COP', zonaHoraria: 'America/Bogota' }],
  ['MX', { moneda: 'MXN', zonaHoraria: 'America/Mexico_City' }],
  ['CL', { moneda: 'CLP', zonaHoraria: 'America/Santiago' }],
]);

/** La moneda y la hora con que nace una ciudad de ese país (un país desconocido: dólares y Nueva York). */
export function zonaDeFabrica(pais: string | null | undefined): {
  moneda: string;
  zonaHoraria: string;
} {
  return (
    ZONAS.get((pais ?? '').toUpperCase()) ?? { moneda: 'USD', zonaHoraria: 'America/New_York' }
  );
}
