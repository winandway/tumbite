import { formatearMonto } from '@tumbite/compartido';
import type { Env } from './env';
import { notificar } from './notificaciones';

/**
 * Tramo 1 (orden de Richard, 23 nov 2026) — todos los países. Cuando al conductor se le recarga saldo
 * por CUALQUIER vía (código, tarjeta, agente, la carga manual del equipo o un regalo de Divoox), le
 * llega un aviso al celular. En la campana de Driver sale también (la lista la arma
 * `GET /datos/repartidor/avisos` con lo acreditado en `libro`). Nunca frena la recarga: si el aviso
 * falla, queda en el registro de errores.
 */
export const CONCEPTOS_RECARGA = [
  'recarga_codigo',
  'recarga_stripe',
  'recarga_agente',
  'carga_manual',
  'carga_regalo_nuevo',
  'carga_regalo_a_saldo',
] as const;

export async function avisarSaldoRecargado(
  env: Env | undefined,
  db: D1Database,
  conductorId: string,
  monto: number,
  moneda: string,
) {
  if (!env || !(monto > 0)) return;
  try {
    await notificar(env, db, { id: conductorId, app: 'repartidor' }, (i) => ({
      titulo: i === 'en' ? 'Balance added' : 'Te recargamos saldo',
      cuerpo:
        i === 'en'
          ? `${formatearMonto(monto, moneda, 'en')} was added to your balance. You can now get trips.`
          : `Se acreditaron ${formatearMonto(monto, moneda, 'es')} a tu saldo. Ya puedes recibir carreras.`,
      datos: { tipo: 'saldo_recargado' },
    }));
  } catch (e) {
    console.error('saldo: no salió el aviso de recarga', String(e));
  }
}
