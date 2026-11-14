import { Hono } from 'hono';
import { CIUDAD_PRUEBAS_EL_VIGIA, VERSION_TERMINOS } from '@tumbite/compartido';
import { hashClave, nuevoToken, sha256 } from '../cripto';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * Comida · Venezuela — C-COMIDA-VE-PUNTA-A-PUNTA (13 nov 2026). El guion
 * scripts/staging/probar-comida-venezuela.mjs hace el pedido de comida en El Vigía por la API, como
 * las apps y el panel. Estas rutas solo existen en el sitio de pruebas o en local, con el secreto
 * del reloj, y hacen solo lo que una persona no hace con la app: pases de sesión de 30 minutos para
 * cuentas FIJAS que se reutilizan en cada vuelta (cliente, restaurante, repartidor con saldo,
 * repartidor sin saldo y equipo). El saldo, los pedidos y el libro no se borran nunca: borrar dinero
 * a mano descuadra la conciliación.
 */
export const COMIDA_VE = {
  cliente: 'zz-cmve-c',
  restaurante: 'zz-cmve-r',
  repartidor: 'zz-cmve-k',
  sinSaldo: 'zz-cmve-s',
  equipo: 'zz-cmve-a',
} as const;

const HOSTS_PRUEBAS = new Set([
  'staging.tumbite.com',
  'tumbite-pruebas.sitios.dev',
  'localhost',
  '127.0.0.1',
]);

async function iguales(a: string, b: string): Promise<boolean> {
  const h = async (x: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)));
  const [ha, hb] = await Promise.all([h(a), h(b)]);
  return a.length === b.length && ha.every((v, i) => v === hb.at(i));
}

export const pruebasComidaVe = new Hono<{ Bindings: Env; Variables: Variables }>();

pruebasComidaVe.use('/interno/pruebas/comida-ve/*', async (c, next) => {
  const secreto = c.env.RELOJ_SECRETO;
  if (
    !HOSTS_PRUEBAS.has(new URL(c.req.url).hostname) ||
    !secreto ||
    !(await iguales(c.req.header('x-reloj-secreto') ?? '', secreto))
  )
    throw new ErrorDatos('No encontrado.', undefined, 404);
  await next();
});

pruebasComidaVe.post('/interno/pruebas/comida-ve/armar', async (c) => {
  const db = base(c);
  const { cliente, restaurante, repartidor, sinSaldo, equipo } = COMIDA_VE;
  const clave = `Cv-${nuevoToken().slice(0, 16)}-9`;
  const hash = await hashClave(clave);
  const ids = [cliente, restaurante, repartidor, sinSaldo, equipo];
  const tokens = ids.map(() => nuevoToken());
  const huellas = await Promise.all(tokens.map((t) => sha256(t)));
  const usuario = (id: string, rol: string, nombre: string) =>
    db
      .prepare(
        `INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, correo_confirmado_en)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET clave_hash = excluded.clave_hash`,
      )
      .bind(id, `${id}@prueba.invalid`, nombre, rol, hash);
  const ficha = (id: string) =>
    db
      .prepare(
        `INSERT INTO repartidores (usuario_id, conectado, zona_id) VALUES (?, 0, ?)
         ON CONFLICT(usuario_id) DO NOTHING`,
      )
      .bind(id, CIUDAD_PRUEBAS_EL_VIGIA.id);
  await db.batch([
    usuario(equipo, 'admin', 'Soporte de pruebas'),
    usuario(cliente, 'cliente', 'Cliente de prueba'),
    usuario(restaurante, 'restaurante', 'Restaurante de prueba'),
    usuario(repartidor, 'repartidor', 'Repartidor de prueba'),
    usuario(sinSaldo, 'repartidor', 'Repartidor sin saldo de prueba'),
    db.prepare('DELETE FROM sesiones WHERE usuario_id IN (?, ?, ?, ?, ?)').bind(...ids),
    ...ids.map((id, i) =>
      db
        .prepare(
          "INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+30 minutes'))",
        )
        .bind(huellas.at(i) ?? '', id),
    ),
  ]);
  // Las fichas de repartidor van después de crear las cuentas (llave foránea).
  // Lo que la app pide con la cámara y no tiene sentido en un guion: la foto de control del día.
  const selfie = (id: string) => [
    db
      .prepare(
        "UPDATE selfies_control SET tomada_en = datetime('now'), resultado = 'ok' WHERE usuario_id = ? AND tomada_en IS NULL",
      )
      .bind(id),
    db
      .prepare(
        "INSERT OR REPLACE INTO selfies_control (id, usuario_id, tomada_en, resultado) VALUES (?, ?, datetime('now'), 'ok')",
      )
      .bind(`zz-cmve-sc-${id}`, id),
  ];
  await db.batch([ficha(repartidor), ficha(sinSaldo), ...selfie(repartidor), ...selfie(sinSaldo)]);
  return c.json({
    ids: COMIDA_VE,
    clave,
    versionTerminos: VERSION_TERMINOS,
    tokens: {
      cliente: tokens.at(0),
      restaurante: tokens.at(1),
      repartidor: tokens.at(2),
      sinSaldo: tokens.at(3),
      equipo: tokens.at(4),
    },
  });
});

/** Al terminar: nadie conectado ni con sesión (los pedidos, el saldo y el libro se quedan). */
pruebasComidaVe.post('/interno/pruebas/comida-ve/limpiar', async (c) => {
  const db = base(c);
  const { cliente, restaurante, repartidor, sinSaldo, equipo } = COMIDA_VE;
  await db.batch([
    db
      .prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id IN (?, ?)')
      .bind(repartidor, sinSaldo),
    db
      .prepare('DELETE FROM sesiones WHERE usuario_id IN (?, ?, ?, ?, ?)')
      .bind(cliente, restaurante, repartidor, sinSaldo, equipo),
  ]);
  return c.json({ ok: true });
});
