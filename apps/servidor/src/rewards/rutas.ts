import { Hono } from 'hono';
import type { Env } from '../env';
import { entornoDe } from '../entorno';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';
import { type EnvRewards, calcularYGuardar, modoRewards } from './sombra';

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
