import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from './pruebas/ayuda';

/** Auditoría final, punto 16: comentario en la calificación y queja guiada con reembolso parcial (C-QUEJA-GUIADA). */
async function escenario() {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push(`${init?.method ?? 'GET'} ${url}`);
    if (/\/refunds$/.test(String(url)))
      return new Response(JSON.stringify({ id: 're_q' }), { status: 200 });
    return new Response(JSON.stringify({ id: 'pi_sesion', client_secret: 'x' }), { status: 200 });
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', YAD_TOKEN: 'x'.repeat(40) });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const cubano = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  const jugo = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Jugo', precioCentavos: 500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  const p = await m.llamar(
    'POST',
    '/datos/pedidos',
    {
      restauranteId: rid,
      lineas: [
        { platoId: cubano.datos.plato.id, cantidad: 1 },
        { platoId: jugo.datos.plato.id, cantidad: 2 },
      ],
      propinaCentavos: 0,
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
  await m.DB.prepare(
    "INSERT OR REPLACE INTO cobros (pedido_id, capturado_en, capturado) VALUES (?, datetime('now'), ?)",
  )
    .bind(id, p.datos.desglose.totalCliente)
    .run();
  await llevarA(m.DB, id, 'entregado');
  return { m, admin, cliente, id, jugoId: jugo.datos.plato.id as string, llamadas };
}

describe('queja guiada y comentario (C-QUEJA-GUIADA)', () => {
  it('con el reembolso automático apagado, la queja por faltante abre el ticket con el monto propuesto y no devuelve nada', async () => {
    const e = await escenario();
    const q = await e.m.llamar(
      'POST',
      '/datos/quejas',
      {
        pedidoId: e.id,
        texto: 'Faltaron los dos jugos',
        motivo: 'articulo_faltante',
        platoIds: [e.jugoId],
      },
      e.cliente.token,
    );
    expect(q.estado).toBe(201);
    expect(q.datos.propuesta).toBe(1000);
    expect(q.datos.reembolso).toBe(0);
    expect(e.llamadas.some((l) => /\/refunds$/.test(l))).toBe(false);
    const t = await e.m.DB.prepare('SELECT datos_json FROM tickets WHERE pedido_id = ?')
      .bind(e.id)
      .first<{ datos_json: string }>();
    expect(JSON.parse(t!.datos_json)).toMatchObject({
      motivo: 'articulo_faltante',
      propuesta: 1000,
      platoIds: [e.jugoId],
    });
  });

  it('encendido por el superadmin y dentro del tope, devuelve solo el valor de los platos; por encima del tope, va al ticket', async () => {
    const e = await escenario();
    expect(
      (await e.m.llamar('GET', '/datos/admin/quejas-config', undefined, e.admin.token)).datos.config
        .reembolsoAuto,
    ).toBe(false);
    await e.m.llamar(
      'PUT',
      '/datos/admin/quejas-config',
      { reembolsoAuto: true, topeCentavos: 1500 },
      e.admin.token,
    );
    const q = await e.m.llamar(
      'POST',
      '/datos/quejas',
      {
        pedidoId: e.id,
        texto: 'Faltaron los jugos',
        motivo: 'articulo_faltante',
        platoIds: [e.jugoId],
      },
      e.cliente.token,
    );
    expect(q.datos.reembolso).toBe(1000);
    expect(e.llamadas.filter((l) => /\/refunds$/.test(l))).toHaveLength(1);
    const dv = await e.m.DB.prepare(
      'SELECT monto, cargar_a, actor_id FROM devoluciones WHERE pedido_id = ?',
    )
      .bind(e.id)
      .first<{ monto: number; cargar_a: string; actor_id: string | null }>();
    expect(dv).toEqual({ monto: 1000, cargar_a: 'tumbite', actor_id: null });
    await e.m.llamar(
      'PUT',
      '/datos/admin/quejas-config',
      { reembolsoAuto: true, topeCentavos: 100 },
      e.admin.token,
    );
    const otro = await escenario();
    const q2 = await otro.m.llamar(
      'POST',
      '/datos/quejas',
      {
        pedidoId: otro.id,
        texto: 'Faltó el jugo',
        motivo: 'articulo_faltante',
        platoIds: [otro.jugoId],
      },
      otro.cliente.token,
    );
    expect(q2.datos.reembolso).toBe(0);
    expect(q2.datos.propuesta).toBe(1000);
  });

  it('la calificación guarda el comentario y la app lo pide; la queja de la app manda motivo y platos', async () => {
    const e = await escenario();
    const r = await e.m.llamar(
      'POST',
      `/datos/pedidos/${e.id}/calificar`,
      { estrellasRestaurante: 4, comentario: 'Rico, pero faltó servilleta' },
      e.cliente.token,
    );
    expect(r.estado).toBe(200);
    const cal = await e.m.DB.prepare('SELECT comentario FROM calificaciones WHERE pedido_id = ?')
      .bind(e.id)
      .first<{ comentario: string }>();
    expect(cal?.comentario).toBe('Rico, pero faltó servilleta');
    const raiz = join(__dirname, '..', '..', '..');
    const leer = (x: string) => readFileSync(join(raiz, x), 'utf8');
    expect(leer('apps/cliente/src/app/order/[id].tsx')).toContain('comentario,');
    const rp = leer('packages/movil/src/ReportarProblema.tsx');
    expect(rp).toContain("motivo: pedidoId ? motivo : 'otro'");
    expect(rp).toContain('articulo_faltante');
    expect(leer('apps/panel/src/panel/ControlDinero.tsx')).toContain(
      "'/datos/admin/quejas-config'",
    );
  });

  // C-AYUDA-PEDIDO (29 oct 2026, como «Get help» de DoorDash): plato equivocado o dañado también
  // se devuelve por plato; un solo reembolso automático por pedido; foto privada de la queja.
  it('plato equivocado o dañado también se devuelve por plato, y solo una vez por pedido', async () => {
    const e = await escenario();
    await e.m.llamar(
      'PUT',
      '/datos/admin/quejas-config',
      { reembolsoAuto: true, topeCentavos: 1500 },
      e.admin.token,
    );
    const q = await e.m.llamar(
      'POST',
      '/datos/quejas',
      {
        pedidoId: e.id,
        texto: 'Los jugos eran otros',
        motivo: 'pedido_incorrecto',
        platoIds: [e.jugoId],
      },
      e.cliente.token,
    );
    expect(q.datos.reembolso).toBe(1000);
    const q2 = await e.m.llamar(
      'POST',
      '/datos/quejas',
      {
        pedidoId: e.id,
        texto: 'Y además llegaron dañados',
        motivo: 'frio_o_danado',
        platoIds: [e.jugoId],
      },
      e.cliente.token,
    );
    expect(q2.estado).toBe(201);
    expect(q2.datos.reembolso).toBe(0);
    expect(q2.datos.propuesta).toBe(1000);
    expect(e.llamadas.filter((l) => /\/refunds$/.test(l))).toHaveLength(1);
  });

  it('la foto de la queja es privada: la ven quien se quejó y soporte, nadie más', async () => {
    const e = await escenario();
    const q = await e.m.llamar(
      'POST',
      '/datos/quejas',
      { pedidoId: e.id, texto: 'Llegó aplastado', motivo: 'frio_o_danado', platoIds: [e.jugoId] },
      e.cliente.token,
    );
    const ticket = q.datos.ticketId as string;
    expect(ticket).toBeTruthy();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const subir = (token: string, cuerpo: Uint8Array) =>
      e.m.crudo(`/datos/quejas/${ticket}/foto`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'image/png' },
        body: cuerpo as BodyInit,
      });
    const otro = await e.m.cuenta('cliente', 'Otra Persona');
    expect((await subir(otro.token, png)).status).toBe(404);
    expect((await subir(e.cliente.token, new TextEncoder().encode('no es foto'))).status).toBe(415);
    expect((await subir(e.cliente.token, png)).status).toBe(201);
    const ver = (token: string) =>
      e.m.crudo(`/datos/quejas/${ticket}/foto`, { headers: { authorization: `Bearer ${token}` } });
    expect((await ver(e.cliente.token)).status).toBe(200);
    expect((await ver(e.admin.token)).status).toBe(200);
    const ajena = await ver(otro.token);
    expect(ajena.status).toBe(404);
    expect((await ver(e.admin.token)).headers.get('cache-control')).toContain('private');
  });
});
