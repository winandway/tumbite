import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { contarFilas } from './presupuestoFilas';
import { avisarAutorizacionesPorVencer, saludAutorizaciones } from './autorizacionVencida';
import { conciliarPedidos } from './conciliacion';
import { saludCobros } from './liquidaciones';
import { olvidarSegundoFactor } from './segundoFactor';
import { usarTransporteCorreo } from './correo';
import { firmaValida } from './stripe';

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
  usarTransporteCorreo(null);
});

/** El correo de mentira: guarda lo que se mandó (nunca le pega al servicio real). */
type Enviado = { para: string; asunto: string; texto: string };
function correoSimulado() {
  const enviados: Enviado[] = [];
  usarTransporteCorreo(
    async (_url, init) => {
      const c = JSON.parse(String(init.body)) as {
        to: { address: string }[];
        subject: string;
        text: string;
      };
      enviados.push({ para: c.to[0]!.address, asunto: c.subject, texto: c.text });
      return new Response(JSON.stringify({ success: true, message_id: 'm1' }));
    },
    { omitirDePrueba: false },
  );
  return enviados;
}
const ENV_CORREO = { ADMIN_CORREOS: 'dinero@ejemplo.com', YAD_TOKEN: 'tok_prueba' } as never;
const SECRETO_AVISO = `whsec_${crypto.randomUUID()}`;
async function avisoFirmado(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO_AVISO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  const v1 = [...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const firma = `t=${t},v1=${v1}`;
  expect(await firmaValida(cuerpo, firma, SECRETO_AVISO)).toBe(true);
  return firma;
}

type Resultado = 'succeeded' | 'requires_action' | 'rechazo' | 'processing' | 'caida';
type OpcionesStripe = {
  consentimiento?: boolean;
  estadoVieja?: string;
  /** El cobro nuevo (o uno por intento, en orden; el último se repite). */
  cobro?: Resultado | Resultado[];
};

type Creado = { clave: string | null; cuerpo: URLSearchParams; id: string; status: string };

/** Stripe de mentira: guarda la respuesta de cada clave de idempotencia como el de verdad. */
function stripeSimulado(o: OpcionesStripe = {}) {
  const creados: Creado[] = [];
  const claves: (string | null)[] = [];
  const porClave = new Map<string, Response>();
  // Como Stripe: la misma clave mientras la primera petición sigue en curso responde 409.
  const enCurso = new Set<string>();
  const espera = () => new Promise((r) => setTimeout(r, 15));
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
  const secuencia = Array.isArray(o.cobro) ? o.cobro : [o.cobro ?? 'succeeded'];
  let intento = 0;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = new URL(String(url));
    const metodo = init?.method ?? 'GET';
    if (u.hostname !== 'api.stripe.com') return json({ success: true, message_id: 'x' });
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
    const uno = creados.find((c) => u.pathname === `/v1/payment_intents/${c.id}`);
    if (metodo === 'GET' && uno) return json({ id: uno.id, status: uno.status });
    if (metodo === 'GET' && u.pathname === '/v1/payment_intents')
      return json({
        data: creados.map((c) => ({
          id: c.id,
          status: c.status,
          metadata: { recobro_de: c.cuerpo.get('metadata[recobro_de]') },
        })),
      });
    if (metodo === 'POST' && u.pathname === '/v1/payment_intents') {
      const clave = new Headers(init?.headers).get('idempotency-key');
      claves.push(clave);
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
      const cobro = secuencia[Math.min(intento, secuencia.length - 1)]!;
      intento++;
      if (cobro === 'caida') throw new TypeError('fetch failed');
      let r: Response;
      if (cobro === 'rechazo')
        r = json({ error: { message: 'Your card was declined.', code: 'card_declined' } }, 402);
      else {
        const id = `pi_nueva_${creados.length + 1}`;
        if (cobro !== 'requires_action') creados.push({ clave, cuerpo, id, status: cobro });
        r = json({
          id,
          status: cobro,
          amount_received: cobro === 'succeeded' ? Number(cuerpo.get('amount')) : 0,
        });
      }
      if (clave) porClave.set(clave, r.clone());
      return r;
    }
    return json({});
  });
  return { creados, claves };
}

/** Con el interruptor de «Volver a cobrar» encendido (apagado por defecto, B1). */
const ENCENDIDO = { STRIPE_SECRET_KEY: 'sk_test_x', RECOBRO_TARJETA_ACTIVO: '1' };

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
    const m = mundo(ENCENDIDO);
    const { id } = await entregaEnRevision(m);
    expect(await saludCobros(m.DB)).toBe('error');
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.cobros).toBe('error');
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
  });

  it('la ficha avisa y la consulta muestra el estado real del pago en Stripe', async () => {
    stripeSimulado();
    const m = mundo(ENCENDIDO);
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
    const m = mundo(ENCENDIDO);
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
    const m = mundo(ENCENDIDO);
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
    const m = mundo(ENCENDIDO);
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    s.creados.push({
      clave: 'otra',
      cuerpo: new URLSearchParams({ 'metadata[recobro_de]': 'pi_vieja' }),
      id: 'pi_ya_cobrado',
      status: 'succeeded',
    });
    const r = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
    expect(r.datos).toMatchObject({ estado: 'capturada', pago: 'pi_ya_cobrado' });
    expect(s.creados).toHaveLength(1);
  });

  it('sin el permiso del cliente para cobros futuros, no se ofrece ni se cobra', async () => {
    const s = stripeSimulado({ consentimiento: false });
    const m = mundo(ENCENDIDO);
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
      const m = mundo(ENCENDIDO);
      const admin = await m.cuenta('admin');
      const { id } = await entregaEnRevision(m);
      const r = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
      expect(r.estado, cobro).toBe(409);
      expect((await estadoLiq(m, id))?.estado, cobro).toBe('revision');
    }
  });

  it('cerrar sin cobro: la nota es obligatoria; con nota sale de revisión y la conciliación ya no espera captura', async () => {
    const s = stripeSimulado();
    const m = mundo(ENCENDIDO);
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
    const m = mundo(ENCENDIDO);
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
    const m = mundo(ENCENDIDO);
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
    const m = mundo(ENCENDIDO);
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
    const m = mundo(ENCENDIDO);
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

describe('C-AUTORIZACION-VENCIDA: lo que pidió la revisión de calidad (16 nov 2026)', () => {
  it('B1: «Volver a cobrar» está APAGADO por defecto: 409, sin cobro ni aprobación; «Cerrar sin cobro» sigue', async () => {
    const s = stripeSimulado();
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m, 25_000);
    const g = await m.llamar('GET', ruta(id), undefined, admin.token);
    expect(g.datos).toMatchObject({
      cobroEncendido: false,
      sePuedeResolver: true,
      sePuedeCobrar: false,
    });
    const r = await m.llamar('POST', ruta(id, 'cobrar'), { nota: 'x' }, admin.token);
    expect(r.estado).toBe(409);
    expect(r.datos.error).toContain('turned off until the legal wording is confirmed');
    const es = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token, {
      'accept-language': 'es',
    });
    expect(es.datos.error).toContain('Volver a cobrar está apagado');
    expect(s.creados).toHaveLength(0);
    const aprob = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM aprobaciones_dinero WHERE tipo = 'autorizacion_cobrar'",
    ).first<{ n: number }>();
    expect(aprob?.n).toBe(0);
    // Una aprobación que quedó pendiente cuando estaba encendido tampoco cobra al ejecutarse.
    const { volverACobrar } = await import('./autorizacionVencida');
    await expect(
      volverACobrar({ STRIPE_SECRET_KEY: 'sk_test_x' } as never, m.DB, {
        pedidoId: id,
        nota: '',
        actorId: admin.id,
        aprobadorId: null,
      }),
    ).rejects.toThrow('Volver a cobrar está apagado');
    expect(s.creados).toHaveLength(0);
    const cerrar = await m.llamar(
      'POST',
      ruta(id, 'sin-cobro'),
      { nota: 'Divoox lo asume' },
      admin.token,
    );
    expect([200, 202]).toContain(cerrar.estado);
  });

  it('B1: con el interruptor encendido, el cliente recibe UN correo en su idioma con el pedido y el monto', async () => {
    for (const idioma of ['es', 'en'] as const) {
      stripeSimulado();
      const enviados = correoSimulado();
      const m = mundo({ ...ENCENDIDO, YAD_TOKEN: 'tok_prueba' });
      const admin = await m.cuenta('admin');
      const { id, cliente } = await entregaEnRevision(m);
      await m.DB.prepare('UPDATE usuarios SET idioma = ? WHERE id = ?')
        .bind(idioma, cliente.id)
        .run();
      const correo = (
        await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
          .bind(cliente.id)
          .first<{ correo: string }>()
      )?.correo;
      const [a, b] = await Promise.all([
        m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token),
        m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token),
      ]);
      expect([a.estado, b.estado], idioma).toContain(200);
      await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
      const corto = id.slice(0, 8).toUpperCase();
      const alCliente = enviados.filter((e) => e.para === correo && e.asunto.includes(corto));
      expect(
        alCliente.map((e) => e.asunto),
        idioma,
      ).toHaveLength(1);
      const c = alCliente[0]!;
      expect(c.asunto).toContain(`#${corto}`);
      expect(c.texto).toContain('$34.00');
      expect(c.texto).toContain('4242');
      expect(c.texto).toContain(
        idioma === 'en'
          ? 'temporary hold on your card expired'
          : 'retención temporal de tu tarjeta venció',
      );
    }
  });

  it('B1: si el correo al cliente no sale, el cobro queda igual y el fallo va al registro de errores', async () => {
    stripeSimulado();
    usarTransporteCorreo(async () => new Response('{"success":false}', { status: 500 }), {
      omitirDePrueba: false,
    });
    const m = mundo({ ...ENCENDIDO, YAD_TOKEN: 'tok_prueba' });
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    const r = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
    expect(r.datos).toMatchObject({ estado: 'capturada', correoCliente: false });
    const e = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM errores_servidor WHERE ruta LIKE 'autorizacion_vencida:correo_cliente:%'",
    ).first<{ n: number }>();
    expect(e?.n).toBe(1);
  });

  it('menor 2: después de un rechazo, el siguiente intento usa otra clave y sí cobra (una sola vez)', async () => {
    const s = stripeSimulado({ cobro: ['rechazo', 'succeeded'] });
    const m = mundo(ENCENDIDO);
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    const r1 = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token, {
      'accept-language': 'es',
    });
    expect(r1.estado).toBe(409);
    expect(r1.datos.error).toContain('rechazó el cobro');
    const r2 = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
    expect(r2.estado, JSON.stringify(r2.datos)).toBe(200);
    expect(s.claves).toEqual([`recobro-${id}`, `recobro-${id}-1`]);
    expect(s.creados).toHaveLength(1);
    expect((await estadoLiq(m, id))?.estado).toBe('capturada');
  });

  it('menor 2: si Stripe no contesta, la clave se conserva (el reintento no puede cobrar dos veces)', async () => {
    const s = stripeSimulado({ cobro: ['caida', 'succeeded'] });
    const m = mundo(ENCENDIDO);
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    const r1 = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token, {
      'accept-language': 'es',
    });
    expect(r1.estado).toBe(409);
    expect(r1.datos.error).toContain('nunca se cobra dos veces');
    expect(r1.datos.error).not.toContain('Intenta de nuevo en unos minutos');
    const r2 = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token);
    expect(r2.estado).toBe(200);
    expect(s.claves).toEqual([`recobro-${id}`, `recobro-${id}`]);
  });

  it('menor 3: un cobro «processing» queda en curso (no se repite ni se cierra sin cobro) y el aviso de Stripe lo cierra', async () => {
    const s = stripeSimulado({ cobro: 'processing' });
    const enviados = correoSimulado();
    const m = mundo({
      ...ENCENDIDO,
      STRIPE_WEBHOOK_SECRET: SECRETO_AVISO,
      YAD_TOKEN: 'tok_prueba',
    });
    const admin = await m.cuenta('admin', 'Soporte Total');
    const { id } = await entregaEnRevision(m);
    const r = await m.llamar('POST', ruta(id, 'cobrar'), { nota: 'Cliente avisado' }, admin.token);
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect(r.datos).toMatchObject({ estado: 'en_curso', pago: 'pi_nueva_1' });
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
    const g = await m.llamar('GET', ruta(id), undefined, admin.token);
    expect(g.datos).toMatchObject({
      aviso: 'cobro_en_curso',
      sePuedeResolver: false,
      sePuedeCobrar: false,
    });
    // Otro clic no crea un segundo cobro; cerrar sin cobro no se deja.
    expect((await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token)).datos).toMatchObject({
      estado: 'en_curso',
    });
    expect(s.creados).toHaveLength(1);
    const { cerrarSinCobro } = await import('./autorizacionVencida');
    await expect(
      cerrarSinCobro(ENCENDIDO as never, m.DB, {
        pedidoId: id,
        nota: 'Cerrar igual',
        actorId: admin.id,
        aprobadorId: null,
      }),
    ).rejects.toThrow('Ya hay un cobro de reemplazo');
    // El banco termina: Stripe avisa con el pago NUEVO (el pedido todavía apunta al viejo).
    s.creados[0]!.status = 'succeeded';
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_nueva_1',
          status: 'succeeded',
          amount_received: 3400,
          metadata: { pedido_id: id, recobro_de: 'pi_vieja' },
        },
      },
    });
    const aviso = await m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await avisoFirmado(cuerpo),
      },
      body: cuerpo,
    });
    expect(aviso.status).toBe(200);
    expect(await estadoLiq(m, id)).toEqual({ estado: 'capturada', pi: 'pi_nueva_1' });
    const p = await m.DB.prepare('SELECT stripe_sesion FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ stripe_sesion: string }>();
    expect(p?.stripe_sesion).toBe('pi_nueva_1');
    const res = await m.DB.prepare(
      "SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'autorizacion_resuelta'",
    )
      .bind(id)
      .first<{ detalle: string }>();
    expect(JSON.parse(res!.detalle)).toMatchObject({
      decision: 'cobrado_de_nuevo',
      por: 'Soporte Total',
      nota: 'Cliente avisado',
      pagoNuevo: 'pi_nueva_1',
    });
    expect(await saludCobros(m.DB)).toBe('ok');
    expect(enviados.filter((e) => e.asunto.includes(id.slice(0, 8).toUpperCase()))).toHaveLength(1);
  });

  it('menor 3 (de la revisión, punto 4): cerrar sin cobro una entrega sin pago de Stripe: 409', async () => {
    stripeSimulado();
    const m = mundo(ENCENDIDO);
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    await m.DB.prepare('UPDATE liquidaciones SET pi = NULL WHERE pedido_id = ?').bind(id).run();
    const r = await m.llamar(
      'POST',
      ruta(id, 'sin-cobro'),
      { nota: 'Sin pago a la vista' },
      admin.token,
    );
    expect(r.estado).toBe(409);
    expect((await estadoLiq(m, id))?.estado).toBe('revision');
  });

  it('menor 4: si el cobro sale bien después de un «sin cobro» a la vez, el historial sigue al dinero', async () => {
    stripeSimulado();
    const m = mundo(ENCENDIDO);
    const admin = await m.cuenta('admin', 'Soporte Total');
    const { id } = await entregaEnRevision(m);
    const { volverACobrar, cerrarSinCobro } = await import('./autorizacionVencida');
    const env = ENCENDIDO as never;
    const d = { pedidoId: id, actorId: admin.id, aprobadorId: null };
    // El cobro arranca (lee «revisión»), mientras tanto otra persona la cierra sin cobro.
    const cobro = volverACobrar(env, m.DB, { ...d, nota: 'Cobrar' });
    await cerrarSinCobro(env, m.DB, { ...d, nota: 'Cerrar sin cobro a la vez' });
    expect((await estadoLiq(m, id))?.estado).toBe('no_aplica');
    expect(await cobro).toMatchObject({ estado: 'capturada' });
    expect(await estadoLiq(m, id)).toEqual({ estado: 'capturada', pi: 'pi_nueva_1' });
    const res = await m.DB.prepare(
      "SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'autorizacion_resuelta'",
    )
      .bind(id)
      .first<{ detalle: string }>();
    expect(JSON.parse(res!.detalle)).toMatchObject({
      decision: 'cobrado_de_nuevo',
      reemplaza: 'sin_cobro',
      notaReemplazada: 'Cerrar sin cobro a la vez',
    });
    const ficha = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    const eventos = ficha.datos.pedido.linea.map((x: { evento: string }) => x.evento);
    expect(eventos).toContain('autorizacion_cobrada');
    expect(eventos).not.toContain('autorizacion_sin_cobro');
    expect((await conciliarPedidos(m.DB, [id])).detalle.stripeEsperado).toBe(3400);
  });

  it('menor 5: con devoluciones anotadas no se vuelve a cobrar', async () => {
    const s = stripeSimulado();
    const m = mundo(ENCENDIDO);
    const admin = await m.cuenta('admin');
    const { id } = await entregaEnRevision(m);
    await m.DB.prepare(
      "INSERT INTO devoluciones (id, pedido_id, monto, motivo) VALUES (?, ?, 500, 'prueba')",
    )
      .bind(crypto.randomUUID(), id)
      .run();
    const r = await m.llamar('POST', ruta(id, 'cobrar'), {}, admin.token, {
      'accept-language': 'es',
    });
    expect(r.estado).toBe(409);
    expect(r.datos.error).toContain('devoluciones anotadas');
    expect(s.creados).toHaveLength(0);
  });

  it('menor 6: lo absorbido por «cerrar sin cobro» se consulta por mes y moneda, y sale de la cuenta si después se cobra', async () => {
    stripeSimulado();
    const m = mundo(ENCENDIDO);
    const admin = await m.cuenta('admin');
    const a = await entregaEnRevision(m, 3400);
    const b = await entregaEnRevision(m, 1200);
    for (const e of [a, b])
      expect(
        (await m.llamar('POST', ruta(e.id, 'sin-cobro'), { nota: 'Divoox lo asume' }, admin.token))
          .estado,
      ).toBe(200);
    const medir = contarFilas(m.DB);
    const { absorbidoSinCobro } = await import('./autorizacionVencida');
    const filas = await absorbidoSinCobro(medir.db);
    expect(medir.cuenta.escritas).toBe(0);
    const mes = new Date().toISOString().slice(0, 7);
    expect(filas).toEqual([{ mes, moneda: 'USD', pedidos: 2, monto: 4600 }]);
    const l = await m.llamar('GET', '/datos/admin/liquidaciones', undefined, admin.token);
    expect(l.datos.absorbidoSinCobro).toEqual(filas);
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
    const enviados = correoSimulado();
    const m = mundo();
    const viejo = await pedidoAbierto(m, 100);
    await pedidoAbierto(m, 10);
    expect(await saludAutorizaciones(m.DB)).toBe('pendiente');
    const primera = contarFilas(m.DB);
    expect(await avisarAutorizacionesPorVencer(ENV_CORREO, primera.db)).toBe(1);
    expect(primera.cuenta.escritas).toBe(1);
    expect(enviados).toHaveLength(1);
    const segunda = contarFilas(m.DB);
    expect(await avisarAutorizacionesPorVencer(ENV_CORREO, segunda.db)).toBe(0);
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
    expect(t).toMatchObject({ cada: 'hora', escriturasEsperadas: 27 });
  });

  it('menor 7: si no sale ningún correo no se da por avisado, queda en el registro de errores y se reintenta', async () => {
    const m = mundo();
    const id = await pedidoAbierto(m, 100);
    const avisada = async () =>
      (
        await m.DB.prepare(
          "SELECT COUNT(*) AS n FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'autorizacion_por_vencer'",
        )
          .bind(id)
          .first<{ n: number }>()
      )?.n;
    const errores = async () =>
      (
        await m.DB.prepare(
          "SELECT COUNT(*) AS n FROM errores_servidor WHERE ruta = 'autorizaciones_por_vencer'",
        ).first<{ n: number }>()
      )?.n;
    // 1) Nadie recibe los avisos de dinero.
    expect(await avisarAutorizacionesPorVencer({} as never, m.DB)).toBe(0);
    expect(await avisada()).toBe(0);
    expect(await errores()).toBe(1);
    // 2) El servicio de correo falla: tampoco, y la tarea no se rompe.
    usarTransporteCorreo(
      async () => new Response('{"success":false,"error":"caído"}', { status: 500 }),
      {
        omitirDePrueba: false,
      },
    );
    expect(await avisarAutorizacionesPorVencer(ENV_CORREO, m.DB)).toBe(0);
    expect(await avisada()).toBe(0);
    expect(await errores()).toBe(2);
    // 3) Vuelve el correo: en la siguiente vuelta sí se avisa, una vez.
    correoSimulado();
    expect(await avisarAutorizacionesPorVencer(ENV_CORREO, m.DB)).toBe(1);
    expect(await avisada()).toBe(1);
  });
});
