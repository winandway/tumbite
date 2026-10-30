import { afterEach, describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';
import { correoDeEntrega } from './avisos';

/**
 * C-CORREO-ENTREGA (30 oct 2026): como DoorDash, al entregar le llega al cliente un correo con la
 * foto de la entrega. La foto es privada: el correo la muestra con un enlace propio de esa
 * entrega, imposible de adivinar, que vence a los 7 días.
 */
describe('correo de entrega con foto', () => {
  afterEach(() => usarTransporteCorreo(null));

  async function entregado(conFoto: boolean) {
    const enviados: { subject: string; html: string; text: string; to: { address: string }[] }[] =
      [];
    usarTransporteCorreo(async (_e, init) => {
      enviados.push(JSON.parse(String(init.body)));
      return new Response('{"ok":true,"id":"c1"}', { status: 200 });
    });
    const m = mundo({ YAD_TOKEN: 'x'.repeat(40), SITIO_URL: 'https://divoox.com' });
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente', 'Ana García');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const pid = `ped-entrega-${conFoto ? 'si' : 'no'}`;
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, aceptado_en, pagado_en, entregado_en)
       VALUES (?, ?, ?, 'entregado', '[]', 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', '200 Calle Prueba', 25.78, -80.2, datetime('now'), datetime('now'), datetime('now'))`,
    )
      .bind(pid, cliente.id, r.datos.restaurante.id)
      .run();
    if (conFoto) {
      await m.DB.prepare(
        "INSERT INTO evidencias (pedido_id, tipo, clave, confirmada_en) VALUES (?, 'entrega', ?, datetime('now'))",
      )
        .bind(pid, `evidencias/${pid}/entrega-1`)
        .run();
    }
    // Solo cuenta el correo de la entrega (no los de confirmar las cuentas de la prueba).
    enviados.splice(0);
    return { m, pid, enviados };
  }

  it('con foto: el correo lleva la imagen y el enlace funciona sin sesión; uno inventado no', async () => {
    const { m, pid, enviados } = await entregado(true);
    await correoDeEntrega(
      { DB: m.DB, YAD_TOKEN: 'x'.repeat(40), SITIO_URL: 'https://divoox.com' } as never,
      m.DB,
      pid,
    );
    expect(enviados).toHaveLength(1);
    const c = enviados[0]!;
    expect(c.subject).toMatch(/entregado|delivered/i);
    const enlace = /https:\/\/divoox\.com\/datos\/entregas\/foto\/([A-Za-z0-9_-]{32,})/.exec(
      c.html,
    );
    expect(enlace).not.toBeNull();
    expect(c.html).toContain('<img');
    expect(c.text).toContain(`/app/order/${pid}`);
    const token = enlace![1]!;
    const fila = await m.DB.prepare('SELECT pedido_id FROM fotos_entrega_publicas WHERE token = ?')
      .bind(token)
      .first();
    expect(fila).toEqual({ pedido_id: pid });
    // Con la foto en el almacén, el enlace del correo la muestra sin sesión.
    await (m.extra.BUCKET as R2Bucket).put(
      `evidencias/${pid}/entrega-1`,
      new Uint8Array([1, 2, 3]),
      {
        httpMetadata: { contentType: 'image/jpeg' },
      },
    );
    const bien = await m.crudo(`/datos/entregas/foto/${token}`, { method: 'GET' });
    expect(bien.status).toBe(200);
    expect(bien.headers.get('content-type')).toBe('image/jpeg');
    const malo = await m.llamar(
      'GET',
      '/datos/entregas/foto/inventado0000000000000000000000000000',
    );
    expect(malo.estado).toBe(404);
    // Vencido: a los 7 días ya no se ve.
    await m.DB.prepare(
      "UPDATE fotos_entrega_publicas SET creado_en = datetime('now', '-8 days')",
    ).run();
    const vencido = await m.llamar('GET', `/datos/entregas/foto/${token}`);
    expect(vencido.estado).toBe(404);
  });

  it('sin foto (entrega en mano): el correo sale igual, sin imagen ni enlace', async () => {
    const { m, pid, enviados } = await entregado(false);
    await correoDeEntrega(
      { DB: m.DB, YAD_TOKEN: 'x'.repeat(40), SITIO_URL: 'https://divoox.com' } as never,
      m.DB,
      pid,
    );
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.html).not.toContain('/datos/entregas/foto/');
  });
});
