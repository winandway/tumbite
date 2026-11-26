import { pagaEnMano } from './regaloDivoox';
import { type MontoEnMano, equivalenteLocal } from './tasaReferencia';

/**
 * C-SALDO-CLIENTE (25 nov 2026, Venezuela; la pieza sirve a todos los países): el Saldo Divoox del
 * pasajero. Es crédito prepagado en dólares que carga el equipo (una carrera de regalo, una recarga de
 * regalo o lo que el cliente prepagó y el equipo registró con su referencia). Se usa en la pantalla
 * «Método de pago»: primero el regalo de código (si hay), después el saldo hasta donde alcance, y el
 * resto se paga en mano (Pago Móvil o Efectivo). Las cuentas de dinero las hace el servidor; esta
 * pieza solo dice lo mismo en las dos puntas (app y servidor) para que nunca se contradigan.
 */

/** El saldo del cliente vive en dólares (la moneda de los viajes de Venezuela). */
export const MONEDA_SALDO_DIVOOX = 'USD';

/** Por qué entra o sale saldo (el libro del saldo del cliente). */
export const CONCEPTOS_SALDO_CLIENTE = [
  'regalo',
  'recarga',
  'uso_viaje',
  'devolucion',
  'ajuste',
  // Al borrar la cuenta: el saldo se cierra a cero (auditable; el prepago real se devuelve aparte).
  'cierre_cuenta',
] as const;
export type ConceptoSaldoCliente = (typeof CONCEPTOS_SALDO_CLIENTE)[number];

/** Los motivos con que el equipo carga saldo desde el panel (el motivo es obligatorio). */
export const MOTIVOS_CARGA_SALDO = ['carrera_regalo', 'recarga_regalo', 'prepago'] as const;
export type MotivoCargaSaldo = (typeof MOTIVOS_CARGA_SALDO)[number];
/** El prepago del cliente es plata que entró: va como «recarga»; lo demás es regalo de Divoox. */
export const conceptoDeMotivo = (m: MotivoCargaSaldo): ConceptoSaldoCliente =>
  m === 'prepago' ? 'recarga' : 'regalo';

/** El saldo como lo manda la cotización (solo donde el país lo tiene encendido). */
export type SaldoDivooxCotizacion = {
  /** Lo que el pasajero tiene disponible ahora (centavos de dólar). */
  disponible: number;
  moneda: string;
};

/**
 * La cuenta del viaje con saldo: total → menos el regalo de código → menos el saldo hasta donde
 * alcance → el resto se paga en mano. `cubreTodo` = no hace falta elegir Pago Móvil ni Efectivo.
 */
export function cuentaConSaldo(p: {
  total: number;
  regalo?: { monto: number } | null;
  saldoDisponible: number;
  usarSaldo: boolean;
}) {
  const despuesDelRegalo = pagaEnMano(p.total, p.regalo);
  const saldoUsado = p.usarSaldo
    ? Math.max(0, Math.min(despuesDelRegalo, Math.floor(p.saldoDisponible)))
    : 0;
  const resto = pagaEnMano(p.total, p.regalo, saldoUsado);
  return {
    despuesDelRegalo,
    saldoUsado,
    resto,
    cubreTodo: saldoUsado > 0 && resto === 0,
    saldoQueQueda: Math.max(0, Math.floor(p.saldoDisponible) - saldoUsado),
  };
}

/** Frase exacta de un método que no se puede usar en este viaje (nunca una ventana de error). */
export const TEXTO_METODO_NO_DISPONIBLE = {
  es: 'Aún no disponible para este viaje',
  en: 'Not available for this trip yet',
} as const;

/**
 * El mismo monto en mano con otra cifra (el resto después del saldo) y la MISMA tasa fijada de la
 * cotización: así la pantalla de pago dice los bolívares exactos sin otra consulta al servidor.
 */
export function enManoCon(
  base: MontoEnMano | null | undefined,
  centavos: number,
): MontoEnMano | null {
  if (!base) return null;
  return {
    ...base,
    monto: centavos,
    local: base.local
      ? { ...base.local, monto: equivalenteLocal(centavos, base.local.tasa) }
      : null,
  };
}
