import type { Env } from './env';
import { nuevoId } from './cripto';
import { ErrorStripe, type Stripe } from './stripe';

/**
 * Retiros sin doble pago (Fase 0, 15 oct 2026). Candado C-RETIROS-SEGUROS.
 *
 * Antes: un mismo try/catch envolvía la transferencia a Stripe y la escritura en la base, y
 * CUALQUIER error devolvía el saldo. Si Stripe transfería y la respuesta se perdía, el saldo
 * volvía y el mismo dinero se podía retirar otra vez (con otra clave: Stripe no lo unía).
 *
 * Ahora:
 *  1. Pedir = una sentencia: crea el retiro solo si hay saldo; un disparador lo descuenta.
 *  2. Un solo proceso reclama el retiro (estado «enviando»).
 *  3. Stripe se llama con la clave fija retiro:<id> (también es su transfer_group).
 *  4. Resultado incierto (red, tiempo agotado, 409, 429, 5xx, 2xx sin id) → se VERIFICA en Stripe
 *     por transfer_group; si existe, confirmado; si no, «reintentar». El saldo NO vuelve.
 *  5. Solo un rechazo de Stripe (400/402/403/404) con la verificación hecha y sin transferencia
 *     → «fallido», y un disparador devuelve el saldo una sola vez.
 */
export const MAX_INTENTOS_RETIRO = 8;
export const MINUTOS_ATASCADO = 5;
const RECHAZOS = new Set([400, 402, 403, 404]);

export type ResultadoRetiro = 'confirmado' | 'en_proceso' | 'fallido' | 'revision' | 'no_reclamado';

export const claveRetiro = (id: string) => `retiro:${id}`;

/** ¿Se puede pedir un retiro ahora? Variable de entorno (emergencia) y bandera en la base. */
export async function retirosActivos(env: Env, db: D1Database): Promise<boolean> {
  if (env.RETIROS_APAGADOS === '1') return false;
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'retiros_activos'")
    .first<{ valor: string }>();
  return f?.valor !== '0';
}

/** Crea el retiro y descuenta el saldo en UNA sentencia. Devuelve el id, o null si no alcanza. */
export async function pedirRetiro(
  db: D1Database,
  usuarioId: string,
  stripeCuenta: string,
  monto: number,
): Promise<string | null> {
  const id = nuevoId();
  const r = await db
    .prepare(
      `INSERT INTO retiros (id, usuario_id, stripe_cuenta, monto_centavos)
       SELECT ?, ?, ?, ? WHERE (SELECT COALESCE(SUM(monto), 0) FROM movimientos WHERE usuario_id = ?) >= ?`,
    )
    .bind(id, usuarioId, stripeCuenta, monto, usuarioId, monto)
    .run();
  return r.meta.changes ? id : null;
}

async function confirmar(db: D1Database, id: string, transferencia: string): Promise<'confirmado'> {
  await db
    .prepare(
      "UPDATE retiros SET estado = 'confirmado', stripe_transferencia = ?, ultimo_error = '', actualizado_en = datetime('now') WHERE id = ? AND estado IN ('enviando', 'reintentar', 'revision')",
    )
    .bind(transferencia, id)
    .run();
  return 'confirmado';
}

/** Busca en Stripe la transferencia de este retiro. Sirve aunque Stripe ya haya borrado la clave. */
async function buscarEnStripe(stripe: Stripe, id: string): Promise<string | null> {
  const lista = await stripe.get<{ data?: { id?: string }[] }>('/transfers', {
    transfer_group: claveRetiro(id),
    limit: 1,
  });
  return lista.data?.[0]?.id ?? null;
}

/**
 * Procesa un retiro: lo reclama, llama a Stripe y clasifica la respuesta. Seguro de llamar varias
 * veces y desde varios lugares (la ruta, el reloj, la conciliación): solo uno lo reclama.
 */
export async function procesarRetiro(
  db: D1Database,
  stripe: Stripe,
  id: string,
): Promise<ResultadoRetiro> {
  const r = await db
    .prepare(
      `UPDATE retiros SET estado = 'enviando', intentos = intentos + 1, enviando_desde = datetime('now'), actualizado_en = datetime('now')
        WHERE id = ? AND proximo_intento_en <= datetime('now')
          AND (estado IN ('pendiente', 'reintentar')
               OR (estado = 'enviando' AND enviando_desde < datetime('now', '-${MINUTOS_ATASCADO} minutes')))
       RETURNING monto_centavos, stripe_cuenta, usuario_id, intentos`,
    )
    .bind(id)
    .first<{
      monto_centavos: number;
      stripe_cuenta: string;
      usuario_id: string;
      intentos: number;
    }>();
  if (!r) return 'no_reclamado';
  try {
    // Desde el segundo intento, primero se mira si el anterior sí llegó a Stripe.
    if (r.intentos > 1) {
      const ya = await buscarEnStripe(stripe, id);
      if (ya) return await confirmar(db, id, ya);
    }
    const t = await stripe.post<{ id?: string }>(
      '/transfers',
      {
        amount: r.monto_centavos,
        currency: 'usd',
        destination: r.stripe_cuenta,
        transfer_group: claveRetiro(id),
        metadata: { retiro_id: id, usuario_id: r.usuario_id },
      },
      claveRetiro(id),
    );
    if (t.id) return await confirmar(db, id, t.id);
    throw new Error('Stripe respondió sin id de transferencia');
  } catch (e) {
    const rechazo = e instanceof ErrorStripe && RECHAZOS.has(e.estado);
    let verificado = false;
    let hallada: string | null = null;
    try {
      hallada = await buscarEnStripe(stripe, id);
      verificado = true;
    } catch (v) {
      console.error('retiro: no se pudo verificar en Stripe', id, v);
    }
    if (hallada) return await confirmar(db, id, hallada);
    const mensaje = e instanceof Error ? e.message : String(e);
    if (rechazo && verificado) {
      // Stripe lo rechazó y comprobamos que NO hay transferencia: el saldo vuelve (una vez).
      await db
        .prepare(
          "UPDATE retiros SET estado = 'fallido', ultimo_error = ?, actualizado_en = datetime('now') WHERE id = ? AND estado = 'enviando'",
        )
        .bind(mensaje.slice(0, 500), id)
        .run();
      return 'fallido';
    }
    // Incierto: el saldo sigue descontado. Se reintenta con espera creciente o pasa a revisión.
    const revision = r.intentos >= MAX_INTENTOS_RETIRO;
    const espera = Math.min(60, 2 ** Math.min(r.intentos, 6));
    await db
      .prepare(
        `UPDATE retiros SET estado = ?, ultimo_error = ?, proximo_intento_en = datetime('now', ?), actualizado_en = datetime('now') WHERE id = ? AND estado = 'enviando'`,
      )
      .bind(revision ? 'revision' : 'reintentar', mensaje.slice(0, 500), `+${espera} minutes`, id)
      .run();
    if (revision) console.error('retiro: pasa a revisión de soporte', id, mensaje);
    return revision ? 'revision' : 'en_proceso';
  }
}

/** El reloj: procesa los retiros pendientes, por reintentar o atascados. */
export async function procesarRetirosPendientes(
  db: D1Database,
  stripe: Stripe,
  limite = 20,
): Promise<Record<ResultadoRetiro, number>> {
  const { results } = await db
    .prepare(
      `SELECT id FROM retiros
        WHERE proximo_intento_en <= datetime('now')
          AND (estado IN ('pendiente', 'reintentar')
               OR (estado = 'enviando' AND enviando_desde < datetime('now', '-${MINUTOS_ATASCADO} minutes')))
        ORDER BY creado_en LIMIT ?`,
    )
    .bind(limite)
    .all<{ id: string }>();
  const cuenta: Record<ResultadoRetiro, number> = {
    confirmado: 0,
    en_proceso: 0,
    fallido: 0,
    revision: 0,
    no_reclamado: 0,
  };
  for (const { id } of results) cuenta[await procesarRetiro(db, stripe, id)]++;
  return cuenta;
}

/**
 * Conciliación: (1) cada retiro en revisión se busca en Stripe y, si la transferencia existe, se
 * confirma; (2) las transferencias de retiros de los últimos 2 días en Stripe se cruzan con la base.
 * Lo que no cuadra queda en config «retiros_conciliacion» y la salud lo marca en rojo.
 */
export async function conciliarRetiros(
  db: D1Database,
  stripe: Stripe,
  ahora = new Date(),
): Promise<{ cuadra: boolean; detalle: string[] }> {
  const detalle: string[] = [];
  const { results: dudosos } = await db
    .prepare("SELECT id FROM retiros WHERE estado = 'revision' LIMIT 50")
    .all<{ id: string }>();
  for (const { id } of dudosos) {
    const t = await buscarEnStripe(stripe, id);
    if (t) await confirmar(db, id, t);
  }
  const desde = Math.floor(ahora.getTime() / 1000) - 2 * 86400;
  let despues: string | undefined;
  for (let pagina = 0; pagina < 10; pagina++) {
    const lista = await stripe.get<{
      data?: {
        id: string;
        amount: number;
        transfer_group?: string | null;
        metadata?: Record<string, string>;
      }[];
      has_more?: boolean;
    }>('/transfers', { 'created[gte]': desde, limit: 100, starting_after: despues });
    for (const t of lista.data ?? []) {
      const rid =
        t.metadata?.retiro_id ??
        (t.transfer_group?.startsWith('retiro:') ? t.transfer_group.slice(7) : null);
      if (!rid) continue;
      const f = await db
        .prepare('SELECT estado, monto_centavos, stripe_transferencia FROM retiros WHERE id = ?')
        .bind(rid)
        .first<{ estado: string; monto_centavos: number; stripe_transferencia: string | null }>();
      if (!f) detalle.push(`transferencia ${t.id} sin retiro en la base`);
      else if (
        f.estado !== 'confirmado' &&
        ['enviando', 'reintentar', 'revision'].includes(f.estado)
      )
        await confirmar(db, rid, t.id);
      else if (f.estado === 'fallido')
        detalle.push(`retiro ${rid} fallido pero Stripe transfirió ${t.id}`);
      else if (f.stripe_transferencia !== t.id)
        detalle.push(`retiro ${rid}: otra transferencia ${t.id}`);
      else if (f.monto_centavos !== t.amount) detalle.push(`retiro ${rid}: monto distinto`);
    }
    if (!lista.has_more || !lista.data?.length) break;
    despues = lista.data.at(-1)?.id;
  }
  const { results: enRevision } = await db
    .prepare("SELECT id FROM retiros WHERE estado = 'revision'")
    .all<{ id: string }>();
  for (const { id } of enRevision) detalle.push(`retiro ${id} sigue en revisión`);
  const cuadra = detalle.length === 0;
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('retiros_conciliacion', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify({ cuando: ahora.toISOString(), cuadra, detalle: detalle.slice(0, 50) }))
    .run();
  if (!cuadra) console.error('retiros: la conciliación no cuadra', detalle);
  return { cuadra, detalle };
}

/** Aviso de Stripe transfer.created / transfer.reversed (ya deduplicado por avisos_stripe). */
export async function avisoDeTransferencia(
  db: D1Database,
  tipo: string,
  obj: Record<string, unknown>,
): Promise<'confirmado' | 'alerta' | 'ignorado'> {
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const grupo = typeof obj.transfer_group === 'string' ? obj.transfer_group : '';
  const id = meta.retiro_id ?? (grupo.startsWith('retiro:') ? grupo.slice(7) : '');
  if (!id) return 'ignorado';
  const f = await db
    .prepare('SELECT estado FROM retiros WHERE id = ?')
    .bind(id)
    .first<{ estado: string }>();
  if (!f) return 'ignorado';
  if (tipo === 'transfer.reversed') {
    console.error('retiro: Stripe revirtió la transferencia', id, obj.id);
    return 'alerta';
  }
  if (f.estado === 'fallido') {
    // Devolvimos el saldo pero Stripe sí transfirió: lo revisa el equipo (posible doble pago).
    await db
      .prepare(
        "UPDATE retiros SET estado = 'revision', ultimo_error = ?, actualizado_en = datetime('now') WHERE id = ? AND estado = 'fallido'",
      )
      .bind(`Stripe avisó la transferencia ${String(obj.id)} de un retiro marcado fallido`, id)
      .run();
    console.error('retiro: fallido con transferencia real', id, obj.id);
    return 'alerta';
  }
  if (typeof obj.id === 'string') await confirmar(db, id, obj.id);
  return 'confirmado';
}

/** Disparadores que sostienen los retiros: si falta uno, la salud lo marca en rojo (prueba S1). */
export const DISPARADORES_RETIROS = [
  'retiros_descuenta_saldo',
  'retiros_fallido_devuelve',
  'retiros_transicion_valida',
] as const;

/** Pieza «retiros» de /datos/salud. */
export async function saludRetiros(
  env: Env,
  db: D1Database,
): Promise<'ok' | 'error' | 'pendiente' | 'atrasado'> {
  const d = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN (${DISPARADORES_RETIROS.map(() => '?').join(',')})`,
    )
    .bind(...DISPARADORES_RETIROS)
    .first<{ n: number }>();
  if (Number(d?.n ?? 0) !== DISPARADORES_RETIROS.length) return 'error';
  const conc = await db
    .prepare("SELECT valor FROM config WHERE clave = 'retiros_conciliacion'")
    .first<{ valor: string }>();
  if (conc && (JSON.parse(conc.valor) as { cuadra?: boolean }).cuadra === false) return 'error';
  const dudosos = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM retiros WHERE estado = 'revision' OR (estado IN ('reintentar', 'enviando') AND creado_en < datetime('now', '-1 hour'))",
    )
    .first<{ n: number }>();
  if (Number(dudosos?.n ?? 0) > 0) return 'atrasado';
  return (await retirosActivos(env, db)) ? 'ok' : 'pendiente';
}

/** Conciliación de retiros una vez al día (la llama el reloj en cada vuelta). */
export async function conciliarRetirosSiToca(db: D1Database, stripe: Stripe, ahora = new Date()) {
  const conc = await db
    .prepare("SELECT valor FROM config WHERE clave = 'retiros_conciliacion'")
    .first<{ valor: string }>();
  const ultima = conc ? Date.parse((JSON.parse(conc.valor) as { cuando: string }).cuando) : 0;
  if (ahora.getTime() - ultima < 20 * 3600 * 1000) return null;
  return conciliarRetiros(db, stripe, ahora);
}
