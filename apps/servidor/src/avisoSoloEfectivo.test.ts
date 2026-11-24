import { describe, expect, it } from 'vitest';
import { abrirCaracas, cargarPagoMovilVe, conductorListoVe, escenarioVe } from './pruebas/motoVe';
import { avisarSiQuedoActivo } from './activacion';
import type { Env } from './env';

/**
 * C-AVISO-SOLO-EFECTIVO (24 nov 2026, comprobación) — todos los países donde rige el pago móvil. Ya
 * existía (C-BARRA-ACTIVACION): cuando la cuenta del conductor queda activada sin su pago móvil, el
 * aviso único «Ya puedes recibir carreras» le dice que por ahora solo le llegan en efectivo. Esta
 * prueba lo fija.
 */
const activado = async (db: D1Database, id: string) =>
  db
    .prepare(
      `SELECT cuerpo_es, cuerpo_en FROM avisos_enviados WHERE usuario_id = ? AND tipo = 'conductor_activado'`,
    )
    .bind(id)
    .all<{ cuerpo_es: string; cuerpo_en: string }>();

describe('C-AVISO-SOLO-EFECTIVO', () => {
  it('sin pago móvil: «por ahora solo recibes carreras en efectivo», una sola vez', async () => {
    const e = await escenarioVe();
    expect((await abrirCaracas(e)).estado).toBe(201);
    const c = await conductorListoVe(e, 1000);
    const env = { DB: e.m.DB } as unknown as Env;
    await avisarSiQuedoActivo(env, e.m.DB, c.rep.id);
    await avisarSiQuedoActivo(env, e.m.DB, c.rep.id);
    const { results } = await activado(e.m.DB, c.rep.id);
    expect(results).toHaveLength(1);
    expect(results[0]!.cuerpo_es).toContain('solo recibes carreras en efectivo');
    expect(results[0]!.cuerpo_en).toContain('only get cash trips');
  });

  it('con su pago móvil cargado, el aviso no habla de efectivo', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const c = await conductorListoVe(e, 1000);
    await cargarPagoMovilVe(c);
    await e.m.DB.prepare(
      'UPDATE repartidores SET activacion_avisada_en = NULL WHERE usuario_id = ?',
    )
      .bind(c.rep.id)
      .run();
    await e.m.DB.prepare("DELETE FROM avisos_enviados WHERE tipo = 'conductor_activado'").run();
    await avisarSiQuedoActivo({ DB: e.m.DB } as unknown as Env, e.m.DB, c.rep.id);
    const { results } = await activado(e.m.DB, c.rep.id);
    expect(results).toHaveLength(1);
    expect(results[0]!.cuerpo_es).not.toContain('efectivo');
  });
});
