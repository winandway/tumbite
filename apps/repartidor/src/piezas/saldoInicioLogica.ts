import { CARRERAS_SALDO_BAJO } from '@tumbite/compartido';

/** Lo que devuelve `GET /datos/repartidor/saldo-prepago` y usa la tarjeta del inicio. */
export type SaldoPrepagoInicio = {
  disponible: number;
  moneda?: string;
  comisionTipica?: number;
  carrerasAlcanzan?: number | null;
  saldoBajo?: boolean;
  sinSaldo?: boolean;
  comisionTipicaComida?: number;
  pedidosAlcanzan?: number | null;
  sinSaldoComida?: boolean;
  /** C-COMIDA-VE-QUIEN-PAGA: en la comida con pago directo cobra el envío entero (0 % para Divoox). */
  comidaEnvioEntero?: boolean;
  efectivoActivo?: boolean;
  transferenciaActiva?: boolean;
  recargasPuntoVenta?: boolean;
};

export type TarjetaSaldo = {
  /** «ok» va en verde; «bajo» y «sin» en rojo (problema: hay que recargar). */
  nivel: 'ok' | 'bajo' | 'sin';
  alcanza: { tipo: 'carreras' | 'pedidos'; n: number } | null;
  /** Solo las carreras cobran del saldo: el aviso no le dice que se queda sin pedidos de comida. */
  soloCarreras: boolean;
};

/**
 * C-SALDO-EN-INICIO: qué muestra la tarjeta del saldo en el inicio de Driver. `null` cuando el país
 * no cobra del saldo prepago (EE. UU. va con Stripe Connect): ahí no hay nada que recargar.
 */
export function tarjetaSaldoInicio(p: SaldoPrepagoInicio | null): TarjetaSaldo | null {
  if (!p) return null;
  const viajes = (p.comisionTipica ?? 0) > 0;
  const comida = (p.comisionTipicaComida ?? 0) > 0;
  const usaPrepago =
    viajes ||
    comida ||
    Boolean(p.efectivoActivo) ||
    Boolean(p.transferenciaActiva) ||
    Boolean(p.recargasPuntoVenta);
  if (!usaPrepago) return null;

  const sinViajes = viajes && Boolean(p.sinSaldo);
  const sinComida = comida && Boolean(p.sinSaldoComida);
  // «Sin saldo» cuando no le llega NADA de lo que cobra del saldo; si una cosa todavía le alcanza, es bajo.
  // C-COMIDA-VE-QUIEN-PAGA: si nada cobra del saldo (comida con el envío entero), un saldo en cero no
  // le quita trabajo: no es un problema.
  const sinTodo =
    (viajes || comida) && (p.disponible <= 0 || ((!viajes || sinViajes) && (!comida || sinComida)));
  const bajo =
    Boolean(p.saldoBajo) ||
    sinViajes ||
    sinComida ||
    (p.pedidosAlcanzan != null && comida && p.pedidosAlcanzan < CARRERAS_SALDO_BAJO);

  const alcanza =
    p.carrerasAlcanzan != null && viajes
      ? { tipo: 'carreras' as const, n: p.carrerasAlcanzan }
      : p.pedidosAlcanzan != null && comida
        ? { tipo: 'pedidos' as const, n: p.pedidosAlcanzan }
        : null;
  return {
    nivel: sinTodo ? 'sin' : bajo ? 'bajo' : 'ok',
    alcanza,
    soloCarreras: viajes && !comida,
  };
}
