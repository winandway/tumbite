/**
 * C-RESUMEN-ANUAL (29 oct 2026), como el resumen de millas y ganancias del año de Dasher: por mes,
 * cuántas entregas, cuánta distancia y cuánto ganó (por moneda, nunca mezcladas). La distancia es la
 * del restaurante a la dirección del cliente en línea recta: una estimación, no el camino recorrido.
 */
export type EntregaDelAno = {
  entregadoEn: string;
  distanciaKm: number | null;
  moneda: string;
  total: number;
};
export type MesResumen = {
  mes: string;
  entregas: number;
  km: number;
  millas: number;
  ganado: { moneda: string; total: number }[];
};

export const KM_POR_MILLA = 1.609344;
const redondear = (x: number) => Math.round(x * 10) / 10;

export function resumenAnual(entregas: EntregaDelAno[]): {
  meses: MesResumen[];
  total: { entregas: number; km: number; millas: number };
} {
  const porMes = new Map<string, { entregas: number; km: number; ganado: Map<string, number> }>();
  for (const x of entregas) {
    const mes = x.entregadoEn.slice(0, 7);
    const m = porMes.get(mes) ?? { entregas: 0, km: 0, ganado: new Map<string, number>() };
    m.entregas += 1;
    m.km += x.distanciaKm ?? 0;
    m.ganado.set(x.moneda, (m.ganado.get(x.moneda) ?? 0) + x.total);
    porMes.set(mes, m);
  }
  const meses = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, m]) => ({
      mes,
      entregas: m.entregas,
      km: redondear(m.km),
      millas: redondear(m.km / KM_POR_MILLA),
      ganado: [...m.ganado.entries()].map(([moneda, total]) => ({ moneda, total })),
    }));
  const km = entregas.reduce((s, x) => s + (x.distanciaKm ?? 0), 0);
  return {
    meses,
    total: { entregas: entregas.length, km: redondear(km), millas: redondear(km / KM_POR_MILLA) },
  };
}

/** El CSV para el contador: una fila por mes y moneda, montos en la unidad mayor (dólares, pesos). */
export function csvResumenAnual(meses: MesResumen[], idioma: 'es' | 'en'): string {
  const cabecera =
    idioma === 'en'
      ? 'month,deliveries,miles,km,currency,earned'
      : 'mes,entregas,millas,km,moneda,ganado';
  const filas = meses.flatMap((m) =>
    (m.ganado.length ? m.ganado : [{ moneda: '', total: 0 }]).map(
      (g) => `${m.mes},${m.entregas},${m.millas},${m.km},${g.moneda},${(g.total / 100).toFixed(2)}`,
    ),
  );
  return [cabecera, ...filas].join('\n');
}
