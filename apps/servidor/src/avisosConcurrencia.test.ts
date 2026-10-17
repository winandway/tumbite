import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * Cierre de seguridad de C-FALLOS-CRITICOS 1 (16 oct 2026): los avisos de Stripe bajo
 * concurrencia. Criterios de Richard: ningún aviso válido se pierde, ningún efecto financiero se
 * duplica, un fallo no borra la marca válida de otro procesamiento, y los reintentos son seguros.
 * Stripe siempre simulado.
 */
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
  return `t=${t},v1=${v1}`;
}

async function escenario() {
  vi.stubGlobal('fetch', async (url: string) =>
    /\/(payment_intents|customers|customer_sessions)/.test(String(url))
      ? new Response(JSON.stringify({ id: 'pi_sesion', client_secret: 'pi_sesion_secret_x' }), {
          status: 200,
        })
      : new Response(JSON.stringify({ id: 're_1' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRETO_AVISO });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
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
  const total = p.datos.desglose.totalCliente as number;
  const evento = `evt_${crypto.randomUUID()}`;
  const entregar = async () => {
    const cuerpo = JSON.stringify({
      id: evento,
      type: 'payment_intent.amount_capturable_updated',
      data: { object: { id: 'pi_sesion', amount_capturable: total, metadata: { pedido_id: id } } },
    });
    const res = await m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await avisoFirmado(cuerpo),
      },
      body: cuerpo,
    });
    const alResponder = (
      await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;
    return { estado: res.status, datos: (await res.json().catch(() => ({}))) as any, alResponder };
  };
  const efectos = async () => {
    const e = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ estado: string }>();
    const cobros = await m.DB.prepare('SELECT COUNT(*) AS n FROM cobros WHERE pedido_id = ?')
      .bind(id)
      .first<{ n: number }>();
    const pagados = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM historial_estados WHERE pedido_id = ? AND estado = 'pagado'",
    )
      .bind(id)
      .first<{ n: number }>();
    const marca = await m.DB.prepare('SELECT estado FROM avisos_stripe WHERE id = ?')
      .bind(evento)
      .first<{ estado: string }>();
    return { estado: e?.estado, cobros: cobros?.n, pagados: pagados?.n, marca: marca?.estado };
  };
  /**
   * El doble de D1 es síncrono: para que dos entregas se CRUCEN de verdad, la lectura del pedido
   * dentro del aviso tarda 30 ms (como en la nube) y, si se pide, la base falla una sola vez justo
   * después (corte a medias simulado), antes de escribir nada.
   */
  const lento = (fallar: boolean) => {
    const original = m.DB.prepare.bind(m.DB);
    let usado = false;
    m.DB.prepare = ((sql: string) => {
      const st = original(sql);
      if (usado || !/SELECT total, stripe_sesion, estado FROM pedidos/.test(sql)) return st;
      usado = true;
      const conPausa = (base: ReturnType<typeof original>) => ({
        ...base,
        bind: (...v: unknown[]) => conPausa(base.bind(...v)),
        first: async <T>(columna?: string) => {
          await new Promise((r) => setTimeout(r, 30));
          if (fallar) throw new Error('D1: conexión cortada a medias (simulada)');
          return columna === undefined ? base.first<T>() : base.first<T>(columna);
        },
      });
      return conPausa(st) as unknown as ReturnType<typeof original>;
    }) as typeof m.DB.prepare;
    return () => {
      m.DB.prepare = original;
    };
  };
  const fallarUnaVez = () => lento(true);
  return { m, id, evento, entregar, efectos, fallarUnaVez, lento };
}

const UNA_VEZ = { estado: 'pagado', cobros: 1, pagados: 1, marca: 'hecho' };

describe('avisos de Stripe bajo concurrencia (C-FALLOS-CRITICOS 1)', () => {
  it('1 · dos entregas simultáneas del mismo evento: una procesa, la otra nunca dice «repetido» a medias, los efectos van una sola vez', async () => {
    const { entregar, efectos, lento } = await escenario();
    const restaurar = lento(false);
    const [a, b] = await Promise.all([entregar(), entregar()]);
    restaurar();
    const estados = [a.estado, b.estado].sort();
    // Una aplica (200). La otra: 409 «en curso» (Stripe reintenta) o 200 «repetido» SOLO si al
    // responder el pedido ya estaba pagado. Nunca «repetido» con el pedido sin pagar.
    expect(estados[0]).toBe(200);
    expect([200, 409]).toContain(estados[1]);
    for (const x of [a, b]) if (x.datos.repetido) expect(x.alResponder).toBe('pagado');
    expect(await efectos()).toEqual(UNA_VEZ);
  });

  it('2 · una entrega falla mientras otra intenta el mismo evento: nadie recibe «repetido» sin efectos, y el reintento lo aplica una sola vez', async () => {
    const { entregar, efectos, fallarUnaVez } = await escenario();
    const restaurar = fallarUnaVez();
    const [a, b] = await Promise.all([entregar(), entregar()]);
    restaurar();
    // Prohibido: 200 «repetido» con el pedido todavía sin pagar (Stripe daría el aviso por entregado).
    for (const x of [a, b]) if (x.datos.repetido) expect(x.alResponder).toBe('pagado');
    const tercero = await entregar();
    expect([200, 409]).toContain(tercero.estado);
    if (tercero.estado === 409) expect((await entregar()).estado).toBe(200);
    expect(await efectos()).toEqual(UNA_VEZ);
  });

  it('2b · un fallo no borra la marca válida de un procesamiento ya terminado', async () => {
    const { m, evento, entregar, efectos, fallarUnaVez } = await escenario();
    expect((await entregar()).estado).toBe(200);
    expect(await efectos()).toEqual(UNA_VEZ);
    const restaurar = fallarUnaVez();
    const r = await entregar();
    restaurar();
    expect(r.estado).toBe(200);
    expect(r.datos.repetido).toBe(true);
    const marca = await m.DB.prepare('SELECT estado FROM avisos_stripe WHERE id = ?')
      .bind(evento)
      .first<{ estado: string }>();
    expect(marca?.estado).toBe('hecho');
    expect(await efectos()).toEqual(UNA_VEZ);
  });

  it('3 · la primera entrega termina bien y llega un reintento tardío: «repetido», sin duplicar nada', async () => {
    const { entregar, efectos } = await escenario();
    expect((await entregar()).estado).toBe(200);
    for (let i = 0; i < 3; i++) {
      const r = await entregar();
      expect(r.estado).toBe(200);
      expect(r.datos.repetido).toBe(true);
    }
    expect(await efectos()).toEqual(UNA_VEZ);
  });

  it('4 · la respuesta se pierde después de aplicar bien: la marca queda «hecho» y el reintento es inocuo', async () => {
    const { m, evento, entregar, efectos } = await escenario();
    // Aplicar bien = la marca pasa a «hecho» ANTES de responder; si la respuesta se pierde en la
    // red, Stripe reintenta y recibe «repetido».
    expect((await entregar()).estado).toBe(200);
    const marca = await m.DB.prepare('SELECT estado FROM avisos_stripe WHERE id = ?')
      .bind(evento)
      .first<{ estado: string }>();
    expect(marca?.estado).toBe('hecho');
    expect((await entregar()).datos.repetido).toBe(true);
    expect(await efectos()).toEqual(UNA_VEZ);
  });

  it('4b · una marca a medias reciente responde 409 (Stripe reintenta); una abandonada hace más de 5 minutos se reclama y se procesa', async () => {
    const { m, evento, entregar, efectos } = await escenario();
    await m.DB.prepare(
      "INSERT INTO avisos_stripe (id, tipo, estado) VALUES (?, 'payment_intent.amount_capturable_updated', 'procesando')",
    )
      .bind(evento)
      .run();
    const reciente = await entregar();
    expect(reciente.estado).toBe(409);
    expect((await efectos()).estado).toBe('pago_pendiente');
    await m.DB.prepare(
      "UPDATE avisos_stripe SET recibido_en = datetime('now', '-10 minutes') WHERE id = ?",
    )
      .bind(evento)
      .run();
    expect((await entregar()).estado).toBe(200);
    expect(await efectos()).toEqual(UNA_VEZ);
  });

  it('los avisos guardados antes de esta columna cuentan como hechos (nunca se reprocesan)', async () => {
    const { m, evento, entregar, efectos } = await escenario();
    // Como quedaron en producción: sin estado explícito → el valor por defecto es «hecho».
    await m.DB.prepare(
      "INSERT INTO avisos_stripe (id, tipo) VALUES (?, 'payment_intent.amount_capturable_updated')",
    )
      .bind(evento)
      .run();
    const r = await entregar();
    expect(r.estado).toBe(200);
    expect(r.datos.repetido).toBe(true);
    expect((await efectos()).estado).toBe('pago_pendiente');
  });
});
