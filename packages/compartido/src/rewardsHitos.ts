/**
 * Divoox Rewards · Fase 2 · estados de premios y reglas antifraude por servicio (30 oct 2026).
 * Sin pagos: la Fase 2 solo registra estados en modo sombra. Diseño: docs/REWARDS-FASE-2-DISENO.md.
 */
import type { NivelRep, ServicioRep } from './reputacion';
import { ORDEN_NIVELES } from './reputacion';

/**
 * Estados de un hito:
 * - progreso: contador hacia el hito (no es dinero ni promesa).
 * - sin_presupuesto: hito alcanzado pero sin presupuesto reservado: NO es una obligación (condición D).
 * - condicionado: presupuesto reservado, falta el nivel requerido; no vence por fecha.
 * - ganado: condiciones cumplidas; espera la ventana de reclamos.
 * - pagado: solo con pagos autorizados (en la Fase 2 nunca se llega aquí).
 * - cancelado: fraude o seguridad probados, baja voluntaria o fin del programa con aviso.
 */
export const ESTADOS_HITO = [
  'progreso',
  'sin_presupuesto',
  'condicionado',
  'ganado',
  'pagado',
  'cancelado',
] as const;
export type EstadoHito = (typeof ESTADOS_HITO)[number];

const TRANSICIONES = new Map<EstadoHito, readonly EstadoHito[]>([
  ['progreso', ['sin_presupuesto', 'condicionado', 'ganado', 'cancelado']],
  ['sin_presupuesto', ['condicionado', 'ganado', 'cancelado']],
  ['condicionado', ['ganado', 'cancelado']],
  ['ganado', ['pagado', 'cancelado']],
  ['pagado', []],
  ['cancelado', []],
]);

export function puedePasar(de: EstadoHito, a: EstadoHito): boolean {
  return (TRANSICIONES.get(de) ?? []).includes(a);
}

/** Ventana de reclamos antes de que un hito ganado pueda pagarse. */
export const DIAS_RETENCION = 14;

export type Hito = {
  programa: string;
  unidades: number;
  montoCentavos: number;
  nivelMinimo: NivelRep;
  servicio: ServicioRep | 'todos';
};

/** El primer hito aprobado como hipótesis (30 USD a las 100 unidades, Plata o más). Sin pagos. */
export const HITOS_FASE2: readonly Hito[] = [
  {
    programa: 'primer-hito-2026',
    unidades: 100,
    montoCentavos: 3000,
    nivelMinimo: 'plata',
    servicio: 'todos',
  },
];

export const cumpleNivel = (nivel: NivelRep, minimo: NivelRep) =>
  ORDEN_NIVELES.indexOf(nivel) >= ORDEN_NIVELES.indexOf(minimo);

/**
 * Condición C: reglas antifraude distintas por servicio. Cada item es una unidad candidata a contar
 * para un hito; la función devuelve cuántas cuentan y por qué se descartaron las demás.
 */
export type ItemComida = {
  servicio: 'comida' | 'tiendas';
  cliente: string;
  pagado: boolean;
  reclamoAprobado: boolean;
  /** El cliente comparte identidad, tarjeta, teléfono o dispositivo con el repartidor. */
  propio: boolean;
};
export type ItemExpress = {
  servicio: 'express';
  cliente: string;
  pagado: boolean;
  distanciaKm: number;
  propio: boolean;
};
export type ItemFlex = {
  servicio: 'flex';
  empresa: string;
  ruta: string;
  paquetesEntregados: number;
  /** Empresa verificada, con política de cobro prepago activa. */
  empresaVerificada: boolean;
  /** El conductor es dueño o miembro administrador de esa empresa. */
  conductorEsDeLaEmpresa: boolean;
  /** La ruta la cerró la empresa (paquetes no entregados recibidos en el centro). */
  rutaCerrada: boolean;
};
export type ItemHito = ItemComida | ItemExpress | ItemFlex;

export const REGLAS_ANTIFRAUDE = {
  comida: { maxPorCliente: 3, minDistintos: 0.5 },
  tiendas: { maxPorCliente: 3, minDistintos: 0.5 },
  express: { maxPorCliente: 3, minDistintos: 0.4, minKm: 1 },
  flex: { maxPaquetesPorRuta: 30 },
} as const;
const reglasCliente = (s: ItemComida['servicio'] | 'express') =>
  s === 'express'
    ? REGLAS_ANTIFRAUDE.express
    : s === 'tiendas'
      ? REGLAS_ANTIFRAUDE.tiendas
      : REGLAS_ANTIFRAUDE.comida;

export function unidadesQueCuentan(items: ItemHito[]): {
  cuentan: number;
  descartes: Record<string, number>;
  bloqueo: string | null;
} {
  const cuenta = new Map<string, number>();
  const descartar = (m: string, n = 1) => cuenta.set(m, (cuenta.get(m) ?? 0) + n);
  const porCliente = new Map<string, number>();
  let cuentan = 0;
  let deClientes = 0;
  for (const it of items) {
    if (it.servicio === 'flex') {
      if (!it.empresaVerificada) {
        descartar('empresa_no_verificada');
        continue;
      }
      if (it.conductorEsDeLaEmpresa) {
        descartar('empresa_propia');
        continue;
      }
      if (!it.rutaCerrada) {
        descartar('ruta_sin_cerrar');
        continue;
      }
      const n = Math.min(it.paquetesEntregados, REGLAS_ANTIFRAUDE.flex.maxPaquetesPorRuta);
      if (n < it.paquetesEntregados) descartar('tope_por_ruta', it.paquetesEntregados - n);
      cuentan += n;
      continue;
    }
    if (!it.pagado) {
      descartar('sin_pagar');
      continue;
    }
    if (it.propio) {
      descartar('pedido_propio');
      continue;
    }
    if (it.servicio !== 'express' && it.reclamoAprobado) {
      descartar('reclamo_aprobado');
      continue;
    }
    if (it.servicio === 'express' && it.distanciaKm < REGLAS_ANTIFRAUDE.express.minKm) {
      descartar('viaje_muy_corto');
      continue;
    }
    const usados = porCliente.get(it.cliente) ?? 0;
    if (usados >= reglasCliente(it.servicio).maxPorCliente) {
      descartar('tope_por_cliente');
      continue;
    }
    porCliente.set(it.cliente, usados + 1);
    cuentan++;
    deClientes++;
  }
  // Clientes distintos: solo para servicios con clientes (no Flex), con umbral propio por servicio.
  let bloqueo: string | null = null;
  const conClientes = items.filter((i) => i.servicio !== 'flex');
  if (deClientes > 0 && conClientes.length) {
    const min = Math.min(
      ...conClientes.map((i) => reglasCliente(i.servicio as ItemComida['servicio']).minDistintos),
    );
    if (porCliente.size / deClientes < min) bloqueo = 'pocos_clientes_distintos';
  }
  return { cuentan, descartes: Object.fromEntries(cuenta), bloqueo };
}
