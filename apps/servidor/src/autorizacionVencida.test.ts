import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { contarFilas } from './presupuestoFilas';
import { avisarAutorizacionesPorVencer, saludAutorizaciones } from './autorizacionVencida';
import { conciliarPedidos } from './conciliacion';
import { saludCobros } from './liquidaciones';
import { olvidarSegundoFactor } from './segundoFactor';

/**
 * Candado C-AUTORIZACION-VENCIDA (16 nov 2026) — todos los países con tarjeta. El pedido de pruebas
 * 407F se pagó el 8 nov y se entregó el 16 nov: la autorización ya había vencido, la captura falló,
 * la entrega quedó «en revisión» y la salud en 503. Stripe va simulado (nunca el real): la
 * autorización vieja `canceled` y los cobros nuevos con su clave de idempotencia, como Stripe.
 * Cada prueba se vio en rojo quitando su pieza (anotado en CANDADOS.md).
 */
type Mundo = ReturnType<typeof mundo>;

afterEach(() => {
  vi.unstubAllGlobals();
  olvidarSegundoFactor();
});

type OpcionesStripe = {
  consentimiento?: boolean;
  estadoVieja?: string;
  /** El cobro nuevo: 'succeeded' | 'requires_action' | 'rechazo'. */
  cobro?: 'succeeded' | 'requires_action' | 'rechazo';
};

/** Stripe de mentira: guarda la respuesta de cada clave de idempotencia como el de verdad. */
function stripeSimulado(o: OpcionesStripe = {}) {
  const creados: { clave: string | null; cuerpo: URLSearchParams; id: string }[] = [];
  const porClave = new Map<string, Response>();
  // Como Stripe: la misma clave mientras la primera petición sigue en curso responde 409.
  const enCurso = new Set<string>();
  const espera = () => new Promise((r) => setTimeout(r, 15));
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = new URL(String(url));
    const metodo = init?.method ?? 'GET';
    if (metodo === 'GET' && u.pathname === '/v1/payment_intents/pi_vieja') {
      await espera();
      return json({
        id: 'pi_vieja',
        status: o.estadoVieja ?? 'canceled',
        amount: 3400,
        amount_capturable: 0,
        amount_received: 0,
        customer: 'cus_1',
        setup_future_usage: o.consentimiento === false ? null : 'off_session',
        cancellation_reason: 'automatic',
        canceled_at: 1_763_251_200,
        created: 1_762_560_000,
        payment_method: {
          id: 'pm_1',
          customer: 'cus_1',
          card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2034 },
        },
        latest_charge: { payment_method_details: { card: { capture_before: 1_763_164_800 } } },
      });
    }
    if (metodo === 'GET' && u.pathname === '/v1/payment_intents')
      return json({
        data: creados.map((c) => ({
          id: c.id,
          status: 'succeeded',
          metadata: { recobro_de: c.cuerpo.get('metadata[recobro_de]') },
        })),
      });
    if (metodo === 'POST' && u.pathname === '/v1/payment_intents') {
      const clave = new Headers(init?.headers).get('idempotency-key');
      const guardada = clave ? porClave.get(clave) : undefined;
      if (guardada) return guardada.clone();
      if (clave && enCurso.has(clave))
        return json(
          { error: { message: 'Keys for idempotent requests…', code: 'idempotency_key_in_use' } },
          409,
        );
      if (clave) enCurso.add(clave);
      await espera();
      if (clave) enCurso.delete(clave);
      const cuerpo = new URLSearchParams(String(init?.body ?? ''));
      let r: Response;
      if (o.cobro === 'rechazo')
        r = json({ error: { message: 'Your card was declined.', code: 'card_declined' } }, 402);
      else {
        const id = `pi_nueva_${creados.length + 1}`;
        if (o.cobro !== 'requires_action') creados.push({ clave, cuerpo, id });
        r = json({
          id,
          status: o.cobro ?? 'succeeded',
          amount_received: o.cobro === 'requires_action' ? 0 : Number(cuerpo.get('amount')),
        });
      }
      if (clave) porClave.set(clave, r.clone());
      return r;
    }
    return json({});
  });
  return { creados };
}

/** Una entrega con la tarjeta vencida en revisión, como el 407F. */
async function entregaEnRevision(m: Mundo, monto = 3400) {
  const dueno = await m.cuenta('restaurante');
  const cliente = await m.cuenta('cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_1' WHERE id = ?")
    .bind(cliente.id)
    .run();
  await m.DB.prepare("UPDATE restaurantes SET zona_id = 'US-FL-MIAMI' WHERE id = ?")
    .bind(rid)
    .run();
  const id = crypto.randomUUID();
  await m.DB.batch([
    m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, zona_id, stripe_pago, stripe_sesion, pagado_en, entregado_en)
       VALUES (?, ?, ?, 'entregado', '[]', ?, 0, 0, 0, 0, ?, 0, 0, 0, 0, 0, 'inicial', 'x', 'US-FL-MIAMI', 'pi_vieja', 'pi_vieja', datetime('now', '-8 days'), datetime('now'))`,
    ).bind(id, cliente.id, rid, monto, monto),
    m.DB.prepare(
      "INSERT INTO cobros (pedido_id, autorizado_en) VALUES (?, datetime('now', '-8 days'))",
    ).bind(id),
    m.DB.prepare(
      "INSERT INTO liquidaciones (pedido_id, estado, pi, monto, intentos, error, alertado_en) VALUES (?, 'revision', 'pi_vieja', ?, 2, 'La autorización venció o se anuló (canceled)', datetime('now'))",
    ).bind(id, monto),
  ]);
  return { id, cliente, rid };
}

const estadoLiq = async (m: Mundo, id: string) =>
  (await m.DB.prepare('SELECT estado, pi FROM liquidaciones WHERE pedido_id = ?')
    .bind(id)
    .first<{ estado: string; pi: string }>()) ?? null;

async function empleado(m: Mundo, token: string, plantillas: string[], extra = {}) {
  const correo = `emp-${Math.random().toString(36).slice(2)}@ejemplo.com`;
  const inv = await m.llamar(
    'POST',
    '/datos/admin/equipo/invitaciones',
    { correo, nombre: 'Persona Equipo', plantillas, motivo: 'Alta de prueba', ...extra },
    token,
  );
  expect(inv.estado, JSON.stringify(inv.datos)).toBe(201);
  const codigo = new URL(inv.datos.enlace).searchParams.get('code');
  const a = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
    codigo,
    nombre: 'Persona Equipo',
    clave: 'clave-segura-1',
  });
  expect(a.estado, JSON.stringify(a.datos)).toBe(201);
  return { token: a.datos.token as string, id: a.datos.usuario.id as string };
}

const ruta = (id: string, accion = '') =>
  `/datos/admin/liquidaciones/${id}/autorizacion${accion ? `/${accion}` : ''}`;

describe('C-AUTORIZACION-VENCIDA: resolver la autorización vencida desde la ficha', () => {
  it('sin resolver, la entrega sigue en revisión y la salud de cobros en rojo', async () => {
    stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const { id } = await entregaEnRevision(m);
    expect(await saludCobros(m.DB)).toBe('error');
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.cobros).toBe('error');
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
  });

  it('la ficha avisa y la consulta muestra el estado real del pago en Stripe', async () => {
    stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin', 'Soporte Total');
    const { id } = await entregaEnRevision(m);
    const ficha = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(ficha.datos.pedido.liquidacion).toMatchObject({ estado: 'revision' });
    const r = await m.llamar('GET', ruta(id), undefined, admin.token);
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({
      sePuedeResolver: true,
      sePuedeCobrar: true,
      motivoSinCobro: null,
      stripe: {
        estado: 'canceled',
        vencida: true,
        montoAutorizado: 3400,
        consentimiento: true,
        tarjeta: { marca: 'visa', ultimos4: '4242' },
      },
    });
    expect(r.datos.stripe.capturarAntesDe).toMatch(/^2025-11-15T/);
  });

  it('volver a cobrar: UN cobro con la tarjeta guardada, la entrega sale de revisión y la salud vuelve a verde', async () => {
    const s = stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin', 'Soporte Total');
    const { id } = await entregaEnRevision(m);
    const r = await m.llamar('POST', ruta(id, 'cobrar'), { nota: 'Cliente avisado' }, admin.token);
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect(r.datos).toMatchObject({ estado: 'capturada', pago: 'pi_nueva_1', cobrado: 3400 });
    expect(s.creados).toHaveLength(1);
    const c = s.creados[0]!;
    expect(c.clave).toBe(`recobro-${id}`);
    expect(c.cuerpo.get('off_session')).toBe('true');
    expect(c.cuerpo.get('payment_method')).toBe('pm_1');
    expect(c.cuerpo.get('customer')).toBe('cus_1');
    expect(c.cuerpo.get('amount')).toBe('3400');
    expect(await estadoLiq(m, id)).toEqual({ estado: 'capturada', pi: 'pi_nueva_1' });
    const p = await m.DB.prepare('SELECT stripe_pago FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ stripe_pago: string }>();
    expect(p?.stripe_pago).toBe('pi_nueva_1');
    const cobro = await m.DB.prepare('SELECT capturado FROM cobros WHERE pedido_id = ?')
      .bind(id)
      .first<{ capturado: number }>();
    expect(cobro?.capturado).toBe(3400);
    // La bitácora: quién, qué y la nota; y el pago viejo anotado para que la conciliación lo revise.
    const { results: bit } = await m.DB.prepare(
      'SELECT evento, detalle FROM bitacora_pedidos WHERE pedido_id = ?',
    )
      .bind(id)
      .all<{ evento: string; detalle: string }>();
    const res = bit.find((b) => b.evento === 'autorizacion_resuelta');
    expect(JSON.parse(res!.detalle)).toMatchObject({
      decision: 'cobrado_de_nuevo',
      por: 'Soporte Total',
      nota: 'Cliente avisado',
    });
    expect(bit.map((b) => b.evento)).toContain('cobro_reautorizado:pi_vieja');
    const acc = await m.DB.prepare(
      "SELECT estado FROM acciones_equipo WHERE usuario_id = ? AND ruta LIKE '%/autorizacion/cobrar'",
    )
      .bind(admin.id)
      .first<{ estado: number }>();
    expect(acc?.estado).toBe(200);
    expect(await saludCobros(m.DB)).toBe('ok');
    const ficha = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(
      ficha.datos.pedido.linea.find((x: { evento: string }) => x.evento === 'autorizacion_cobrada'),
    ).toMatchObject({ quien: 'Soporte Total', detalle: 'Cliente avisado', rol: 'soporte' });
  });

  it('el doble clic (a la vez o seguido) no cobra dos veces', async () => {
    const s = stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    const [a, b] = await Promise.all([
      m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token),
      m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token),
    ]);
    // Los dos pasan la comprobación a la vez; Stripe da UN cobro (el otro: «ya se está haciendo»).
    expect([a.estado, b.estado].sort()).toEqual(
      [a.estado, b.estado].includes(409) ? [200, 409] : [200, 200],
    );
    const tercero = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
    expect(tercero.datos).toMatchObject({ estado: 'capturada', yaEstaba: true });
    expect(new Set(s.creados.map((c) => c.id)).size).toBe(1);
    expect((await estadoLiq(m, id))?.estado).toBe('capturada');
  });

  it('una respuesta perdida no cobra dos veces: si Stripe ya tiene el cobro de reemplazo, se usa ese', async () => {
    const s = stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    s.creados.push({
      clave: 'otra',
      cuerpo: new URLSearchParams({ 'metadata[recobro_de]': 'pi_vieja' }),
      id: 'pi_ya_cobrado',
    });
    const r = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
    expect(r.datos).toMatchObject({ estado: 'capturada', pago: 'pi_ya_cobrado' });
    expect(s.creados).toHaveLength(1);
  });

  it('sin el permiso del cliente para cobros futuros, no se ofrece ni se cobra', async () => {
    const s = stripeSimulado({ consentimiento: false });
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    const g = await m.llamar('GET', ruta(id), undefined, admin.token);
    expect(g.datos).toMatchObject({
      sePuedeResolver: true,
      sePuedeCobrar: false,
      motivoSinCobro: 'sin_consentimiento',
    });
    const r = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
    expect(r.estado).toBe(409);
    expect(r.datos.error).toContain('didn’t save their card');
    expect(s.creados).toHaveLength(0);
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
  });

  it('la tarjeta rechazada o que pide confirmar no anota nada como cobrado', async () => {
    for (const cobro of ['rechazo', 'requires_action'] as const) {
      stripeSimulado({ cobro });
      const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
      const admin = await m.cuenta('admin');
      const { id } = await entregaEnRevision(m);
      const r = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
      expect(r.estado, cobro).toBe(409);
      expect((await estadoLiq(m, id))?.estado, cobro).toBe('revision');
    }
  });

  it('cerrar sin cobro: la nota es obligatoria; con nota sale de revisión y la conciliación ya no espera captura', async () => {
    const s = stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin', 'Soporte Total');
    const { id } = await entregaEnRevision(m);
    expect((await conciliarPedidos(m.DB, [id])).detalle.stripeEsperado).toBe(3400);
    for (const nota of [undefined, '', '   ', 'no'])
      expect(
        (
          await m.llamar(
            'POST',
            ruta(id, 'sin-cobro'),
            nota === undefined ? {} : { nota },
            admin.token,
          )
        ).estado,
        String(nota),
      ).toBe(400);
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
    const r = await m.llamar(
      'POST',
      ruta(id, 'sin-cobro'),
      { nota: 'Pedido de prueba, no se cobra' },
      admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect((await estadoLiq(m, id))?.estado).toBe('no_aplica');
    expect(s.creados).toHaveLength(0);
    expect(await saludCobros(m.DB)).toBe('ok');
    expect((await conciliarPedidos(m.DB, [id])).detalle.stripeEsperado).toBe(0);
    const g = await m.llamar('GET', ruta(id), undefined, admin.token);
    expect(g.datos.resolucion).toMatchObject({
      decision: 'sin_cobro',
      por: 'Soporte Total',
      nota: 'Pedido de prueba, no se cobra',
    });
    // Ya resuelta: cobrar ahora no hace nada.
    expect((await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token)).estado).toBe(409);
  });

  it('no se cierra sin cobro si Stripe dice que la autorización sigue vigente', async () => {
    stripeSimulado({ estadoVieja: 'requires_capture' });
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    const g = await m.llamar('GET', ruta(id), undefined, admin.token);
    expect(g.datos).toMatchObject({ sePuedeResolver: false, aviso: 'vigente' });
    const r = await m.llamar(
      'POST',
      ruta(id, 'sin-cobro'),
      { nota: 'Cerrar por error' },
      admin.token,
    );
    expect(r.estado).toBe(409);
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
  });

  it('sin el permiso: 403 (Soporte nivel 2); con Finanzas o Supervisor de su ciudad sí', async () => {
    stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const total = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    const soporte = await empleado(m, total.token, ['soporte_2']);
    const r = await m.llamar(
      'POST',
      ruta(id, 'sin-cobro'),
      { nota: 'Sin permiso aquí' },
      soporte.token,
    );
    expect(r.estado).toBe(403);
    expect((await m.llamar('POST', ruta(id, 'cobrar'), {}, soporte.token)).estado).toBe(403);
    // Leer el estado sí (es parte de la ficha).
    expect((await m.llamar('GET', ruta(id), undefined, soporte.token)).estado).toBe(200);
    const sup = await empleado(m, total.token, ['supervisor'], {
      alcance: { zonas: ['US-FL-MIAMI'] },
    });
    const ok = await m.llamar('POST', ruta(id, 'cobrar'), {}, sup.token);
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(200);
  });

  it('fuera de su zona de trabajo: 404, como si no existiera', async () => {
    const s = stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const total = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    const otra =
      (
        await m.DB.prepare(
          "SELECT id FROM zonas WHERE id != 'US-FL-MIAMI' ORDER BY id LIMIT 1",
        ).first<{
          id: string;
        }>()
      )?.id ?? 'US-MI-NOVI';
    const sup = await empleado(m, total.token, ['supervisor'], { alcance: { zonas: [otra] } });
    for (const [metodo, accion, cuerpo] of [
      ['GET', '', undefined],
      ['POST', 'cobrar', {}],
      ['POST', 'sin-cobro', { nota: 'Fuera de mi zona' }],
    ] as const) {
      const r = await m.llamar(metodo, ruta(id, accion), cuerpo, sup.token);
      expect(r.estado, accion).toBe(404);
    }
    expect(s.creados).toHaveLength(0);
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
  });

  it('por encima del límite pasa por el control dual: nada se cobra hasta la segunda firma', async () => {
    const s = stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const pide = await m.cuenta('admin', 'Soporte Pide');
    const aprueba = await m.cuenta('admin', 'Soporte Aprueba');
    const { id } = await entregaEnRevision(m, 25_000);
    const r = await m.llamar('POST', ruta(id, 'cobrar'), { nota: 'Grande' }, pide.token);
    expect(r.estado).toBe(202);
    expect(r.datos.pendiente).toBe(true);
    expect(s.creados).toHaveLength(0);
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
    const mismo = await m.llamar(
      'POST',
      `/datos/admin/aprobaciones-dinero/${r.datos.aprobacion.id}/aprobar`,
      { clave: 'clave-segura-1' },
      pide.token,
    );
    expect(mismo.estado).toBe(409);
    const ok = await m.llamar(
      'POST',
      `/datos/admin/aprobaciones-dinero/${r.datos.aprobacion.id}/aprobar`,
      { clave: 'clave-segura-1' },
      aprueba.token,
    );
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(200);
    expect(s.creados).toHaveLength(1);
    expect((await estadoLiq(m, id))?.estado).toBe('capturada');
    const d = await m.DB.prepare(
      "SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'autorizacion_resuelta'",
    )
      .bind(id)
      .first<{ detalle: string }>();
    expect(JSON.parse(d!.detalle)).toMatchObject({
      por: 'Soporte Pide',
      aprobo: 'Soporte Aprueba',
    });
  });
});

describe('C-AUTORIZACION-VENCIDA: el aviso antes de que venza', () => {
  async function pedidoAbierto(m: Mundo, horas: number) {
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const id = crypto.randomUUID();
    await m.DB.batch([
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, stripe_pago, pagado_en)
         VALUES (?, ?, ?, 'aceptado', '[]', 2000, 0, 0, 0, 0, 2000, 0, 0, 0, 0, 0, 'inicial', 'x', 'pi_a', datetime('now', ?))`,
      ).bind(id, cliente.id, r.datos.restaurante.id, `-${horas} hours`),
      m.DB.prepare(
        "INSERT INTO cobros (pedido_id, autorizado_en) VALUES (?, datetime('now', ?))",
      ).bind(id, `-${horas} hours`),
    ]);
    return id;
  }

  it('sale UNA sola vez por pedido, solo pasadas las 96 horas, y con su presupuesto de filas', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    const m = mundo();
    const viejo = await pedidoAbierto(m, 100);
    await pedidoAbierto(m, 10);
    expect(await saludAutorizaciones(m.DB)).toBe('pendiente');
    const primera = contarFilas(m.DB);
    expect(await avisarAutorizacionesPorVencer({} as never, primera.db)).toBe(1);
    expect(primera.cuenta.escritas).toBe(1);
    const segunda = contarFilas(m.DB);
    expect(await avisarAutorizacionesPorVencer({} as never, segunda.db)).toBe(0);
    expect(segunda.cuenta.escritas).toBe(0);
    const n = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM bitacora_pedidos WHERE evento = 'autorizacion_por_vencer'",
    ).first<{ n: number }>();
    expect(n?.n).toBe(1);
    const fila = await m.DB.prepare(
      "SELECT pedido_id FROM bitacora_pedidos WHERE evento = 'autorizacion_por_vencer'",
    ).first<{ pedido_id: string }>();
    expect(fila?.pedido_id).toBe(viejo);
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.autorizaciones).toBe('pendiente');
    // Entregado (capturado), deja de estar a la vista.
    await m.DB.prepare("UPDATE cobros SET capturado_en = datetime('now') WHERE pedido_id = ?")
      .bind(viejo)
      .run();
    expect(await saludAutorizaciones(m.DB)).toBe('ok');
  });

  it('la tarea está en el reloj, cada hora y con sus escrituras declaradas', async () => {
    const { TAREAS_RELOJ } = await import('./rutas/operacion');
    const t = TAREAS_RELOJ.find((x) => x.nombre === 'autorizaciones_por_vencer');
    expect(t).toMatchObject({ cada: 'hora', escriturasEsperadas: 25 });
  });
});
