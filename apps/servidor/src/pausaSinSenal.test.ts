import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { TAREAS_RELOJ } from './rutas/operacion';
import { pausarSinSenal } from './pausa';

/**
 * Entrega 3 · C-PAUSA-SIN-SENAL (16 oct 2026): la tienda deja de recibir pedidos si su app o su
 * panel no preguntan por pedidos en 5 minutos, y vuelve sola cuando vuelven a preguntar.
 * Ficha: docs/investigaciones-rea/2026-10-16-pausa-sin-senal.md.
 */
async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_secret_y' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente');
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
  const senal = async (hace: string | null) =>
    m.DB.prepare(
      `UPDATE restaurantes SET senal_en = ${hace ? `datetime('now', '${hace}')` : 'NULL'} WHERE id = ?`,
    )
      .bind(rid)
      .run();
  const enLista = async () => {
    const l = await m.llamar(
      'GET',
      '/datos/restaurantes?lat=25.77&lng=-80.19',
      undefined,
      cliente.token,
    );
    return (l.datos.restaurantes as { id: string; abiertoAhora: boolean }[]).find(
      (x) => x.id === rid,
    );
  };
  const pedir = () =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
      },
      cliente.token,
    );
  const fila = () =>
    m.DB.prepare('SELECT senal_en, pausa_aviso_en FROM restaurantes WHERE id = ?')
      .bind(rid)
      .first<{ senal_en: string | null; pausa_aviso_en: string | null }>();
  return { m, dueno, rid, senal, enLista, pedir, fila };
}

describe('pausa automática del restaurante sin señal (C-PAUSA-SIN-SENAL)', () => {
  it('la app del restaurante deja su señal al preguntar por pedidos, como mucho una escritura cada 30 s', async () => {
    const { m, dueno, fila } = await escenario();
    expect((await fila())?.senal_en).toBeNull();
    await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    const primera = (await fila())?.senal_en;
    expect(primera).toBeTruthy();
    // Marca vieja de 10 s: dentro de los 30 s no se reescribe.
    await m.DB.prepare(
      "UPDATE restaurantes SET senal_en = datetime('now', '-10 seconds') WHERE dueno_id = ?",
    )
      .bind(dueno.id)
      .run();
    const fijada = (await fila())?.senal_en;
    await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect((await fila())?.senal_en).toBe(fijada);
    // Marca de hace 40 s: sí se renueva.
    await m.DB.prepare(
      "UPDATE restaurantes SET senal_en = datetime('now', '-40 seconds') WHERE dueno_id = ?",
    )
      .bind(dueno.id)
      .run();
    const vieja = (await fila())?.senal_en;
    await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect((await fila())?.senal_en).not.toBe(vieja);
  });

  it('sin señal de 6 minutos: el cliente lo ve cerrado y no puede pedir; con señal vuelve solo', async () => {
    const { m, dueno, senal, enLista, pedir } = await escenario();
    await senal('-6 minutes');
    expect((await enLista())?.abiertoAhora).toBe(false);
    const r = await pedir();
    expect(r.estado).toBe(409);
    expect(String(r.datos.error)).toMatch(/no está recibiendo pedidos|isn.t taking orders/i);
    // La app del restaurante vuelve a preguntar: vuelve sola, sin que el dueño toque nada.
    await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect((await enLista())?.abiertoAhora).toBe(true);
    expect((await pedir()).estado).toBe(201);
  });

  it('compatibilidad: un restaurante sin marca todavía (como todos al publicar) sigue abierto', async () => {
    const { senal, enLista, pedir } = await escenario();
    await senal(null);
    expect((await enLista())?.abiertoAhora).toBe(true);
    expect((await pedir()).estado).toBe(201);
  });

  it('interruptor: con pausa_sin_senal_minutos = 0 la pausa está apagada', async () => {
    const { m, senal, enLista, pedir } = await escenario();
    await m.DB.prepare(
      "INSERT INTO config (clave, valor) VALUES ('pausa_sin_senal_minutos', '0') ON CONFLICT(clave) DO UPDATE SET valor = '0'",
    ).run();
    await senal('-2 hours');
    expect((await enLista())?.abiertoAhora).toBe(true);
    expect((await pedir()).estado).toBe(201);
  });

  it('el reloj avisa UNA vez por pausa y avisa la vuelta; no toca restaurantes cerrados', async () => {
    const { m, rid, senal, fila } = await escenario();
    await senal('-6 minutes');
    expect(await pausarSinSenal({ DB: m.DB } as never, m.DB)).toEqual({
      pausados: 1,
      reanudados: 0,
    });
    expect((await fila())?.pausa_aviso_en).toBeTruthy();
    // Segunda vuelta del reloj: ya avisado, no repite.
    expect(await pausarSinSenal({ DB: m.DB } as never, m.DB)).toEqual({
      pausados: 0,
      reanudados: 0,
    });
    // Vuelve la señal: se borra la marca y se avisa la vuelta.
    await senal('-5 seconds');
    expect(await pausarSinSenal({ DB: m.DB } as never, m.DB)).toEqual({
      pausados: 0,
      reanudados: 1,
    });
    expect((await fila())?.pausa_aviso_en).toBeNull();
    // Cerrado por el dueño: aunque no tenga señal, no es una pausa.
    await m.DB.prepare('UPDATE restaurantes SET abierto = 0 WHERE id = ?').bind(rid).run();
    await senal('-1 hour');
    expect(await pausarSinSenal({ DB: m.DB } as never, m.DB)).toEqual({
      pausados: 0,
      reanudados: 0,
    });
  });

  it('la tarea está en la lista del reloj seguro como NO crítica (si falla, la pausa ya funciona al leer)', () => {
    const t = TAREAS_RELOJ.find((x) => x.nombre === 'pausa_sin_senal');
    expect(t).toBeTruthy();
    expect(t?.critica).toBe(false);
  });

  it('no interrumpe pedidos ya aceptados: sin señal, el pedido en curso sigue hasta la entrega', async () => {
    const { m, dueno, senal, pedir } = await escenario();
    const p = await pedir();
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    await m.DB.prepare("UPDATE pedidos SET estado = 'pagado', stripe_pago = 'pi_x' WHERE id = ?")
      .bind(id)
      .run();
    await m.DB.prepare('INSERT OR IGNORE INTO cobros (pedido_id) VALUES (?)').bind(id).run();
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/aceptar`,
          { minutos: 5 },
          dueno.token,
        )
      ).estado,
    ).toBe(200);
    // Se cae la tableta: la tienda queda sin señal.
    await senal('-10 minutes');
    // Las acciones del pedido ya aceptado siguen funcionando (y vuelven a dar señal, pero el
    // repartidor y la entrega no dependen de ella).
    const rep = await m.cuenta('repartidor');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      rep.token,
    );
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await senal('-10 minutes');
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);
    expect(
      (await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token)).estado,
    ).toBe(200);
    await senal('-10 minutes');
    await m.recoger(id, rep.token, dueno.token);
    expect((await m.entregar(id, rep.token)).estado).toBe(200);
    const estado = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ estado: string }>();
    expect(estado?.estado).toBe('entregado');
  });

  it('no pausa por fallos momentáneos: 3 minutos sin señal sigue abierta; el límite es 5', async () => {
    const { senal, enLista, pedir } = await escenario();
    await senal('-3 minutes');
    expect((await enLista())?.abiertoAhora).toBe(true);
    expect((await pedir()).estado).toBe(201);
    await senal('-290 seconds');
    expect((await enLista())?.abiertoAhora).toBe(true);
  });

  it('recuperación segura: solo la señal del propio restaurante la reabre; ni un cliente, ni otro restaurante, ni alguien sin sesión', async () => {
    const { m, rid, senal, enLista, fila } = await escenario();
    await senal('-10 minutes');
    const antes = (await fila())?.senal_en;
    const cliente = await m.cuenta('cliente');
    const otroDueno = await m.cuenta('restaurante');
    await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Otro' },
      otroDueno.token,
    );
    await m.llamar('GET', '/datos/restaurante/pedidos', undefined, cliente.token);
    await m.llamar('GET', '/datos/restaurante/pedidos', undefined, otroDueno.token);
    await m.llamar('GET', '/datos/restaurante/pedidos');
    expect((await fila())?.senal_en).toBe(antes);
    expect((await enLista())?.abiertoAhora).toBe(false);
    void rid;
  });

  it('conexiones simultáneas: diez consultas a la vez de la app y el panel dejan UNA sola escritura de señal', async () => {
    const { m, dueno, rid, senal } = await escenario();
    await senal('-10 minutes');
    const original = m.DB.prepare.bind(m.DB);
    let escrituras = 0;
    m.DB.prepare = ((sql: string) => {
      const st = original(sql);
      if (!/UPDATE restaurantes SET senal_en/.test(sql)) return st;
      const contar = (b: ReturnType<typeof original>): ReturnType<typeof original> =>
        ({
          ...b,
          bind: (...v: unknown[]) => contar(b.bind(...v)),
          run: async () => {
            const r = await b.run();
            escrituras += Number(r.meta.changes);
            return r;
          },
        }) as ReturnType<typeof original>;
      return contar(st);
    }) as typeof m.DB.prepare;
    await Promise.all(
      Array.from({ length: 10 }, () =>
        m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token),
      ),
    );
    m.DB.prepare = original;
    expect(escrituras).toBe(1);
    void rid;
  });

  it('reintentos del reloj: dos vueltas a la vez avisan UNA sola vez la pausa y UNA sola vez la vuelta', async () => {
    const { m, senal } = await escenario();
    await senal('-6 minutes');
    const [a, b] = await Promise.all([
      pausarSinSenal({ DB: m.DB } as never, m.DB),
      pausarSinSenal({ DB: m.DB } as never, m.DB),
    ]);
    expect(a.pausados + b.pausados).toBe(1);
    await senal('-5 seconds');
    const [c, d] = await Promise.all([
      pausarSinSenal({ DB: m.DB } as never, m.DB),
      pausarSinSenal({ DB: m.DB } as never, m.DB),
    ]);
    expect(c.reanudados + d.reanudados).toBe(1);
  });
});
