import { type Idioma, contar } from '@tumbite/compartido';

/**
 * C-GANANCIAS-COHERENTES (18 nov 2026, tercera auditoría de tiendas): la tarjeta «Total de hoy» de
 * Ganancias. El total suma todo lo ganado (entregas, propinas, bonos y regalos de Divoox); las
 * entregas son los pedidos de comida entregados, como en la tarjeta de Hoy del inicio y en el
 * desglose de abajo. Un regalo de Divoox no es una entrega: decía «1 entregas» con «Total · 0
 * entregas» debajo.
 *
 * C-GANANCIAS-CARRERAS (revisor, 18 nov 2026): lo que pagó con tarjeta el pasajero de un viaje de
 * Moto, Carro o Envíos llega como «entrega» SIN pedido (viajesCobro.ts). Antes del arreglo anterior
 * contaba por `pedidoId ?? id`; con «solo con pedido» un conductor de viajes veía «Total $X · 0
 * entregas». Ahora cada uno cuenta como lo que es: entregas (pedidos) y carreras (viajes), como Uber
 * Driver («trips») y DoorDash («deliveries»).
 *
 * La billetera es siempre en USD: la tabla de movimientos no lleva moneda y todo lo que escribe en
 * ella es en dólares (Stripe de EE. UU. y los regalos de Divoox, también en Venezuela).
 */
export type MovimientoGanancia = {
  id: string;
  monto: number;
  concepto: string;
  pedidoId?: string | null;
  /**
   * El viaje (Moto, Carro, Envíos) al que pertenece el movimiento: su cobro con tarjeta o el regalo
   * de Divoox que lo pagó. Un viaje es UNA carrera aunque tenga varios movimientos.
   */
  operacionId?: string | null;
};

export function resumenPeriodo(movs: MovimientoGanancia[]): {
  total: number;
  entregas: number;
  carreras: number;
  regalos: number;
} {
  const ganado = movs.filter((m) => m.concepto !== 'retiro' && m.monto > 0);
  const deTrabajo = ganado.filter((m) => m.concepto === 'entrega');
  const entregados = new Set(deTrabajo.filter((m) => m.pedidoId).map((m) => m.pedidoId));
  // Robot (18 nov 2026): un viaje pagado entero con regalo no tiene «entrega»; su regalo dice el
  // viaje. Cada viaje cuenta una vez; una «entrega» sin pedido ni viaje (servidor viejo), por su id.
  const carreras = new Set([
    ...ganado
      .filter((m) => (m.concepto === 'entrega' || m.concepto === 'regalo') && m.operacionId)
      .map((m) => `v:${m.operacionId}`),
    ...deTrabajo.filter((m) => !m.pedidoId && !m.operacionId).map((m) => `m:${m.id}`),
  ]);
  return {
    total: ganado.reduce((x, m) => x + m.monto, 0),
    entregas: entregados.size,
    carreras: carreras.size,
    regalos: ganado.filter((m) => m.concepto === 'regalo').reduce((x, m) => x + m.monto, 0),
  };
}

/** «3 entregas», «1 carrera» o, si el periodo mezcla, «2 entregas · 1 carrera». */
export function textoTrabajos(entregas: number, carreras: number, idioma: Idioma): string {
  if (!carreras) return contar(entregas, 'entrega', idioma);
  if (!entregas) return contar(carreras, 'carrera', idioma);
  return `${contar(entregas, 'entrega', idioma)} · ${contar(carreras, 'carrera', idioma)}`;
}

/**
 * C-GANANCIAS-EN-MANO (19 nov 2026, Venezuela y Perú — Gerencia): el total del día del conductor no
 * sumaba lo cobrado en mano (efectivo, pago móvil, Yape, Plin), que no pasa por la billetera. En el
 * piloto de Venezuela TODO se cobra en mano: el conductor veía «$0.00» después de trabajar el día.
 * El total junta la billetera (siempre dólares) con lo cobrado en mano, cada moneda por separado
 * (nunca se suman monedas distintas), y los bolívares cobrados con la tasa fijada de cada viaje.
 */
export type CobroEnMano = {
  /** «p:<pedido>» o «v:<viaje>». */
  id: string;
  tipo: 'entrega' | 'carrera';
  /** Fecha del servidor (UTC, «AAAA-MM-DD HH:MM:SS»). */
  fecha: string;
  monto: number;
  moneda: string;
  /** Bolívares cobrados con la tasa fijada del viaje (solo Venezuela). */
  montoLocal?: number | null;
};

export function resumenConEnMano(
  movs: MovimientoGanancia[],
  cobros: CobroEnMano[],
): {
  /** Un total por moneda, los dólares primero. Siempre hay al menos una parte. */
  partes: { monto: number; moneda: string }[];
  /** Lo cobrado en mano, por moneda (para la línea «incluye … cobrado en mano»). */
  enMano: { monto: number; moneda: string }[];
  /** Bolívares cobrados en mano (suma de lo fijado en cada viaje); 0 si no hubo. */
  bolivares: number;
  entregas: number;
  carreras: number;
  regalos: number;
} {
  const b = resumenPeriodo(movs);
  const porMoneda = new Map<string, number>();
  for (const c of cobros) porMoneda.set(c.moneda, (porMoneda.get(c.moneda) ?? 0) + c.monto);
  const orden = (x: string, y: string) => (x === 'USD' ? -1 : y === 'USD' ? 1 : x.localeCompare(y));
  const enMano = [...porMoneda.entries()]
    .filter(([, monto]) => monto > 0)
    .sort(([x], [y]) => orden(x, y))
    .map(([moneda, monto]) => ({ moneda, monto }));
  const total = new Map(porMoneda);
  if (b.total > 0 || !enMano.length) total.set('USD', (total.get('USD') ?? 0) + b.total);
  const partes = [...total.entries()]
    .filter(([, monto], _i, lista) => monto > 0 || lista.length === 1)
    .sort(([x], [y]) => orden(x, y))
    .map(([moneda, monto]) => ({ moneda, monto }));
  // Un viaje con regalo ya cuenta como carrera por su regalo en la billetera: no se cuenta dos veces.
  const yaContados = new Set(
    movs
      .filter((m) => m.monto > 0 && m.operacionId && m.concepto !== 'retiro')
      .map((m) => `v:${m.operacionId}`),
  );
  const pedidosBilletera = new Set(
    movs.filter((m) => m.monto > 0 && m.pedidoId).map((m) => `p:${m.pedidoId}`),
  );
  return {
    partes: partes.length ? partes : [{ moneda: 'USD', monto: 0 }],
    enMano,
    bolivares: cobros.reduce((x, c) => x + (c.moneda === 'USD' ? (c.montoLocal ?? 0) : 0), 0),
    entregas:
      b.entregas +
      new Set(
        cobros.filter((c) => c.tipo === 'entrega' && !pedidosBilletera.has(c.id)).map((c) => c.id),
      ).size,
    carreras:
      b.carreras +
      new Set(cobros.filter((c) => c.tipo === 'carrera' && !yaContados.has(c.id)).map((c) => c.id))
        .size,
    regalos: b.regalos,
  };
}

/** Los cobros en mano que caen en el periodo, con la fecha local del conductor. */
export function cobrosDelPeriodo(
  cobros: CobroEnMano[],
  periodo: 'hoy' | 'semana' | 'mes',
  ahora: Date,
): CobroEnMano[] {
  const fechaDe = (c: CobroEnMano) => new Date(`${c.fecha.replace(' ', 'T')}Z`);
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7));
  inicioSemana.setHours(0, 0, 0, 0);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const hoy = ahora.toLocaleDateString('en-CA');
  return cobros.filter((c) =>
    periodo === 'hoy'
      ? fechaDe(c).toLocaleDateString('en-CA') === hoy
      : periodo === 'semana'
        ? fechaDe(c) >= inicioSemana
        : fechaDe(c) >= inicioMes,
  );
}
