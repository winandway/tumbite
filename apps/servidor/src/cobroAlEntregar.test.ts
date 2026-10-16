import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { pedirRetiro } from './retiros';
import { liquidarPendientes } from './liquidaciones';
import { TAREAS_RELOJ } from './rutas/operacion';

/**
 * Entrega 1b · C-COBRO-AL-ENTREGAR (16 oct 2026). Ficha: docs/investigaciones-rea/2026-10-16-cobro-al-entregar.md.
 *
 * Stripe simulado que se porta como dice su documentación:
 *  - una sola captura por pago (`requires_capture` → `succeeded`; capturar otra vez da 400);
 *  - la misma clave de idempotencia devuelve la respuesta guardada, INCLUIDOS los 500;
 *  - GET /payment_intents/:id dice el estado real.
 * Se le pueden inyectar fallos: un 500 en la próxima captura, o cobrar y «perder» la respuesta.
 */
type Falla = 'ninguna' | '500' | 'cobra-y-pierde-respuesta' | 'red';

function stripeFalso() {
  const pi = { id: 'pi_1', status: 'requires_capture', amount_received: 0 };
  const guardadas = new Map<string, Response>();
  let proxima: Falla = 'ninguna';
  const capturasReales: number[] = [];
  const intentos: { clave: string; resultado: string }[] = [];
  const fetchFalso = async (url: string, init?: RequestInit) => {
    const u = String(url);
    const metodo = String(init?.method ?? 'GET');
    const clave = (init?.headers as Record<string, string> | undefined)?.['idempotency-key'] ?? '';
    if (/\/payment_intents\/pi_1\/capture$/.test(u) && metodo === 'POST') {
      if (clave && guardadas.has(clave)) {
        intentos.push({ clave, resultado: 'guardada' });
        return guardadas.get(clave)!.clone();
      }
      const falla = proxima;
      proxima = 'ninguna';
      if (falla === 'red') {
        intentos.push({ clave, resultado: 'red' });
        throw new Error('red: sin respuesta');
      }
      if (falla === '500') {
        const r = new Response(JSON.stringify({ error: { message: 'Stripe interno' } }), {
          status: 500,
        });
        if (clave) guardadas.set(clave, r.clone());
        intentos.push({ clave, resultado: '500' });
        return r;
      }
      if (pi.status !== 'requires_capture') {
        const r = new Response(
          JSON.stringify({
            error: {
              message: `This PaymentIntent could not be captured because it has a status of ${pi.status}.`,
            },
          }),
          { status: 400 },
        );
        if (clave) guardadas.set(clave, r.clone());
        intentos.push({ clave, resultado: '400' });
        return r;
      }
      const body = new URLSearchParams(String(init?.body ?? ''));
      const monto = Number(body.get('amount_to_capture') ?? 0);
      pi.status = 'succeeded';
      pi.amount_received = monto;
      capturasReales.push(monto);
      intentos.push({ clave, resultado: 'cobrada' });
      if (falla === 'cobra-y-pierde-respuesta') throw new Error('red: la respuesta se perdió');
      const r = new Response(JSON.stringify({ ...pi }), { status: 200 });
      if (clave) guardadas.set(clave, r.clone());
      return r;
    }
    if (/\/payment_intents\/pi_1$/.test(u) && metodo === 'GET')
      return new Response(JSON.stringify({ ...pi }), { status: 200 });
    if (/\/payment_intents$/.test(u) && metodo === 'POST')
      return new Response(JSON.stringify({ id: 'pi_1', client_secret: 'pi_1_secret_x' }), {
        status: 200,
      });
    return new Response(JSON.stringify({ id: 'cus_1', client_secret: 'cuss_x' }), { status: 200 });
  };
  return {
    fetchFalso,
    pi,
    capturasReales,
    intentos,
    fallar: (f: Falla) => {
      proxima = f;
    },
  };
}

async function escenario() {
  const st = stripeFalso();
  vi.stubGlobal('fetch', st.fetchFalso);
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  await m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
    { estado: 'aprobado' },
    admin.token,
  );
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  const p = await m.llamar(
    'POST',
    '/datos/pedidos',
    {
      restauranteId: r.datos.restaurante.id,
      lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
      propinaCentavos: 300,
      direccion: '300 Calle Prueba',
      lat: 25.775,
      lng: -80.195,
    },
    cliente.token,
  );
  const id = p.datos.pedidoId as string;
  await m.DB.prepare(
    "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
  )
    .bind(id)
    .run();
  await m.DB.prepare('INSERT OR IGNORE INTO cobros (pedido_id) VALUES (?)').bind(id).run();
  const rep = await m.cuenta('repartidor');
  await m.llamar(
    'POST',
    '/datos/repartidor/conectar',
    { conectado: true, lat: 25.771, lng: -80.191 },
    rep.token,
  );
  await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
  await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
  await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
  await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
  await m.recoger(id, rep.token, dueno.token);
  const total = Number(
    (await m.DB.prepare('SELECT total FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ total: number }>())!.total,
  );
  const estado = async () =>
    (
      await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;
  const liquidacion = async () =>
    m.DB.prepare('SELECT estado, intentos FROM liquidaciones WHERE pedido_id = ?')
      .bind(id)
      .first<{ estado: string; intentos: number }>()
      .catch(() => null);
  const movimientos = async () =>
    (
      await m.DB.prepare('SELECT usuario_id, concepto, monto FROM movimientos WHERE pedido_id = ?')
        .bind(id)
        .all<{ usuario_id: string; concepto: string; monto: number }>()
    ).results;
  const capturado = async () =>
    m.DB.prepare('SELECT capturado_en, capturado FROM cobros WHERE pedido_id = ?')
      .bind(id)
      .first<{ capturado_en: string | null; capturado: number | null }>();
  /** Hace que la base falle UNA vez en la sentencia que coincida (corte de D1 a medias). */
  const fallarBase = (patron: RegExp) => {
    const original = m.DB.prepare.bind(m.DB);
    let hecho = false;
    m.DB.prepare = ((sql: string) => {
      if (!hecho && patron.test(sql)) {
        hecho = true;
        throw new Error('D1: corte a medias (simulado)');
      }
      return original(sql);
    }) as typeof m.DB.prepare;
    return () => {
      m.DB.prepare = original;
    };
  };
  /** Adelanta el reloj de los reintentos: todo lo programado ya venció. */
  const vencerEsperas = () =>
    m.DB.prepare(
      "UPDATE liquidaciones SET proximo_en = datetime('now', '-1 minute'), actualizado_en = datetime('now', '-10 minutes')",
    ).run();
  const reloj = () =>
    liquidarPendientes({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' } as never, m.DB);
  return {
    m,
    st,
    id,
    rep,
    dueno,
    total,
    estado,
    liquidacion,
    movimientos,
    capturado,
    fallarBase,
    vencerEsperas,
    reloj,
  };
}

describe('cobro al entregar: A · Stripe cobra y D1 falla (C-COBRO-AL-ENTREGAR)', () => {
  it('A1 · Stripe cobra y falla la escritura del cobro: el pedido queda entregado y el reloj confirma el cobro sin cobrar dos veces', async () => {
    const e = await escenario();
    const restaurar = e.fallarBase(/UPDATE cobros SET capturado_en/);
    const r = await e.m.entregar(e.id, e.rep.token);
    restaurar();
    expect(r.estado).toBe(200);
    expect(await e.estado()).toBe('entregado');
    expect(e.st.capturasReales).toEqual([e.total]);
    // El reloj encuentra la liquidación a medias, pregunta a Stripe (ya cobró) y la cierra.
    await e.vencerEsperas();
    await e.reloj();
    expect((await e.liquidacion())?.estado).toBe('capturada');
    expect((await e.capturado())?.capturado).toBe(e.total);
    expect(e.st.capturasReales).toEqual([e.total]);
  });

  it('A2 · falla el lote de la entrega: NO se cobra nada; al reintentar se entrega y se cobra una vez', async () => {
    const e = await escenario();
    const restaurar = e.fallarBase(/UPDATE pedidos SET estado = 'entregado'/);
    const r = await e.m.entregar(e.id, e.rep.token);
    restaurar();
    expect(r.estado).toBeGreaterThanOrEqual(500);
    expect(await e.estado()).toBe('en_camino');
    expect(e.st.capturasReales).toEqual([]);
    expect(await e.movimientos()).toEqual([]);
    expect((await e.m.entregar(e.id, e.rep.token)).estado).toBe(200);
    expect(await e.estado()).toBe('entregado');
    expect(e.st.capturasReales).toEqual([e.total]);
  });
});

describe('cobro al entregar: B · D1 registra y Stripe falla', () => {
  it('B1 · Stripe da 500 al capturar: la entrega se registra igual (200), el cobro queda «reintentar» y el reloj lo cobra con una clave nueva', async () => {
    const e = await escenario();
    e.st.fallar('500');
    const r = await e.m.entregar(e.id, e.rep.token);
    expect(r.estado).toBe(200);
    expect(await e.estado()).toBe('entregado');
    expect(e.st.capturasReales).toEqual([]);
    expect((await e.liquidacion())?.estado).toBe('reintentar');
    await e.vencerEsperas();
    await e.reloj();
    expect((await e.liquidacion())?.estado).toBe('capturada');
    expect(e.st.capturasReales).toEqual([e.total]);
    // Nunca se reusó la clave con el 500 guardado.
    const claves = e.st.intentos.map((x) => x.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('B2 · Stripe cobra pero la respuesta se pierde: se verifica con GET y queda capturada, una sola captura', async () => {
    const e = await escenario();
    e.st.fallar('cobra-y-pierde-respuesta');
    expect((await e.m.entregar(e.id, e.rep.token)).estado).toBe(200);
    expect((await e.liquidacion())?.estado).toBe('capturada');
    expect(e.st.capturasReales).toEqual([e.total]);
  });

  it('B3 · Stripe no responde (red): «reintentar»; el reloj verifica que sigue autorizado y cobra una vez', async () => {
    const e = await escenario();
    e.st.fallar('red');
    expect((await e.m.entregar(e.id, e.rep.token)).estado).toBe(200);
    expect((await e.liquidacion())?.estado).toBe('reintentar');
    await e.vencerEsperas();
    await e.reloj();
    await e.vencerEsperas();
    await e.reloj();
    expect((await e.liquidacion())?.estado).toBe('capturada');
    expect(e.st.capturasReales).toEqual([e.total]);
  });

  it('B4 · la autorización venció (canceled): pasa a «revision», la salud se pone en rojo y no se cobra', async () => {
    const e = await escenario();
    e.st.pi.status = 'canceled';
    expect((await e.m.entregar(e.id, e.rep.token)).estado).toBe(200);
    expect((await e.liquidacion())?.estado).toBe('revision');
    expect(e.st.capturasReales).toEqual([]);
    const salud = (await (await e.m.crudo('/datos/salud', {})).json()) as {
      piezas: Record<string, string>;
    };
    expect(salud.piezas.cobros).toBe('error');
  });

  it('B5 · tras 6 intentos fallidos pasa a «revision» (no reintenta para siempre)', async () => {
    const e = await escenario();
    e.st.fallar('500');
    await e.m.entregar(e.id, e.rep.token);
    for (let i = 0; i < 8; i++) {
      e.st.fallar('500');
      await e.vencerEsperas();
      await e.reloj();
    }
    const l = await e.liquidacion();
    expect(l?.estado).toBe('revision');
    expect(Number(l?.intentos)).toBeLessThanOrEqual(6);
    expect(e.st.capturasReales).toEqual([]);
  });
});

describe('cobro al entregar: protecciones', () => {
  it('doble entrega simultánea: una sola liquidación, una sola captura, abonos una vez', async () => {
    const e = await escenario();
    const [a, b] = await Promise.all([
      e.m.entregar(e.id, e.rep.token),
      e.m.entregar(e.id, e.rep.token),
    ]);
    expect([a.estado, b.estado].sort()).toEqual([200, 409]);
    expect(e.st.capturasReales).toEqual([e.total]);
    const movs = await e.movimientos();
    const conceptos = movs.map((x) => `${x.usuario_id}:${x.concepto}`);
    expect(new Set(conceptos).size).toBe(conceptos.length);
  });

  it('dos vueltas del reloj a la vez: un solo intento de captura', async () => {
    const e = await escenario();
    e.st.fallar('500');
    await e.m.entregar(e.id, e.rep.token);
    await e.vencerEsperas();
    await Promise.all([e.reloj(), e.reloj()]);
    expect(e.st.capturasReales).toEqual([e.total]);
    expect((await e.liquidacion())?.estado).toBe('capturada');
  });

  it('C · lo abonado de un pedido sin cobro confirmado no se puede retirar; al capturar, sí', async () => {
    const e = await escenario();
    e.st.fallar('500');
    await e.m.entregar(e.id, e.rep.token);
    const ganado = (await e.movimientos())
      .filter((x) => x.usuario_id === e.rep.id)
      .reduce((s, x) => s + Number(x.monto), 0);
    expect(ganado).toBeGreaterThan(0);
    expect(await pedirRetiro(e.m.DB, e.rep.id, 'acct_1', ganado)).toBeNull();
    await e.vencerEsperas();
    await e.reloj();
    expect((await e.liquidacion())?.estado).toBe('capturada');
    expect(await pedirRetiro(e.m.DB, e.rep.id, 'acct_1', ganado)).not.toBeNull();
  });

  it('el aviso payment_intent.succeeded también cierra una liquidación a medias', async () => {
    const e = await escenario();
    e.st.fallar('red');
    await e.m.entregar(e.id, e.rep.token);
    expect((await e.liquidacion())?.estado).toBe('reintentar');
    // Stripe cobró por su cuenta (p. ej. el equipo capturó desde el panel) y avisa.
    e.st.pi.status = 'succeeded';
    await e.m.DB.prepare("UPDATE pedidos SET stripe_sesion = 'pi_1' WHERE id = ?").bind(e.id).run();
    const { liquidarDesdeAviso } = await import('./liquidaciones');
    await liquidarDesdeAviso(e.m.DB, e.id, e.total);
    expect((await e.liquidacion())?.estado).toBe('capturada');
  });

  it('la tarea «liquidaciones» está en el reloj seguro como crítica', () => {
    const t = TAREAS_RELOJ.find((x) => x.nombre === 'liquidaciones');
    expect(t?.critica).toBe(true);
  });

  it('la salud dice cobros: ok cuando todo está capturado', async () => {
    const e = await escenario();
    expect((await e.m.entregar(e.id, e.rep.token)).estado).toBe(200);
    expect((await e.liquidacion())?.estado).toBe('capturada');
    const salud = (await (await e.m.crudo('/datos/salud', {})).json()) as {
      piezas: Record<string, string>;
    };
    expect(salud.piezas.cobros).toBe('ok');
  });
});
