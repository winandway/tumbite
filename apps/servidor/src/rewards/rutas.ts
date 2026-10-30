import { Hono } from 'hono';
import type { Env } from '../env';
import { entornoDe } from '../entorno';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { z } from 'zod';
import { HITOS_FASE2, unidadesQueCuentan } from '@tumbite/compartido';
import {
  type EnvRewards,
  calcularYGuardar,
  itemsParaHito,
  leerAjustes,
  modoRewards,
  reputacionVisible,
} from './sombra';

/**
 * Divoox Rewards · Fase 2: lectura del modo sombra para el equipo (solo admin y solo en pruebas).
 * En producción estas direcciones responden «no existe».
 */
export const rewardsSombra = new Hono<{ Bindings: Env; Variables: Variables }>();

function soloPruebas(url: string) {
  if (entornoDe(url) !== 'pruebas')
    throw new ErrorDatos('Esta dirección no existe.', undefined, 404);
}

rewardsSombra.get('/admin/rewards/sombra/:repartidorId', async (c) => {
  soloPruebas(c.req.url);
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('repartidorId');
  const [dias, hitos, eventos] = await Promise.all([
    db
      .prepare(
        'SELECT * FROM reputacion_diaria WHERE repartidor_id = ? ORDER BY fecha DESC LIMIT 30',
      )
      .bind(id)
      .all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM rewards_hitos WHERE repartidor_id = ?').bind(id).all(),
    db
      .prepare('SELECT * FROM rewards_eventos WHERE repartidor_id = ? ORDER BY id DESC LIMIT 50')
      .bind(id)
      .all(),
  ]);
  return c.json({
    modo: modoRewards({ ...c.env, ENTORNO_RELOJ: entornoDe(c.req.url) } as EnvRewards),
    dias: dias.results.map((d) => ({
      ...d,
      componentes: JSON.parse(String(d.componentes_json)),
      porServicio: JSON.parse(String(d.por_servicio_json)),
      experiencia: JSON.parse(String(d.experiencia_json)),
    })),
    hitos: hitos.results,
    eventos: eventos.results,
  });
});

/** Calcular ya la foto de hoy de un repartidor (para revisar en pruebas sin esperar al reloj). */
rewardsSombra.post('/admin/rewards/sombra/:repartidorId/calcular', async (c) => {
  soloPruebas(c.req.url);
  exigir(c, 'admin');
  const env = { ...c.env, ENTORNO_RELOJ: entornoDe(c.req.url) } as EnvRewards;
  if (modoRewards(env) !== 'sombra')
    throw new ErrorDatos('El modo sombra está apagado.', undefined, 409);
  const r = await calcularYGuardar(
    base(c),
    c.req.param('repartidorId'),
    new Date().toISOString().slice(0, 10),
  );
  return c.json(r);
});

// ---------------------------------------------------------------- C-REWARDS-MI-NIVEL (R2)

const MAXIMOS = new Map([
  ['finalizacion', 30],
  ['puntualidad', 25],
  ['calidad', 20],
  ['satisfaccion', 15],
  ['aceptacion', 10],
]);

/** «Mi nivel» en Driver: el puntaje explicado, la experiencia por servicio y el avance al hito. */
rewardsSombra.get('/repartidor/mi-nivel', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const env: EnvRewards = { ...c.env, ENTORNO_RELOJ: entornoDe(c.req.url) };
  const rep = await reputacionVisible(env, db, u.id);
  if (!rep) throw new ErrorDatos('Tu nivel todavía no está activo.', undefined, 404);
  const f = await db
    .prepare(
      'SELECT componentes_json, experiencia_json, elegibilidad, fecha FROM reputacion_diaria WHERE repartidor_id = ? ORDER BY fecha DESC LIMIT 1',
    )
    .bind(u.id)
    .first<{
      componentes_json: string;
      experiencia_json: string;
      elegibilidad: string;
      fecha: string;
    }>();
  const crudos = new Map(
    Object.entries(
      JSON.parse(f?.componentes_json ?? '{}') as Record<string, { valor: number; puntos: number }>,
    ),
  );
  const componentes = Object.fromEntries(
    [...MAXIMOS].map(([k, maximo]) => {
      const x = crudos.get(k);
      return [k, { valor: x?.valor ?? null, puntos: x?.puntos ?? 0, maximo }];
    }),
  );
  const hito = HITOS_FASE2[0];
  const { cuentan } = unidadesQueCuentan(await itemsParaHito(db, u.id));
  return c.json({
    ...rep,
    fecha: f?.fecha ?? null,
    elegibilidad: f?.elegibilidad ?? 'sin_datos',
    componentes,
    experiencia: JSON.parse(f?.experiencia_json ?? '{}') as Record<string, number>,
    hito: hito ? { meta: hito.unidades, contadas: Math.min(cuentan, hito.unidades) } : null,
  });
});

// ---------------------------------------------------------------- C-REWARDS-AJUSTES (R3)

rewardsSombra.get('/admin/rewards/ajustes', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: presupuestos } = await db
    .prepare(
      'SELECT zona_id AS zona, mes, programa, tope_centavos AS centavos FROM rewards_presupuesto ORDER BY mes DESC, zona_id LIMIT 50',
    )
    .all();
  return c.json({ ajustes: await leerAjustes(db), presupuestos });
});

rewardsSombra.put('/admin/rewards/ajustes', async (c) => {
  const yo = exigir(c, 'admin');
  const nivel = z.number().min(1).max(100);
  const d = await leerCuerpo(
    c,
    z
      .object({
        umbrales: z.object({ plata: nivel, oro: nivel, diamante: nivel }),
        porcentajeMargen: z.number().min(0).max(50),
        topePremioCentavos: z.number().int().min(0).max(1_000_000),
        hitoUnidades: z.number().int().min(10).max(10_000),
        prioridadDespacho: z.boolean().default(false),
        presupuesto: z
          .object({
            zona: z.string().min(2).max(64),
            mes: z.string().regex(/^\d{4}-\d{2}$/),
            centavos: z.number().int().min(0).max(100_000_000),
          })
          .optional(),
      })
      .refine((x) => x.umbrales.plata < x.umbrales.oro && x.umbrales.oro < x.umbrales.diamante, {
        message: 'Los umbrales van en orden: Plata menor que Oro, y Oro menor que Diamante.',
        path: ['umbrales'],
      }),
  );
  const db = base(c);
  const { presupuesto, ...ajustes } = d;
  const lote = [
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES ('rewards_ajustes', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(JSON.stringify(ajustes)),
  ];
  if (presupuesto)
    lote.push(
      db
        .prepare(
          `INSERT INTO rewards_presupuesto (zona_id, mes, programa, tope_centavos) VALUES (?, ?, ?, ?)
           ON CONFLICT(zona_id, mes, programa) DO UPDATE SET tope_centavos = excluded.tope_centavos`,
        )
        .bind(
          presupuesto.zona,
          presupuesto.mes,
          HITOS_FASE2[0]?.programa ?? 'primer-hito-2026',
          presupuesto.centavos,
        ),
    );
  await db.batch(lote);
  console.warn('rewards: ajustes cambiados por', yo.id, JSON.stringify(d));
  return c.json({ ok: true });
});
