/**
 * «Le gustó al 92 % (40)» por plato (C-GUSTO-PLATOS), como DoorDash: al calificar el pedido, el
 * cliente marca pulgar arriba o abajo en cada plato que pidió. El menú muestra el porcentaje solo
 * con un mínimo de votos, para que dos opiniones no pinten un plato de rojo. Lógica pura.
 */
export const GUSTO_MINIMO_VOTOS = 5;

export type GustoPlato = { porcentaje: number; votos: number };

/** Junta los votos (gusta 1 o 0) por plato; deja fuera los que no llegan al mínimo. */
export function resumenGusto(
  votos: { platoId: string; gusta: number }[],
): Record<string, GustoPlato> {
  const cuenta = new Map<string, { si: number; n: number }>();
  for (const v of votos) {
    const c = cuenta.get(v.platoId) ?? { si: 0, n: 0 };
    c.n += 1;
    if (Number(v.gusta) === 1) c.si += 1;
    cuenta.set(v.platoId, c);
  }
  return Object.fromEntries(
    [...cuenta]
      .filter(([, c]) => c.n >= GUSTO_MINIMO_VOTOS)
      .map(([id, c]) => [id, { porcentaje: Math.round((c.si / c.n) * 100), votos: c.n }]),
  );
}

/** Los platos de un pedido, a partir de sus líneas guardadas: solo esos se pueden calificar. */
export function platosDelPedido(lineasJson: string): Set<string> {
  let lineas: unknown;
  try {
    lineas = JSON.parse(lineasJson);
  } catch {
    console.warn('gusto por plato: líneas ilegibles en un pedido');
    return new Set();
  }
  if (!Array.isArray(lineas)) return new Set();
  return new Set(
    (lineas as { platoId?: unknown }[])
      .map((l) => (typeof l?.platoId === 'string' ? l.platoId : ''))
      .filter(Boolean),
  );
}

/** «92 % (40)» en español y «92% (40)» en inglés. */
export function textoGusto(g: GustoPlato, idioma: 'es' | 'en'): string {
  return `${g.porcentaje}${idioma === 'en' ? '%' : ' %'} (${g.votos})`;
}
