import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-ENTREGA-PRACTICA (3 nov 2026, ordenado por Gerencia para el video de Apple): el pedido de prueba
 * que se manda la cuenta de revisión del restaurante («Send a test order») le llega como oferta de
 * práctica SOLO a las cuentas de revisión del repartidor, que la aceptan, recogen y entregan como
 * una de verdad. Sin cobro, sin pago al repartidor y fuera del dinero y la conciliación: vive en su
 * propia tabla (`entregas_practica`), nunca en `pedidos`, `ofertas` ni el libro. Todos los países.
 */
describe('entrega de práctica para las cuentas de revisión', () => {
  async function escena() {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const revisor = await m.cuenta('repartidor', 'Revisor Driver');
    const normal = await m.cuenta('repartidor', 'Repartidor Real');
    for (const u of [dueno, revisor, normal]) await m.confirmarCorreo(u.id);
    const correo = async (id: string) =>
      (await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?').bind(id).first<{
        correo: string;
      }>())!.correo;
    await m.DB.prepare(
      "INSERT INTO revisores (correo, rol) VALUES (?, 'restaurante'), (?, 'repartidor')",
    )
      .bind(await correo(dueno.id), await correo(revisor.id))
      .run();
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    await m.abrir(dueno.token);
    await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pizza', precioCentavos: 1400 },
      dueno.token,
    );
    for (const u of [revisor, normal])
      await m.llamar(
        'POST',
        '/datos/repartidor/conectar',
        { conectado: true, lat: 25.77, lng: -80.19 },
        u.token,
      );
    return { m, dueno, revisor, normal, rid };
  }
  const contar = async (m: ReturnType<typeof mundo>, tabla: string) =>
    Number((await m.DB.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).first<{ n: number }>())!.n);

  it('solo el repartidor de revisión la ve, la entrega de punta a punta y no toca el dinero', async () => {
    const { m, dueno, revisor, normal } = await escena();
    const antes = {
      pedidos: await contar(m, 'pedidos'),
      ofertas: await contar(m, 'ofertas'),
      libro: await contar(m, 'libro'),
    };
    const prueba = await m.llamar('POST', '/datos/restaurante/pedido-prueba', {}, dueno.token);
    const id = prueba.datos.pedido.id as string;
    // Como en la vida real, la oferta sale cuando el restaurante acepta el pedido.
    const sinAceptar = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, revisor.token);
    expect(sinAceptar.datos.ofertas).toHaveLength(0);
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );

    const ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, revisor.token);
    expect(ofertas.datos.ofertas).toHaveLength(1);
    expect(ofertas.datos.ofertas[0]).toMatchObject({
      id,
      practica: true,
      pagoRepartidor: 0,
      propina: 0,
    });
    const ajenas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, normal.token);
    expect(ajenas.datos.ofertas).toHaveLength(0);
    // Un repartidor real no puede tomarla aunque sepa su número.
    const robo = await m.llamar(
      'POST',
      `/datos/repartidor/ofertas/${id}/aceptar`,
      {},
      normal.token,
    );
    expect(robo.estado).toBe(403);

    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, revisor.token)).estado,
    ).toBe(200);
    const activo = await m.llamar('GET', '/datos/repartidor/estado', undefined, revisor.token);
    expect(activo.datos.activo).toMatchObject({ id, practica: true, pagoRepartidor: 0 });

    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    for (const [paso, cuerpo] of [
      ['llegue', { lat: 25.77, lng: -80.19 }],
      ['verificar', { codigo: id.slice(0, 4) }],
    ] as const)
      expect(
        (await m.llamar('POST', `/datos/repartidor/pedidos/${id}/${paso}`, cuerpo, revisor.token))
          .estado,
      ).toBe(200);
    expect(
      (await m.foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, revisor.token)).estado,
    ).toBe(200);
    const enCamino = await m.llamar('GET', '/datos/repartidor/estado', undefined, revisor.token);
    expect(enCamino.datos.activo).toMatchObject({ id, estado: 'en_camino', practica: true });
    expect((await m.foto(`/datos/repartidor/pedidos/${id}/entregado`, revisor.token)).estado).toBe(
      200,
    );
    const fin = await m.llamar('GET', '/datos/repartidor/estado', undefined, revisor.token);
    expect(fin.datos.activo).toBeNull();

    // Nada en pedidos, ofertas ni el libro: fuera del dinero por construcción.
    expect(await contar(m, 'pedidos')).toBe(antes.pedidos);
    expect(await contar(m, 'ofertas')).toBe(antes.ofertas);
    expect(await contar(m, 'libro')).toBe(antes.libro);
    expect(await contar(m, 'entregas_practica')).toBe(1);
  });

  it('el pedido de prueba de un restaurante que no es de revisión no se ofrece a nadie', async () => {
    const { m, dueno, revisor } = await escena();
    await m.DB.prepare('DELETE FROM revisores WHERE rol = ?').bind('restaurante').run();
    const prueba = await m.llamar('POST', '/datos/restaurante/pedido-prueba', {}, dueno.token);
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${prueba.datos.pedido.id as string}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );
    const ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, revisor.token);
    expect(ofertas.datos.ofertas).toHaveLength(0);
  });
});
