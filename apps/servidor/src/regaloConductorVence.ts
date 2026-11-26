/**
 * C-REGALO-CONDUCTOR-TOPE-VENCE (26 nov 2026, Richard: «el conductor que se registre nuevo, de forma
 * automática se le cargan sus $5», 50 USD al día por ciudad, 30 días si no se usan) — todos los
 * países con prepago.
 *
 * El regalo de arranque vence a los N días de la ciudad (la fecha queda fija en la carga, `vence_en`).
 * Como el saldo promocional de las grandes plataformas, el regalo se gasta PRIMERO: lo que el
 * conductor usó en comisiones desde que lo recibió sale del regalo. Al vencer se retira solo lo que
 * quedó sin usar, nunca más que su saldo, y nunca su propio dinero (recargas y cargas no cuentan como
 * uso del regalo).
 *
 * Es UNA sola sentencia (la cuenta y el retiro van juntos, así una comisión al mismo tiempo no hace
 * que se retire de más) y se escribe una sola vez por regalo (referencia única `vence-regalo:<id>`;
 * si no quedaba nada, el asiento es de 0 y ya no se vuelve a mirar). Corre a la vista, sin reloj: al
 * mirar el saldo, al conectarse y antes de apartar una comisión. Una sentencia que no encuentra nada
 * vencido no escribe ninguna fila.
 *
 * No importa nada del libro ni del saldo, para que el libro la pueda meter en sus lotes.
 */
export function sentenciaVencerRegaloConductor(db: D1Database, conductorId: string) {
  return db
    .prepare(
      `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
       SELECT lower(hex(randomblob(16))), v.conductor_id, 'prepago', v.pais, v.moneda,
              -MIN(MAX(0, v.monto - MAX(0, v.usado)), MAX(0, v.saldo)),
              'vence_regalo_nuevo', 'vence-regalo:' || v.id
         FROM (
           SELECT c.id, c.conductor_id, c.pais, c.moneda, c.monto,
                  -(SELECT COALESCE(SUM(l.monto), 0) FROM libro l
                     WHERE l.cuenta_id = c.conductor_id AND l.bolsillo = 'prepago'
                       AND l.pais = c.pais AND l.moneda = c.moneda AND l.creado_en >= c.creado_en
                       AND l.concepto NOT LIKE 'recarga%' AND l.concepto NOT LIKE 'carga%'
                       AND l.concepto <> 'vence_regalo_nuevo') AS usado,
                  (SELECT COALESCE(SUM(l.monto), 0) FROM libro l
                     WHERE l.cuenta_id = c.conductor_id AND l.bolsillo = 'prepago'
                       AND l.pais = c.pais AND l.moneda = c.moneda) AS saldo
             FROM cargas_saldo_conductor c
            WHERE c.conductor_id = ?1 AND c.tipo = 'regalo_nuevo'
              AND c.vence_en IS NOT NULL AND c.vence_en <= datetime('now')
              AND NOT EXISTS (SELECT 1 FROM libro x WHERE x.referencia = 'vence-regalo:' || c.id)
         ) v`,
    )
    .bind(conductorId);
}

export async function vencerRegaloConductor(db: D1Database, conductorId: string) {
  const r = await sentenciaVencerRegaloConductor(db, conductorId).run();
  return Number(r.meta.changes ?? 0) > 0;
}

/**
 * Lo que le queda del regalo de arranque y cuándo vence, para que el conductor lo vea en su saldo
 * («Incluye 5,00 $ de regalo de Divoox · vence el …»). `null` si no tiene un regalo que venza todavía.
 */
export async function regaloVigenteConductor(db: D1Database, conductorId: string) {
  const r = await db
    .prepare(
      `SELECT c.vence_en,
              MIN(MAX(0, c.monto - MAX(0, -(SELECT COALESCE(SUM(l.monto), 0) FROM libro l
                     WHERE l.cuenta_id = c.conductor_id AND l.bolsillo = 'prepago'
                       AND l.pais = c.pais AND l.moneda = c.moneda AND l.creado_en >= c.creado_en
                       AND l.concepto NOT LIKE 'recarga%' AND l.concepto NOT LIKE 'carga%'
                       AND l.concepto <> 'vence_regalo_nuevo'))),
                  MAX(0, (SELECT COALESCE(SUM(l.monto), 0) FROM libro l
                     WHERE l.cuenta_id = c.conductor_id AND l.bolsillo = 'prepago'
                       AND l.pais = c.pais AND l.moneda = c.moneda))) AS queda
         FROM cargas_saldo_conductor c
        WHERE c.conductor_id = ? AND c.tipo = 'regalo_nuevo'
          AND c.vence_en IS NOT NULL AND c.vence_en > datetime('now')`,
    )
    .bind(conductorId)
    .first<{ vence_en: string; queda: number }>();
  if (!r || Number(r.queda) <= 0) return null;
  return { monto: Number(r.queda), venceEn: r.vence_en };
}
