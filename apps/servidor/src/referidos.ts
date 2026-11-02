import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './env';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';
import { limiteIntentos } from './seguridad';
import { nuevoId } from './cripto';
import { rutaSuperadmin } from './superadmin';

/**
 * C-REFERIDOS (CLI-7, 2 nov 2026, como «Invita a un amigo» de DoorDash y Uber Eats): cada cliente
 * tiene un código personal para compartir. El amigo lo escribe antes de su primer pedido y recibe
 * su crédito al momento (se usa como saldo de regalo en el carrito); quien invitó recibe el suyo
 * cuando ese primer pedido se entrega. Una vez por amigo, nunca a uno mismo.
 *
 * Arranca APAGADO y con los montos en cero: el dinero lo fija Richard (es un descuento que paga
 * Divoox). No se enciende con montos en cero. Todos los países (el crédito va en la moneda del
 * saldo de regalo, en centavos).
 */
export const referidos = new Hono<{ Bindings: Env; Variables: Variables }>();

export type AjustesReferidos = {
  activos: boolean;
  /** Crédito para el amigo invitado, en centavos. */
  paraAmigo: number;
  /** Crédito para quien invitó, cuando el primer pedido del amigo se entrega. */
  paraQuienInvita: number;
};
export const REFERIDOS_INICIAL: AjustesReferidos = {
  activos: false,
  paraAmigo: 0,
  paraQuienInvita: 0,
};

export async function leerReferidos(db: D1Database): Promise<AjustesReferidos> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'referidos'")
    .first<{ valor: string }>();
  if (!f) return REFERIDOS_INICIAL;
  try {
    return { ...REFERIDOS_INICIAL, ...(JSON.parse(f.valor) as Partial<AjustesReferidos>) };
  } catch (e) {
    console.error('referidos: ajustes ilegibles, quedan apagados', e);
    return REFERIDOS_INICIAL;
  }
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codigoNuevo(nombre: string): string {
  const base = (
    nombre
      .normalize('NFD')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase() || 'DIVOOX'
  ).slice(0, 6);
  const azar = Array.from(
    crypto.getRandomValues(new Uint8Array(4)),
    (b) => LETRAS[b % LETRAS.length],
  ).join('');
  return `${base}${azar}`;
}

/** El código personal de la persona; se crea la primera vez que lo pide. */
export async function miCodigo(db: D1Database, usuarioId: string, nombre: string): Promise<string> {
  const f = await db
    .prepare('SELECT codigo FROM codigos_referido WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ codigo: string }>();
  if (f) return f.codigo;
  for (let i = 0; i < 5; i++) {
    const codigo = codigoNuevo(nombre);
    const r = await db
      .prepare('INSERT OR IGNORE INTO codigos_referido (usuario_id, codigo) VALUES (?, ?)')
      .bind(usuarioId, codigo)
      .run();
    if (r.meta.changes) return codigo;
    const otra = await db
      .prepare('SELECT codigo FROM codigos_referido WHERE usuario_id = ?')
      .bind(usuarioId)
      .first<{ codigo: string }>();
    if (otra) return otra.codigo;
  }
  throw new ErrorDatos('No pudimos crear tu código. Intenta de nuevo.', undefined, 503);
}

referidos.get('/referidos', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const a = await leerReferidos(db);
  const { results } = await db
    .prepare('SELECT estado FROM referidos WHERE invitador_id = ?')
    .bind(u.id)
    .all<{ estado: string }>();
  const usado = await db
    .prepare('SELECT 1 FROM referidos WHERE invitado_id = ?')
    .bind(u.id)
    .first();
  return c.json({
    activos: a.activos,
    paraAmigo: a.paraAmigo,
    paraQuienInvita: a.paraQuienInvita,
    codigo: a.activos ? await miCodigo(db, u.id, u.nombre) : null,
    invitados: results.length,
    premiados: results.filter((r) => r.estado === 'premiado').length,
    yaUsoUnCodigo: Boolean(usado),
  });
});

/** El amigo escribe el código antes de su primer pedido: recibe su crédito al momento. */
referidos.post('/referidos/canjear', limiteIntentos(10, 60_000), async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(c, z.object({ codigo: z.string().trim().min(4).max(20) }));
  const db = base(c);
  const a = await leerReferidos(db);
  if (!a.activos) throw new ErrorDatos('Las invitaciones no están activas.', undefined, 409);
  const dueno = await db
    .prepare('SELECT usuario_id FROM codigos_referido WHERE codigo = ?')
    .bind(d.codigo.toUpperCase())
    .first<{ usuario_id: string }>();
  if (!dueno) throw new ErrorDatos('Ese código no existe.', 'codigo', 404);
  if (dueno.usuario_id === u.id)
    throw new ErrorDatos('No puedes usar tu propio código.', 'codigo', 409);
  const yaPidio = await db
    .prepare("SELECT 1 FROM pedidos WHERE cliente_id = ? AND estado <> 'cancelado' LIMIT 1")
    .bind(u.id)
    .first();
  if (yaPidio) throw new ErrorDatos('El código es solo para tu primer pedido.', 'codigo', 409);
  const id = nuevoId();
  const r = await db
    .prepare(
      "INSERT OR IGNORE INTO referidos (id, invitado_id, invitador_id, estado, para_amigo, para_quien_invita) VALUES (?, ?, ?, 'pendiente', ?, ?)",
    )
    .bind(id, u.id, dueno.usuario_id, a.paraAmigo, a.paraQuienInvita)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ya usaste un código de invitación.', 'codigo', 409);
  if (a.paraAmigo > 0)
    await db
      .prepare(
        "INSERT OR IGNORE INTO creditos_regalo (id, usuario_id, centavos, motivo, referencia) VALUES (?, ?, ?, 'referido_amigo', ?)",
      )
      .bind(nuevoId(), u.id, a.paraAmigo, `referido-amigo:${id}`)
      .run();
  return c.json({ ok: true, credito: a.paraAmigo }, 201);
});

/**
 * Al entregarse un pedido: si es el primero de un amigo invitado, quien invitó recibe su crédito.
 * Una sola vez (la referencia del crédito es única y el estado pasa a «premiado»).
 */
export async function premiarReferido(db: D1Database, clienteId: string): Promise<boolean> {
  const r = await db
    .prepare(
      "UPDATE referidos SET estado = 'premiado', premiado_en = datetime('now') WHERE invitado_id = ? AND estado = 'pendiente' RETURNING id, invitador_id, para_quien_invita",
    )
    .bind(clienteId)
    .first<{ id: string; invitador_id: string; para_quien_invita: number }>();
  if (!r) return false;
  if (Number(r.para_quien_invita) > 0)
    await db
      .prepare(
        "INSERT OR IGNORE INTO creditos_regalo (id, usuario_id, centavos, motivo, referencia) VALUES (?, ?, ?, 'referido_invita', ?)",
      )
      .bind(nuevoId(), r.invitador_id, Number(r.para_quien_invita), `referido-invita:${r.id}`)
      .run();
  return true;
}

const esquemaAjustes = z
  .object({
    activos: z.boolean(),
    paraAmigo: z.number().int().min(0).max(10_000),
    paraQuienInvita: z.number().int().min(0).max(10_000),
  })
  .refine((a) => !a.activos || a.paraAmigo > 0 || a.paraQuienInvita > 0, {
    message: 'Para encender las invitaciones, fija al menos un monto.',
    path: ['paraAmigo'],
  });

rutaSuperadmin(referidos, 'get', '/admin/referidos', async (c) => {
  const db = base(c);
  const totales = await db
    .prepare("SELECT COUNT(*) AS invitados, SUM(estado = 'premiado') AS premiados FROM referidos")
    .first<{ invitados: number; premiados: number | null }>();
  return c.json({
    ...(await leerReferidos(db)),
    invitados: Number(totales?.invitados ?? 0),
    premiados: Number(totales?.premiados ?? 0),
  });
});

rutaSuperadmin(referidos, 'put', '/admin/referidos', async (c) => {
  const d = await leerCuerpo(c, esquemaAjustes);
  const db = base(c);
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('referidos', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
    )
    .bind(JSON.stringify(d))
    .run();
  return c.json(d);
});
