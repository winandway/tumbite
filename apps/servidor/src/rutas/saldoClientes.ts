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
  return c.json({
    cliente: { id: f.id, nombre: f.nombre, ciudad: f.ciudad, pais: f.pais },
    saldo: await saldoDeCliente(db, id),
    moneda: MONEDA_SALDO_DIVOOX,
    movimientos: await movimientosSaldoCliente(db, id),
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

/** Lo que la app del cliente ve de su Saldo Divoox (solo donde su país lo tiene). */
saldoClientes.get('/cliente/saldo-divoox', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const z1 = await db
    .prepare('SELECT z.pais FROM usuarios u LEFT JOIN zonas z ON z.id = u.zona_id WHERE u.id = ?')
    .bind(u.id)
    .first<{ pais: string | null }>();
  const disponible = await saldoDeCliente(db, u.id);
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
    moneda: MONEDA_SALDO_DIVOOX,
    movimientos,
  });
});
