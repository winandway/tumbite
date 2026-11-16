import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from '../pruebas/ayuda';
import { usarTransporteAvisos } from '../notificaciones';
import { tieneOfensivas, taparOfensivas } from '../filtroPalabras';

/**
 * C-MODERACION (16 nov 2026, todos los países). Regla 1.2 de Apple para apps con chat y reseñas:
 * reportar, bloquear, filtrar y una bandeja del equipo que actúa. Como Uber, DoorDash y Rappi.
 */
type Mensaje = { to: string; title: string; body: string };

function expoFalso() {
  const mandados: Mensaje[] = [];
  usarTransporteAvisos(async (_url, init) => {
    const lote = JSON.parse(String(init.body)) as Mensaje[];
    mandados.push(...lote);
    return new Response(JSON.stringify({ data: lote.map(() => ({ status: 'ok' })) }), {
      status: 200,
    });
  });
  return mandados;
}

async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ id: 'x', client_secret: 'y' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante', 'Dueño Restaurante');
  const admin = await m.cuenta('admin', 'Soporte Total');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const restauranteId = r.datos.restaurante.id as string;
  await m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${restauranteId}`,
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
  async function pedidoPagado() {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 300,
        direccion: '200 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(p.datos.pedidoId)
      .run();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${p.datos.pedidoId}/aceptar`,
      { minutos: 5 },
      dueno.token,
    );
    return p.datos.pedidoId as string;
  }
  async function repartidor(nombre: string, lat: number, lng: number) {
    const d = await m.cuenta('repartidor', nombre);
    await m.llamar('POST', '/datos/repartidor/conectar', { conectado: true, lat, lng }, d.token);
    return d;
  }
  const ofertas = async (token: string) =>
    ((await m.llamar('GET', '/datos/repartidor/ofertas', undefined, token)).datos.ofertas ??
      []) as { pedidoId?: string; id?: string }[];
  return { m, dueno, admin, cliente, restauranteId, pedidoPagado, repartidor, ofertas };
}

/** Un pedido con repartidor asignado (el chat queda abierto). */
async function conChat() {
  const e = await escenario();
  const rep = await e.repartidor('Luis Repartidor', 25.771, -80.191);
  const id = await e.pedidoPagado();
  await e.ofertas(rep.token);
  const ac = await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
  expect(ac.estado).toBe(200);
  return { ...e, rep, id };
}

afterEach(() => {
  usarTransporteAvisos(null);
  vi.unstubAllGlobals();
});

describe('C-MODERACION: filtro de palabras', () => {
  it('tapa insultos en español e inglés, también disfrazados, y deja en paz las frases normales', () => {
    expect(taparOfensivas('eres un pendejo').texto).toBe('eres un •••');
    expect(taparOfensivas('F U C K').tapado).toBe(false); // letras sueltas no son palabra
    expect(taparOfensivas('what the fuuuck').texto).toBe('what the •••');
    expect(taparOfensivas('$hit happens').tapado).toBe(true);
    expect(taparOfensivas('hijo de puta').texto).toBe('••• ••• •••');
    expect(tieneOfensivas('Coño, llegué tarde')).toBe(true);
    // Frases normales que comparten letras: no se tocan.
    for (const limpio of [
      'Dejé el pedido en el cono naranja',
      'La perra del vecino ladra',
      'Puedes tocar el timbre del apartamento 5',
      'Scunthorpe and Dickens Street',
      'The fried chicken was amazing',
      'Computadora y putative',
    ])
      expect(tieneOfensivas(limpio), limpio).toBe(false);
  });
});

describe('C-MODERACION: chat del pedido', () => {
  it('reportar un mensaje: llega a la bandeja; el reportado no ve nada y no sabe quién fue', async () => {
    const { m, cliente, rep, id, admin } = await conChat();
    await m.llamar(
      'POST',
      `/datos/pedidos/${id}/mensajes`,
      { texto: 'Te espero afuera' },
      rep.token,
    );
    const chat = await m.llamar('GET', `/datos/pedidos/${id}/mensajes`, undefined, cliente.token);
    const msj = chat.datos.mensajes[0] as { id: number; mio: boolean };
    expect(msj.mio).toBe(false);
    // No se puede reportar lo propio, ni lo de un pedido ajeno.
    const propio = await m.llamar(
      'POST',
      '/datos/reportes',
      { tipo: 'mensaje_pedido', id: msj.id, motivo: 'acoso' },
      rep.token,
    );
    expect(propio.estado).toBe(404);
    const extrano = await m.cuenta('cliente', 'Otra Persona');
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/reportes',
          { tipo: 'mensaje_pedido', id: msj.id, motivo: 'acoso' },
          extrano.token,
        )
      ).estado,
    ).toBe(404);
    const r = await m.llamar(
      'POST',
      '/datos/reportes',
      { tipo: 'mensaje_pedido', id: msj.id, motivo: 'acoso', nota: 'Me escribió de más' },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    // Reportar dos veces no duplica.
    await m.llamar(
      'POST',
      '/datos/reportes',
      { tipo: 'mensaje_pedido', id: msj.id, motivo: 'acoso' },
      cliente.token,
    );
    const bandeja = await m.llamar('GET', '/datos/admin/reportes', undefined, admin.token);
    expect(bandeja.estado).toBe(200);
    expect(bandeja.datos.reportes).toHaveLength(1);
    expect(bandeja.datos.reportes[0]).toMatchObject({
      tipo: 'mensaje_pedido',
      motivo: 'acoso',
      nota: 'Me escribió de más',
      texto: 'Te espero afuera',
      reporta: { nombre: 'Ana', rol: 'cliente' },
    });
    // El reportado no puede leer la bandeja.
    expect(
      (await m.llamar('GET', '/datos/admin/reportes', undefined, rep.token)).estado,
    ).toBeGreaterThanOrEqual(401);
  });

  it('el filtro tapa la palabra y deja el mensaje en la bandeja', async () => {
    const { m, cliente, rep, id, admin } = await conChat();
    await m.llamar(
      'POST',
      `/datos/pedidos/${id}/mensajes`,
      { texto: 'apúrate pendejo' },
      rep.token,
    );
    const chat = await m.llamar('GET', `/datos/pedidos/${id}/mensajes`, undefined, cliente.token);
    expect(chat.datos.mensajes[0].texto).toBe('apúrate •••');
    const bandeja = await m.llamar('GET', '/datos/admin/reportes', undefined, admin.token);
    expect(bandeja.datos.reportes[0]).toMatchObject({
      motivo: 'filtro',
      texto: 'apúrate pendejo',
      reporta: null,
    });
  });

  it('bloquear: no ve sus mensajes ni recibe sus avisos; el bloqueado no se entera; se puede desbloquear', async () => {
    const mandados = expoFalso();
    const { m, cliente, rep, id } = await conChat();
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: 'ExponentPushToken[cliente-1]', plataforma: 'ios' },
      cliente.token,
    );
    const b = await m.llamar('POST', '/datos/bloqueos', { pedidoId: id }, cliente.token);
    expect(b.estado).toBe(201);
    const antes = mandados.length;
    const escrito = await m.llamar(
      'POST',
      `/datos/pedidos/${id}/mensajes`,
      { texto: 'Hola otra vez' },
      rep.token,
    );
    expect(escrito.estado).toBe(200); // el bloqueado escribe como siempre: no sabe nada
    expect(mandados.length).toBe(antes); // pero al cliente no le llega el aviso
    const suyo = await m.llamar('GET', `/datos/pedidos/${id}/mensajes`, undefined, rep.token);
    expect(suyo.datos.mensajes).toHaveLength(1);
    expect(suyo.datos.bloqueaste).toBe(false);
    const delCliente = await m.llamar(
      'GET',
      `/datos/pedidos/${id}/mensajes`,
      undefined,
      cliente.token,
    );
    expect(delCliente.datos.mensajes).toHaveLength(0);
    expect(delCliente.datos.bloqueaste).toBe(true);
    // Su lista de bloqueos: solo el nombre de pila, nunca el id de la otra persona.
    const lista = await m.llamar('GET', '/datos/bloqueos', undefined, cliente.token);
    expect(lista.datos.bloqueos).toEqual([
      expect.objectContaining({ nombre: 'Luis', id: expect.any(Number) }),
    ]);
    expect(JSON.stringify(lista.datos)).not.toContain(rep.id);
    // Desbloquear: vuelve a ver sus mensajes.
    expect(
      (
        await m.llamar(
          'DELETE',
          `/datos/bloqueos/${lista.datos.bloqueos[0].id}`,
          undefined,
          cliente.token,
        )
      ).estado,
    ).toBe(200);
    const otraVez = await m.llamar(
      'GET',
      `/datos/pedidos/${id}/mensajes`,
      undefined,
      cliente.token,
    );
    expect(otraVez.datos.mensajes).toHaveLength(1);
  });

  it('bloquear: el siguiente pedido del cliente no se le ofrece a ese repartidor, sí a otro', async () => {
    const { m, cliente, rep, id, pedidoPagado, repartidor, ofertas } = await conChat();
    expect(
      (await m.llamar('POST', '/datos/bloqueos', { pedidoId: id }, cliente.token)).estado,
    ).toBe(201);
    // El primero queda libre otra vez (el pedido anterior se entregó).
    await llevarA(m.DB, id, 'entregado');
    const otro = await repartidor('Otro Repartidor', 25.79, -80.21);
    const nuevo = await pedidoPagado();
    const delBloqueado = await ofertas(rep.token);
    expect(delBloqueado.map((o) => o.pedidoId ?? o.id)).not.toContain(nuevo);
    const delOtro = await ofertas(otro.token);
    expect(delOtro.map((o) => o.pedidoId ?? o.id)).toContain(nuevo);
  });
});

describe('C-MODERACION: reseñas', () => {
  async function conResena(comentario: string) {
    const e = await conChat();
    await llevarA(e.m.DB, e.id, 'entregado');
    const cal = await e.m.llamar(
      'POST',
      `/datos/pedidos/${e.id}/calificar`,
      { estrellasRestaurante: 2, comentario },
      e.cliente.token,
    );
    expect(cal.estado).toBeLessThan(300);
    return e;
  }
  const publicas = async (m: Awaited<ReturnType<typeof escenario>>['m'], rid: string) => {
    // La ficha pública solo muestra reseñas con 10 o más opiniones: aquí se mira la base.
    const { results } = await m.DB.prepare(
      `SELECT c.rowid AS id FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id
        WHERE p.restaurante_id = ? AND NOT EXISTS (SELECT 1 FROM contenido_oculto o WHERE o.tipo = 'resena' AND o.ref = c.pedido_id)`,
    )
      .bind(rid)
      .all<{ id: number }>();
    return results;
  };

  it('una reseña con insultos se guarda tapada, no se publica y queda para el equipo; publicar la devuelve', async () => {
    const { m, admin, restauranteId, id } = await conResena('Comida de mierda, todo frío');
    const fila = await m.DB.prepare('SELECT comentario FROM calificaciones WHERE pedido_id = ?')
      .bind(id)
      .first<{ comentario: string }>();
    expect(fila?.comentario).toBe('Comida de •••, todo frío');
    expect(await publicas(m, restauranteId)).toHaveLength(0);
    const bandeja = await m.llamar('GET', '/datos/admin/reportes', undefined, admin.token);
    const rep0 = bandeja.datos.reportes[0];
    expect(rep0).toMatchObject({ tipo: 'resena', motivo: 'filtro', oculto: true });
    const pub = await m.llamar(
      'POST',
      `/datos/admin/reportes/${rep0.id}/accion`,
      { accion: 'publicar' },
      admin.token,
    );
    expect(pub.estado).toBe(200);
    expect(await publicas(m, restauranteId)).toHaveLength(1);
    const resueltos = await m.llamar(
      'GET',
      '/datos/admin/reportes?estado=resuelto',
      undefined,
      admin.token,
    );
    expect(resueltos.datos.reportes[0]).toMatchObject({ accion: 'publicar', estado: 'resuelto' });
  });

  it('el restaurante reporta una reseña; el equipo la oculta y avisa a quien la escribió, sin decir quién reportó', async () => {
    const mandados = expoFalso();
    const { m, admin, dueno, cliente, restauranteId } = await conResena('Muy lento todo');
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: 'ExponentPushToken[cliente-2]', plataforma: 'ios' },
      cliente.token,
      { 'x-idioma': 'en' },
    );
    const lista = await m.llamar('GET', '/datos/mi-restaurante/resenas', undefined, dueno.token);
    const resena = lista.datos.resenas[0] as { id: number; oculta: boolean };
    expect(resena.oculta).toBe(false);
    const r = await m.llamar(
      'POST',
      '/datos/reportes',
      { tipo: 'resena', id: resena.id, motivo: 'spam' },
      dueno.token,
    );
    expect(r.estado).toBe(201);
    // Quien la escribió no puede reportarse a sí mismo.
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/reportes',
          { tipo: 'resena', id: resena.id, motivo: 'spam' },
          cliente.token,
        )
      ).estado,
    ).toBe(404);
    const bandeja = await m.llamar('GET', '/datos/admin/reportes', undefined, admin.token);
    const rid = bandeja.datos.reportes[0].id as string;
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/reportes/${rid}/accion`,
          { accion: 'ocultar' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    expect(await publicas(m, restauranteId)).toHaveLength(0);
    const otraVez = await m.llamar('GET', '/datos/mi-restaurante/resenas', undefined, dueno.token);
    expect(otraVez.datos.resenas[0].oculta).toBe(true);
    // Avisar: el aviso habla de las normas, en el idioma de su teléfono, sin nombres.
    const antes = mandados.length;
    const nuevo = await m.llamar(
      'POST',
      '/datos/reportes',
      { tipo: 'resena', id: resena.id, motivo: 'ofensivo' },
      admin.token,
    );
    expect(nuevo.estado).toBe(201);
    const b2 = await m.llamar('GET', '/datos/admin/reportes', undefined, admin.token);
    await m.llamar(
      'POST',
      `/datos/admin/reportes/${b2.datos.reportes[0].id}/accion`,
      { accion: 'avisar' },
      admin.token,
    );
    const aviso = mandados.slice(antes).find((x) => x.to === 'ExponentPushToken[cliente-2]');
    expect(aviso?.title).toBe('A reminder about our community guidelines');
    expect(JSON.stringify(aviso)).not.toMatch(/Dueño|Soporte|restaurante/i);
  });

  it('una respuesta del restaurante con insultos no se guarda', async () => {
    const { m, dueno, id } = await conResena('Bien');
    const r = await m.llamar(
      'POST',
      `/datos/mi-restaurante/resenas/${id}/responder`,
      { texto: 'Cállate pendejo' },
      dueno.token,
    );
    expect(r.estado).toBe(422);
    const ok = await m.llamar(
      'POST',
      `/datos/mi-restaurante/resenas/${id}/responder`,
      { texto: 'Gracias por escribirnos' },
      dueno.token,
    );
    expect(ok.estado).toBe(200);
  });

  it('suspender desde la bandeja exige el permiso de suspender y cierra la sesión del autor', async () => {
    const { m, admin, cliente, rep, id } = await conChat();
    await m.llamar('POST', `/datos/pedidos/${id}/mensajes`, { texto: 'te voy a matar' }, rep.token);
    const bandeja = await m.llamar('GET', '/datos/admin/reportes', undefined, admin.token);
    expect(bandeja.datos.reportes[0].motivo).toBe('filtro');
    const s = await m.llamar(
      'POST',
      `/datos/admin/reportes/${bandeja.datos.reportes[0].id}/accion`,
      { accion: 'suspender' },
      admin.token,
    );
    expect(s.estado).toBe(200);
    const yo = await m.llamar('GET', '/datos/cuentas/yo', undefined, rep.token);
    expect(yo.estado).toBe(401);
    // El mensaje queda oculto para el cliente.
    const chat = await m.llamar('GET', `/datos/pedidos/${id}/mensajes`, undefined, cliente.token);
    expect(chat.datos.mensajes).toHaveLength(0);
  });
});
