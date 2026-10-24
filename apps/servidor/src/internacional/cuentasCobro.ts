import type { Env } from '../env';
import { enviarCorreo } from '../correo';
import { ErrorDatos } from '../validar';

export const TIPOS_CUENTA = ['banco', 'nequi', 'daviplata', 'pago_movil', 'zelle', 'otro'] as const;
export type TipoCuenta = (typeof TIPOS_CUENTA)[number];
/** Una cuenta nueva o cambiada entra en vigor a las 24 h (protección contra el robo de la cuenta). */
export const HORAS_ESPERA_CUENTA = 24;

export type CuentaCobro = {
  id: string;
  tipo: TipoCuenta;
  banco: string;
  titular: string;
  identificador: string;
  verificacion: 'declarada' | 'confirmada';
  activa: boolean;
  activaDesde: string;
  vigente: boolean;
  creadoEn: string;
};

/** Muestra solo el final del número (para listas y correos). */
export function enmascarar(identificador: string): string {
  const limpio = identificador.trim();
  return limpio.length <= 4
    ? limpio
    : `${'•'.repeat(Math.max(2, limpio.length - 4))}${limpio.slice(-4)}`;
}

function aCuenta(r: Record<string, unknown>, ahora = new Date()): CuentaCobro {
  const activaDesde = String(r.activa_desde);
  const vigente =
    Number(r.activa) === 1 &&
    new Date(`${activaDesde.replace(' ', 'T')}Z`).getTime() <= ahora.getTime();
  return {
    id: String(r.id),
    tipo: String(r.tipo) as TipoCuenta,
    banco: String(r.banco ?? ''),
    titular: String(r.titular),
    identificador: String(r.identificador),
    verificacion: String(r.verificacion) as 'declarada' | 'confirmada',
    activa: Number(r.activa) === 1,
    activaDesde,
    vigente,
    creadoEn: String(r.creado_en),
  };
}

export async function cuentasDe(db: D1Database, usuarioId: string): Promise<CuentaCobro[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM cuentas_cobro WHERE usuario_id = ? ORDER BY activa DESC, creado_en DESC',
    )
    .bind(usuarioId)
    .all<Record<string, unknown>>();
  return results.map((r) => aCuenta(r));
}

/** La cuenta que el cliente ve para transferir: activa y ya en vigor, del país y moneda del pedido. */
export async function cuentaVigente(
  db: D1Database,
  usuarioId: string,
  pais: string,
  moneda: string,
) {
  const r = await db
    .prepare(
      "SELECT * FROM cuentas_cobro WHERE usuario_id = ? AND pais = ? AND moneda = ? AND activa = 1 AND activa_desde <= datetime('now') ORDER BY creado_en DESC LIMIT 1",
    )
    .bind(usuarioId, pais, moneda)
    .first<Record<string, unknown>>();
  return r ? aCuenta(r) : null;
}

/**
 * Alta de una cuenta de cobro. La ruta ya comprobó la contraseña. La cuenta anterior activa se
 * desactiva, la nueva entra en vigor a las 24 h (el equipo puede confirmarla antes), todo queda
 * en el historial y el repartidor recibe un correo (si no fue él, puede reaccionar).
 */
export async function crearCuentaCobro(
  env: Env,
  db: D1Database,
  p: {
    usuarioId: string;
    pais: string;
    moneda: string;
    tipo: TipoCuenta;
    banco: string;
    titular: string;
    identificador: string;
    autorId: string;
    correo: string;
    nombre: string;
    idioma: 'es' | 'en';
  },
): Promise<CuentaCobro> {
  const id = crypto.randomUUID();
  const { results: previas } = await db
    .prepare(
      'SELECT id FROM cuentas_cobro WHERE usuario_id = ? AND pais = ? AND moneda = ? AND activa = 1',
    )
    .bind(p.usuarioId, p.pais, p.moneda)
    .all<{ id: string }>();
  await db.batch([
    ...previas.map((c) =>
      db.prepare('UPDATE cuentas_cobro SET activa = 0 WHERE id = ?').bind(c.id),
    ),
    ...previas.map((c) =>
      db
        .prepare(
          'INSERT INTO cuentas_cobro_historial (id, cuenta_id, usuario_id, cambio, autor_id) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          crypto.randomUUID(),
          c.id,
          p.usuarioId,
          'desactivada por una cuenta nueva',
          p.autorId,
        ),
    ),
    db
      .prepare(
        `INSERT INTO cuentas_cobro (id, usuario_id, pais, moneda, tipo, banco, titular, identificador, activa, activa_desde)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now', ?))`,
      )
      .bind(
        id,
        p.usuarioId,
        p.pais,
        p.moneda,
        p.tipo,
        p.banco,
        p.titular,
        p.identificador,
        `+${HORAS_ESPERA_CUENTA} hours`,
      ),
    db
      .prepare(
        'INSERT INTO cuentas_cobro_historial (id, cuenta_id, usuario_id, cambio, autor_id) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        id,
        p.usuarioId,
        `alta ${p.tipo} ${enmascarar(p.identificador)} · ${p.titular}`,
        p.autorId,
      ),
  ]);
  const en = p.idioma === 'en';
  await enviarCorreo(env, {
    de: 'avisos',
    para: p.correo,
    asunto: en ? 'Your Divoox payout account was changed' : 'Cambió tu cuenta de cobro en Divoox',
    texto: en
      ? `Hi ${p.nombre},\n\nA new account for receiving customer transfers was added to your Divoox driver profile: ${p.tipo} ${p.banco} ${enmascarar(p.identificador)} (${p.titular}). It becomes active in ${HORAS_ESPERA_CUENTA} hours.\n\nIf it wasn’t you, reply to this email right now.`
      : `Hola, ${p.nombre}.\n\nSe agregó una cuenta nueva para recibir las transferencias de los clientes en tu perfil de repartidor de Divoox: ${p.tipo} ${p.banco} ${enmascarar(p.identificador)} (${p.titular}). Entra en vigor en ${HORAS_ESPERA_CUENTA} horas.\n\nSi no fuiste tú, responde este correo ahora mismo.`,
    responderA: 'support@divoox.com',
  }).catch((e: unknown) => console.error('cuenta de cobro: correo', e));
  const r = await db
    .prepare('SELECT * FROM cuentas_cobro WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  return aCuenta(r!);
}

export async function desactivarCuentaCobro(
  db: D1Database,
  p: { id: string; usuarioId: string; autorId: string },
) {
  const r = await db
    .prepare('UPDATE cuentas_cobro SET activa = 0 WHERE id = ? AND usuario_id = ? AND activa = 1')
    .bind(p.id, p.usuarioId)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa cuenta de cobro no existe.', undefined, 404);
  await db
    .prepare(
      'INSERT INTO cuentas_cobro_historial (id, cuenta_id, usuario_id, cambio, autor_id) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(crypto.randomUUID(), p.id, p.usuarioId, 'desactivada', p.autorId)
    .run();
}

/** El equipo revisó la cuenta (documento, llamada): entra en vigor ya y queda «confirmada». Nunca dice «verificada por el banco». */
export async function confirmarCuentaCobro(db: D1Database, p: { id: string; autorId: string }) {
  const r = await db
    .prepare(
      "UPDATE cuentas_cobro SET verificacion = 'confirmada', activa_desde = MIN(activa_desde, datetime('now')) WHERE id = ?",
    )
    .bind(p.id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa cuenta de cobro no existe.', undefined, 404);
  const c = (await db
    .prepare('SELECT usuario_id FROM cuentas_cobro WHERE id = ?')
    .bind(p.id)
    .first<{ usuario_id: string }>())!;
  await db
    .prepare(
      'INSERT INTO cuentas_cobro_historial (id, cuenta_id, usuario_id, cambio, autor_id) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(crypto.randomUUID(), p.id, c.usuario_id, 'confirmada por el equipo', p.autorId)
    .run();
}

export async function historialCuentas(db: D1Database, usuarioId: string) {
  const { results } = await db
    .prepare(
      'SELECT cuenta_id, cambio, autor_id, creado_en FROM cuentas_cobro_historial WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 50',
    )
    .bind(usuarioId)
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    cuentaId: String(r.cuenta_id),
    cambio: String(r.cambio),
    autorId: r.autor_id ? String(r.autor_id) : null,
    creadoEn: String(r.creado_en),
  }));
}
