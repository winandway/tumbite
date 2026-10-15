import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { mundo } from '../pruebas/ayuda';

/**
 * Diagnóstico del sitio de pruebas (Fase 0): doble cerrojo (dominio de pruebas + secreto del
 * reloj) y cada prueba S corre de verdad contra la base y la deja limpia.
 */
const SEC = `reloj-${crypto.randomUUID()}`;

function preparar(extra: Record<string, unknown> = {}) {
  const m = mundo({ RELOJ_SECRETO: SEC, ...extra });
  const pedir = async (
    ruta: string,
    cuerpo?: unknown,
    host = 'http://localhost',
    secreto = SEC,
  ) => {
    const res = await app.request(
      `${host}/datos/interno/diagnostico/${ruta}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-reloj-secreto': secreto },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      },
      { DB: m.DB, RELOJ_SECRETO: SEC, ...extra },
    );
    return { estado: res.status, datos: (await res.json().catch(() => ({}))) as any };
  };
  return { m, pedir };
}

describe('diagnóstico del sitio de pruebas', () => {
  it('no existe en tumbite.com ni sin el secreto correcto', async () => {
    const { pedir } = preparar();
    expect((await pedir('s7', undefined, 'https://tumbite.com')).estado).toBe(404);
    expect((await pedir('s7', undefined, 'https://staging.tumbite.com', 'otro')).estado).toBe(404);
    expect((await pedir('s7', undefined, 'https://staging.tumbite.com')).estado).toBe(200);
  });

  it('S2, S3, S5 y S7 pasan y no dejan rastro', async () => {
    const { m, pedir } = preparar();
    const s2 = await pedir('s2');
    expect(s2.datos.ok, JSON.stringify(s2.datos)).toBe(true);
    expect((await pedir('s3')).datos.ok).toBe(true);
    const s4 = (await pedir('s4')).datos;
    expect(Object.keys(s4.tiempos)).toEqual(['despacho', 'saldo', 'restaurantes', 'retiros']);
    expect(s4.tiempos.saldo).toHaveProperty('baseMediana');
    expect(s4.tiempos.saldo).toHaveProperty('viajeMediana');
    expect((await pedir('s7')).datos).toMatchObject({
      ok: true,
      loteFallo: true,
      filasQuedaron: 0,
    });
    const { datos: p } = await pedir('s5/preparar');
    const r = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        pedir('s5/aceptar', { tabla: p.tabla, conductor: `c${i}` }),
      ),
    );
    expect(r.filter((x) => x.datos.gano).length).toBe(1);
    expect((await pedir('s5/cerrar', { tabla: p.tabla })).datos.ganador).toMatch(/^c\d+$/);
    const restos = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'zz_%' UNION ALL SELECT COUNT(*) FROM usuarios WHERE id LIKE 'zz-%'",
    ).all<{ n: number }>();
    expect(restos.results.map((x) => x.n)).toEqual([0, 0]);
  });

  it('S5 no acepta nombres de tabla arbitrarios', async () => {
    const { pedir } = preparar();
    expect((await pedir('s5/cerrar', { tabla: 'usuarios' })).estado).toBe(400);
  });

  it('S11 se niega sin llaves de modo prueba (nunca con llaves reales)', async () => {
    const { pedir } = preparar({ STRIPE_SECRET_KEY: 'sk_live_x' });
    const r = await pedir('s11');
    expect(r.datos.ok).toBe(false);
    expect(r.datos.omitido).toBeTruthy();
  });
});
