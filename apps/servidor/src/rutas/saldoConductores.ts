import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { hacerOPedirAprobacion } from '../finanzas/controlDual';
import {
  cuentaDeConductor,
  topesSaldoDe,
  cargasDeConductor,
  conductoresDeCiudad,
  guardarRegaloConductorNuevo,
  leerRegalosConductorNuevo,
  regalosASaldo,
} from '../saldoConductores';

/**
 * C-SALDO-CONDUCTOR (17 nov 2026): la vista de conductores por ciudad del superadmin, la carga
 * manual de saldo (con la doble firma del dinero), el regalo de arranque por ciudad y el «pasar a mi
 * saldo» de los regalos del conductor. La lógica vive en `saldoConductores.ts`.
 */
export const saldoConductores = new Hono<{ Bindings: Env; Variables: Variables }>();

saldoConductores.get('/admin/conductores-ciudad', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: zonas } = await db
    .prepare(
      // Todas las ciudades activas, aunque todavía no tengan conductores (se les puede preparar el
      // regalo de arranque antes de que llegue el primero).
      `SELECT z.id, z.nombre, z.pais, z.moneda FROM zonas z
        WHERE z.activa = 1 ORDER BY z.pais DESC, z.nombre LIMIT 200`,
    )
    .all<{ id: string; nombre: string; pais: string; moneda: string }>();
  const pedida = c.req.query('zona');
  const zona = zonas.find((z) => z.id === pedida) ?? zonas[0];
  return c.json({
    zonas,
    ciudad: zona ? await conductoresDeCiudad(db, zona.id) : null,
    regalosNuevos: await leerRegalosConductorNuevo(db),
    // C-TOPES-SALDO-MONEDA: los topes de la moneda de la ciudad elegida.
    topes: topesSaldoDe(zona?.moneda),
  });
});

saldoConductores.get('/admin/conductores-ciudad/:id/cargas', async (c) => {
  exigir(c, 'admin');
  return c.json({ cargas: await cargasDeConductor(base(c), c.req.param('id')) });
});

/** Cargar saldo a mano: bajo el límite de la persona lo hace de una vez; por encima, con otra firma. */
saldoConductores.post('/admin/conductores-ciudad/:id/saldo', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      // El tope depende de la moneda del conductor: se comprueba abajo, antes de pedir la firma.
      monto: z.number().int().min(1),
      motivo: z.string().trim().min(3).max(120),
      comprobante: z.string().trim().max(80).default(''),
    }),
  );
  const conductorId = c.req.param('id');
  const cuenta = await cuentaDeConductor(base(c), conductorId);
  if (d.monto > topesSaldoDe(cuenta.moneda).cargaMaxima)
    throw new ErrorDatos('Esa carga pasa el máximo permitido de Divoox por carga.', 'monto', 400);
  return hacerOPedirAprobacion(c, {
    tipo: 'saldo_conductor',
    objeto: conductorId,
    monto: d.monto,
    motivo: d.motivo,
    datos: { conductorId, monto: d.monto, motivo: d.motivo, comprobante: d.comprobante },
  });
});

saldoConductores.put('/admin/regalo-conductor-nuevo/:zona', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      // Los topes dependen de la moneda de la ciudad: los comprueba `guardarRegaloConductorNuevo`.
      monto: z.number().int().min(1),
      presupuesto: z.number().int().min(1),
      activo: z.boolean(),
    }),
  );
  const ciudad = await base(c)
    .prepare('SELECT moneda FROM zonas WHERE id = ?')
    .bind(c.req.param('zona'))
    .first<{ moneda: string }>();
  const topes = topesSaldoDe(ciudad?.moneda);
  if (d.monto > topes.regaloNuevoMaximo)
    throw new ErrorDatos(
      'Ese regalo pasa el máximo permitido de Divoox por conductor.',
      'monto',
      400,
    );
  if (d.presupuesto > topes.presupuestoRegaloNuevoMaximo)
    throw new ErrorDatos('Ese presupuesto pasa el máximo permitido de Divoox.', 'presupuesto', 400);
  return c.json({
    regalo: await guardarRegaloConductorNuevo(base(c), {
      zonaId: c.req.param('zona'),
      ...d,
      autorId: u.id,
    }),
  });
});

/** El conductor pasa a su saldo, con un toque, lo que Divoox le debe por regalos de pasajeros. */
saldoConductores.post('/repartidor/regalos/a-saldo', async (c) => {
  const u = exigir(c, 'repartidor');
  return c.json(await regalosASaldo(base(c), u.id));
});
