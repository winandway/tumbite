import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { liquidarPendientes } from './liquidaciones';
import { TAREAS_RELOJ } from './rutas/operacion';
import { capturarCobroViaje, soltarCobroViaje } from './viajesCobro';

/**
 * C-COBRO-SEGUNDO-PLANO (26 nov 2026, todos los países). Visto en el sitio de pruebas: el recorrido de
 * comida recargaba la pantalla justo después de entregar un pedido para recoger y el cobro quedaba
 * «capturando». En Cloudflare, cuando el cliente se va, la petición se cancela; solo sigue lo que
 * está bajo `waitUntil` (hasta 30 segundos). Antes, la captura en Stripe corría dentro de la petición:
 * al cortarse, quedaba a medias hasta que pasara el reloj (y en pruebas el reloj está en pausa).
 *
 * Cómo se simula el corte: el Stripe de mentira retiene la captura; mientras está retenida, la prueba
 * «se va» (no espera la respuesta) y deja seguir SOLO lo que se registró con waitUntil hasta ese
 * momento, como hace Cloudflare. Si el cobro no estaba protegido, queda «capturando»: rojo.
 */

function stripeFalso() {
  const pi = { id: 'pi_1', status: 'requires_capture', amount_received: 0 };
  const guardadas = new Map<string, Response>();
  let dar500 = 0;
  let getRoto = false;
  const capturas: number[] = [];
  let retener = false;
  let retenida = false;
  let soltar: (() => void) | null = null;
  const fetchFalso = async (url: string, init?: RequestInit) => {
    const u = String(url);
    const metodo = String(init?.method ?? 'GET');
    const clave = (init?.headers as Record<string, string> | undefined)?.['idempotency-key'] ?? '';
    if (/\/payment_intents\/pi_1\/capture$/.test(u) && metodo === 'POST') {
      if (clave && guardadas.has(clave)) return guardadas.get(clave)!.clone();
      if (dar500 > 0) {
        dar500--;
        const r = new Response(JSON.stringify({ error: { message: 'Stripe interno' } }), {
          status: 500,
        });
        if (clave) guardadas.set(clave, r.clone());
        return r;
      }
      if (retener) {
        retener = false;
        retenida = true;
        await new Promise<void>((ok) => (soltar = ok));
      }
      if (pi.status !== 'requires_capture')
        return new Response(JSON.stringify({ error: { message: `status ${pi.status}` } }), {
          status: 400,
        });
      const monto = Number(new URLSearchParams(String(init?.body ?? '')).get('amount_to_capture'));
      pi.status = 'succeeded';
      pi.amount_received = monto;
      capturas.push(monto);
      const r = new Response(JSON.stringify({ ...pi }), { status: 200 });
      if (clave) guardadas.set(clave, r.clone());
      return r;
    }
    if (/\/payment_intents\/pi_1\/cancel$/.test(u) && metodo === 'POST') {
      if (pi.status !== 'requires_capture')
        return new Response(JSON.stringify({ error: { message: `status ${pi.status}` } }), {
          status: 400,
        });
      pi.status = 'canceled';
      return new Response(JSON.stringify({ ...pi }), { status: 200 });
    }
    if (/\/payment_intents\/pi_1$/.test(u) && metodo === 'GET' && getRoto)
      throw new Error('red: sin respuesta');
    if (/\/payment_intents\/pi_1$/.test(u) && metodo === 'GET')
      return new Response(JSON.stringify({ ...pi }), { status: 200 });
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
  return {
    fetchFalso,
    capturas,
    retenerProxima: () => {
      retener = true;
    },
    estaRetenida: () => retenida,
    dar500: (veces = 1) => {
      dar500 = veces;
    },
    romperConsulta: () => {
      getRoto = true;
    },
    pi,
    soltar: () => soltar?.(),
  };
}

/** Un contexto de ejecución de mentira: guarda lo que la petición registró con waitUntil. */
function contexto() {
  const vivos: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => vivos.push(p),
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
  return { ctx, vivos };
}

async function pedidoPagado(entrega: 'domicilio' | 'recoger') {
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
      propinaCentavos: entrega === 'recoger' ? 0 : 300,
      ...(entrega === 'recoger'
        ? { entrega: 'recoger', pin: true }
        : { direccion: '300 Calle Prueba', lat: 25.775, lng: -80.195 }),
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
  const liquidacion = async () =>
    (
      await m.DB.prepare('SELECT estado FROM liquidaciones WHERE pedido_id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;
  const reloj = async () => {
    await m.DB.prepare(
      "UPDATE liquidaciones SET proximo_en = datetime('now', '-1 minute'), actualizado_en = datetime('now', '-10 minutes')",
    ).run();
    await liquidarPendientes({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' } as never, m.DB);
  };
  return { st, m, dueno, cliente, id, liquidacion, reloj };
}

type Escena = Awaited<ReturnType<typeof pedidoPagado>>;

/** Deja el pedido a domicilio en camino, listo para entregar en la puerta. */
async function enCamino(e: Escena) {
  const rep = await e.m.cuenta('repartidor');
  await e.m.llamar(
    'POST',
    '/datos/repartidor/conectar',
    { conectado: true, lat: 25.771, lng: -80.191 },
    rep.token,
  );
  await e.m.llamar(
    'POST',
    `/datos/restaurante/pedidos/${e.id}/aceptar`,
    { minutos: 5 },
    e.dueno.token,
  );
  await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
  await e.m.llamar('POST', `/datos/repartidor/ofertas/${e.id}/aceptar`, {}, rep.token);
  await e.m.llamar('POST', `/datos/restaurante/pedidos/${e.id}/listo`, {}, e.dueno.token);
  await e.m.recoger(e.id, rep.token, e.dueno.token);
  return rep;
}

/** Deja la recogida lista en el mostrador y devuelve el PIN que dice el cliente. */
async function listaParaRecoger(e: Escena) {
  await e.m.llamar(
    'POST',
    `/datos/restaurante/pedidos/${e.id}/aceptar`,
    { minutos: 10 },
    e.dueno.token,
  );
  await e.m.llamar('POST', `/datos/restaurante/pedidos/${e.id}/listo`, {}, e.dueno.token);
  const seg = await e.m.llamar(
    'GET',
    `/datos/pedidos/${e.id}/seguimiento`,
    undefined,
    e.cliente.token,
  );
  return String(seg.datos.pedido.pin);
}

const entregarEnLocal = (e: Escena, pin: string) =>
  e.m.llamar('POST', `/datos/restaurante/pedidos/${e.id}/entregado-local`, { pin }, e.dueno.token);

/**
 * Corta la petición mientras Stripe está capturando: deja seguir SOLO lo registrado con waitUntil
 * hasta ese momento (lo que Cloudflare no cancela) y suelta a Stripe.
 */
async function cortarDuranteLaCaptura(e: Escena, peticion: () => Promise<unknown>) {
  const { ctx, vivos } = contexto();
  e.m.usarContexto(ctx);
  e.st.retenerProxima();
  const enCurso = peticion().catch(() => null); // el cliente recargó: nadie espera la respuesta
  await vi.waitFor(() => expect(e.st.estaRetenida()).toBe(true));
  const sobreviven = [...vivos];
  e.m.usarContexto(undefined);
  e.st.soltar();
  await Promise.all(sobreviven.map((p) => p.catch(() => null)));
  const estado = await e.liquidacion();
  await enCurso; // limpieza de la prueba: no cuenta para el resultado
  return estado;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cobro al entregar en segundo plano (C-COBRO-SEGUNDO-PLANO)', () => {
  it('recogida en el local: la pantalla se recarga justo al entregar y el cobro queda «capturada», no «capturando»', async () => {
    const e = await pedidoPagado('recoger');
    const pin = await listaParaRecoger(e);
    const estado = await cortarDuranteLaCaptura(e, () => entregarEnLocal(e, pin));
    expect(estado).toBe('capturada');
    expect(e.st.capturas).toHaveLength(1);
  });

  it('a domicilio: el repartidor pierde la señal justo al entregar y el cobro queda «capturada»', async () => {
    const e = await pedidoPagado('domicilio');
    const rep = await enCamino(e);
    const estado = await cortarDuranteLaCaptura(e, () => e.m.entregar(e.id, rep.token));
    expect(estado).toBe('capturada');
    expect(e.st.capturas).toHaveLength(1);
  });

  it('corte, reintento de la pantalla y vuelta del reloj: un solo cobro', async () => {
    const e = await pedidoPagado('recoger');
    const pin = await listaParaRecoger(e);
    await cortarDuranteLaCaptura(e, () => entregarEnLocal(e, pin));
    // La pantalla vuelve a tocar «Entregado» y después pasa el reloj: nada cobra otra vez.
    expect([200, 409]).toContain((await entregarEnLocal(e, pin)).estado);
    await e.reloj();
    await e.reloj();
    expect(await e.liquidacion()).toBe('capturada');
    expect(e.st.capturas).toHaveLength(1);
  });

  it('a domicilio, entregar dos veces seguidas y pasar el reloj: un solo cobro', async () => {
    const e = await pedidoPagado('domicilio');
    const rep = await enCamino(e);
    expect((await e.m.entregar(e.id, rep.token)).estado).toBe(200);
    const otra = await e.m.entregar(e.id, rep.token);
    expect(otra.estado).toBe(200);
    expect(otra.datos.yaEntregado).toBe(true);
    await e.reloj();
    expect(await e.liquidacion()).toBe('capturada');
    expect(e.st.capturas).toHaveLength(1);
  });
});

describe('viaje con tarjeta terminado y sin cobrar (C-COBRO-SEGUNDO-PLANO)', () => {
  /** Siembra un viaje terminado hace diez minutos con la autorización todavía abierta. */
  async function viajeSinCobrar(m: ReturnType<typeof mundo>, op: string, estado = 'terminado') {
    const cliente = await m.cuenta('cliente', 'Pasajero de prueba');
    const cond = await m.cuenta('repartidor', 'Conductor de prueba');
    await m.DB.prepare(
      "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, zona_id, estado_general) VALUES (?, 'moto', 'viaje_pasajero', ?, ?, 'US-FL-MIAMI', 'terminada')",
    )
      .bind(op, cliente.id, cond.id)
      .run();
    await m.DB.prepare(
      `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion,
         destino_lat, destino_lng, destino_direccion, pin_recogida, metodo_pago, total_final_centavos, terminado_en)
       VALUES (?, ?, 'conductor', ?, 25.76, -80.19, 'Origen de prueba', 25.78, -80.2, 'Destino de prueba', '4321', 'tarjeta', 1100, datetime('now', '-10 minutes'))`,
    )
      .bind(op, estado, `paso:${op}`)
      .run();
    await m.DB.prepare(
      "INSERT INTO cobros_viaje (operacion_id, stripe_pago, autorizado, estado, actualizado_en) VALUES (?, 'pi_1', 1200, 'autorizado', datetime('now', '-20 minutes'))",
    )
      .bind(op)
      .run();
    return cond;
  }
  const cobro = (m: ReturnType<typeof mundo>, op: string) =>
    m.DB.prepare('SELECT estado, capturado FROM cobros_viaje WHERE operacion_id = ?')
      .bind(op)
      .first<{ estado: string; capturado: number }>();
  const abonado = async (m: ReturnType<typeof mundo>, op: string) =>
    (
      await m.DB.prepare(
        "SELECT COALESCE(SUM(monto), 0) AS n FROM movimientos WHERE referencia = 'viaje-tarjeta-' || ?",
      )
        .bind(op)
        .first<{ n: number }>()
    )?.n;

  it('el reloj cobra el viaje que se quedó con la autorización abierta, una sola vez aunque pase dos veces', async () => {
    const st = stripeFalso();
    vi.stubGlobal('fetch', st.fetchFalso);
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
    await viajeSinCobrar(m, 'op-corte-1');
    const tarea = TAREAS_RELOJ.find((t) => t.nombre === 'cobros_viaje');
    expect(tarea?.critica).toBe(true);
    const env = { STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    await tarea!.correr(env, m.DB);
    await tarea!.correr(env, m.DB);
    expect(await cobro(m, 'op-corte-1')).toMatchObject({ estado: 'capturado', capturado: 1100 });
    expect(await abonado(m, 'op-corte-1')).toBe(1100);
    expect(st.capturas).toEqual([1100]);
  });

  it('Stripe ya cobró y la respuesta se perdió: se anota lo cobrado sin capturar otra vez', async () => {
    const st = stripeFalso();
    vi.stubGlobal('fetch', st.fetchFalso);
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
    const cond = await viajeSinCobrar(m, 'op-corte-2');
    // La primera captura llegó a Stripe pero nadie anotó nada (la petición se cortó).
    await fetch('https://api.stripe.com/v1/payment_intents/pi_1/capture', {
      method: 'POST',
      headers: { 'idempotency-key': 'otra-clave' },
      body: 'amount_to_capture=1100',
    });
    await capturarCobroViaje(
      { STRIPE_SECRET_KEY: 'sk_test_x' } as never,
      m.DB,
      'op-corte-2',
      cond.id,
      1100,
    );
    expect(await cobro(m, 'op-corte-2')).toMatchObject({ estado: 'capturado', capturado: 1100 });
    expect(await abonado(m, 'op-corte-2')).toBe(1100);
    expect(st.capturas).toEqual([1100]);
  });

  it('Stripe guardó un 500 con la clave del viaje: se reintenta con clave nueva y se cobra una vez', async () => {
    const st = stripeFalso();
    vi.stubGlobal('fetch', st.fetchFalso);
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
    const cond = await viajeSinCobrar(m, 'op-500');
    st.dar500();
    const env = { STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    await capturarCobroViaje(env, m.DB, 'op-500', cond.id, 1100);
    expect(await cobro(m, 'op-500')).toMatchObject({ estado: 'capturado', capturado: 1100 });
    expect(st.capturas).toEqual([1100]);
  });

  it('cancelar después de un cargo que Stripe ya cobró sin anotarse: se anota el cargo, no una anulación', async () => {
    const st = stripeFalso();
    vi.stubGlobal('fetch', st.fetchFalso);
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
    await viajeSinCobrar(m, 'op-cargo', 'cancelado');
    await fetch('https://api.stripe.com/v1/payment_intents/pi_1/capture', {
      method: 'POST',
      headers: { 'idempotency-key': 'cargo-cortado' },
      body: 'amount_to_capture=300',
    });
    const env = { STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    expect(await soltarCobroViaje(env, m.DB, 'op-cargo', 0)).toBe(300);
    expect(await cobro(m, 'op-cargo')).toMatchObject({ estado: 'capturado', capturado: 300 });
    expect(st.capturas).toEqual([300]);
  });

  it('el reloj cierra las autorizaciones de viajes cancelados: anota lo cobrado y anula la del viaje sin conductor', async () => {
    const st = stripeFalso();
    vi.stubGlobal('fetch', st.fetchFalso);
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
    await viajeSinCobrar(m, 'op-sin-cond', 'sin_conductor');
    const tarea = TAREAS_RELOJ.find((t) => t.nombre === 'cobros_viaje')!;
    await tarea.correr({ STRIPE_SECRET_KEY: 'sk_test_x' } as never, m.DB);
    expect((await cobro(m, 'op-sin-cond'))?.estado).toBe('anulado');
    expect(st.pi.status).toBe('canceled');
    expect(st.capturas).toEqual([]);
  });

  it('bordes: autorización vencida, Stripe caído dos veces, consulta rota y viajes cerrados ya cobrados o con cargo posible', async () => {
    const st = stripeFalso();
    vi.stubGlobal('fetch', st.fetchFalso);
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
    const env = { STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    const tarea = TAREAS_RELOJ.find((t) => t.nombre === 'cobros_viaje')!;
    // Stripe da 500 en los dos intentos: lanza y el viaje sigue autorizado para el reloj.
    const cond = await viajeSinCobrar(m, 'op-caido');
    st.dar500(2);
    await expect(capturarCobroViaje(env, m.DB, 'op-caido', cond.id, 1100)).rejects.toThrow();
    expect((await cobro(m, 'op-caido'))?.estado).toBe('autorizado');
    // Sin poder consultar a Stripe: tampoco se inventa nada.
    st.dar500(1);
    st.romperConsulta();
    await expect(capturarCobroViaje(env, m.DB, 'op-caido', cond.id, 1100)).rejects.toThrow();
    // El cerrado que el reloj no puede consultar queda contado como fallido.
    await viajeSinCobrar(m, 'op-cerrado-roto', 'cancelado');
    expect(await tarea.correr(env, m.DB)).toMatchObject({ fallidos: 2 });
    expect(st.capturas).toEqual([]);
  });

  it('el reloj: autorización vencida (no cobra), cancelado ya cobrado (anota el cargo), no se presentó autorizado (no adivina)', async () => {
    const st = stripeFalso();
    vi.stubGlobal('fetch', st.fetchFalso);
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
    const env = { STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    const tarea = TAREAS_RELOJ.find((t) => t.nombre === 'cobros_viaje')!;
    await viajeSinCobrar(m, 'op-no-show', 'no_show');
    expect(await tarea.correr(env, m.DB)).toMatchObject({ cerradosAnotados: 0 });
    expect((await cobro(m, 'op-no-show'))?.estado).toBe('autorizado');
    // El cargo se cobró en Stripe y nadie lo anotó: el reloj lo anota.
    await fetch('https://api.stripe.com/v1/payment_intents/pi_1/capture', {
      method: 'POST',
      headers: { 'idempotency-key': 'cargo-sin-anotar' },
      body: 'amount_to_capture=250',
    });
    expect(await tarea.correr(env, m.DB)).toMatchObject({ cerradosAnotados: 1 });
    expect(await cobro(m, 'op-no-show')).toMatchObject({ estado: 'capturado', capturado: 250 });
    // Un terminado cuya autorización ya se anuló: no se cobra y queda para el equipo.
    const m2 = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_CORREOS: '' });
    const cond2 = await viajeSinCobrar(m2, 'op-vencido');
    st.pi.status = 'canceled';
    await expect(capturarCobroViaje(env, m2.DB, 'op-vencido', cond2.id, 1100)).rejects.toThrow(
      /venció/,
    );
    // Cargo al cancelar con la autorización ya anulada: queda anulado, sin cargo.
    await viajeSinCobrar(m2, 'op-cargo-vencido', 'cancelado');
    expect(await soltarCobroViaje(env, m2.DB, 'op-cargo-vencido', 300)).toBe(0);
    expect((await cobro(m2, 'op-cargo-vencido'))?.estado).toBe('anulado');
  });
});

describe('rescatar un cobro que quedó «capturando» (C-COBRO-SEGUNDO-PLANO)', () => {
  async function atascado() {
    const e = await pedidoPagado('recoger');
    const pin = await listaParaRecoger(e);
    await cortarDuranteLaCaptura(e, () => entregarEnLocal(e, pin));
    // Así quedaron los dos pedidos del sitio de pruebas: «capturando» desde hace horas.
    await e.m.DB.prepare(
      "UPDATE liquidaciones SET estado = 'capturando', intentos = 1, actualizado_en = datetime('now', '-3 hours'), creado_en = datetime('now', '-3 hours') WHERE pedido_id = ?",
    )
      .bind(e.id)
      .run();
    const admin = await e.m.cuenta('admin');
    return { e, admin };
  }

  it('«Reintentar ahora» del panel de dinero la cierra preguntando a Stripe, sin cobrar otra vez', async () => {
    const { e, admin } = await atascado();
    const r = await e.m.llamar(
      'POST',
      `/datos/admin/liquidaciones/${e.id}/reintentar`,
      {},
      admin.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.estado).toBe('capturada');
    expect(await e.liquidacion()).toBe('capturada');
    expect(e.st.capturas).toHaveLength(1);
    // Repetir el botón no hace nada más.
    const otra = await e.m.llamar(
      'POST',
      `/datos/admin/liquidaciones/${e.id}/reintentar`,
      {},
      admin.token,
    );
    expect(otra.estado).toBe(404);
    expect(e.st.capturas).toHaveLength(1);
  });
});
