/**
 * G3 (2 nov 2026): edad mínima para repartir, como DoorDash y Uber (estudios de Richard, E2 p.3).
 * DoorDash pide 18, 19 en Florida y Texas y 21 en California para cuentas nuevas; Uber pide 19 en
 * moto o carro. Manda la mayor de las reglas que apliquen. Fuera de EE. UU., la mayoría de edad.
 */
export const EDAD_BASE_REPARTIDOR = 18;

/** Estados de EE. UU. con una edad mayor a la base. */
export const EDAD_POR_ESTADO: Readonly<Record<string, number>> = { FL: 19, TX: 19, CA: 21 };

/** Vehículos que piden más edad (Uber: 19 en moto o carro). */
export const EDAD_POR_VEHICULO: Readonly<Record<string, number>> = { carro: 19, moto: 19 };

/** «US-FL-MIAMI» → «FL». Solo EE. UU.; en otro país no hay estado que aplique. */
export function estadoEeuuDeZona(zonaId: string | null | undefined): string | null {
  const m = /^US-([A-Z]{2})-/.exec(zonaId ?? '');
  return m?.[1] ?? null;
}

export function edadMinimaRepartidor(d: {
  zonaId: string | null | undefined;
  vehiculo: string | null | undefined;
}): number {
  if (!(d.zonaId ?? '').startsWith('US-')) return EDAD_BASE_REPARTIDOR;
  const estado = estadoEeuuDeZona(d.zonaId);
  return Math.max(
    EDAD_BASE_REPARTIDOR,
    (estado && EDAD_POR_ESTADO[estado]) || 0,
    EDAD_POR_VEHICULO[d.vehiculo ?? ''] ?? 0,
  );
}

/** Años cumplidos a partir de «AAAA-MM-DD». Null si la fecha no se puede leer. */
export function edadEnAnios(fecha: string | null | undefined, hoy = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? '');
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let edad = hoy.getUTCFullYear() - a;
  const mes = hoy.getUTCMonth() + 1;
  if (mes < me || (mes === me && hoy.getUTCDate() < d)) edad -= 1;
  return edad;
}
