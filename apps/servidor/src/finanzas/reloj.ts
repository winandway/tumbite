import { correosEquipo } from '../avisosEquipo';
import type { Env } from '../env';
import { enviarCorreo } from '../correo';
import { crearStripe } from '../stripe';
import {
  TEXTOS_FINANZAS,
  acreditarRecargaEmpresa,
  avisarFinanzas,
  crearRecargaEmpresa,
  leerConfigRecargas,
  recargaCancelada,
  saldoEmpresa,
} from './billetera';
import { recuperarCobrosHuerfanos } from './cobrosRuta';

/**
 * Divoox · Fase 4: lo que hace el reloj EXISTENTE con el dinero de Flex (C-FIN-CONCILIACION).
 * - Recupera recargas pendientes preguntándole a Stripe (si un aviso se perdió, el dinero llega igual).
 * - Libera o cierra reservas de rutas que ya no están activas (si una petición se cortó a medias).
 * - Comprueba las invariantes del libro y deja el resultado para la salud.
 * - Recarga automática (opcional, por empresa) y alertas de saldo bajo.
 */

type Problema = { tipo: string; detalle: string };

export async function conciliarFinanzas(env: Env, db: D1Database) {
  const problemas: Problema[] = [];
  let recuperadas = 0;
  // 1) Recargas pendientes de más de 10 minutos: se le pregunta a Stripe.
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  const { results: pendientes } = await db
    .prepare(
      `SELECT id, stripe_pi, creado_en FROM recargas_empresa WHERE estado = 'pendiente'
         AND creado_en < datetime('now', '-10 minutes') ORDER BY creado_en LIMIT 20`,
    )
    .all<{ id: string; stripe_pi: string | null; creado_en: string }>();
  for (const r of pendientes) {
    if (!r.stripe_pi) {
      // El pago nunca llegó a abrirse en Stripe.
      await db
        .prepare(
          "UPDATE recargas_empresa SET estado = 'fallida', motivo = 'sin intento de pago', actualizado_en = datetime('now') WHERE id = ? AND estado = 'pendiente' AND creado_en < datetime('now', '-1 hours')",
        )
        .bind(r.id)
        .run();
      continue;
    }
    if (!stripe) continue;
    const pi = await stripe
      .get<Record<string, unknown>>(`/payment_intents/${r.stripe_pi}`)
      .catch(() => null);
    if (!pi) continue;
    if (pi.status === 'succeeded') {
      if (await acreditarRecargaEmpresa(env, db, pi)) recuperadas++;
    } else if (pi.status === 'canceled') await recargaCancelada(db, pi);
    else if (
      (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation') &&
      r.creado_en <
        new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 19).replace('T', ' ')
    ) {
      // Abandonada un día entero: se cancela en Stripe y aquí (nunca se acreditó nada).
      await stripe
        .post(`/payment_intents/${r.stripe_pi}/cancel`, {}, `cancelar-recarga-${r.id}`)
        .then(() => recargaCancelada(db, pi))
        .catch((e: unknown) => console.error('finanzas: cancelar recarga abandonada', e));
    }
  }
  // 2) Reservas huérfanas (rutas que ya no están activas).
  const huerfanas = await recuperarCobrosHuerfanos(db);
  // 3) Invariantes del libro.
  const negativos = await db
    .prepare(
      `SELECT cuenta_id, bolsillo, SUM(monto) AS s FROM libro WHERE cuenta_id LIKE 'empresa:%'
         AND bolsillo IN ('prepago', 'reservado', 'deuda_cliente') GROUP BY cuenta_id, bolsillo, pais, moneda HAVING s < 0`,
    )
    .all<{ cuenta_id: string; bolsillo: string; s: number }>();
  for (const n of negativos.results)
    problemas.push({ tipo: 'saldo_negativo', detalle: `${n.cuenta_id} ${n.bolsillo} ${n.s}` });
  const sinAcreditar = await db
    .prepare(
      `SELECT r.id FROM recargas_empresa r WHERE r.estado = 'acreditada'
         AND NOT EXISTS (SELECT 1 FROM libro l WHERE l.referencia IN ('recarga_empresa:' || r.id || ':prepago', 'recarga_empresa:' || r.id || ':deuda'))`,
    )
    .all<{ id: string }>();
  for (const x of sinAcreditar.results)
    problemas.push({ tipo: 'recarga_sin_movimiento', detalle: x.id });
  const sinRecarga = await db
    .prepare(
      `SELECT l.referencia FROM libro l WHERE l.referencia LIKE 'recarga_empresa:%'
         AND NOT EXISTS (SELECT 1 FROM recargas_empresa r WHERE r.estado = 'acreditada'
           AND l.referencia IN ('recarga_empresa:' || r.id || ':prepago', 'recarga_empresa:' || r.id || ':deuda'))`,
    )
    .all<{ referencia: string }>();
  for (const x of sinRecarga.results)
    problemas.push({ tipo: 'movimiento_sin_recarga', detalle: x.referencia });
  const cruce = await db
    .prepare(
      `SELECT
         (SELECT COALESCE(-SUM(monto), 0) FROM libro WHERE bolsillo = 'reservado' AND referencia LIKE 'comision_flex_paquete:%:reservado') AS empresas,
         (SELECT COALESCE(SUM(monto), 0) FROM libro WHERE bolsillo = 'comisiones' AND referencia LIKE 'comision_flex_paquete:%:divoox') AS divoox`,
    )
    .first<{ empresas: number; divoox: number }>();
  if (Number(cruce?.empresas) !== Number(cruce?.divoox))
    problemas.push({
      tipo: 'comisiones_descuadradas',
      detalle: `empresas ${cruce?.empresas} · divoox ${cruce?.divoox}`,
    });
  const resultado = {
    cuando: new Date().toISOString(),
    ok: problemas.length === 0,
    problemas: problemas.slice(0, 50),
    recargasRecuperadas: recuperadas,
    reservasRecuperadas: huerfanas,
  };
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('fin_conciliacion', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(resultado))
    .run();
  if (!resultado.ok)
    for (const para of await correosEquipo(env, 'dinero'))
      await enviarCorreo(env, {
        de: 'avisos',
        para,
        asunto: 'Revisar billeteras de Flex: la conciliación encontró diferencias',
        texto: problemas.map((p) => `${p.tipo}: ${p.detalle}`).join('\n'),
      }).catch((e: unknown) => console.error('finanzas: correo de conciliación', e));
  return resultado;
}

export async function ultimaConciliacion(db: D1Database) {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'fin_conciliacion'")
    .first<{ valor: string }>();
  return f ? (JSON.parse(f.valor) as Awaited<ReturnType<typeof conciliarFinanzas>>) : null;
}

/** Pieza «billeteras» de la salud: error si la última conciliación encontró diferencias. */
export async function saludBilleteras(db: D1Database): Promise<'ok' | 'error' | 'pendiente'> {
  const u = await ultimaConciliacion(db);
  if (!u) return 'pendiente';
  return u.ok ? 'ok' : 'error';
}

/** Recarga automática: empresas con la opción encendida y el disponible por debajo del umbral. */
export async function recargasAutomaticas(env: Env, db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT f.empresa_id, f.recarga_auto_umbral, f.recarga_auto_monto, f.stripe_metodo, e.pais, e.moneda
         FROM empresa_finanzas f JOIN empresas e ON e.id = f.empresa_id
        WHERE f.recarga_auto_activa = 1 AND f.stripe_metodo IS NOT NULL AND e.estado = 'activa' LIMIT 50`,
    )
    .all<{
      empresa_id: string;
      recarga_auto_umbral: number;
      recarga_auto_monto: number;
      stripe_metodo: string;
      pais: string;
      moneda: string;
    }>();
  let creadas = 0;
  for (const f of results) {
    if (!(await leerConfigRecargas(db, f.pais)).automaticaPermitida) continue;
    const s = await saldoEmpresa(db, { id: f.empresa_id, pais: f.pais, moneda: f.moneda });
    if (s.disponible >= f.recarga_auto_umbral) continue;
    // Una sola automática abierta a la vez y como mucho una por hora.
    const reciente = await db
      .prepare(
        `SELECT 1 FROM recargas_empresa WHERE empresa_id = ? AND automatica = 1
           AND (estado = 'pendiente' OR creado_en > datetime('now', '-1 hours'))`,
      )
      .bind(f.empresa_id)
      .first();
    if (reciente) continue;
    const hora = new Date().toISOString().slice(0, 13);
    await crearRecargaEmpresa(env, db, {
      empresaId: f.empresa_id,
      actorId: null,
      monto: f.recarga_auto_monto,
      idempotencia: `auto:${hora}`,
      guardarMetodo: false,
      automatica: { metodo: f.stripe_metodo },
    })
      .then(() => creadas++)
      .catch(async (e: unknown) => {
        console.error('finanzas: recarga automática', e);
        await avisarFinanzas(
          env,
          db,
          f.empresa_id,
          `auto_error:${hora}`,
          TEXTOS_FINANZAS.recargaAutomaticaFallida,
        );
      });
  }
  return { creadas };
}

/** Alerta de saldo bajo (aviso al celular y correo), como mucho una vez al día por empresa. */
export async function alertasSaldo(env: Env, db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT f.empresa_id, f.alerta_saldo, f.avisos_correo, e.pais, e.moneda, e.nombre FROM empresa_finanzas f
         JOIN empresas e ON e.id = f.empresa_id
        WHERE f.alerta_saldo IS NOT NULL AND (f.alerta_enviada_en IS NULL OR f.alerta_enviada_en < datetime('now', '-1 days'))
        LIMIT 100`,
    )
    .all<{
      empresa_id: string;
      alerta_saldo: number;
      avisos_correo: number;
      pais: string;
      moneda: string;
      nombre: string;
    }>();
  let enviadas = 0;
  for (const f of results) {
    const s = await saldoEmpresa(db, { id: f.empresa_id, pais: f.pais, moneda: f.moneda });
    if (s.disponible >= f.alerta_saldo) continue;
    const dia = new Date().toISOString().slice(0, 10);
    await avisarFinanzas(env, db, f.empresa_id, `saldo_bajo:${dia}`, TEXTOS_FINANZAS.saldoBajo);
    if (f.avisos_correo) {
      const { results: personas } = await db
        .prepare(
          `SELECT u.correo, u.idioma FROM empresa_miembros m JOIN usuarios u ON u.id = m.usuario_id
            WHERE m.empresa_id = ? AND m.estado = 'activo' AND m.rol IN ('dueno', 'finanzas')`,
        )
        .bind(f.empresa_id)
        .all<{ correo: string; idioma: string }>();
      for (const p of personas) {
        const t = TEXTOS_FINANZAS.saldoBajo(p.idioma);
        await enviarCorreo(env, {
          de: 'avisos',
          para: p.correo,
          asunto: t.titulo,
          texto: t.cuerpo,
        }).catch((e: unknown) => console.error('finanzas: correo de saldo bajo', e));
      }
    }
    await db
      .prepare(
        "UPDATE empresa_finanzas SET alerta_enviada_en = datetime('now') WHERE empresa_id = ?",
      )
      .bind(f.empresa_id)
      .run();
    enviadas++;
  }
  return { enviadas };
}

/** Las tareas de dinero de Flex para el reloj existente. */
export const TAREAS_FINANZAS = [
  {
    nombre: 'fin_conciliacion',
    critica: true,
    correr: (env: Env, db: D1Database) => conciliarFinanzas(env, db),
  },
  {
    nombre: 'fin_recarga_automatica',
    critica: false,
    correr: (env: Env, db: D1Database) => recargasAutomaticas(env, db),
  },
  {
    nombre: 'fin_alertas_saldo',
    critica: false,
    correr: (env: Env, db: D1Database) => alertasSaldo(env, db),
  },
] as const;
