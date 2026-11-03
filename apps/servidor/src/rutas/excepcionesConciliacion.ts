import { Hono } from 'hono';
import { z } from 'zod';
import { diasSinCuadrar } from '../conciliacion';
import { verificarClave } from '../cripto';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { perfilDe } from './equipo';

/**
 * C-DINERO-30-DIAS (NXT-1, 3 nov 2026): la bandeja de los días que no cuadraron en los últimos 30.
 * Un día se excusa SOLO con motivo, por una cuenta con perfil Total o Finanzas y con su contraseña.
 * La excepción vive en su propia tabla (`conciliacion_excepciones`, nunca se borra) con quién y
 * cuándo; la fila de `conciliaciones` no se toca jamás. Cada excusa queda además en
 * `acciones_equipo` (lo anota el middleware de permisos internos).
 */
export const excepcionesConciliacion = new Hono<{ Bindings: Env; Variables: Variables }>();

const PERFILES_EXCUSAN = new Set(['total', 'finanzas']);

excepcionesConciliacion.get('/admin/conciliacion/excepciones', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const perfil = await perfilDe(db, u.id);
  return c.json({
    sinCuadrar: await diasSinCuadrar(db),
    puedoExcusar: PERFILES_EXCUSAN.has(perfil),
  });
});

excepcionesConciliacion.post('/admin/conciliacion/excepciones', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const { dia, motivo, clave } = await leerCuerpo(
    c,
    z.object({
      dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      motivo: z.string().trim().min(10, 'Escribe el motivo (al menos 10 letras).').max(500),
      clave: z.string().min(1).max(200),
    }),
  );
  if (!PERFILES_EXCUSAN.has(await perfilDe(db, u.id)))
    throw new ErrorDatos(
      'Solo una cuenta con perfil Total o Finanzas excusa un día de la conciliación.',
      undefined,
      403,
    );
  const f = await db
    .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ clave_hash: string }>();
  if (!f || !(await verificarClave(clave, f.clave_hash)))
    throw new ErrorDatos('La contraseña no es correcta.', 'clave', 403);
  const conc = await db
    .prepare('SELECT pedidos, vendido, cuadra, detalle FROM conciliaciones WHERE dia = ?')
    .bind(dia)
    .first<{ pedidos: number; vendido: number; cuadra: number; detalle: string }>();
  if (!conc) throw new ErrorDatos('Ese día no tiene conciliación.', 'dia', 404);
  if (Number(conc.cuadra) === 1)
    throw new ErrorDatos('Ese día cuadra: no hay nada que excusar.', 'dia', 409);
  // Una excusa por cifras: si el día se recalcula con otra diferencia, se excusa aparte.
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO conciliacion_excepciones (id, dia, pedidos, vendido, detalle, motivo, creado_por, creado_por_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      dia,
      conc.pedidos,
      conc.vendido,
      conc.detalle,
      motivo,
      u.id,
      u.nombre,
    )
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Ese día ya tiene su excepción con estas cifras.', 'dia', 409);
  return c.json({ ok: true });
});
