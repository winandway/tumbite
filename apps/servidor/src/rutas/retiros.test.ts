import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * Candado C-RETIROS-SEGUROS (Fase 0, 15 oct 2026): un retiro nunca se paga dos veces y el saldo
 * solo vuelve ante un rechazo COMPROBADO de Stripe. Stripe simulado según su documentación oficial
 * (API v1): la misma clave de idempotencia devuelve la respuesta guardada (incluido un 500), las
 * claves pueden borrarse a las 24 h, y las transferencias se buscan por transfer_group.
 */
const SECRETO_AVISOS = `whsec_${crypto.randomUUID()}`;
const SECRETO_RELOJ = `reloj-${crypto.randomUUID()}`;
type Modo = 'ok' | 'perder' | 'red_antes' | '500' | 'rechazo' | 'red_lista';
type T = {
  id: string;
  amount: number;
  destination: string;
  transfer_group: string;
  metadata: Record<string, string>;
};

function stripeSimulado() {
  const st = {
    transferencias: new Map<string, T>(),
    guardadas: new Map<string, { estado: number; cuerpo: unknown }>(),
    fallas: [] as Modo[],
    posts: [] as { clave: string; grupo: string }[],
    n: 0,
  };
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const metodo = init?.method ?? 'GET';
    if (u.pathname === '/v1/transfers' && metodo === 'POST') {
      const modo = st.fallas.shift() ?? 'ok';
      const clave = new Headers(init?.headers).get('idempotency-key') ?? '';
      const f = new URLSearchParams(String(init?.body));
      st.posts.push({ clave, grupo: f.get('transfer_group') ?? '' });
      if (modo === 'red_antes') throw new TypeError('fetch failed');
      let g = st.guardadas.get(clave);
      if (!g) {
        if (modo === 'rechazo')
          g = { estado: 400, cuerpo: { error: { message: 'Insufficient funds' } } };
        else {
          const t: T = {
            id: `tr_${++st.n}`,
            amount: Number(f.get('amount')),
            destination: f.get('destination') ?? '',
            transfer_group: f.get('transfer_group') ?? '',
            metadata: { retiro_id: f.get('metadata[retiro_id]') ?? '' },
          };
          st.transferencias.set(t.id, t);
          g =
            modo === '500'
              ? { estado: 500, cuerpo: { error: { message: 'unknown' } } }
              : { estado: 200, cuerpo: t };
        }
        st.guardadas.set(clave, g);
      }
      if (modo === 'perder') throw new TypeError('fetch failed');
      return new Response(JSON.stringify(g.cuerpo), { status: g.estado });
    }
    if (u.pathname === '/v1/transfers' && metodo === 'GET') {
      if (st.fallas[0] === 'red_lista') {
        st.fallas.shift();
        throw new TypeError('fetch failed');
      }
      const grupo = u.searchParams.get('transfer_group');
      const data = [...st.transferencias.values()].filter(
        (t) => !grupo || t.transfer_group === grupo,
      );
      return new Response(JSON.stringify({ data, has_more: false }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  });
  return st;
}

async function firmar(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO_AVISOS),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  return `t=${t},v1=${[...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function escenario(extra: Record<string, unknown> = {}) {
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
    STRIPE_WEBHOOK_SECRET: SECRETO_AVISOS,
    RELOJ_SECRETO: SECRETO_RELOJ,
    ...extra,
  };
  const m = mundo(env);
  const rep = await m.cuenta('repartidor');
  const admin = await m.cuenta('admin');
  await m.DB.prepare(
    "INSERT INTO cuentas_stripe (usuario_id, stripe_cuenta, pagos_activos) VALUES (?, 'acct_rep', 1)",
  )
    .bind(rep.id)
    .run();
  await m.DB.prepare(
    "INSERT INTO movimientos (id, usuario_id, monto, concepto) VALUES ('m-inicial', ?, 1000, 'entrega')",
  )
    .bind(rep.id)
    .run();
  // Los retiros nacen apagados (Fase 0): en estas pruebas se encienden con la bandera.
  await m.DB.prepare("INSERT INTO config (clave, valor) VALUES ('retiros_activos', '1')").run();
  const { app } = await import('../app');
  const base = { DB: m.DB, ...env };
  const retirar = (monto = 1000) =>
    m.llamar('POST', '/datos/billetera/retirar', { montoCentavos: monto }, rep.token);
  const saldo = async () =>
    (await m.llamar('GET', '/datos/billetera', undefined, rep.token)).datos.saldo as number;
  const retiro = async () =>
    (await m.DB.prepare('SELECT * FROM retiros ORDER BY creado_en DESC LIMIT 1').first<
      Record<string, unknown>
    >())!;
  /** El reloj externo (hoy GitHub Actions; luego el Worker de Cloudflare). Adelanta las esperas. */
  const reloj = async () => {
    await m.DB.prepare(
      "UPDATE retiros SET proximo_intento_en = datetime('now', '-1 second')",
    ).run();
    const r = await app.request(
      '/datos/reloj',
      { method: 'POST', headers: { 'x-reloj-secreto': SECRETO_RELOJ } },
      base,
    );
    return (await r.json()) as { retiros: Record<string, number> | null };
  };
  const aviso = async (tipo: string, obj: object, id = `evt_${crypto.randomUUID()}`) => {
    const cuerpo = JSON.stringify({ id, type: tipo, data: { object: obj } });
    const r = await app.request(
      '/datos/stripe/aviso',
      { method: 'POST', body: cuerpo, headers: { 'stripe-signature': await firmar(cuerpo) } },
      base,
    );
    return (await r.json()) as { repetido?: boolean };
  };
  const salud = async () => {
    const r = await app.request('/datos/salud', {}, base);
    return ((await r.json()) as { piezas: Record<string, string> }).piezas.retiros;
  };
  return { m, rep, admin, retirar, saldo, retiro, reloj, aviso, salud, app, base };
}

describe('retiros sin doble pago (C-RETIROS-SEGUROS)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normal: una transferencia con la clave fija retiro:<id> como clave y como transfer_group', async () => {
    const st = stripeSimulado();
    const e = await escenario();
    const r = await e.retirar();
    expect(r.estado).toBe(200);
    expect(r.datos.retiro.estado).toBe('enviado');
    expect(await e.saldo()).toBe(0);
    expect(st.posts).toHaveLength(1);
    expect(st.posts[0]!.clave).toBe(`retiro:${r.datos.retiro.id}`);
    expect(st.posts[0]!.grupo).toBe(`retiro:${r.datos.retiro.id}`);
    expect((await e.retiro()).estado).toBe('confirmado');
  });

  it('respuesta perdida: se verifica en Stripe, se confirma y el saldo NO vuelve (antes volvía)', async () => {
    const st = stripeSimulado();
    st.fallas.push('perder');
    const e = await escenario();
    const r = await e.retirar();
    expect(r.estado).toBe(200);
    expect(await e.saldo()).toBe(0);
    expect((await e.retiro()).estado).toBe('confirmado');
    expect(st.transferencias.size).toBe(1);
    // Volver a pedir el mismo dinero: no hay saldo.
    expect((await e.retirar()).estado).toBe(409);
    expect(st.transferencias.size).toBe(1);
  });

  it('respuesta perdida y la verificación también falla: queda en proceso, el reloj lo confirma sin otra transferencia', async () => {
    const st = stripeSimulado();
    st.fallas.push('perder', 'red_lista');
    const e = await escenario();
    const r = await e.retirar();
    expect(r.estado).toBe(200);
    expect(r.datos.retiro.estado).toBe('en_proceso');
    expect(await e.saldo()).toBe(0);
    expect((await e.retiro()).estado).toBe('reintentar');
    await e.reloj();
    expect((await e.retiro()).estado).toBe('confirmado');
    expect(st.transferencias.size).toBe(1);
    expect(st.posts).toHaveLength(1); // verificó antes de reenviar
  });

  it('la llamada no llegó a Stripe: reintento con la misma clave y una sola transferencia', async () => {
    const st = stripeSimulado();
    st.fallas.push('red_antes');
    const e = await escenario();
    expect((await e.retirar()).datos.retiro.estado).toBe('en_proceso');
    await e.reloj();
    expect((await e.retiro()).estado).toBe('confirmado');
    expect(st.transferencias.size).toBe(1);
    expect(new Set(st.posts.map((p) => p.clave)).size).toBe(1);
  });

  it('Stripe responde 500 habiendo transferido: se verifica y se confirma (no se devuelve)', async () => {
    const st = stripeSimulado();
    st.fallas.push('500');
    const e = await escenario();
    const r = await e.retirar();
    expect(r.estado).toBe(200);
    expect(await e.saldo()).toBe(0);
    expect((await e.retiro()).estado).toBe('confirmado');
    expect(st.transferencias.size).toBe(1);
  });

  it('rechazo comprobado de Stripe: el saldo vuelve UNA sola vez', async () => {
    const st = stripeSimulado();
    st.fallas.push('rechazo');
    const e = await escenario();
    const r = await e.retirar();
    expect(r.estado).toBe(422);
    expect(r.datos.error).toMatch(/Stripe no aceptó el retiro|Stripe didn’t accept the withdrawal/);
    expect(await e.saldo()).toBe(1000);
    expect((await e.retiro()).estado).toBe('fallido');
    await e.reloj();
    expect(await e.saldo()).toBe(1000);
    const id = (await e.retiro()).id as string;
    await expect(
      e.m.DB.prepare(
        "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES ('dup', ?, 1000, 'ajuste', ?)",
      )
        .bind(e.rep.id, `retiro-revertido:${id}`)
        .run(),
    ).rejects.toThrow(/UNIQUE/);
    expect(st.transferencias.size).toBe(0);
  });

  it('aviso transfer.created duplicado: se procesa una vez', async () => {
    const st = stripeSimulado();
    st.fallas.push('perder', 'red_lista');
    const e = await escenario();
    await e.retirar();
    const t = [...st.transferencias.values()][0]!;
    const primero = await e.aviso('transfer.created', t, 'evt_dup');
    const segundo = await e.aviso('transfer.created', t, 'evt_dup');
    expect(primero.repetido).toBeUndefined();
    expect(segundo.repetido).toBe(true);
    expect((await e.retiro()).estado).toBe('confirmado');
    expect((await e.retiro()).stripe_transferencia).toBe(t.id);
  });

  it('el aviso llega antes que el reloj: confirma, y el reloj ya no envía nada', async () => {
    const st = stripeSimulado();
    st.fallas.push('perder', 'red_lista');
    const e = await escenario();
    await e.retirar();
    await e.aviso('transfer.created', [...st.transferencias.values()][0]!);
    const antes = st.posts.length;
    await e.reloj();
    expect(st.posts.length).toBe(antes);
    expect(st.transferencias.size).toBe(1);
  });

  it('aviso de una transferencia de un retiro marcado fallido: pasa a revisión y la salud lo muestra', async () => {
    const st = stripeSimulado();
    st.fallas.push('rechazo');
    const e = await escenario();
    await e.retirar();
    const id = (await e.retiro()).id as string;
    await e.aviso('transfer.created', {
      id: 'tr_raro',
      amount: 1000,
      transfer_group: `retiro:${id}`,
      metadata: { retiro_id: id },
    });
    expect((await e.retiro()).estado).toBe('revision');
    expect(await e.salud()).toBe('atrasado');
  });

  it('el proceso muere después de reclamar el retiro: el reloj lo recupera pasados 5 minutos, una sola vez', async () => {
    const st = stripeSimulado();
    const e = await escenario();
    const { pedirRetiro } = await import('../retiros');
    const id = (await pedirRetiro(e.m.DB, e.rep.id, 'acct_rep', 1000))!;
    await e.m.DB.prepare(
      "UPDATE retiros SET estado = 'enviando', intentos = 1, enviando_desde = datetime('now') WHERE id = ?",
    )
      .bind(id)
      .run();
    await e.reloj();
    expect(st.posts).toHaveLength(0); // todavía no está atascado: nadie lo toca
    await e.m.DB.prepare(
      "UPDATE retiros SET enviando_desde = datetime('now', '-6 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    await e.reloj();
    expect((await e.retiro()).estado).toBe('confirmado');
    expect(st.transferencias.size).toBe(1);
  });

  it('dos procesos a la vez (la ruta y el reloj): solo uno reclama el retiro', async () => {
    const st = stripeSimulado();
    const e = await escenario();
    const { pedirRetiro, procesarRetiro } = await import('../retiros');
    const { crearStripe } = await import('../stripe');
    const id = (await pedirRetiro(e.m.DB, e.rep.id, 'acct_rep', 1000))!;
    await e.m.DB.prepare(
      "UPDATE retiros SET estado = 'enviando', intentos = 1, enviando_desde = datetime('now') WHERE id = ?",
    )
      .bind(id)
      .run();
    expect(await procesarRetiro(e.m.DB, crearStripe('sk_test_x')!, id)).toBe('no_reclamado');
    expect(st.posts).toHaveLength(0);
  });

  it('el proceso muere DESPUÉS de que Stripe transfirió: el reloj lo encuentra al verificar y no reenvía', async () => {
    const st = stripeSimulado();
    st.fallas.push('perder', 'red_lista');
    const e = await escenario();
    await e.retirar();
    const id = (await e.retiro()).id as string;
    await e.m.DB.prepare("UPDATE retiros SET estado = 'reintentar' WHERE id = ?").bind(id).run();
    const antes = st.posts.length;
    await e.reloj();
    expect(st.posts.length).toBe(antes);
    expect((await e.retiro()).estado).toBe('confirmado');
  });

  it('Stripe borró la clave (más de 24 h): la verificación por transfer_group evita la segunda transferencia', async () => {
    const st = stripeSimulado();
    st.fallas.push('perder', 'red_lista');
    const e = await escenario();
    await e.retirar();
    st.guardadas.clear();
    await e.reloj();
    expect(st.transferencias.size).toBe(1);
    expect((await e.retiro()).estado).toBe('confirmado');
  });

  it('dos retiros a la vez con saldo para uno: pasa uno solo', async () => {
    stripeSimulado();
    const e = await escenario();
    const [a, b] = await Promise.all([e.retirar(800), e.retirar(800)]);
    expect([a.estado, b.estado].sort()).toEqual([200, 409]);
    expect(await e.saldo()).toBe(200);
  });

  it('demasiados intentos dudosos: pasa a revisión con el saldo descontado', async () => {
    const st = stripeSimulado();
    st.fallas.push(...Array<Modo>(40).fill('red_antes'));
    const e = await escenario();
    await e.retirar();
    for (let i = 0; i < 10; i++) {
      st.fallas.unshift('red_lista');
      await e.reloj();
    }
    expect((await e.retiro()).estado).toBe('revision');
    expect(await e.saldo()).toBe(0);
    expect(await e.salud()).toBe('atrasado');
  });

  it('un retiro confirmado no puede pasar a fallido (no se devuelve dinero ya pagado)', async () => {
    stripeSimulado();
    const e = await escenario();
    await e.retirar();
    await expect(e.m.DB.prepare("UPDATE retiros SET estado = 'fallido'").run()).rejects.toThrow(
      /retiro_transicion_no_permitida/,
    );
    expect(await e.saldo()).toBe(0);
  });

  it('conciliación diaria: confirma un retiro en revisión que Stripe sí pagó y avisa si algo no cuadra', async () => {
    const st = stripeSimulado();
    st.fallas.push('perder', 'red_lista');
    const e = await escenario();
    await e.retirar();
    await e.m.DB.prepare("UPDATE retiros SET estado = 'revision'").run();
    const { conciliarRetiros } = await import('../retiros');
    const { crearStripe } = await import('../stripe');
    const r = await conciliarRetiros(e.m.DB, crearStripe('sk_test_x')!);
    expect((await e.retiro()).estado).toBe('confirmado');
    expect(r.cuadra).toBe(true);
    // Una transferencia de retiro que la base no conoce: no cuadra y la salud se pone en rojo.
    st.transferencias.set('tr_x', {
      id: 'tr_x',
      amount: 500,
      destination: 'acct_rep',
      transfer_group: 'retiro:desconocido',
      metadata: { retiro_id: 'desconocido' },
    });
    const r2 = await conciliarRetiros(e.m.DB, crearStripe('sk_test_x')!);
    expect(r2.cuadra).toBe(false);
    expect(await e.salud()).toBe('error');
  });

  it('bandera de seguridad: apagados, nadie retira ni se llama a Stripe; la variable manda sobre la bandera', async () => {
    const st = stripeSimulado();
    const e = await escenario();
    expect(
      (await e.m.llamar('PUT', '/datos/admin/retiros', { activos: false }, e.rep.token)).estado,
    ).toBe(403);
    expect(
      (await e.m.llamar('PUT', '/datos/admin/retiros', { activos: false }, e.admin.token)).datos
        .activos,
    ).toBe(false);
    const r = await e.retirar();
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/en pausa|paused/);
    expect(st.posts).toHaveLength(0);
    expect(await e.saldo()).toBe(1000);
    const b = await e.m.llamar('GET', '/datos/billetera', undefined, e.rep.token);
    expect(b.datos.retirosActivos).toBe(false);
    expect(await e.salud()).toBe('pendiente');
    await e.m.llamar('PUT', '/datos/admin/retiros', { activos: true }, e.admin.token);
    const e2 = await escenario({ RETIROS_APAGADOS: '1' });
    expect((await e2.retirar()).estado).toBe(409);
  });

  it('sin bandera, los retiros nacen APAGADOS (decisión del 15 oct 2026)', async () => {
    const st = stripeSimulado();
    const e = await escenario();
    await e.m.DB.prepare("DELETE FROM config WHERE clave = 'retiros_activos'").run();
    expect((await e.retirar()).estado).toBe(409);
    expect(st.posts).toHaveLength(0);
  });

  it('salud: si falta un disparador de los retiros, la pieza se pone en rojo (prueba S1)', async () => {
    stripeSimulado();
    const e = await escenario();
    expect(await e.salud()).toBe('ok');
    await e.m.DB.prepare('DROP TRIGGER retiros_fallido_devuelve').run();
    expect(await e.salud()).toBe('error');
  });

  it('la billetera muestra los retiros que siguen en proceso (compatible con las apps actuales)', async () => {
    const st = stripeSimulado();
    st.fallas.push('red_antes', 'red_lista');
    const e = await escenario();
    await e.retirar();
    const b = await e.m.llamar('GET', '/datos/billetera', undefined, e.rep.token);
    expect(b.datos.saldo).toBe(0);
    expect(b.datos.pagosActivos).toBe(true);
    expect(b.datos.retirosEnProceso).toHaveLength(1);
    expect(b.datos.retirosEnProceso[0].estado).toBe('reintentar');
  });
});
