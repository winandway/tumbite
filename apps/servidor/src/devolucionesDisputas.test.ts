import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from './pruebas/ayuda';

/** Auditoría final A.12: devoluciones después de entregar, disputas por webhook e impuesto guardado (C-DEVOLUCIONES-DISPUTAS). */
const SECRETO = `whsec_${crypto.randomUUID()}`;
async function firmar(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  return `t=${t},v1=${[...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function escenario() {
  const llamadas: { url: string; metodo: string; cuerpo: string; clave: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    llamadas.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: String(init?.body ?? ''),
      clave: h.get('idempotency-key') ?? '',
    });
    if (/\/refunds$/.test(String(url)))
      return new Response(JSON.stringify({ id: `re_${llamadas.length}` }), { status: 200 });
    return new Response(
      JSON.stringify({ id: 'pi_sesion', client_secret: 'pi_sesion_secret_x', status: 'succeeded' }),
      { status: 200 },
    );
  });
  const m = mundo({
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: SECRETO,
    YAD_TOKEN: 'x'.repeat(40),
    ADMIN_CORREOS: 'equipo@ejemplo.com',
  });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
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
      restauranteId: rid,
      lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
      propinaCentavos: 0,
      direccion: '300 Calle Prueba',
      lat: 25.775,
      lng: -80.195,
    },
    cliente.token,
  );
  const id = p.datos.pedidoId as string;
  const total = p.datos.desglose.totalCliente as number;
  await m.DB.prepare(
    "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
  )
    .bind(id)
    .run();
  await m.DB.prepare(
    "INSERT OR REPLACE INTO cobros (pedido_id, capturado_en, capturado) VALUES (?, datetime('now'), ?)",
  )
    .bind(id, total)
    .run();
  return { m, admin, dueno, cliente, id, total, llamadas };
}

describe('devoluciones después de entregar (C-DEVOLUCIONES-DISPUTAS)', () => {
  it('solo sobre un pedido entregado y cobrado; reembolso parcial en Stripe con clave propia; nunca más que el total', async () => {
    const { m, admin, id, total, llamadas } = await escenario();
    const antes = await m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/devolver`,
      { montoCentavos: 500, motivo: 'Llegó frío' },
      admin.token,
    );
    expect(antes.estado).toBe(409);
    await llevarA(m.DB, id, 'entregado');
    const r = await m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/devolver`,
      { montoCentavos: 500, motivo: 'Llegó frío' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    const refund = llamadas.find((l) => /\/refunds$/.test(l.url));
    expect(refund?.cuerpo).toContain('amount=500');
    expect(refund?.clave).toBe(`devolucion-${id}-1`);
    const demasiado = await m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/devolver`,
      { montoCentavos: total, motivo: 'todo' },
      admin.token,
    );
    expect(demasiado.estado).toBe(409);
    expect(demasiado.datos.campo).toBe('montoCentavos');
    const bit = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(JSON.stringify(bit.datos)).toContain('devolucion_parcial');
  });

  it('cargada al restaurante deja un movimiento compensatorio con autor; la conciliación la cuenta como devuelto', async () => {
    const { m, admin, dueno, id } = await escenario();
    await llevarA(m.DB, id, 'entregado');
    const r = await m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/devolver`,
      { montoCentavos: 700, motivo: 'Faltó el jugo', cargarA: 'restaurante' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    const mov = await m.DB.prepare(
      "SELECT monto, referencia FROM movimientos WHERE usuario_id = ? AND concepto = 'ajuste' AND referencia LIKE 'devolucion:%'",
    )
      .bind(dueno.id)
      .first<{ monto: number; referencia: string }>();
    expect(mov?.monto).toBe(-700);
    expect(mov?.referencia).toContain(`:por:${admin.id}`);
    const { conciliar } = await import('./conciliacion');
    const c = await conciliar(m.DB, new Date().toISOString().slice(0, 10));
    expect(c.devuelto).toBeGreaterThanOrEqual(700);
  });
});

describe('disputas por webhook y canario (C-DEVOLUCIONES-DISPUTAS)', () => {
  it('charge.dispute.created deja la disputa, la anota en el pedido, avisa al equipo y pone el canario en rojo si vence pronto', async () => {
    const { m, admin, id } = await escenario();
    const { usarTransporteCorreo } = await import('./correo');
    const enviados: string[] = [];
    usarTransporteCorreo(async (_e, init) => {
      enviados.push((JSON.parse(String(init.body)) as { subject: string }).subject);
      return new Response('{"ok":true}', { status: 200 });
    });
    const aviso = async (type: string, status: string) => {
      const cuerpo = JSON.stringify({
        id: `evt_${crypto.randomUUID()}`,
        type,
        data: {
          object: {
            id: 'dp_1',
            payment_intent: 'pi_1',
            amount: 3000,
            reason: 'product_not_received',
            status,
            evidence_details: { due_by: Math.floor(Date.now() / 1000) + 86_400 },
          },
        },
      });
      return m.crudo('/datos/stripe/aviso', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': await firmar(cuerpo) },
        body: cuerpo,
      });
    };
    expect((await aviso('charge.dispute.created', 'needs_response')).status).toBe(200);
    const lista = await m.llamar('GET', '/datos/admin/disputas', undefined, admin.token);
    expect(lista.datos.disputas).toHaveLength(1);
    expect(lista.datos.disputas[0]).toMatchObject({
      id: 'dp_1',
      pedidoId: id,
      monto: 3000,
      estado: 'needs_response',
    });
    expect(enviados.some((s) => /Disputa abierta/.test(s))).toBe(true);
    const salud = (await (await m.crudo('/datos/salud', { method: 'GET' })).json()) as {
      piezas: Record<string, string>;
    };
    expect(salud.piezas.disputas).toBe('error');
    expect((await aviso('charge.dispute.closed', 'won')).status).toBe(200);
    const despues = (await (await m.crudo('/datos/salud', { method: 'GET' })).json()) as {
      piezas: Record<string, string>;
    };
    expect(despues.piezas.disputas).toBe('ok');
    const bit = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(JSON.stringify(bit.datos)).toContain('disputa_cerrada');
    usarTransporteCorreo(null);
  });

  it('cuenta de Stripe compartida: una disputa de otro negocio se ignora; la de una recarga queda escrita y avisa, sin tocar el saldo', async () => {
    const { m, admin } = await escenario();
    const { usarTransporteCorreo } = await import('./correo');
    const enviados: { asunto: string; texto: string }[] = [];
    usarTransporteCorreo(async (_e, init) => {
      const b = JSON.parse(String(init.body)) as { subject: string; text?: string };
      enviados.push({ asunto: b.subject, texto: String(b.text ?? '') });
      return new Response('{"ok":true}', { status: 200 });
    });
    const aviso = async (disputa: string, pi: string) => {
      const cuerpo = JSON.stringify({
        id: `evt_${crypto.randomUUID()}`,
        type: 'charge.dispute.created',
        data: {
          object: {
            id: disputa,
            payment_intent: pi,
            amount: 2500,
            reason: 'fraudulent',
            status: 'needs_response',
            evidence_details: { due_by: Math.floor(Date.now() / 1000) + 86_400 },
          },
        },
      });
      return m.crudo('/datos/stripe/aviso', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': await firmar(cuerpo) },
        body: cuerpo,
      });
    };
    expect((await aviso('dp_ajena', 'pi_de_otro_negocio')).status).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/admin/disputas', undefined, admin.token)).datos.disputas,
    ).toHaveLength(0);
    expect(enviados).toHaveLength(0);
    const salud = (await (await m.crudo('/datos/salud', { method: 'GET' })).json()) as {
      piezas: Record<string, string>;
    };
    expect(salud.piezas.disputas).toBe('ok');
    // Una recarga del saldo prepago pagada con tarjeta.
    await m.DB.prepare(
      "INSERT INTO recargas (id, usuario_id, pais, moneda, monto, canal, estado, referencia) VALUES ('rec_1', ?, 'US', 'USD', 2500, 'stripe', 'acreditada', 'pi_recarga')",
    )
      .bind(admin.id)
      .run();
    expect((await aviso('dp_recarga', 'pi_recarga')).status).toBe(200);
    const f = await m.DB.prepare('SELECT recarga_id, pedido_id FROM disputas WHERE id = ?')
      .bind('dp_recarga')
      .first<{ recarga_id: string | null; pedido_id: string | null }>();
    expect(f).toMatchObject({ recarga_id: 'rec_1', pedido_id: null });
    expect(enviados.some((e) => /rec_1/.test(e.texto) && /NO se tocó/.test(e.texto))).toBe(true);
    usarTransporteCorreo(null);
  });

  it('el impuesto configurado se guarda en el pedido y viaja en el desglose', async () => {
    const { m, admin, cliente, dueno } = await escenario();
    const cfg = await m.llamar('GET', '/datos/config-dinero', undefined, admin.token);
    expect(cfg.datos.config.impuestoPb).toBe(0);
    await m.llamar(
      'PUT',
      '/datos/admin/config-dinero',
      { ...cfg.datos.config, impuestoPb: 700 },
      admin.token,
    );
    const rest = (await m.llamar('GET', '/datos/mi-restaurante', undefined, dueno.token)).datos;
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rest.restaurante.id,
        lineas: [{ platoId: rest.platos[0].id, cantidad: 2 }],
        propinaCentavos: 0,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
      },
      cliente.token,
    );
    expect(p.estado).toBe(201);
    expect(p.datos.desglose.impuesto).toBe(210);
    const f = await m.DB.prepare('SELECT impuesto, total FROM pedidos WHERE id = ?')
      .bind(p.datos.pedidoId)
      .first<{ impuesto: number; total: number }>();
    expect(f?.impuesto).toBe(210);
    expect(f?.total).toBe(p.datos.desglose.totalCliente);
  });
});
