import { Hono } from 'hono';
import { z } from 'zod';
import { MOTIVOS_CARGA_SALDO, MONEDA_SALDO_DIVOOX, perfilPasajeros } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { accesoDe } from '../accesoInterno';
import { buscarClientesSuper } from './buscadorInterno';
import {
  TOPES_SALDO_CLIENTE_MAXIMOS,
  cargarSaldoCliente,
  guardarTopesSaldoCliente,
  leerTopesSaldoCliente,
  movimientosSaldoCliente,
  resolverRevisionSaldo,
  resumenSaldoClientes,
  revisionesSaldo,
  saldoDeCliente,
} from '../saldoCliente';
import { DIAS_VENCE_PRONTO, detalleSaldo } from '../saldoLotes';
import {
  MAXIMOS_REGLA,
  TOPES_MASIVA_MAXIMOS,
  cargaMasiva,
  crearCargaMasiva,
  detenerCargaMasiva,
  guardarRegla,
  guardarTopesMasiva,
  leerTopesMasiva,
  listarCargasMasivas,
  listarReglas,
  procesarTandaMasiva,
  vistaPreviaMasiva,
} from '../saldoRegalos';

/**
 * C-SALDO-CLIENTE (25 nov 2026, Venezuela): la pantalla «Saldo de clientes» del superadmin (buscar al
 * cliente, ver su saldo y sus movimientos, cargarle saldo con motivo y topes, revisar lo dudoso) y lo
 * que la app del cliente lee de su saldo. La lógica vive en `saldoCliente.ts`.
 */
export const saldoClientes = new Hono<{ Bindings: Env; Variables: Variables }>();

saldoClientes.get('/admin/saldo-clientes', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const q = (c.req.query('q') ?? '').slice(0, 80);
  const encontrados = q ? await buscarClientesSuper(db, u, q, accesoDe(c)) : [];
  const conSaldo = await Promise.all(
    encontrados.map(async (r) => ({ ...r, saldo: await saldoDeCliente(db, r.id) })),
  );
  return c.json({
    clientes: conSaldo,
    resumen: await resumenSaldoClientes(db),
    revisiones: await revisionesSaldo(db),
    topes: await leerTopesSaldoCliente(db),
    maximos: TOPES_SALDO_CLIENTE_MAXIMOS,
    moneda: MONEDA_SALDO_DIVOOX,
  });
});

saldoClientes.get('/admin/saldo-clientes/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const f = await db
    .prepare(
      `SELECT u.id, u.nombre, z.nombre AS ciudad, z.pais FROM usuarios u LEFT JOIN zonas z ON z.id = u.zona_id
        WHERE u.id = ? AND u.rol = 'cliente'`,
    )
    .bind(id)
    .first<{ id: string; nombre: string; ciudad: string | null; pais: string | null }>();
  if (!f) throw new ErrorDatos('No encontramos a ese cliente.', undefined, 404);
  const detalle = await detalleSaldo(db, id);
  // C-SALDO-LOTES: de qué está hecho su saldo (origen, lo que queda y cuándo vence), lo nuevo primero.
  const { results: lotes } = await db
    .prepare(
      `SELECT id, tipo, origen, monto_inicial, restante, vencido, vence_en, prorrogado_en, creado_en
         FROM saldo_cliente_lotes WHERE cliente_id = ? AND monto_inicial > 0 ORDER BY creado_en DESC LIMIT 50`,
    )
    .bind(id)
    .all<Record<string, unknown>>();
  return c.json({
    cliente: { id: f.id, nombre: f.nombre, ciudad: f.ciudad, pais: f.pais },
    saldo: detalle.disponible,
    regalo: detalle.regalo,
    prepago: detalle.prepago,
    proximoVence: detalle.proximoVence,
    moneda: MONEDA_SALDO_DIVOOX,
    movimientos: await movimientosSaldoCliente(db, id),
    lotes: lotes.map((l) => ({
      id: String(l.id),
      tipo: String(l.tipo),
      origen: String(l.origen),
      monto: Number(l.monto_inicial),
      restante: Number(l.restante),
      vencido: Number(l.vencido),
      venceEn: l.vence_en == null ? null : String(l.vence_en),
      prorrogado: l.prorrogado_en != null,
      creadoEn: String(l.creado_en),
    })),
  });
});

saldoClientes.post('/admin/saldo-clientes/:id/cargas', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      monto: z.number().int().min(1),
      motivo: z.enum(MOTIVOS_CARGA_SALDO),
      nota: z.string().trim().max(120).default(''),
      comprobante: z.string().trim().max(80).default(''),
      idempotencia: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
      // C-SALDO-LOTES: los días hasta que vence este regalo (sin valor, no vence; el prepago nunca).
      vigenciaDias: z.number().int().min(1).max(365).nullable().optional(),
    }),
  );
  const r = await cargarSaldoCliente(c.env, base(c), {
    clienteId: c.req.param('id'),
    ...d,
    autorId: u.id,
  });
  return c.json(r, r.repetida ? 200 : 201);
});

saldoClientes.put('/admin/saldo-clientes/topes', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      porCarga: z.number().int().min(1),
      porDiaEquipo: z.number().int().min(1),
      porDiaCliente: z.number().int().min(1),
    }),
  );
  return c.json({ topes: await guardarTopesSaldoCliente(base(c), d, u.id) });
});

saldoClientes.post('/admin/saldo-clientes/revisiones/:op', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ aprobar: z.boolean(), nota: z.string().trim().min(3).max(200) }),
  );
  return c.json(
    await resolverRevisionSaldo(base(c), {
      operacionId: c.req.param('op'),
      aprobar: d.aprobar,
      autorId: u.id,
      nota: d.nota,
    }),
  );
});

/** C-SALDO-CLIENTE (I4): el saldo de la cuenta propia, para el aviso de «Borrar la cuenta» (las tres apps). */
saldoClientes.get('/cuentas/yo/saldo-divoox', async (c) => {
  const u = exigir(c);
  return c.json({ disponible: await saldoDeCliente(base(c), u.id), moneda: MONEDA_SALDO_DIVOOX });
});

/** Lo que la app del cliente ve de su Saldo Divoox (solo donde su país lo tiene). */
saldoClientes.get('/cliente/saldo-divoox', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const z1 = await db
    .prepare('SELECT z.pais FROM usuarios u LEFT JOIN zonas z ON z.id = u.zona_id WHERE u.id = ?')
    .bind(u.id)
    .first<{ pais: string | null }>();
  const detalle = await detalleSaldo(db, u.id);
  const disponible = detalle.disponible;
  const movimientos = (await movimientosSaldoCliente(db, u.id, 20)).map((m) => ({
    id: m.id,
    monto: m.monto,
    moneda: m.moneda,
    concepto: m.concepto,
    operacionId: m.operacionId,
    creadoEn: m.creadoEn,
  }));
  return c.json({
    habilitado: perfilPasajeros(z1?.pais).saldoDivoox || disponible > 0,
    disponible,
    // C-SALDO-LOTES: cuánto es regalo, cuánto prepago, y lo que vence (con su fecha).
    regalo: detalle.regalo,
    prepago: detalle.prepago,
    proximoVence: detalle.proximoVence,
    vencePronto:
      detalle.proximoVence &&
      Date.parse(`${detalle.proximoVence.venceEn.replace(' ', 'T')}Z`) <=
        Date.now() + DIAS_VENCE_PRONTO * 86_400_000
        ? detalle.proximoVence
        : null,
    moneda: MONEDA_SALDO_DIVOOX,
    movimientos,
  });
});

// ───────────── C-SALDO-BIENVENIDA y C-SALDO-FIDELIDAD: las reglas por ciudad (Configuración) ─────────────

saldoClientes.get('/admin/saldo-regalos/reglas', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: zonas } = await db
    .prepare('SELECT id, nombre, pais FROM zonas WHERE activa = 1 ORDER BY nombre LIMIT 300')
    .all<{ id: string; nombre: string; pais: string }>();
  return c.json({
    reglas: await listarReglas(db),
    zonas,
    maximos: MAXIMOS_REGLA,
    moneda: MONEDA_SALDO_DIVOOX,
  });
});

saldoClientes.put('/admin/saldo-regalos/reglas', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      tipo: z.enum(['bienvenida', 'fidelidad']),
      zonaId: z.string().trim().min(1).max(80),
      monto: z.number().int().min(1),
      vigenciaDias: z.number().int().min(1).max(365),
      encendida: z.boolean(),
      presupuesto: z.number().int().min(0),
      topeDiario: z.number().int().min(1).nullable().optional(),
      cadaViajes: z.number().int().min(1).nullable().optional(),
      topePersonaMes: z.number().int().min(1).nullable().optional(),
    }),
  );
  return c.json({ regla: await guardarRegla(base(c), u.id, d) });
});

// ───────────── C-SALDO-MASIVO: la carga masiva (Saldo de clientes) ─────────────

const esquemaFiltros = z.object({
  zonaId: z.string().trim().min(1).max(80).nullable().default(null),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  viajesMin: z.number().int().min(0).max(10_000).nullable().default(null),
  viajesMax: z.number().int().min(0).max(10_000).nullable().default(null),
  celularVerificado: z.boolean().default(false),
});

saldoClientes.get('/admin/saldo-regalos/masiva', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  return c.json({
    cargas: await listarCargasMasivas(db),
    topes: await leerTopesMasiva(db),
    maximos: TOPES_MASIVA_MAXIMOS,
    moneda: MONEDA_SALDO_DIVOOX,
  });
});

saldoClientes.post('/admin/saldo-regalos/masiva/vista-previa', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      filtros: esquemaFiltros,
      monto: z.number().int().min(1),
      pagina: z.string().max(200).nullable().optional(),
    }),
  );
  return c.json(await vistaPreviaMasiva(base(c), d));
});

saldoClientes.post('/admin/saldo-regalos/masiva', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      filtros: esquemaFiltros,
      monto: z.number().int().min(1),
      vigenciaDias: z.number().int().min(1).max(365),
      motivo: z.string().trim().max(160),
      totalEscrito: z.number().int().min(1),
      idempotencia: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    }),
  );
  const r = await crearCargaMasiva(c.env, base(c), { ...d, autorId: u.id });
  return c.json(r, r.repetida ? 200 : 201);
});

saldoClientes.get('/admin/saldo-regalos/masiva/:id', async (c) => {
  exigir(c, 'admin');
  return c.json({ carga: await cargaMasiva(base(c), c.req.param('id')) });
});

saldoClientes.post('/admin/saldo-regalos/masiva/:id/tanda', async (c) => {
  exigir(c, 'admin');
  return c.json({ carga: await procesarTandaMasiva(c.env, base(c), c.req.param('id')) });
});

saldoClientes.post('/admin/saldo-regalos/masiva/:id/detener', async (c) => {
  const u = exigir(c, 'admin');
  return c.json({ carga: await detenerCargaMasiva(base(c), c.req.param('id'), u.id) });
});

saldoClientes.put('/admin/saldo-regalos/masiva-topes', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      porCliente: z.number().int().min(1),
      porCarga: z.number().int().min(1),
      porDiaPersona: z.number().int().min(1),
      porDiaGlobal: z.number().int().min(1),
    }),
  );
  return c.json({ topes: await guardarTopesMasiva(base(c), d, u.id) });
});
