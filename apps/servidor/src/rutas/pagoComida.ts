import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { verificarClave } from '../cripto';
import { guardarFoto } from '../fotoLimpia';
import { hacerOPedirAprobacion } from '../finanzas/controlDual';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';
import {
  confirmarCuentaRestaurante,
  crearCuentaRestaurante,
  cuentasDeRestaurante,
  desactivarCuentaRestaurante,
  filaPagoComida,
  marcarDevolucionHecha,
  reportarPagoComida,
  responderPagoComida,
  usaPagoRestaurante,
  vistaPagoComida,
} from '../internacional/pagoComida';
import {
  carpetaComprobantesRestaurante,
  datosRestaurante,
  declararRecargaRestaurante,
  recargaRestaurante,
  recargasRestaurantePorRevisar,
  rechazarRecargaRestaurante,
  resumenSaldoRestaurante,
} from '../internacional/saldoRestaurante';
import { topesSaldoDe } from '../saldoConductores';

/**
 * C-COMIDA-PAGO-RESTAURANTE y C-SALDO-RESTAURANTE (22 nov 2026) — Venezuela y todo país con la
 * bandera `comidaPagoRestaurante`. Las rutas del pago de la comida directo al restaurante (cliente y
 * restaurante), la cuenta de cobro del restaurante y su saldo prepago (restaurante y equipo). La
 * lógica vive en `internacional/pagoComida.ts` y `internacional/saldoRestaurante.ts`.
 */
export const pagoComidaRutas = new Hono<{ Bindings: Env; Variables: Variables }>();

/** El restaurante de la persona (dueño o miembro del equipo). */
async function miRestaurante(c: Ctx, soloDueno = false) {
  const u = exigir(c, 'restaurante');
  const f = await base(c)
    .prepare(
      soloDueno
        ? 'SELECT id FROM restaurantes WHERE dueno_id = ?1'
        : 'SELECT id FROM restaurantes WHERE (dueno_id = ?1 OR id IN (SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1))',
    )
    .bind(u.id)
    .first<{ id: string }>();
  if (!f)
    throw new ErrorDatos(
      soloDueno
        ? 'Solo el dueño del restaurante puede cambiar la cuenta de cobro.'
        : 'Primero completa los datos de tu restaurante.',
      undefined,
      soloDueno ? 403 : 404,
    );
  return { u, rid: f.id };
}

async function exigirClave(db: D1Database, usuarioId: string, clave: string) {
  const f = await db
    .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ clave_hash: string }>();
  if (!f || !(await verificarClave(clave, f.clave_hash)))
    throw new ErrorDatos('La contraseña no es correcta.', 'clave', 403);
}

/** Lee la foto cruda de la petición y la valida (tipo real, tamaño, almacén disponible). */
async function leerFotoCruda(c: Ctx, campo: string) {
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (!bytes.byteLength) throw new ErrorDatos('Falta la foto del comprobante.', campo, 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', campo, 413);
  const mime = tipoReal(bytes);
  if (!mime) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', campo, 415);
  if (!c.env.BUCKET)
    throw new ErrorDatos('El almacén de fotos no está disponible en este momento.', undefined, 503);
  return { bytes, mime, bucket: c.env.BUCKET };
}

const REFERENCIA = z
  .string()
  .trim()
  .min(1, { error: 'Escribe el número de referencia del pago.' })
  .max(40);

// ───────────────────────── El cliente ─────────────────────────

/** Lo que el cliente (o el restaurante, el conductor o el equipo) ve del pago de la comida. */
pagoComidaRutas.get('/pedidos/:id/pago-comida', async (c) => {
  const u = exigir(c);
  const f = await filaPagoComida(base(c), c.req.param('id'));
  if (!f) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const rol =
    u.rol === 'admin'
      ? 'admin'
      : f.cliente_id === u.id
        ? 'cliente'
        : f.dueno_id === u.id
          ? 'restaurante'
          : f.repartidor_id === u.id
            ? 'conductor'
            : null;
  if (!rol) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  return c.json({ pagoComida: vistaPagoComida(f, rol) });
});

/** El cliente escribe la referencia de su pago móvil (o la corrige una vez). */
pagoComidaRutas.post('/pedidos/:id/pago-comida', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({ referencia: REFERENCIA, banco: z.string().trim().max(60).default('') }),
  );
  const db = base(c);
  const id = c.req.param('id');
  await reportarPagoComida(c.env, db, {
    pedidoId: id,
    clienteId: u.id,
    referencia: d.referencia,
    banco: d.banco,
  });
  const f = await filaPagoComida(db, id);
  return c.json({ pagoComida: f ? vistaPagoComida(f, 'cliente') : null });
});

/** La foto del pago (opcional, nunca es la prueba). Reemplaza la anterior. */
pagoComidaRutas.post('/pedidos/:id/pago-comida/comprobante', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const id = c.req.param('id');
  const f = await filaPagoComida(db, id);
  if (!f || f.cliente_id !== u.id) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  if (!['por_pagar', 'reportado', 'no_llego'].includes(f.estado))
    throw new ErrorDatos('Este pago ya no admite una foto.', undefined, 409);
  const foto = await leerFotoCruda(c, 'comprobante');
  const clave = `evidencias/${id}/pago-comida-${crypto.randomUUID()}`;
  await guardarFoto(foto.bucket, clave, foto.bytes, foto.mime, {
    cacheControl: 'private, no-store',
  });
  await db
    .prepare('UPDATE pagos_comida SET comprobante_clave = ? WHERE pedido_id = ?')
    .bind(clave, id)
    .run();
  // La anterior no queda huérfana en el almacén.
  if (f.comprobante_clave) await foto.bucket.delete(f.comprobante_clave);
  return c.json({ ok: true, url: `/datos/pedidos/${id}/pago-comida/comprobante` });
});

/** La foto del pago: la ven el cliente, el restaurante del pedido y el equipo. */
pagoComidaRutas.get('/pedidos/:id/pago-comida/comprobante', async (c) => {
  const u = exigir(c);
  const f = await filaPagoComida(base(c), c.req.param('id'));
  const puede = f && (u.rol === 'admin' || f.cliente_id === u.id || f.dueno_id === u.id);
  if (!f || !puede || !f.comprobante_clave)
    throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const obj = c.env.BUCKET ? await c.env.BUCKET.get(f.comprobante_clave) : null;
  if (!obj) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'private, no-store',
    },
  });
});

// ───────────────────────── El restaurante: el pago de cada pedido ─────────────────────────

pagoComidaRutas.get('/restaurante/pedidos/:id/pago-comida', async (c) => {
  const { rid } = await miRestaurante(c);
  const f = await filaPagoComida(base(c), c.req.param('id'));
  if (!f || f.restaurante_id !== rid) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  return c.json({ pagoComida: vistaPagoComida(f, 'restaurante') });
});

/** «Me llegó» / «No me llegó»: el restaurante lo confirma mirando su banco, nunca por la foto. */
pagoComidaRutas.post('/restaurante/pedidos/:id/pago-comida', async (c) => {
  const { u, rid } = await miRestaurante(c);
  const d = await leerCuerpo(c, z.object({ llego: z.boolean() }));
  const db = base(c);
  const id = c.req.param('id');
  await responderPagoComida(c.env, db, { pedidoId: id, rid, actorId: u.id, llego: d.llego });
  const f = await filaPagoComida(db, id);
  return c.json({ pagoComida: f ? vistaPagoComida(f, 'restaurante') : null });
});

/** El restaurante ya le devolvió al cliente lo que pagó: lo marca con su referencia. */
pagoComidaRutas.post('/restaurante/pedidos/:id/pago-comida/devolucion', async (c) => {
  const { rid } = await miRestaurante(c);
  const d = await leerCuerpo(c, z.object({ referencia: REFERENCIA }));
  const db = base(c);
  const id = c.req.param('id');
  await marcarDevolucionHecha(c.env, db, { pedidoId: id, rid, referencia: d.referencia });
  const f = await filaPagoComida(db, id);
  return c.json({ pagoComida: f ? vistaPagoComida(f, 'restaurante') : null });
});

// ───────────────────────── El restaurante: su cuenta de cobro ─────────────────────────

pagoComidaRutas.get('/restaurante/cuenta-cobro', async (c) => {
  const { rid } = await miRestaurante(c);
  const db = base(c);
  const r = await datosRestaurante(db, rid);
  const { vigente, cuentas } = await cuentasDeRestaurante(db, rid, r.pais);
  return c.json({
    pais: r.pais,
    // ¿Su país usa el pago directo? Sin cuenta vigente, no recibe pedidos (la app lo dice).
    exigida: await usaPagoRestaurante(db, r.pais),
    cuenta: vigente,
    cuentas,
  });
});

const esquemaCuenta = z.object({
  clave: z.string().min(1, { error: 'Escribe tu contraseña.' }),
  banco: z.string().trim().min(2, { error: 'Escribe el banco.' }).max(60),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, { error: 'Escribe el teléfono del pago móvil, solo números.' }),
  documento: z
    .string()
    .trim()
    .regex(/^[A-Za-z]?-?[0-9-]{5,14}$/, {
      error: 'Escribe el documento del titular, por ejemplo V-12345678.',
    }),
  titular: z.string().trim().min(3, { error: 'Escribe el nombre del titular.' }).max(80),
});

/** Solo el dueño, con su contraseña. La primera cuenta rige al instante; un cambio, a las 24 horas. */
pagoComidaRutas.post('/restaurante/cuenta-cobro', async (c) => {
  const { u, rid } = await miRestaurante(c, true);
  const d = await leerCuerpo(c, esquemaCuenta);
  const db = base(c);
  await exigirClave(db, u.id, d.clave);
  const r = await datosRestaurante(db, rid);
  const { id, enVigorYa } = await crearCuentaRestaurante(db, {
    rid,
    pais: r.pais,
    moneda: r.pais === 'VE' ? 'VES' : r.moneda,
    banco: d.banco,
    telefono: d.telefono,
    documento: d.documento.toUpperCase(),
    titular: d.titular,
    autorId: u.id,
  });
  const { cuentas } = await cuentasDeRestaurante(db, rid, r.pais);
  return c.json({ cuenta: cuentas.find((x) => x.id === id) ?? null, enVigorYa }, 201);
});

pagoComidaRutas.post('/restaurante/cuenta-cobro/:id/desactivar', async (c) => {
  const { u, rid } = await miRestaurante(c, true);
  const { clave } = await leerCuerpo(
    c,
    z.object({ clave: z.string().min(1, { error: 'Escribe tu contraseña.' }) }),
  );
  const db = base(c);
  await exigirClave(db, u.id, clave);
  await desactivarCuentaRestaurante(db, rid, c.req.param('id'));
  return c.json({ ok: true });
});

/** El equipo revisó la cuenta del restaurante (documento, llamada): entra en vigor ya. */
pagoComidaRutas.patch('/admin/finanzas/restaurantes/:rid/cuenta-cobro/:id', async (c) => {
  exigir(c, 'admin');
  await confirmarCuentaRestaurante(base(c), c.req.param('rid'), c.req.param('id'));
  return c.json({ ok: true });
});

// ───────────────────────── El restaurante: su saldo prepago ─────────────────────────

pagoComidaRutas.get('/restaurante/saldo', async (c) => {
  const { rid } = await miRestaurante(c);
  const idioma = c.req.header('x-idioma') === 'en' ? 'en' : 'es';
  return c.json(await resumenSaldoRestaurante(base(c), rid, idioma));
});

/** Fotos de comprobante que un restaurante puede subir por día. */
const MAX_COMPROBANTES_DIA = 30;

pagoComidaRutas.post('/restaurante/saldo/comprobante', async (c) => {
  const { rid } = await miRestaurante(c);
  const db = base(c);
  const foto = await leerFotoCruda(c, 'comprobante');
  const cuota = await db
    .prepare(
      `INSERT INTO contadores (clave, n) VALUES (?1, 1)
       ON CONFLICT(clave) DO UPDATE SET n = n + 1 WHERE n < ?2`,
    )
    .bind(
      `restaurante-comprobantes:${rid}:${new Date().toISOString().slice(0, 10)}`,
      MAX_COMPROBANTES_DIA,
    )
    .run();
  if (!cuota.meta.changes)
    throw new ErrorDatos(
      'Llegaste al máximo de fotos de comprobante por hoy. Intenta mañana o escríbenos.',
      'comprobante',
      429,
    );
  const id = crypto.randomUUID();
  await guardarFoto(
    foto.bucket,
    `${carpetaComprobantesRestaurante(rid)}${id}`,
    foto.bytes,
    foto.mime,
    {
      cacheControl: 'private, no-store',
    },
  );
  return c.json({ comprobanteId: id }, 201);
});

pagoComidaRutas.post('/restaurante/saldo/recargas', async (c) => {
  const { u, rid } = await miRestaurante(c);
  const d = await leerCuerpo(
    c,
    z.object({
      monto: z.number().int().min(1),
      referencia: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9-]{4,40}$/, {
          error: 'Escribe el número de referencia del pago, como sale en tu banco.',
        }),
      banco: z.string().trim().max(60).default(''),
      comprobanteId: z
        .string()
        .regex(/^[a-f0-9-]{36}$/, { error: 'Falta la foto del comprobante.' }),
    }),
  );
  const db = base(c);
  const clave = `${carpetaComprobantesRestaurante(rid)}${d.comprobanteId}`;
  const foto = c.env.BUCKET ? await c.env.BUCKET.head(clave) : null;
  if (!foto) throw new ErrorDatos('Falta la foto del comprobante.', 'comprobanteId', 422);
  const recarga = await declararRecargaRestaurante(db, {
    rid,
    monto: d.monto,
    referencia: d.referencia,
    banco: d.banco,
    comprobanteClave: clave,
    autorId: u.id,
  });
  return c.json({ recarga }, 201);
});

// ───────────────────────── El equipo: saldo de los restaurantes ─────────────────────────

pagoComidaRutas.get('/admin/finanzas/restaurantes-saldo/recargas', async (c) => {
  exigir(c, 'admin');
  const estado = z
    .enum(['pendiente', 'acreditada', 'rechazada'])
    .catch('pendiente')
    .parse(c.req.query('estado'));
  return c.json({ recargas: await recargasRestaurantePorRevisar(base(c), estado) });
});

pagoComidaRutas.get('/admin/finanzas/restaurantes-saldo/recargas/:id/comprobante', async (c) => {
  exigir(c, 'admin');
  const r = await recargaRestaurante(base(c), c.req.param('id'));
  const obj = c.env.BUCKET ? await c.env.BUCKET.get(r.comprobante_clave) : null;
  if (!obj) throw new ErrorDatos('Esa recarga no existe.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'private, no-store',
    },
  });
});

/** Acreditar: bajo el umbral de la persona, ya; por encima, con la firma de otra persona (202). */
pagoComidaRutas.post('/admin/finanzas/restaurantes-saldo/recargas/:id/acreditar', async (c) => {
  exigir(c, 'admin');
  const r = await recargaRestaurante(base(c), c.req.param('id'));
  if (r.estado !== 'pendiente')
    throw new ErrorDatos(
      r.estado === 'acreditada' ? 'Esa recarga ya se acreditó.' : 'Esa recarga se rechazó.',
      undefined,
      409,
    );
  return hacerOPedirAprobacion(c, {
    tipo: 'recarga_restaurante',
    objeto: r.id,
    monto: Number(r.monto),
    motivo: `Recarga de saldo de restaurante ${r.metodo} ${r.referencia}`,
    datos: { recargaId: r.id },
  });
});

pagoComidaRutas.post('/admin/finanzas/restaurantes-saldo/recargas/:id/rechazar', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ motivo: z.string().trim().min(5, { error: 'Escribe el motivo.' }).max(300) }),
  );
  return c.json({
    recarga: await rechazarRecargaRestaurante(base(c), c.req.param('id'), d.motivo, u.id),
  });
});

pagoComidaRutas.get('/admin/finanzas/restaurantes/:rid/saldo', async (c) => {
  exigir(c, 'admin');
  return c.json(await resumenSaldoRestaurante(base(c), c.req.param('rid'), 'es'));
});

/** Cargar saldo a mano a un restaurante, con la doble firma del dinero por encima del límite. */
pagoComidaRutas.post('/admin/finanzas/restaurantes/:rid/saldo', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      monto: z.number().int().min(1),
      motivo: z.string().trim().min(3, { error: 'Escribe el motivo.' }).max(120),
      comprobante: z.string().trim().max(80).default(''),
    }),
  );
  const rid = c.req.param('rid');
  const r = await datosRestaurante(base(c), rid);
  if (d.monto > topesSaldoDe(r.moneda).cargaMaxima)
    throw new ErrorDatos('Esa carga pasa el máximo permitido de Divoox por carga.', 'monto', 400);
  return hacerOPedirAprobacion(c, {
    tipo: 'saldo_restaurante',
    objeto: rid,
    monto: d.monto,
    motivo: d.motivo,
    datos: { restauranteId: rid, monto: d.monto, motivo: d.motivo, comprobante: d.comprobante },
  });
});
