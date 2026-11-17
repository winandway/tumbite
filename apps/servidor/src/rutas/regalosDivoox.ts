import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { paisDeZona } from '../internacional/paises';
import {
  SERVICIOS_REGALO,
  TOPES_REGALO,
  alertasRegalo,
  huellaAparato,
  liquidacionConductores,
  listarCupones,
  normalizarCodigoRegalo,
  pagarRegaloConductor,
  regaloParaCliente,
  revisarTopes,
} from '../regalosDivoox';

/**
 * C-CUPON-DIVOOX: las rutas del cliente («Agregar código», el regalo que se aplicaría) y las del
 * superadmin (crear, encender, presupuesto en vivo, reporte y pago al conductor). La lógica vive en
 * `regalosDivoox.ts`.
 */
export const regalosDivoox = new Hono<{ Bindings: Env; Variables: Variables }>();

/** La huella del aparato desde la cabecera que manda la app (null si es una app vieja). */
export const aparatoDe = (c: Ctx) => huellaAparato(c.req.header('x-aparato'));

// ───────────────────────── Cliente ─────────────────────────

/** Mis códigos de regalo: los que agregué y si todavía sirven. */
regalosDivoox.get('/regalos-divoox', async (c) => {
  const u = exigir(c, 'cliente');
  const { results } = await base(c)
    .prepare(
      `SELECT c.codigo, c.nombre_es, c.nombre_en, c.tipo, c.valor, c.moneda, c.servicios, c.vence_en, c.activo,
              c.apagado_motivo, g.guardado_en,
              (SELECT x.estado FROM usos_cupon_divoox x WHERE x.codigo = c.codigo AND x.cliente_id = ?1 AND x.estado <> 'liberado' LIMIT 1) AS uso
         FROM cupones_divoox_guardados g JOIN cupones_divoox c ON c.codigo = g.codigo
        WHERE g.cliente_id = ?1 ORDER BY g.guardado_en DESC LIMIT 20`,
    )
    .bind(u.id)
    .all<Record<string, unknown>>();
  return c.json({
    regalos: results.map((r) => {
      const vencido =
        r.vence_en != null &&
        String(r.vence_en) < new Date().toISOString().replace('T', ' ').slice(0, 19);
      return {
        codigo: String(r.codigo),
        nombreEs: String(r.nombre_es),
        nombreEn: String(r.nombre_en),
        tipo: String(r.tipo),
        valor: Number(r.valor),
        moneda: String(r.moneda),
        servicios: JSON.parse(String(r.servicios)) as string[],
        venceEn: r.vence_en == null ? null : String(r.vence_en),
        estado:
          r.uso === 'cobrado'
            ? 'usado'
            : r.uso === 'apartado'
              ? 'en_uso'
              : vencido
                ? 'vencido'
                : Number(r.activo) === 1
                  ? 'listo'
                  : 'pausado',
      };
    }),
  });
});

/**
 * «Agregar código»: el cupón queda en la cuenta y se aplica solo en el próximo viaje, envío o pedido
 * que cumpla. Se rechaza aquí lo que nunca va a servir (no existe, venció, ya lo usaste).
 */
regalosDivoox.post('/regalos-divoox/guardar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const { codigo: escrito } = await leerCuerpo(
    c,
    z.object({ codigo: z.string().trim().min(3).max(30) }),
  );
  const codigo = normalizarCodigoRegalo(escrito);
  const aparato = await aparatoDe(c);
  if (!aparato)
    throw new ErrorDatos('Actualiza la app para usar códigos de regalo.', 'codigo', 409);
  const cu = await db
    .prepare(
      'SELECT codigo, activo, apagado_motivo, vence_en, nombre_es, nombre_en, tipo, valor, moneda, servicios, zonas FROM cupones_divoox WHERE codigo = ?',
    )
    .bind(codigo)
    .first<Record<string, unknown>>();
  if (!cu || (Number(cu.activo) !== 1 && cu.apagado_motivo !== 'agotado'))
    throw new ErrorDatos('Ese código no existe o ya no está activo.', 'codigo', 404);
  if (cu.apagado_motivo === 'agotado')
    throw new ErrorDatos('Ese regalo ya se agotó. Gracias por tu interés.', 'codigo', 409);
  if (
    cu.vence_en != null &&
    String(cu.vence_en) < new Date().toISOString().replace('T', ' ').slice(0, 19)
  )
    throw new ErrorDatos('Ese código ya venció.', 'codigo', 409);
  const yo = await db
    .prepare('SELECT telefono, telefono_canonico FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ telefono: string | null; telefono_canonico: string | null }>();
  if (!(yo?.telefono_canonico ?? yo?.telefono))
    throw new ErrorDatos(
      'Agrega tu número de celular en tu cuenta para usar códigos de regalo.',
      'codigo',
      409,
    );
  const usado = await db
    .prepare(
      "SELECT 1 FROM usos_cupon_divoox WHERE codigo = ? AND estado <> 'liberado' AND (cliente_id = ? OR aparato = ?) LIMIT 1",
    )
    .bind(codigo, u.id, aparato)
    .first();
  if (usado) throw new ErrorDatos('Ya usaste este regalo.', 'codigo', 409);
  await db
    .prepare('INSERT OR IGNORE INTO cupones_divoox_guardados (cliente_id, codigo) VALUES (?, ?)')
    .bind(u.id, codigo)
    .run();
  return c.json(
    {
      regalo: {
        codigo,
        nombreEs: String(cu.nombre_es),
        nombreEn: String(cu.nombre_en),
        tipo: String(cu.tipo),
        valor: Number(cu.valor),
        moneda: String(cu.moneda),
        servicios: JSON.parse(String(cu.servicios)) as string[],
        venceEn: cu.vence_en == null ? null : String(cu.vence_en),
      },
    },
    201,
  );
});

/** El regalo que se aplicaría ahora a un pedido de comida (el carrito lo muestra solo). */
regalosDivoox.post('/regalos-divoox/aplicable', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const d = await leerCuerpo(
    c,
    z.object({
      servicio: z.enum(SERVICIOS_REGALO),
      restauranteId: z.string().min(1).max(64).optional(),
      zonaId: z.string().min(1).max(64).optional(),
      base: z.number().int().min(0).max(10_000_000),
    }),
  );
  const zonaId =
    d.zonaId ??
    (d.restauranteId
      ? (
          await db
            .prepare('SELECT zona_id FROM restaurantes WHERE id = ?')
            .bind(d.restauranteId)
            .first<{ zona_id: string | null }>()
        )?.zona_id
      : null);
  if (!zonaId) return c.json({ regalo: null });
  const { moneda } = await paisDeZona(db, zonaId);
  const regalo = await regaloParaCliente(db, {
    clienteId: u.id,
    servicio: d.servicio,
    zonaId,
    moneda,
    base: d.base,
    aparato: await aparatoDe(c),
  });
  return c.json({ regalo });
});

// ───────────────────────── Superadmin ─────────────────────────

const fechaSql = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/, {
    error: 'Escribe la fecha como AAAA-MM-DD.',
  })
  .transform((s) => (s.length === 10 ? `${s} 23:59:59` : s.length === 16 ? `${s}:00` : s));

/** Los campos de un cupón, sin valores por defecto (así el cambio parcial no pisa lo guardado). */
const camposCupon = {
  nombreEs: z.string().trim().min(3).max(80),
  nombreEn: z.string().trim().min(3).max(80),
  tipo: z.enum(['monto', 'gratis']),
  valor: z.number().int().min(1).max(TOPES_REGALO.valorMaximo),
  servicios: z.array(z.enum(SERVICIOS_REGALO)).min(1).max(SERVICIOS_REGALO.length),
  zonas: z.array(z.string().min(1).max(64)).min(1).max(50),
  venceEn: fechaSql.nullable(),
  presupuesto: z.number().int().min(100).max(TOPES_REGALO.presupuestoMaximo),
  bienvenida: z.boolean(),
  topeDiarioConductor: z.number().int().min(1).max(TOPES_REGALO.topeDiarioConductorMaximo),
};
const esquemaCupon = z.object({
  ...camposCupon,
  codigo: z.string().trim().min(3).max(20),
  venceEn: camposCupon.venceEn.default(null),
  bienvenida: camposCupon.bienvenida.default(false),
  topeDiarioConductor: camposCupon.topeDiarioConductor.default(6),
});
const esquemaCambioCupon = z
  .object(camposCupon)
  .partial()
  .extend({ activo: z.boolean().optional() });

async function monedaDeZonas(db: D1Database, zonas: string[]) {
  const monedas = new Set<string>();
  for (const z0 of zonas) {
    const f = await db
      .prepare('SELECT id FROM zonas WHERE id = ?')
      .bind(z0)
      .first<{ id: string }>();
    if (!f) throw new ErrorDatos('Una de las ciudades no existe.', 'zonas', 422);
    monedas.add((await paisDeZona(db, z0)).moneda);
  }
  if (monedas.size !== 1)
    throw new ErrorDatos(
      'Todas las ciudades de un cupón tienen que cobrar en la misma moneda.',
      'zonas',
      422,
    );
  return [...monedas][0]!;
}

regalosDivoox.get('/admin/regalos-divoox', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: zonas } = await db
    .prepare(
      'SELECT id, nombre, pais, moneda FROM zonas WHERE activa = 1 ORDER BY pais, nombre LIMIT 200',
    )
    .all<{ id: string; nombre: string; pais: string; moneda: string }>();
  return c.json({
    cupones: await listarCupones(db),
    conductores: await liquidacionConductores(db),
    alertas: await alertasRegalo(db),
    zonas,
    servicios: SERVICIOS_REGALO,
    topes: TOPES_REGALO,
  });
});

regalosDivoox.post('/admin/regalos-divoox', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaCupon);
  const codigo = normalizarCodigoRegalo(d.codigo);
  if (codigo.length < 3)
    throw new ErrorDatos('El código lleva al menos tres letras o números.', 'codigo', 422);
  const choca = await db
    .prepare(
      'SELECT 1 FROM cupones_divoox WHERE codigo = ?1 UNION ALL SELECT 1 FROM cupones WHERE codigo = ?1',
    )
    .bind(codigo)
    .first();
  if (choca) throw new ErrorDatos('Ya existe un cupón con ese código.', 'codigo', 409);
  await revisarTopes(db, d);
  const moneda = await monedaDeZonas(db, d.zonas);
  // Nace APAGADO: lo enciende una persona del equipo cuando todo está listo.
  await db
    .prepare(
      `INSERT INTO cupones_divoox (codigo, nombre_es, nombre_en, tipo, valor, moneda, servicios, zonas, vence_en, presupuesto, bienvenida, tope_diario_conductor, activo, apagado_motivo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'manual', ?)`,
    )
    .bind(
      codigo,
      d.nombreEs,
      d.nombreEn,
      d.tipo,
      d.valor,
      moneda,
      JSON.stringify([...new Set(d.servicios)]),
      JSON.stringify([...new Set(d.zonas)]),
      d.venceEn,
      d.presupuesto,
      d.bienvenida ? 1 : 0,
      d.topeDiarioConductor,
      u.id,
    )
    .run();
  const cupon = (await listarCupones(db)).find((x) => x.codigo === codigo);
  return c.json({ cupon }, 201);
});

regalosDivoox.patch('/admin/regalos-divoox/:codigo', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const codigo = normalizarCodigoRegalo(c.req.param('codigo'));
  const actual = (await listarCupones(db)).find((x) => x.codigo === codigo);
  if (!actual) throw new ErrorDatos('Ese cupón no existe.', undefined, 404);
  const d = await leerCuerpo(c, esquemaCambioCupon);
  const nuevo = { ...actual, ...d };
  if (nuevo.presupuesto < actual.gastado + actual.apartado)
    throw new ErrorDatos(
      'El presupuesto no puede quedar por debajo de lo que ya se gastó y está apartado.',
      'presupuesto',
      422,
    );
  await revisarTopes(db, nuevo, codigo);
  const moneda = d.zonas ? await monedaDeZonas(db, d.zonas) : actual.moneda;
  if (moneda !== actual.moneda && actual.gastado + actual.apartado > 0)
    throw new ErrorDatos(
      'Este cupón ya tiene usos: no puede cambiar a ciudades de otra moneda.',
      'zonas',
      422,
    );
  const restante = nuevo.presupuesto - actual.gastado - actual.apartado;
  if (d.activo === true && restante <= 0)
    throw new ErrorDatos(
      'Este cupón no tiene presupuesto. Súbele el presupuesto para encenderlo.',
      'presupuesto',
      409,
    );
  // Encendido a mano: queda encendido. Apagado a mano: no se vuelve a encender solo.
  const activo =
    d.activo === undefined ? actual.activo || (actual.agotado && restante > 0) : d.activo;
  const motivo = activo
    ? null
    : d.activo === false
      ? 'manual'
      : restante <= 0
        ? 'agotado'
        : actual.agotado
          ? 'agotado'
          : 'manual';
  await db
    .prepare(
      `UPDATE cupones_divoox SET nombre_es = ?, nombre_en = ?, tipo = ?, valor = ?, moneda = ?, servicios = ?, zonas = ?, vence_en = ?,
         presupuesto = ?, bienvenida = ?, tope_diario_conductor = ?, activo = ?, apagado_motivo = ?,
         agotado_en = CASE WHEN ? = 'agotado' THEN COALESCE(agotado_en, datetime('now')) ELSE NULL END,
         actualizado_en = datetime('now') WHERE codigo = ?`,
    )
    .bind(
      nuevo.nombreEs,
      nuevo.nombreEn,
      nuevo.tipo,
      nuevo.valor,
      moneda,
      JSON.stringify([...new Set(nuevo.servicios)]),
      JSON.stringify([...new Set(nuevo.zonas)]),
      nuevo.venceEn,
      nuevo.presupuesto,
      nuevo.bienvenida ? 1 : 0,
      nuevo.topeDiarioConductor,
      activo ? 1 : 0,
      motivo,
      motivo,
      codigo,
    )
    .run();
  return c.json({ cupon: (await listarCupones(db)).find((x) => x.codigo === codigo) });
});

regalosDivoox.get('/admin/regalos-divoox/:codigo/usos', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT u.id, u.operacion_id, u.servicio, u.zona_id, u.monto, u.moneda, u.estado, u.creado_en, u.cerrado_en, u.motivo,
              cli.nombre AS cliente, con.nombre AS conductor
         FROM usos_cupon_divoox u LEFT JOIN usuarios cli ON cli.id = u.cliente_id
         LEFT JOIN usuarios con ON con.id = u.conductor_id
        WHERE u.codigo = ? ORDER BY u.creado_en DESC LIMIT 200`,
    )
    .bind(normalizarCodigoRegalo(c.req.param('codigo')))
    .all<Record<string, unknown>>();
  return c.json({
    usos: results.map((r) => ({
      id: String(r.id),
      operacionId: String(r.operacion_id),
      servicio: String(r.servicio),
      zonaId: String(r.zona_id),
      monto: Number(r.monto),
      moneda: String(r.moneda),
      estado: String(r.estado),
      cliente: String(r.cliente ?? '').split(' ')[0] ?? '',
      conductor: r.conductor == null ? null : String(r.conductor),
      creadoEn: String(r.creado_en),
      cerradoEn: r.cerrado_en == null ? null : String(r.cerrado_en),
    })),
  });
});

regalosDivoox.post('/admin/regalos-divoox/conductores/:id/pago-movil', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      moneda: z.string().length(3),
      monto: z.number().int().min(1).max(TOPES_REGALO.presupuestoMaximo),
      referencia: z.string().trim().min(4).max(40),
    }),
  );
  const id = await pagarRegaloConductor(base(c), {
    conductorId: c.req.param('id'),
    moneda: d.moneda,
    monto: d.monto,
    referencia: d.referencia,
    autorId: u.id,
  });
  return c.json({ ok: true, id }, 201);
});
