import { CONCEPTOS_RECARGA } from './avisoSaldo';
import type { Env } from './env';
import { saldoLibro } from './internacional/libro';
import { leerConfigPais } from './internacional/paises';
import { type Aviso, type Idioma, notificar } from './notificaciones';

/**
 * C-SALDO-BAJO (24 nov 2026) — todos los países donde rige el prepago. La base del modelo de recarga,
 * como el «low balance» de inDrive y DiDi: el conductor sabe a tiempo que se le acaba el saldo para la
 * comisión (y el restaurante, antes de quedarse en cero), en vez de descubrirlo cuando ya no le llegan
 * ofertas.
 *
 * - Cuenta en CARRERAS (o pedidos) que le quedan, no en dinero: el saldo entre la comisión de la
 *   operación que acaba de apartar. Con `avisoSaldoBajo` carreras o menos (configurable por país en el
 *   panel, «Control del dinero»; de fábrica 3; 0 = solo «te quedaste sin saldo»), le llega UNA vez.
 * - UNA vez por cruce: la marca es la última recarga (si no ha recargado desde el último aviso, no se
 *   repite). Va en la tabla de marcas de una vez que ya existe (`flex_avisos`), sin columna nueva y sin
 *   escribir por mirar: solo se mira justo después de que una operación descontó saldo.
 * - El texto no asusta: dice cómo recargar y a quién acudir (el agente de su zona). Sin montos.
 * - Nunca frena la operación: si algo falla, queda en el registro de errores.
 */
export const AVISO_SALDO_BAJO_DE_FABRICA = 3;

/** Lo que cuenta como una recarga (abre un cruce nuevo). */
const RECARGAS: readonly string[] = [
  ...CONCEPTOS_RECARGA,
  'carga_manual_restaurante',
  'recarga_restaurante',
];

export type NivelSaldo = 'bajo' | 'cero';

export const AVISOS_SALDO = {
  conductor: (i: Idioma, nivel: NivelSaldo, quedan: number): Aviso =>
    nivel === 'cero'
      ? i === 'en'
        ? {
            titulo: 'You’re out of balance',
            cuerpo:
              'Tap “View my balance” on the Divoox Driver home screen to top up, or go to the agent in your area to keep getting trips.',
            canal: 'dinero',
          }
        : {
            titulo: 'Te quedaste sin saldo',
            cuerpo:
              'Toca «Ver mi saldo» en el inicio de Divoox Driver para recargar, o acude al agente de tu zona para seguir recibiendo carreras.',
            canal: 'dinero',
          }
      : i === 'en'
        ? {
            titulo: quedan === 1 ? 'Balance for 1 more trip' : `Balance for ${quedan} more trips`,
            cuerpo:
              'Tap “View my balance” on the Divoox Driver home screen to top up, or go to the agent in your area so you don’t stop getting trips.',
            canal: 'dinero',
          }
        : {
            titulo:
              quedan === 1
                ? 'Te queda saldo para 1 carrera'
                : `Te queda saldo para ${quedan} carreras`,
            cuerpo:
              'Toca «Ver mi saldo» en el inicio de Divoox Driver para recargar, o acude al agente de tu zona para no dejar de recibir carreras.',
            canal: 'dinero',
          },
  restaurante: (i: Idioma, quedan: number): Aviso => {
    const alcanza =
      i === 'en'
        ? quedan === 0
          ? 'It no longer covers your next order.'
          : `It covers ${quedan === 1 ? '1 more order' : `about ${quedan} more orders`}.`
        : quedan === 0
          ? 'Ya no alcanza para tu próximo pedido.'
          : `Alcanza para ${quedan === 1 ? '1 pedido más' : `unos ${quedan} pedidos más`}.`;
    return i === 'en'
      ? {
          titulo: 'Your balance is running low',
          cuerpo: `${alcanza} Tap “Top up balance” in Divoox Restaurants so you keep receiving orders.`,
          canal: 'dinero',
        }
      : {
          titulo: 'Tu saldo está por acabarse',
          cuerpo: `${alcanza} Toca «Recargar saldo» en Divoox Restaurants para seguir recibiendo pedidos.`,
          canal: 'dinero',
        };
  },
};

/** Cuántas operaciones le quedan con este saldo (sin redondear para arriba). */
export const operacionesQueQuedan = (saldo: number, porOperacion: number) =>
  porOperacion > 0 ? Math.max(0, Math.floor(saldo / porOperacion)) : Infinity;

/** El nivel que toca avisar, o null si no toca (el restaurante no recibe «cero»: ya tiene el suyo). */
export function nivelSaldo(
  quedan: number,
  umbral: number,
  quien: 'conductor' | 'restaurante',
): NivelSaldo | null {
  if (quedan === 0) return quien === 'conductor' ? 'cero' : umbral > 0 ? 'bajo' : null;
  return quedan <= umbral ? 'bajo' : null;
}

/**
 * Mira el saldo justo después de descontar una operación y avisa si cruzó el umbral. `cuentaId`: la
 * cuenta del libro (el conductor, o `restaurante:<id>`); `usuarioId`: a quién le llega el aviso.
 */
export async function revisarSaldoBajo(
  env: Env,
  db: D1Database,
  p: {
    quien: 'conductor' | 'restaurante';
    cuentaId: string;
    usuarioId: string;
    pais: string;
    moneda: string;
    porOperacion: number;
  },
): Promise<NivelSaldo | null> {
  try {
    if (!(p.porOperacion > 0)) return null;
    const umbral = (await leerConfigPais(db, p.pais)).avisoSaldoBajo ?? AVISO_SALDO_BAJO_DE_FABRICA;
    const saldo = await saldoLibro(db, p.cuentaId, 'prepago', p.pais, p.moneda);
    const quedan = operacionesQueQuedan(saldo, p.porOperacion);
    const nivel = nivelSaldo(quedan, umbral, p.quien);
    if (!nivel) return null;
    const ultima = await db
      .prepare(
        `SELECT id FROM libro WHERE cuenta_id = ? AND bolsillo = 'prepago' AND pais = ? AND moneda = ?
           AND monto > 0 AND concepto IN (SELECT value FROM json_each(?))
         ORDER BY creado_en DESC, id DESC LIMIT 1`,
      )
      .bind(p.cuentaId, p.pais, p.moneda, JSON.stringify(RECARGAS))
      .first<{ id: string }>();
    const marca = await db
      .prepare(
        "INSERT OR IGNORE INTO flex_avisos (clave, usuario_id, tipo) VALUES (?, ?, 'saldo_bajo')",
      )
      .bind(
        `saldo_${nivel}:${p.cuentaId}:${p.pais}:${p.moneda}:${ultima?.id ?? 'inicio'}`,
        p.usuarioId,
      )
      .run();
    if (!marca.meta.changes) return null;
    await notificar(env, db, p.usuarioId, (i) => ({
      ...(p.quien === 'conductor'
        ? AVISOS_SALDO.conductor(i, nivel, quedan)
        : AVISOS_SALDO.restaurante(i, quedan)),
      datos: { tipo: 'saldo_bajo', nivel },
    }));
    return nivel;
  } catch (e) {
    console.error('saldo bajo: no se pudo revisar', p.cuentaId, String(e));
    return null;
  }
}
