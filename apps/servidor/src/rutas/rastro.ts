import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { ErrorDatos } from '../validar';
import { HITOS_DESDE_APP } from '@tumbite/compartido';
import {
  anotarHito,
  anotarPaso,
  contarPasoAnonimo,
  embudoRegistro,
  esPasoAnonimo,
  lineaDeCuenta,
  origenDePeticion,
} from '../rastro';
import { limiteIntentos } from '../seguridad';
import { type Variables, base, exigir } from '../sesion';
import { accesoDe, alcanceObjetoSql } from '../accesoInterno';

/**
 * C-RASTRO (22 nov 2026, Richard) — todos los países. Las rutas del rastro de actividad: el paso del
 * registro que mandan las apps y la web (antes de crear la cuenta solo suma a un contador), y lo que
 * lee el panel del equipo (la actividad de una cuenta y el embudo). Mirar no escribe.
 */
export const rastroRutas = new Hono<{ Bindings: Env; Variables: Variables }>();

const cuerpoPaso = z.object({
  app: z.enum(['cliente', 'repartidor']),
  paso: z.string().max(30),
});

// En memoria (no escribe en la base): una misma red no puede inflar los contadores.
rastroRutas.use('/rastro/paso', limiteIntentos(30, 60_000));
rastroRutas.post('/rastro/paso', async (c) => {
  const leido = cuerpoPaso.safeParse(await c.req.json().catch(() => null));
  // Solo se aceptan los pasos de antes de crear la cuenta; los demás los anota la base sola.
  if (!leido.success || !esPasoAnonimo(leido.data.paso)) return c.json({ ok: false }, 400);
  const u = c.get('usuario');
  const origen = origenDePeticion(c.req);
  if (u) {
    // Con sesión (alguien que ya tiene cuenta y volvió a esa pantalla) queda en su propia cuenta.
    if (u.rol === 'cliente' || u.rol === 'repartidor')
      await anotarPaso(base(c), u.id, leido.data.paso, origen);
    return c.json({ ok: true });
  }
  const contado = await contarPasoAnonimo(base(c), leido.data.app, leido.data.paso, origen).catch(
    (e: unknown) => {
      console.error('rastro: contador', String(e));
      return false;
    },
  );
  return c.json({ ok: contado });
});

/**
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026): un hito que solo ve la app del conductor (la tarjeta de la cara
 * a la vista, la cámara abierta, una foto tomada, una subida que no llegó). Solo los conocidos y con sus
 * motivos; los de conectarse y los rechazos de fotos los pone el servidor. UNA fila la primera vez.
 */
const HITOS_APP = new Map<string, readonly string[]>(Object.entries(HITOS_DESDE_APP));
const cuerpoHito = z.object({ hito: z.string().max(30), motivo: z.string().max(30).default('') });
rastroRutas.use('/rastro/hito', limiteIntentos(40, 60_000));
rastroRutas.post('/rastro/hito', async (c) => {
  const u = exigir(c, 'repartidor');
  const leido = cuerpoHito.safeParse(await c.req.json().catch(() => null));
  const motivos = leido.success ? HITOS_APP.get(leido.data.hito) : undefined;
  if (!leido.success || !motivos || !motivos.includes(leido.data.motivo))
    return c.json({ ok: false }, 400);
  await anotarHito(
    base(c),
    u.id,
    leido.data.hito as keyof typeof HITOS_DESDE_APP,
    leido.data.motivo,
    origenDePeticion(c.req),
  );
  return c.json({ ok: true });
});

async function actividad(db: D1Database, id: string, rol: 'repartidor' | 'cliente') {
  const linea = await lineaDeCuenta(db, id);
  if (!linea) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  return { rol, ...linea };
}

rastroRutas.get('/admin/repartidores/:id/actividad', async (c) => {
  exigir(c, 'admin');
  return c.json({ actividad: await actividad(base(c), c.req.param('id'), 'repartidor') });
});
rastroRutas.get('/admin/clientes/:id/actividad', async (c) => {
  exigir(c, 'admin');
  return c.json({ actividad: await actividad(base(c), c.req.param('id'), 'cliente') });
});

const DIA = /^\d{4}-\d{2}-\d{2}$/;
rastroRutas.get('/admin/embudo', async (c) => {
  exigir(c, 'admin');
  const hoy = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const desde = DIA.test(c.req.query('desde') ?? '') ? c.req.query('desde')! : hace30;
  const hasta = DIA.test(c.req.query('hasta') ?? '') ? c.req.query('hasta')! : hoy;
  if (desde > hasta)
    throw new ErrorDatos('La fecha inicial va antes que la final.', undefined, 400);
  // Como mucho un año por consulta: el panel no lee de más.
  if (Date.parse(hasta) - Date.parse(desde) > 366 * 86_400_000)
    throw new ErrorDatos('Elige un período de un año o menos.', undefined, 400);
  const app = c.req.query('app') === 'cliente' ? 'cliente' : 'repartidor';
  const pais = /^[A-Za-z]{2}$/.test(c.req.query('pais') ?? '')
    ? c.req.query('pais')!.toUpperCase()
    : null;
  const zona = c.req.query('zona')?.slice(0, 40) || null;
  return c.json({
    app,
    desde,
    hasta,
    pais,
    zona,
    // C-PERMISOS-FINOS: quien tiene una zona de trabajo ve solo las cuentas de su zona.
    ...(await embudoRegistro(base(c), {
      app,
      desde,
      hasta,
      pais,
      zona,
      alcance: alcanceObjetoSql(
        accesoDe(c),
        app === 'repartidor' ? 'repartidor' : 'cliente',
        'u.id',
      ),
    })),
  });
});
