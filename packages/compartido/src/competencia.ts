import type { Plan } from './catalogo';
import { type Centavos, porcentajeDe } from './dinero';
import { CONFIG_DINERO_INICIAL, type ConfigDinero } from './bolsillos';

/**
 * Lo que DoorDash y Uber Eats publican que cobran al restaurante por cada pedido a domicilio
 * (puntos básicos: 1500 = 15 %). Fuentes oficiales consultadas el 13 oct 2026:
 * merchants.doordash.com/en-us/pricing y merchants.ubereats.com/us/en/pricing. Se comparan plan
 * con plan: Inicial con el más básico, Crece con el del medio y Élite con el más alto.
 * Detalle en docs/MODELO-DE-DINERO.md. Si cambian sus precios, se cambia aquí y en la guía «compare».
 */
export const COMPETENCIA = {
  consultado: '2026-10-13',
  doordash: {
    nombre: 'DoorDash',
    pb: { inicial: 1500, crece: 2500, elite: 3000 } satisfies Record<Plan, number>,
    planes: { inicial: 'Basic', crece: 'Plus', elite: 'Premier' } satisfies Record<Plan, string>,
  },
  ubereats: {
    nombre: 'Uber Eats',
    pb: { inicial: 2000, crece: 2500, elite: 3000 } satisfies Record<Plan, number>,
    planes: { inicial: 'Lite', crece: 'Plus', elite: 'Premium' } satisfies Record<Plan, string>,
  },
} as const;

export type Comparacion = {
  ventas: Centavos;
  tumbite: Centavos;
  doordash: Centavos;
  ubereats: Centavos;
};

/**
 * Lo que le queda al restaurante de unas ventas (ya restados los regalos que él decidió dar) con
 * Divoox y con el plan equivalente de cada competidor.
 */
export function compararConOtras(
  ventas: Centavos,
  regalos: Centavos,
  plan: Plan,
  config: ConfigDinero = CONFIG_DINERO_INICIAL,
): Comparacion {
  const base = Math.max(0, ventas - regalos);
  const del = (t: Record<Plan, number>) =>
    plan === 'crece' ? t.crece : plan === 'elite' ? t.elite : t.inicial;
  const queda = (pb: number) => base - porcentajeDe(base, pb);
  return {
    ventas,
    tumbite: queda(del(config.comisionPb)),
    doordash: queda(del(COMPETENCIA.doordash.pb)),
    ubereats: queda(del(COMPETENCIA.ubereats.pb)),
  };
}

/** El nombre del plan equivalente en cada competidor (Inicial → Basic y Lite, etc.). */
export function planesEquivalentes(plan: Plan): { doordash: string; ubereats: string } {
  if (plan === 'crece') return { doordash: 'Plus', ubereats: 'Plus' };
  if (plan === 'elite') return { doordash: 'Premier', ubereats: 'Premium' };
  return { doordash: 'Basic', ubereats: 'Lite' };
}
