import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from './pruebas/ayuda';

/**
 * C-TERRITORIO: áreas de cobertura dibujadas dentro de una ciudad, varias franquicias por ciudad
 * y managers que solo ven lo suyo. Miami se parte en NORTE y SUR, que comparten el borde 25.77.
 */
const ENV = { STRIPE_SECRET_KEY: 'sk_test_x', ADMIN_SEMILLA: 'semilla-de-prueba-larga-123456' };
const NORTE = [
  [-80.3, 25.77],
  [-80.1, 25.77],
  [-80.1, 25.9],
  [-80.3, 25.9],
];
const SUR = [
  [-80.3, 25.64],
  [-80.1, 25.64],
  [-80.1, 25.77],
  [-80.3, 25.77],
];
const EN_NORTE = { lat: 25.8, lng: -80.2 };
const EN_SUR = { lat: 25.7, lng: -80.2 };
const EN_MIAMI_FUERA_DE_AREAS = { lat: 25.95, lng: -80.2 }; // dentro del círculo, fuera de las áreas

function stripeFalso() {
  vi.stubGlobal('fetch', async (url: string) =>
    /\/(payment_intents|customers|customer_sessions)/.test(url)
      ? new Response(JSON.stringify({ id: 'pi_1', client_secret: 'pi_1_secret_x' }))
      : new Response('{}', { status: 404 }),
  );
}

async function correoDe(m: ReturnType<typeof mundo>, id: string) {
  return (
    await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(id)
      .first<{ correo: string }>()
  )?.correo as string;
}

async function restauranteEn(
  m: ReturnType<typeof mundo>,
  adminToken: string,
  donde: typeof EN_NORTE,
  nombre: string,
) {
  const dueno = await m.cuenta('restaurante');
  const r = await m.llamar(
    'PUT',
    '/datos/mi-restaurante',
    { ...RESTAURANTE_BASE, ...donde, nombre },
    dueno.token,
  );
  await m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
    { estado: 'aprobado' },
    adminToken,
  );
  const p = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Plato', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  return { dueno, id: r.datos.restaurante.id as string, platoId: p.datos.plato.id as string };
}

async function miamiPartida(m: ReturnType<typeof mundo>, adminToken: string) {
  const norte = await m.llamar(
    'POST',
    '/datos/admin/zonas/US-FL-MIAMI/areas',
    { nombre: 'Miami Norte', poligono: NORTE, estado: 'activa' },
    adminToken,
  );
  const sur = await m.llamar(
    'POST',
    '/datos/admin/zonas/US-FL-MIAMI/areas',
    { nombre: 'Miami Sur', poligono: SUR, estado: 'proximamente', aperturaPrevista: '2026-12-01' },
    adminToken,
  );
  return {
    norte: norte.datos.area.id as string,
    sur: sur.datos.area.id as string,
    estados: [norte.estado, sur.estado],
  };
}

describe('C-TERRITORIO: cobertura por áreas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin áreas, Miami sigue con su círculo; solo el admin dibuja áreas', async () => {
    const m = mundo(ENV);
    const fuera = await m.llamar(
      'GET',
      `/datos/cobertura?lat=${EN_MIAMI_FUERA_DE_AREAS.lat}&lng=${EN_MIAMI_FUERA_DE_AREAS.lng}`,
    );
    expect(fuera.datos).toMatchObject({
      estado: 'dentro',
      zona: { id: 'US-FL-MIAMI' },
      area: null,
    });
    expect((await m.llamar('GET', '/datos/cobertura?lat=40.7&lng=-74')).datos.estado).toBe('fuera');
    const cliente = await m.cuenta('cliente');
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/zonas/US-FL-MIAMI/areas',
          { nombre: 'X', poligono: NORTE },
          cliente.token,
        )
      ).estado,
    ).toBe(403);
  });

  it('áreas publicadas que se pisan se rechazan; en borrador se permiten; vecinas con borde compartido, sí', async () => {
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    const { estados } = await miamiPartida(m, admin.token);
    expect(estados).toEqual([201, 201]); // comparten el borde 25.77
    const encima = [
      [-80.25, 25.75],
      [-80.15, 25.75],
      [-80.15, 25.85],
      [-80.25, 25.85],
    ];
    const r = await m.llamar(
      'POST',
      '/datos/admin/zonas/US-FL-MIAMI/areas',
      { nombre: 'Encima', poligono: encima, estado: 'activa' },
      admin.token,
    );
    expect(r.estado).toBe(409);
    const borrador = await m.llamar(
      'POST',
      '/datos/admin/zonas/US-FL-MIAMI/areas',
      { nombre: 'Encima', poligono: encima },
      admin.token,
    );
    expect(borrador.estado).toBe(201);
    // Publicarla después también choca.
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/admin/areas/${borrador.datos.area.id}`,
          { estado: 'proximamente' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
    // Un polígono que se cruza consigo mismo no entra.
    const moño = [
      [0, 0],
      [2, 2],
      [2, 0],
      [0, 1],
    ];
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/zonas/US-FL-MIAMI/areas',
          { nombre: 'Moño', poligono: moño },
          admin.token,
        )
      ).estado,
    ).toBe(400);
  });

  it('dentro, próxima apertura y fuera; la ciudad con áreas deja de usar su círculo', async () => {
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    await miamiPartida(m, admin.token);
    const q = (p: { lat: number; lng: number }) =>
      m.llamar('GET', `/datos/cobertura?lat=${p.lat}&lng=${p.lng}`);
    expect((await q(EN_NORTE)).datos).toMatchObject({
      estado: 'dentro',
      area: { nombre: 'Miami Norte' },
    });
    expect((await q(EN_SUR)).datos).toMatchObject({
      estado: 'proximamente',
      area: { nombre: 'Miami Sur', apertura: '2026-12-01' },
    });
    const fuera = (await q(EN_MIAMI_FUERA_DE_AREAS)).datos;
    expect(fuera.estado).toBe('fuera');
    expect(fuera.ciudadesActivas.map((z: { id: string }) => z.id)).toContain('US-FL-MIAMI');
    expect(fuera.proximas).toEqual([
      expect.objectContaining({ area: 'Miami Sur', ciudad: 'Miami' }),
    ]);
    // Pausar el norte: deja de atender.
    const { areas } = (
      await m.llamar('GET', '/datos/admin/zonas/US-FL-MIAMI/areas', undefined, admin.token)
    ).datos;
    const norte = areas.find((a: { nombre: string }) => a.nombre === 'Miami Norte');
    await m.llamar('PATCH', `/datos/admin/areas/${norte.id}`, { estado: 'pausada' }, admin.token);
    expect((await q(EN_NORTE)).datos.estado).toBe('pausada');
  });

  it('el catálogo y el pedido respetan el área activa, y lo valida el servidor', async () => {
    stripeFalso();
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    const { norte } = await miamiPartida(m, admin.token);
    const rn = await restauranteEn(m, admin.token, EN_NORTE, 'Norte Grill');
    const rs = await restauranteEn(m, admin.token, EN_SUR, 'Sur Grill');
    const area = async (id: string) =>
      (
        await m.DB.prepare('SELECT area_id FROM restaurantes WHERE id = ?')
          .bind(id)
          .first<{ area_id: string }>()
      )?.area_id;
    expect(await area(rn.id)).toBe(norte);
    expect(await area(rs.id)).not.toBe(norte);
    // El catálogo del norte muestra el del norte; el del sur (área no activa) no sale.
    const cat = await m.llamar(
      'GET',
      `/datos/restaurantes?lat=${EN_NORTE.lat}&lng=${EN_NORTE.lng}`,
    );
    const nombres = cat.datos.restaurantes.map((r: { nombre: string }) => r.nombre);
    expect(nombres).toContain('Norte Grill');
    expect(nombres).not.toContain('Sur Grill');
    // Pedido con entrega en el sur (fuera de toda área activa): el servidor lo rechaza.
    const cliente = await m.cuenta('cliente');
    const pedir = (donde: typeof EN_NORTE) =>
      m.llamar(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: rn.id,
          lineas: [{ platoId: rn.platoId, cantidad: 1 }],
          propinaCentavos: 0,
          direccion: '10 Calle Prueba, Miami',
          ...donde,
        },
        cliente.token,
      );
    const malo = await pedir(EN_SUR);
    expect(malo.estado).toBe(409);
    expect(malo.datos.error ?? malo.datos.mensaje ?? JSON.stringify(malo.datos)).toMatch(
      /fuera de la zona de cobertura|outside Tumbite/,
    );
    const bueno = await pedir({ lat: 25.81, lng: -80.21 });
    expect([200, 201]).toContain(bueno.estado);
    const pedido = await m.DB.prepare('SELECT area_id FROM pedidos WHERE id = ?')
      .bind(bueno.datos.pedidoId)
      .first<{ area_id: string }>();
    expect(pedido?.area_id).toBe(norte);
  });
});

describe('C-TERRITORIO: franquicias y managers aislados', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('dos franquicias en Miami; cada área es de una sola; cada manager ve solo lo suyo', async () => {
    stripeFalso();
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    const { norte, sur } = await miamiPartida(m, admin.token);
    await m.llamar('PATCH', `/datos/admin/areas/${sur}`, { estado: 'activa' }, admin.token);
    const rn = await restauranteEn(m, admin.token, EN_NORTE, 'Norte Grill');
    const rs = await restauranteEn(m, admin.token, EN_SUR, 'Sur Grill');

    const fa = await m.llamar(
      'POST',
      '/datos/admin/franquicias',
      { zonaId: 'US-FL-MIAMI', nombre: 'Miami Norte' },
      admin.token,
    );
    const fb = await m.llamar(
      'POST',
      '/datos/admin/franquicias',
      { zonaId: 'US-FL-MIAMI', nombre: 'Miami Sur' },
      admin.token,
    );
    expect([fa.estado, fb.estado]).toEqual([201, 201]);
    const A = fa.datos.franquicia;
    const B = fb.datos.franquicia;
    // Condiciones comerciales: ninguna inventada, todas pendientes.
    expect(A.condiciones).toMatchObject({
      cuotaEntradaCentavos: null,
      porcentajeIngresos: null,
      cuotaMensualCentavos: null,
    });

    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/admin/franquicias/${A.id}/areas`,
          { areaIds: [norte] },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/admin/franquicias/${B.id}/areas`,
          { areaIds: [norte] },
          admin.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/admin/franquicias/${B.id}/areas`,
          { areaIds: [sur] },
          admin.token,
        )
      ).estado,
    ).toBe(200);

    // Managers por correo.
    const ma = await m.cuenta('cliente', 'Manager Norte');
    const mb = await m.cuenta('cliente', 'Manager Sur');
    await m.llamar(
      'POST',
      `/datos/admin/franquicias/${A.id}/miembros`,
      { correo: await correoDe(m, ma.id) },
      admin.token,
    );
    await m.llamar(
      'POST',
      `/datos/admin/franquicias/${B.id}/miembros`,
      { correo: await correoDe(m, mb.id) },
      admin.token,
    );
    expect((await m.llamar('GET', '/datos/mi-franquicia', undefined, ma.token)).datos.ruta).toBe(
      A.ruta,
    );

    // Un pedido en cada franquicia, con su incidencia.
    const cliente = await m.cuenta('cliente');
    const pedir = (r: typeof rn, donde: typeof EN_NORTE) =>
      m.llamar(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: r.id,
          lineas: [{ platoId: r.platoId, cantidad: 1 }],
          propinaCentavos: 0,
          direccion: '10 Calle Prueba, Miami',
          ...donde,
        },
        cliente.token,
      );
    const pn = (await pedir(rn, { lat: 25.81, lng: -80.21 })).datos.pedidoId as string;
    const ps = (await pedir(rs, { lat: 25.69, lng: -80.21 })).datos.pedidoId as string;
    // Sin pagar no se supervisa: se llevan a «pagado» como lo haría el aviso de Stripe.
    await llevarA(m.DB, pn, 'pagado');
    await llevarA(m.DB, ps, 'pagado');
    await m.DB.batch(
      [pn, ps].map((p, i) =>
        m.DB.prepare(
          "INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, pedido_id, zona_id) VALUES (?, ?, 'queja', 'Cliente', 'c@ejemplo.com', 'Llegó frío', ?, 'US-FL-MIAMI')",
        ).bind(`t${i}`, `cod${i}`, p),
      ),
    );

    const verA = (await m.llamar('GET', `/datos/franquicia/${A.ruta}/resumen`, undefined, ma.token))
      .datos;
    expect(verA.rol).toBe('manager');
    expect(verA.restaurantes.map((r: { nombre: string }) => r.nombre)).toEqual(['Norte Grill']);
    expect(verA.pedidos).toHaveLength(1);
    expect(verA.pedidos[0].codigo).toBe(pn.slice(0, 8).toUpperCase());
    expect(verA.quejas.map((t: { id: string }) => t.id)).toEqual(['t0']);
    expect(JSON.stringify(verA)).not.toContain('Sur Grill');

    // El manager del norte no entra a la franquicia del sur ni toca su incidencia.
    expect(
      (await m.llamar('GET', `/datos/franquicia/${B.ruta}/resumen`, undefined, ma.token)).estado,
    ).toBe(404);
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/franquicia/${A.ruta}/incidencias/t1`,
          { estado: 'cerrado' },
          ma.token,
        )
      ).estado,
    ).toBe(404);
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/franquicia/${B.ruta}/incidencias/t1`,
          { estado: 'cerrado' },
          ma.token,
        )
      ).estado,
    ).toBe(404);
    // La suya sí.
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/franquicia/${A.ruta}/incidencias/t0`,
          { estado: 'cerrado' },
          ma.token,
        )
      ).estado,
    ).toBe(200);
    // Las reglas del superadmin no son para el manager.
    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/admin/franquicias/${A.id}/areas`,
          { areaIds: [norte, sur] },
          ma.token,
        )
      ).estado,
    ).toBe(403);
    // El admin ve las dos.
    const resumen = (await m.llamar('GET', '/datos/admin/resumen', undefined, admin.token)).datos;
    expect(resumen.franquicias).toHaveLength(2);
    expect(resumen.ciudades.find((z: { id: string }) => z.id === 'US-FL-MIAMI')).toMatchObject({
      franquicias: 2,
      areas: 2,
      areasLibres: 0,
    });
  });

  it('una franquicia sin áreas no ve nada de su ciudad', async () => {
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    await restauranteEn(m, admin.token, EN_NORTE, 'Norte Grill');
    const dueno = await m.cuenta('cliente', 'Socio');
    const f = await m.llamar(
      'POST',
      '/datos/admin/franquicias',
      { zonaId: 'US-FL-MIAMI', duenoCorreo: await correoDe(m, dueno.id) },
      admin.token,
    );
    const ver = (
      await m.llamar(
        'GET',
        `/datos/franquicia/${f.datos.franquicia.ruta}/resumen`,
        undefined,
        dueno.token,
      )
    ).datos;
    expect(ver.rol).toBe('dueno');
    expect(ver.restaurantes).toEqual([]);
    expect(ver.metricas.restaurantes).toBe(0);
  });

  it('la solicitud del formulario se convierte en franquicia (una sola vez)', async () => {
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    await m.DB.prepare(
      "INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, ciudad) VALUES ('tf', 'codf', 'franquicia', 'Ana Socia', 'ana@ejemplo.com', 'Quiero Tumbite', 'Orlando')",
    ).run();
    const lista = (
      await m.llamar('GET', '/datos/admin/solicitudes-franquicia', undefined, admin.token)
    ).datos.solicitudes;
    expect(lista).toEqual([expect.objectContaining({ id: 'tf', franquicia_id: null })]);
    const r = await m.llamar(
      'POST',
      '/datos/admin/franquicias/desde-solicitud/tf',
      { zonaId: 'US-FL-MIAMI' },
      admin.token,
    );
    expect(r.estado).toBe(201);
    expect(r.datos.franquicia).toMatchObject({
      estado: 'prospecto',
      duenoCorreo: 'ana@ejemplo.com',
      ticketId: 'tf',
    });
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/franquicias/desde-solicitud/tf',
          { zonaId: 'US-FL-MIAMI' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
    const t = await m.DB.prepare("SELECT estado FROM tickets WHERE id = 'tf'").first<{
      estado: string;
    }>();
    expect(t?.estado).toBe('respondido');
  });
});
