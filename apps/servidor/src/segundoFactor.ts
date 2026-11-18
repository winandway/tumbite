import { Hono } from 'hono';
import { z } from 'zod';
import { CONFIG_PERMISOS, PERMISOS_DELICADOS } from '@tumbite/compartido';
import type { Env } from './env';
import { type AccesoEnSesion, exigirPermiso } from './accesoInterno';
import { enviarCorreo } from './correo';
import { sha256 } from './cripto';
import { entornoDe } from './entorno';
import { limiteIntentos } from './seguridad';
import { type Ctx, type Variables, base, exigir, SESION_TERMINADA } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';

/**
 * C-SEGUNDO-FACTOR-EQUIPO (MON-5, 15 nov 2026) — todos los países. Segundo factor para los permisos
 * delicados del equipo (fotos, datos personales, dinero, gestionar el equipo): un código de 6 cifras
 * por correo, de un solo uso, que vale `horasSegundoFactor` en esa sesión. Como Stripe con su rol de
 * transferencias [DOC].
 *
 * APAGADO de fábrica (decisión 4 de Richard, pendiente). Lo enciende una cuenta con
 * `equipo.gestionar` (config `equipo_segundo_factor`). Nunca toca el inicio de sesión de las apps
 * ni a los revisores de Apple y Google: solo mira cuentas del equipo (rol admin) y solo al usar un
 * permiso delicado. El dueño (`ADMIN_CORREOS`) no lo necesita: es la cuenta «rompe-cristales» y no
 * puede quedar fuera si el correo falla.
 */
export const CLAVE_SEGUNDO_FACTOR = 'equipo_segundo_factor';
const ESPERA_CACHE_MS = 60_000;
let cache: { activo: boolean; leido: number } | null = null;

/** Solo para pruebas. */
export function olvidarSegundoFactor() {
  cache = null;
}

export async function segundoFactorActivo(db: D1Database): Promise<boolean> {
  if (cache && Date.now() - cache.leido < ESPERA_CACHE_MS) return cache.activo;
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_SEGUNDO_FACTOR)
    .first<{ valor: string }>();
  let activo: boolean = CONFIG_PERMISOS.segundoFactorInicial;
  if (f)
    try {
      activo = z.object({ activo: z.boolean() }).parse(JSON.parse(f.valor)).activo;
    } catch (e) {
      // Un valor dañado deja el escudo ENCENDIDO (lo seguro) y queda en el registro.
      console.error('segundo factor: config dañada, queda encendido', e);
      activo = true;
    }
  cache = { activo, leido: Date.now() };
  return activo;
}

/** ¿La sesión confirmó el código hace menos de `horasSegundoFactor`? */
export function segundoFactorVigente(en: string | null | undefined): boolean {
  if (!en) return false;
  const desde = Date.parse(`${en.replace(' ', 'T')}Z`);
  return Date.now() - desde < CONFIG_PERMISOS.horasSegundoFactor * 3_600_000;
}

export async function exigirSegundoFactor(c: Ctx, acceso: AccesoEnSesion) {
  if (acceso.dueno || !c.env.DB) return;
  if (!(await segundoFactorActivo(c.env.DB))) return;
  if (segundoFactorVigente(c.get('usuario')?.segundoFactorEn)) return;
  throw new ErrorDatos(
    'Para esto hace falta confirmar con el código que te mandamos por correo.',
    'segundo_factor',
    403,
  );
}

const enLocalOPruebas = (c: Ctx) => {
  const e = entornoDe(c.req.url);
  return e === 'local' || e === 'pruebas';
};

export const segundoFactor = new Hono<{ Bindings: Env; Variables: Variables }>();

segundoFactor.post('/equipo-interno/segundo-factor/pedir', limiteIntentos(5, 60_000), async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  if (!u.sesionId) throw new ErrorDatos(SESION_TERMINADA, undefined, 401);
  const codigo = String(100_000 + ((crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 900_000));
  await db
    .prepare(
      `INSERT INTO segundo_factor_codigos (sesion_id, codigo_hash, expira_en, intentos)
       VALUES (?, ?, datetime('now', ?), 0)
       ON CONFLICT(sesion_id) DO UPDATE SET codigo_hash = excluded.codigo_hash, expira_en = excluded.expira_en, intentos = 0`,
    )
    .bind(
      u.sesionId,
      await sha256(codigo),
      `+${CONFIG_PERMISOS.minutosCodigoSegundoFactor} minutes`,
    )
    .run();
  const en = u.idioma === 'es' ? false : true;
  const envio = await enviarCorreo(c.env, {
    de: 'avisos',
    para: u.correo,
    idioma: u.idioma === 'es' ? 'es' : 'en',
    asunto: en ? `Your Divoox team code: ${codigo}` : `Tu código del equipo de Divoox: ${codigo}`,
    texto: en
      ? `Hi ${u.nombre.split(' ')[0] ?? ''},\n\nYour code to confirm it’s you in the Divoox team panel is ${codigo}. It works once and expires in ${CONFIG_PERMISOS.minutosCodigoSegundoFactor} minutes.\n\nIf you didn’t ask for it, tell the team right away.`
      : `Hola, ${u.nombre.split(' ')[0] ?? ''}.\n\nTu código para confirmar que eres tú en el panel del equipo de Divoox es ${codigo}. Sirve una vez y vence en ${CONFIG_PERMISOS.minutosCodigoSegundoFactor} minutos.\n\nSi no lo pediste, avísale al equipo enseguida.`,
  });
  if (!envio.ok && !enLocalOPruebas(c))
    throw new ErrorDatos(
      'No pudimos mandar el código. Intenta de nuevo en un minuto.',
      undefined,
      503,
    );
  // En local y en el sitio de pruebas el código vuelve en la respuesta (los correos de prueba no salen).
  return c.json({ ok: true, ...(enLocalOPruebas(c) ? { codigoPrueba: codigo } : {}) });
});

segundoFactor.post(
  '/equipo-interno/segundo-factor/verificar',
  limiteIntentos(10, 60_000),
  async (c) => {
    const u = exigir(c, 'admin');
    const db = base(c);
    const { codigo } = await leerCuerpo(
      c,
      z.object({
        codigo: z
          .string()
          .trim()
          .regex(/^\d{6}$/, { error: 'Escribe los 6 números del código.' }),
      }),
    );
    if (!u.sesionId) throw new ErrorDatos(SESION_TERMINADA, undefined, 401);
    const f = await db
      .prepare(
        "SELECT codigo_hash, intentos, expira_en > datetime('now') AS vigente FROM segundo_factor_codigos WHERE sesion_id = ?",
      )
      .bind(u.sesionId)
      .first<{ codigo_hash: string; intentos: number; vigente: number }>();
    if (!f || !f.vigente || f.intentos >= 5)
      throw new ErrorDatos('Ese código ya no sirve. Pide uno nuevo.', 'codigo', 410);
    if (f.codigo_hash !== (await sha256(codigo))) {
      await db
        .prepare('UPDATE segundo_factor_codigos SET intentos = intentos + 1 WHERE sesion_id = ?')
        .bind(u.sesionId)
        .run();
      throw new ErrorDatos('El código no coincide.', 'codigo', 403);
    }
    await db.batch([
      db
        .prepare("UPDATE sesiones SET segundo_factor_en = datetime('now') WHERE id = ?")
        .bind(u.sesionId),
      db.prepare('DELETE FROM segundo_factor_codigos WHERE sesion_id = ?').bind(u.sesionId),
    ]);
    return c.json({ ok: true, horas: CONFIG_PERMISOS.horasSegundoFactor });
  },
);

/** El interruptor (Equipo interno → Ajustes). Cambiarlo queda en la auditoría. */
segundoFactor.get('/admin/equipo/ajustes/segundo-factor', async (c) => {
  exigir(c, 'admin');
  return c.json({
    activo: await segundoFactorActivo(base(c)),
    permisos: PERMISOS_DELICADOS,
    horas: CONFIG_PERMISOS.horasSegundoFactor,
  });
});

segundoFactor.put('/admin/equipo/ajustes/segundo-factor', async (c) => {
  const u = exigir(c, 'admin');
  exigirPermiso(c, 'equipo.gestionar');
  const db = base(c);
  const { activo } = await leerCuerpo(c, z.object({ activo: z.boolean() }));
  const antes = await segundoFactorActivo(db);
  await db.batch([
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(CLAVE_SEGUNDO_FACTOR, JSON.stringify({ activo })),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        u.id,
        'equipo.segundo_factor',
        'equipo:ajustes',
        JSON.stringify({ activo: antes }),
        JSON.stringify({ activo }),
      ),
  ]);
  cache = { activo, leido: Date.now() };
  return c.json({ ok: true, activo });
});
