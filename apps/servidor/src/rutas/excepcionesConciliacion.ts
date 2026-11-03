import { Hono } from 'hono';
import { z } from 'zod';
import { diasSinCuadrar } from '../conciliacion';
import { verificarClave } from '../cripto';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { pedirAprobacion } from '../finanzas/controlDual';
import { perfilDe } from './equipo';

/**
 * C-DINERO-30-DIAS (NXT-1, 3 nov 2026): la bandeja de los días que no cuadraron en los últimos 30.
 * Un día se excusa SOLO con motivo: lo pide una cuenta Total o Finanzas con su contraseña y lo
 * aprueba OTRA en «Para aprobar» (ETP-3, control dual).
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
  // ETP-3: los días con una excusa esperando la segunda firma (el canario sigue en rojo).
  const { results } = await db
    .prepare(
      "SELECT objeto, pedido_por FROM aprobaciones_dinero WHERE tipo = 'excusa_conciliacion' AND estado = 'pendiente'",
    )
    .all<{ objeto: string; pedido_por: string }>();
  const esperando = new Map(results.map((r) => [r.objeto.replace(/^conciliacion:/, ''), r]));
  return c.json({
    sinCuadrar: (await diasSinCuadrar(db)).map((d) => ({
      ...d,
      esperandoFirma: !d.excusado && esperando.has(d.dia),
      pedidoPorMi: esperando.get(d.dia)?.pedido_por === u.id,
    })),
    puedoExcusar: PERFILES_EXCUSAN.has(perfil),
  });
});

/**
 * ETP-3 (C-CONCILIACION-SEGUNDA-FIRMA): excusar un día ya no lo hace una sola cuenta. Quien lo pide
 * (Total o Finanzas, con su contraseña y el motivo) deja la solicitud en «Para aprobar» y OTRA
 * cuenta Total o Finanzas la aprueba (`excusarDia`, por el control dual). Mientras espera, el
 * canario de dinero sigue en rojo.
 */
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
  const conc = await cifrasDelDia(db, dia);
  const ya = await db
    .prepare(
      'SELECT 1 FROM conciliacion_excepciones WHERE dia = ? AND pedidos = ? AND vendido = ? AND detalle = ?',
    )
    .bind(dia, conc.pedidos, conc.vendido, conc.detalle)
    .first();
  if (ya) throw new ErrorDatos('Ese día ya tiene su excepción con estas cifras.', 'dia', 409);
  return pedirAprobacion(
    c,
    u.id,
    {
      tipo: 'excusa_conciliacion',
      objeto: `conciliacion:${dia}`,
      monto: Number(conc.vendido),
      motivo,
      datos: {
        dia,
        pedidos: Number(conc.pedidos),
        vendido: Number(conc.vendido),
        detalle: conc.detalle,
        motivo,
      },
    },
    { moneda: 'USD', monto: Number(conc.vendido) },
  );
});

async function cifrasDelDia(db: D1Database, dia: string) {
  const conc = await db
    .prepare('SELECT pedidos, vendido, cuadra, detalle FROM conciliaciones WHERE dia = ?')
    .bind(dia)
    .first<{ pedidos: number; vendido: number; cuadra: number; detalle: string }>();
  if (!conc) throw new ErrorDatos('Ese día no tiene conciliación.', 'dia', 404);
  if (Number(conc.cuadra) === 1)
    throw new ErrorDatos('Ese día cuadra: no hay nada que excusar.', 'dia', 409);
  return conc;
}

/**
 * La segunda firma ya está (la llama `ejecutarDual` al aprobar): la excusa se guarda SOLO si las
 * cifras del día siguen siendo las que se pidieron excusar. Queda quién la pidió y quién la aprobó.
 */
export async function excusarDia(
  db: D1Database,
  d: Record<string, unknown>,
  pedidoPor: string,
  aprobadoPor: string | undefined,
) {
  const datos = z
    .object({
      dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      pedidos: z.number().int(),
      vendido: z.number().int(),
      detalle: z.string(),
      motivo: z.string().min(10).max(500),
    })
    .parse(d);
  if (!aprobadoPor || aprobadoPor === pedidoPor)
    throw new ErrorDatos(
      'No puedes aprobar lo que tú pediste. Lo aprueba otra persona del equipo.',
      undefined,
      409,
    );
  const conc = await cifrasDelDia(db, datos.dia);
  if (
    Number(conc.pedidos) !== datos.pedidos ||
    Number(conc.vendido) !== datos.vendido ||
    conc.detalle !== datos.detalle
  )
    throw new ErrorDatos(
      'Las cifras de ese día cambiaron desde que se pidió la excusa. Pídela otra vez con las nuevas.',
      'dia',
      409,
    );
  const quien = await db
    .prepare('SELECT nombre FROM usuarios WHERE id = ?')
    .bind(pedidoPor)
    .first<{ nombre: string }>();
  // Una excusa por cifras: si el día se recalcula con otra diferencia, se excusa aparte. Quién la
  // aprobó queda en la fila de `aprobaciones_dinero` (revisado_por), que nunca se borra.
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO conciliacion_excepciones (id, dia, pedidos, vendido, detalle, motivo, creado_por, creado_por_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      datos.dia,
      datos.pedidos,
      datos.vendido,
      datos.detalle,
      datos.motivo,
      pedidoPor,
      quien?.nombre ?? '',
    )
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Ese día ya tiene su excepción con estas cifras.', 'dia', 409);
  return { excusado: true, dia: datos.dia };
}
