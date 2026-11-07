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
  /** Un pedido cobrado de 200,00 con sus filas de devolución, y lo que dice Stripe de él. */
  type Reembolso = {
    id: string;
    amount: number;
    status: string;
    metadata?: Record<string, string>;
  };
  async function conciliarCon(
    reembolsos: Reembolso[],
    op: {
      devoluciones?: [string, number][];
      ajustes?: [string, number][];
      estado?: string;
      /** LAN-2: propina después de entregar (lo guardado, lo que tiene Stripe y lo abonado). */
      propina?: { centavos: number; stripe: number; estado?: string; abonado: number };
      /** LAN-2x: la autorización vieja que se reemplazó al cambiar la dirección y su estado. */
      reautorizado?: { estado: string };
      /** LAN-2z: varias autorizaciones reemplazadas, cada una con su estado en Stripe. */
      reautorizados?: { viejo: string; estado: string }[];
    } = {},
  ) {
    vi.stubGlobal('fetch', async (url: string) => {
      const u = new URL(url);
      if (u.pathname === '/v1/refunds') return Response.json({ data: reembolsos });
      const otra = op.reautorizados?.find((x) => u.pathname === `/v1/payment_intents/${x.viejo}`);
      if (otra) return Response.json({ id: otra.viejo, status: otra.estado });
      if (u.pathname === '/v1/payment_intents/pi_viejo')
        return Response.json({ id: 'pi_viejo', status: op.reautorizado?.estado ?? 'canceled' });
      if (u.pathname === '/v1/payment_intents/pi_prop')
        return Response.json({
          status: op.propina?.estado ?? 'succeeded',
          amount_received: op.propina?.stripe ?? 0,
        });
      if (u.pathname.startsWith('/v1/payment_intents/'))
        return Response.json({ status: 'succeeded', amount_received: 20000 });
      return Response.json({ data: [] });
    });
    try {
      const { m, pedir } = preparar({ STRIPE_SECRET_KEY: 'sk_test_x' });
      await m.DB.prepare('PRAGMA foreign_keys = OFF').run();
      await m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno,
           propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, stripe_sesion, stripe_pago, entregado_en)
         VALUES ('zz-dual', 'c', 'r', ?, '[]', 20000, 0, 0, 0, 0, 20000, 0, 0, 0, 0, 0, 'basico', 'x', 'pi_dual', 'pi_dual', datetime('now'))`,
      )
        .bind(op.estado ?? 'entregado')
        .run();
      await m.DB.prepare(
        "INSERT INTO cobros (pedido_id, capturado_en, capturado) VALUES ('zz-dual', datetime('now'), 20000)",
      ).run();
      for (const [re, monto] of op.devoluciones ?? [])
        await m.DB.prepare(
          "INSERT INTO devoluciones (id, pedido_id, monto, stripe_reembolso) VALUES (?, 'zz-dual', ?, ?)",
        )
          .bind(`d-${re}`, monto, re)
          .run();
      for (const [re, monto] of op.ajustes ?? [])
        await m.DB.prepare(
          "INSERT INTO devoluciones_ajuste (id, pedido_id, plato_id, monto, stripe_reembolso, clave) VALUES (?, 'zz-dual', 'pl', ?, ?, ?)",
        )
          .bind(`a-${re}`, monto, re, `ajuste-zz-dual-${re}`)
          .run();
      for (const [i, x] of (op.reautorizados ?? []).entries())
        await m.DB.prepare(
          "INSERT INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES ('zz-dual', ?, ?)",
        )
          .bind(
            `cobro_reautorizado:${x.viejo}`,
            `${x.viejo}>${op.reautorizados![i + 1]?.viejo ?? 'pi_dual'}`,
          )
          .run();
      if (op.reautorizado)
        await m.DB.prepare(
          "INSERT INTO bitacora_pedidos (pedido_id, evento, detalle) VALUES ('zz-dual', 'cobro_reautorizado', 'pi_viejo>pi_dual')",
        ).run();
      if (op.propina) {
        await m.DB.prepare(
          "INSERT INTO propinas_extra (pedido_id, centavos, stripe_pago) VALUES ('zz-dual', ?, 'pi_prop')",
        )
          .bind(op.propina.centavos)
          .run();
        await m.DB.prepare(
          "INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto, referencia) VALUES ('mv-prop', 'rep', 'zz-dual', ?, 'ajuste', 'propina-extra-zz-dual')",
        )
          .bind(op.propina.abonado)
          .run();
      }
      const casos = (await pedir('conciliacion', { pedidos: ['zz-dual'] })).datos.casos as {
        nombre: string;
        ok: boolean;
        detalle: string;
      }[];
      return { caso: casos.find((x) => x.nombre.startsWith('cada cobro'))!, pedir };
    } finally {
      vi.unstubAllGlobals();
    }
  }
  const ok = (id: string, amount: number, metadata?: Record<string, string>): Reembolso => ({
    id,
    amount,
    status: 'succeeded',
    ...(metadata ? { metadata } : {}),
  });

  it('NXT-2: cada devolución es UN reembolso exacto en Stripe (ni dos veces ni de menos)', async () => {
    const doble = (
      await conciliarCon([ok('re_1', 15000), ok('re_2', 15000)], {
        devoluciones: [['re_1', 15000]],
      })
    ).caso;
    expect(doble.ok).toBe(false);
    expect(doble.detalle).toContain('reembolso re_2 de 15000 en Stripe sin explicar');
    expect(doble.nombre).toContain('(1 pedidos)');
    expect(
      (await conciliarCon([ok('re_1', 15000)], { devoluciones: [['re_1', 15000]] })).caso.ok,
    ).toBe(true);
    // De menos: la base dice 150 y Stripe devolvió 100.
    const menos = (await conciliarCon([ok('re_1', 10000)], { devoluciones: [['re_1', 15000]] }))
      .caso;
    expect(menos.ok).toBe(false);
    expect(menos.detalle).toContain('base devolvió 15000 en 1, Stripe 10000 en 1 reembolsos');
  });

  it('NXT-2x: un reembolso en Stripe SIN fila de devolución sale en rojo', async () => {
    const r = (await conciliarCon([ok('re_x', 15000)])).caso;
    expect(r.ok).toBe(false);
    expect(r.detalle).toContain('reembolso re_x de 15000 en Stripe sin explicar');
  });

  it('NXT-2x: dos reembolsos de 75 para una devolución de 150 salen en rojo', async () => {
    const r = (
      await conciliarCon([ok('re_1', 7500), ok('re_2', 7500)], { devoluciones: [['re_1', 15000]] })
    ).caso;
    expect(r.ok).toBe(false);
  });

  it('NXT-2x: dos devoluciones en la base y un solo reembolso por la misma suma salen en rojo', async () => {
    const r = (
      await conciliarCon([ok('re_1', 15000)], {
        devoluciones: [
          ['re_1', 7500],
          ['re_2', 7500],
        ],
      })
    ).caso;
    expect(r.ok).toBe(false);
    expect(r.detalle).toContain('base devolvió 15000 en 2, Stripe 15000 en 1 reembolsos');
  });

  it('NXT-2x: un reembolso fallido o cancelado no cuenta', async () => {
    const fallido = { id: 're_f', amount: 15000, status: 'failed' };
    const cancelado = { id: 're_c', amount: 15000, status: 'canceled' };
    expect(
      (
        await conciliarCon([fallido, cancelado, ok('re_1', 15000)], {
          devoluciones: [['re_1', 15000]],
        })
      ).caso.ok,
    ).toBe(true);
    // Solo el fallido: la devolución de la base no está en Stripe.
    const r = (
      await conciliarCon([{ ...fallido, id: 're_1' }], { devoluciones: [['re_1', 15000]] })
    ).caso;
    expect(r.ok).toBe(false);
    expect(r.detalle).toContain('Stripe 0 en 0 reembolsos');
    // Fallidos sin fila tampoco son alarma.
    expect((await conciliarCon([fallido])).caso.ok).toBe(true);
  });

  it('NXT-2x: el plato agotado después de cobrar y la cancelación de un pedido cancelado están explicados', async () => {
    expect(
      (
        await conciliarCon([ok('re_a', 1200, { pedido_id: 'zz-dual', motivo: 'plato_agotado' })], {
          ajustes: [['re_a', 1200]],
        })
      ).caso.ok,
    ).toBe(true);
    // El de OTRO pedido con la misma marca no explica este.
    expect(
      (
        await conciliarCon([ok('re_a', 1200, { pedido_id: 'otro', motivo: 'plato_agotado' })], {
          ajustes: [['re_a', 1200]],
        })
      ).caso.ok,
    ).toBe(false);
    expect(
      (await conciliarCon([ok('re_c', 20000, { pedido_id: 'zz-dual' })], { estado: 'cancelado' }))
        .caso.ok,
    ).toBe(true);
    // Un reembolso «de cancelación» en un pedido entregado no se explica.
    expect((await conciliarCon([ok('re_c', 20000, { pedido_id: 'zz-dual' })])).caso.ok).toBe(false);
  });

  it('ETP-2: cada reembolso por plato agotado cuadra con su fila por id y por monto exacto', async () => {
    const agotado = (id: string, monto: number) =>
      ok(id, monto, { pedido_id: 'zz-dual', motivo: 'plato_agotado' });
    // Dos faltantes, dos filas, dos reembolsos: cuadra.
    expect(
      (
        await conciliarCon([agotado('re_a', 1200), agotado('re_b', 350)], {
          ajustes: [
            ['re_a', 1200],
            ['re_b', 350],
          ],
        })
      ).caso.ok,
    ).toBe(true);
    // Monto distinto: rojo.
    const distinto = (await conciliarCon([agotado('re_a', 1500)], { ajustes: [['re_a', 1200]] }))
      .caso;
    expect(distinto.ok).toBe(false);
    expect(distinto.detalle).toContain('reembolso re_a de 1500 por plato agotado');
    // Sin su fila (la primera devolución que se perdía): rojo.
    const sinFila = (await conciliarCon([agotado('re_a', 1200)])).caso;
    expect(sinFila.ok).toBe(false);
    expect(sinFila.detalle).toContain('reembolso re_a de 1200 por plato agotado');
    // Una fila sin su reembolso en Stripe: rojo.
    const sinReembolso = (await conciliarCon([], { ajustes: [['re_a', 1200]] })).caso;
    expect(sinReembolso.ok).toBe(false);
    expect(sinReembolso.detalle).toContain('devolución por plato agotado re_a de 1200');
  });

  it('LAN-2: la propina después de entregar cuadra con su cobro aparte en Stripe y con lo abonado al repartidor', async () => {
    expect(
      (await conciliarCon([], { propina: { centavos: 300, stripe: 300, abonado: 300 } })).caso.ok,
    ).toBe(true);
    const otroMonto = (
      await conciliarCon([], { propina: { centavos: 300, stripe: 500, abonado: 300 } })
    ).caso;
    expect(otroMonto.ok).toBe(false);
    expect(otroMonto.detalle).toContain('propina después de entregar de 300');
    const sinCobrar = (
      await conciliarCon([], {
        propina: { centavos: 300, stripe: 0, estado: 'requires_payment_method', abonado: 300 },
      })
    ).caso;
    expect(sinCobrar.ok).toBe(false);
    const abonoDistinto = (
      await conciliarCon([], { propina: { centavos: 300, stripe: 300, abonado: 200 } })
    ).caso;
    expect(abonoDistinto.ok).toBe(false);
    expect(abonoDistinto.detalle).toContain('abonado al repartidor 200');
  });

  it('LAN-2x: la autorización vieja de un cambio de dirección tiene que estar anulada en Stripe', async () => {
    expect((await conciliarCon([], { reautorizado: { estado: 'canceled' } })).caso.ok).toBe(true);
    const suelta = (await conciliarCon([], { reautorizado: { estado: 'requires_capture' } })).caso;
    expect(suelta.ok).toBe(false);
    expect(suelta.detalle).toContain('autorización vieja pi_viejo sin anular');
  });

  it('LAN-2z: con dos cambios seguidos, la conciliación revisa CADA autorización reemplazada', async () => {
    expect(
      (
        await conciliarCon([], {
          reautorizados: [
            { viejo: 'pi_a', estado: 'canceled' },
            { viejo: 'pi_b', estado: 'canceled' },
          ],
        })
      ).caso.ok,
    ).toBe(true);
    const medio = (
      await conciliarCon([], {
        reautorizados: [
          { viejo: 'pi_a', estado: 'canceled' },
          { viejo: 'pi_b', estado: 'requires_capture' },
        ],
      })
    ).caso;
    expect(medio.ok).toBe(false);
    expect(medio.detalle).toContain('autorización vieja pi_b sin anular');
  });

  it('NXT-2: un pedido pedido que no existe no pasa en silencio', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      new URL(url).pathname.startsWith('/v1/payment_intents/')
        ? Response.json({ status: 'succeeded', amount_received: 20000 })
        : Response.json({ data: [] }),
    );
    try {
      const { pedir } = preparar({ STRIPE_SECRET_KEY: 'sk_test_x' });
      const falta = (
        (await pedir('conciliacion', { pedidos: ['zz-no'] })).datos.casos as {
          nombre: string;
          ok: boolean;
          detalle: string;
        }[]
      ).find((x) => x.nombre.startsWith('cada cobro'))!;
      expect(falta.ok).toBe(false);
      expect(falta.detalle).toContain('de 1 pedidos pedidos se encontraron 0');
    } finally {
      vi.unstubAllGlobals();
    }
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

describe('C-SIN-CARGA-NUBE', () => {
  it('S3 (carga de 10.000 filas) no toca la base en el sitio de pruebas de la nube', async () => {
    const { m, pedir } = preparar();
    const r = await pedir('s3', undefined, 'https://staging.tumbite.com');
    expect(r.estado).toBe(200);
    expect(r.datos.omitida).toMatch(/solo en local/);
    const t = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'zz_s3_%'",
    ).first<{ n: number }>();
    expect(t?.n).toBe(0);
  });
});
