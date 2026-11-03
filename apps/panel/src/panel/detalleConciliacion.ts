import { type Idioma, formatearMonto } from '@tumbite/compartido';

/**
 * C-CONCILIACION-SEGUNDA-FIRMA (ETP-3, 3 nov 2026): el detalle de un día de la conciliación en
 * palabras, para la bandeja de días sin cuadrar y para «Para aprobar», en vez del JSON crudo.
 * Primero los pagos con tarjeta (en dólares) y después los cobros directos de cada moneda.
 */
export type GrupoDetalle = { titulo: string; lineas: string[] };

const T = {
  es: {
    tarjeta: 'Pagos con tarjeta, en dólares',
    restaurantes: 'Restaurantes',
    repartidores: 'Repartidores',
    stripe: 'Stripe',
    esperado: 'esperado',
    abonado: 'abonado',
    capturado: 'capturado',
    cuadra: 'cuadra',
    noCuadra: 'no cuadra',
    directos: (m: string) => `Cobros directos en ${m}`,
    entregados: (n: number) => `${n} ${n === 1 ? 'entregado' : 'entregados'}`,
    conDiferencia: (n: number) => `${n} con diferencia`,
    pendientes: (n: number) => `${n} ${n === 1 ? 'pendiente' : 'pendientes'} de conciliar`,
  },
  en: {
    tarjeta: 'Card payments, in US dollars',
    restaurantes: 'Restaurants',
    repartidores: 'Drivers',
    stripe: 'Stripe',
    esperado: 'expected',
    abonado: 'paid',
    capturado: 'captured',
    cuadra: 'balances',
    noCuadra: 'doesn’t balance',
    directos: (m: string) => `Direct payments in ${m}`,
    entregados: (n: number) => `${n} delivered`,
    conDiferencia: (n: number) => `${n} with a difference`,
    pendientes: (n: number) => `${n} pending reconciliation`,
  },
};

export function detalleEnPalabras(detalle: unknown, idioma: Idioma): GrupoDetalle[] {
  const t = idioma === 'en' ? T.en : T.es;
  const d = new Map(
    Object.entries(detalle && typeof detalle === 'object' ? (detalle as object) : {}),
  );
  const num = (k: string) => Number(d.get(k) ?? 0) || 0;
  const usd = (k: string) => formatearMonto(num(k), 'USD', idioma);
  const estado = (k: string) => (d.get(k) === 'NO' ? t.noCuadra : t.cuadra);
  const grupos: GrupoDetalle[] = [];
  if (d.has('restaurantesEsperado') || d.has('stripeEsperado'))
    grupos.push({
      titulo: t.tarjeta,
      lineas: [
        `${t.restaurantes}: ${t.esperado} ${usd('restaurantesEsperado')}, ${t.abonado} ${usd('restaurantesAbonado')} · ${estado('cuadraRestaurantes')}`,
        `${t.repartidores}: ${t.esperado} ${usd('repartidoresEsperado')}, ${t.abonado} ${usd('repartidoresAbonado')} · ${estado('cuadraRepartidores')}`,
        `${t.stripe}: ${t.esperado} ${usd('stripeEsperado')}, ${t.capturado} ${usd('stripeCapturado')} · ${estado('cuadraStripe')}`,
      ],
    });
  const monedas = [...d.keys()]
    .filter((k) => k.startsWith('directos_'))
    .map((k) => k.slice('directos_'.length))
    .sort();
  for (const m of monedas)
    grupos.push({
      titulo: t.directos(m),
      lineas: [
        [
          t.entregados(num(`directos_${m}`)),
          t.conDiferencia(num(`directosConDiferencia_${m}`)),
          t.pendientes(num(`directosPendientes_${m}`)),
        ].join(', '),
      ],
    });
  return grupos;
}
