/**
 * C-REPARTIDOR-DESTACADO (29 oct 2026), como el «Top Dasher» de DoorDash: quien cumple los cinco
 * requisitos es repartidor destacado y, a igual distancia, recibe las ofertas antes. Se revisa cada
 * vez que el repartidor mira sus calificaciones o se conecta; nadie se desactiva por no cumplirlos.
 */
export const REQUISITOS_DESTACADO = {
  estrellas: 4.7,
  aceptacion: 70,
  finalizacion: 95,
  entregas30Dias: 100,
  entregasTotales: 200,
} as const;

export type MetricasDestacado = {
  estrellas: number | null;
  aceptacion: number | null;
  finalizacion: number | null;
  entregas30Dias: number;
  entregasTotales: number;
};

export function requisitosDestacado(m: MetricasDestacado) {
  const r = REQUISITOS_DESTACADO;
  const lista = [
    {
      clave: 'estrellas',
      meta: r.estrellas,
      valor: m.estrellas,
      ok: (m.estrellas ?? 0) >= r.estrellas,
    },
    {
      clave: 'aceptacion',
      meta: r.aceptacion,
      valor: m.aceptacion,
      ok: (m.aceptacion ?? 0) >= r.aceptacion,
    },
    {
      clave: 'finalizacion',
      meta: r.finalizacion,
      valor: m.finalizacion,
      ok: (m.finalizacion ?? 0) >= r.finalizacion,
    },
    {
      clave: 'entregas30Dias',
      meta: r.entregas30Dias,
      valor: m.entregas30Dias,
      ok: m.entregas30Dias >= r.entregas30Dias,
    },
    {
      clave: 'entregasTotales',
      meta: r.entregasTotales,
      valor: m.entregasTotales,
      ok: m.entregasTotales >= r.entregasTotales,
    },
  ] as const;
  return { destacado: lista.every((x) => x.ok), requisitos: lista };
}
