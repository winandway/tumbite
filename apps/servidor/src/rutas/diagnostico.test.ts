import { describe, expect, it, vi } from 'vitest';
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
    const mp = await pedir('migraciones-prueba');
    expect(mp.datos.ok, JSON.stringify(mp.datos.casos)).toBe(true);
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

describe('diagnóstico de las fases 1 y 2 (validación en staging)', () => {
  it('F1, F2 y las migraciones pasan contra la base y no dejan rastro', async () => {
    const { m, pedir } = preparar();
    const dueno = await m.cuenta('restaurante');
    await m.DB.prepare(
      "INSERT INTO restaurantes (id, dueno_id, nombre, estado) VALUES ('r-diag', ?, 'Rest', 'aprobado')",
    )
      .bind(dueno.id)
      .run();
    const f1 = await pedir('f1');
    expect(f1.datos.ok, JSON.stringify(f1.datos.casos)).toBe(true);
    const f2 = await pedir('f2');
    expect(f2.datos.ok, JSON.stringify(f2.datos.casos)).toBe(true);
    const rep = await m.cuenta('repartidor', 'Rep Migra');
    await m.DB.prepare(
      "INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo) VALUES (?, 'bicicleta')",
    )
      .bind(rep.id)
      .run();
    expect((await pedir('migraciones', { paso: 'verificar' })).estado).toBe(200);
    expect((await pedir('migraciones', { paso: 'm4' })).datos.cambios).toEqual([1]);
    expect((await pedir('migraciones', { paso: 'm5' })).estado).toBe(200);
    const v = await pedir('migraciones', { paso: 'verificar' });
    expect(v.datos.resultados[2]).toEqual([{ sin_comida: 0 }]);
    expect(v.datos.resultados.at(-1)).toEqual([{ identidad_sin_evidencia: 0 }]);
    expect((await pedir('migraciones', { paso: 'revertir' })).estado).toBe(400); // la vuelta atrás no se corre desde aquí
    const restos = await m.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM usuarios WHERE id LIKE 'zz-%') + (SELECT COUNT(*) FROM zonas WHERE id LIKE 'ZZ-%') + (SELECT COUNT(*) FROM pedidos WHERE id LIKE 'zz-%') AS n",
    ).first<{ n: number }>();
    expect(restos?.n).toBe(0);
  });
});

describe('prueba en vivo del tiempo real (armado en staging)', () => {
  it('arma cuentas temporales con sesión, el pase sale para el repartidor y el cliente, y se borra todo', async () => {
    const secreto = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { m, pedir } = preparar({
      PASE_LLAVE_ID: 'p1',
      PASE_SECRETO_ACTUAL: secreto,
      TIEMPO_REAL_URL: 'https://tr.ejemplo.com',
    });
    const a = await pedir('vivo', { accion: 'armar', k: 'abc123' });
    expect(a.estado).toBe(200);
    const rep = await m.llamar('POST', '/datos/tiempo-real/pase', {}, a.datos.tokens.repLibre);
    expect(rep.estado).toBe(200);
    const cli = await m.llamar(
      'POST',
      '/datos/tiempo-real/pase',
      { pedidoId: a.datos.pedido },
      a.datos.tokens.cliente,
    );
    expect(cli.estado).toBe(200);
    expect((await pedir('vivo', { accion: 'leer', k: 'abc123' })).datos.posiciones).toHaveLength(2);
    await pedir('vivo', { accion: 'borrar', k: 'abc123' });
    const restos = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM usuarios WHERE id LIKE 'zz-vivo-%'",
    ).first<{ n: number }>();
    expect(restos?.n).toBe(0);
  });
});

describe('recorrido y conciliación en staging', () => {
  it('la consulta responde; pagar y conciliar se niegan sin Stripe de prueba', async () => {
    const { pedir } = preparar({ STRIPE_SECRET_KEY: 'sk_live_x' });
    expect(
      (await pedir('sql', { sql: "SELECT id FROM servicios WHERE id = 'comida'" })).datos.results,
    ).toEqual([{ id: 'comida' }]);
    expect((await pedir('confirmar-pago', { pedidoId: 'x' })).estado).toBe(409);
    expect((await pedir('conciliacion')).estado).toBe(409);
  });
  it('en tumbite.com tampoco existen', async () => {
    const { pedir } = preparar();
    expect((await pedir('sql', { sql: 'SELECT 1' }, 'https://tumbite.com')).estado).toBe(404);
  });
});

describe('diagnóstico F3 (exclusividad en el motor real)', () => {
  it('carrera de conductores, un conductor contra dos viajes y un pedido, y limpieza total', async () => {
    const { m, pedir } = preparar();
    await m.cuenta('cliente'); // la base queda migrada (vista de elegibles)
    const p = await pedir('f3/preparar', { conductores: 8 });
    expect(p.estado).toBe(200);
    const { carrera, dobleA, dobleB, pedido, conductores, sufijo } = p.datos;
    const r = await Promise.all(
      conductores.map((k: { id: string; vehiculo: string }, i: number) =>
        pedir('f3/aceptar', {
          operacion: carrera,
          conductor: k.id,
          vehiculo: k.vehiculo,
          clave: `c${i}`,
        }),
      ),
    );
    expect(r.filter((x) => x.datos.resultado === 'tomada')).toHaveLength(1);
    const k0 = conductores[0];
    const ganador = r.findIndex((x) => x.datos.resultado === 'tomada');
    // Si el primero ya ganó la carrera, el doble se prueba con el mismo: todo debe salir rechazado.
    const d = await Promise.all([
      pedir('f3/aceptar', {
        operacion: dobleA,
        conductor: k0.id,
        vehiculo: k0.vehiculo,
        clave: 'a',
      }),
      pedir('f3/aceptar', {
        operacion: dobleB,
        conductor: k0.id,
        vehiculo: k0.vehiculo,
        clave: 'b',
      }),
      pedir('f3/comida', { pedido, conductor: k0.id }),
    ]);
    const exitos =
      d.filter((x) => x.datos.resultado === 'tomada').length +
      (d[2]!.datos.tomado ? 1 : 0) +
      (ganador === 0 ? 1 : 0);
    expect(exitos).toBe(1);
    const fin = await pedir('f3/cerrar', { sufijo });
    expect(fin.datos.casos.filter((x: { ok: boolean }) => !x.ok)).toEqual([]);
    expect(fin.datos.ok).toBe(true);
  });
});

describe('diagnóstico del reloj seguro', () => {
  it('corre los casos con Stripe de prueba simulado y deja todo limpio', async () => {
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const u = String(url);
      const m = init?.method ?? 'GET';
      if (u.includes('/refunds')) return Response.json({ data: [] });
      if (u.endsWith('/cancel')) return Response.json({ id: 'pi_diag', status: 'canceled' });
      if (m === 'POST' && u.endsWith('/payment_intents'))
        return Response.json({ id: 'pi_diag', status: 'requires_capture' });
      if (m === 'GET' && u.includes('/payment_intents/pi_diag'))
        return Response.json({ id: 'pi_diag', status: 'canceled' });
      return Response.json({});
    });
    const { m, pedir } = preparar({ STRIPE_SECRET_KEY: 'sk_test_diag' });
    await m.cuenta('cliente');
    const r = await pedir('reloj');
    expect(r.datos.casos?.filter((x: { ok: boolean }) => !x.ok)).toEqual([]);
    expect(r.datos.ok).toBe(true);
    vi.unstubAllGlobals();
  });
});
