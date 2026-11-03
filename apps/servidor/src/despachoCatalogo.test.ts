import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';

/**
 * C-DESPACHO-CATALOGO (NXT-6): el reparto de Comida lee el catálogo de habilitaciones, con un
 * interruptor por zona que nace APAGADO. Como DoorDash y Uber: solo recibe pedidos quien está
 * activado, con su vehículo aprobado y sus papeles (licencia y seguro en carro) [DOC, E2 p.3].
 */
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ id: 'x', client_secret: 'y' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin', 'Soporte Despacho');
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
  const q = (sql: string, ...v: unknown[]) =>
    m.DB.prepare(sql)
      .bind(...v)
      .run();
  /** Un pedido pagado, aceptado y listo: se ofrece ya. */
  async function pedidoListo() {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 300,
        direccion: '200 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await q(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
      id,
    );
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 10 },
      dueno.token,
    );
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    return id;
  }
  /** Un repartidor conectado y ubicado (sin pasar por la puerta de conectar). */
  async function repartidor(nombre: string, lat: number) {
    const d = await m.cuenta('repartidor', nombre);
    await q(
      "INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES (?, 1, ?, -80.191, datetime('now'), 'US-FL-MIAMI') ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en",
      d.id,
      lat,
    );
    return d;
  }
  const ofertas = async (token: string) =>
    ((await m.llamar('GET', '/datos/repartidor/ofertas', undefined, token)).datos.ofertas ??
      []) as { id: string }[];
  const encender = (activo: boolean, zona = 'US-FL-MIAMI') =>
    m.llamar('PUT', `/datos/admin/despacho-catalogo/${zona}`, { activo }, admin.token);
  return { m, q, admin, pedidoListo, repartidor, ofertas, encender };
}

describe('C-DESPACHO-CATALOGO · Comida lee el catálogo de habilitaciones', () => {
  it('apagado (de fábrica): un repartidor con Comida suspendida recibe la oferta igual que antes', async () => {
    const { q, admin, pedidoListo, repartidor, ofertas, m } = await escenario();
    const cerca = await repartidor('Rep Suspendido', 25.771);
    await q(
      "INSERT INTO habilitaciones (conductor_id, servicio_id, estado) VALUES (?, 'comida', 'suspendida')",
      cerca.id,
    );
    const lista = await m.llamar('GET', '/datos/admin/despacho-catalogo', undefined, admin.token);
    expect(lista.datos.zonas.find((z: { id: string }) => z.id === 'US-FL-MIAMI')?.activo).toBe(
      false,
    );
    const id = await pedidoListo();
    expect((await ofertas(cerca.token))[0]?.id).toBe(id);
  });

  it('encendido: el suspendido no recibe la oferta, la recibe el siguiente habilitado; y al conectarse se le dice por qué', async () => {
    const { q, pedidoListo, repartidor, ofertas, encender, m } = await escenario();
    expect((await encender(true)).estado).toBe(200);
    const cerca = await repartidor('Rep Suspendido', 25.771);
    const lejos = await repartidor('Rep Legado', 25.79);
    await q(
      "INSERT INTO habilitaciones (conductor_id, servicio_id, estado) VALUES (?, 'comida', 'suspendida')",
      cerca.id,
    );
    const id = await pedidoListo();
    expect(await ofertas(cerca.token)).toHaveLength(0);
    // El repartidor de siempre, sin fila en el catálogo, sigue habilitado para Comida (legado).
    expect((await ofertas(lejos.token))[0]?.id).toBe(id);
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      cerca.token,
    );
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('servicios');
    expect(r.datos.error).toMatch(/activada para repartir Comida|activated to deliver Food/);
  });

  it('encendido: en carro hace falta la licencia y el seguro aprobados; con ellos, recibe la oferta', async () => {
    const { q, admin, pedidoListo, repartidor, ofertas, encender } = await escenario();
    await encender(true);
    const rep = await repartidor('Rep Carro', 25.771);
    await q(
      "INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado) VALUES ('veh-c1', ?, 'carro', 'Toyota', 'Corolla', 'Negro', 'C1X', 'FL', 2022, 4, 'aprobado')",
      rep.id,
    );
    await q("UPDATE repartidores SET vehiculo_activo_id = 'veh-c1' WHERE usuario_id = ?", rep.id);
    const id = await pedidoListo();
    expect(await ofertas(rep.token)).toHaveLength(0);
    await q(
      "INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, aprobado_por) VALUES (?, '', 'licencia', 'aprobado', 'revision_manual', ?)",
      rep.id,
      admin.id,
    );
    expect(await ofertas(rep.token)).toHaveLength(0);
    await q(
      "INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, aprobado_por) VALUES (?, 'veh-c1', 'seguro_vehiculo', 'aprobado', 'revision_manual', ?)",
      rep.id,
      admin.id,
    );
    expect((await ofertas(rep.token))[0]?.id).toBe(id);
  });

  it('encendido: con un bloqueo de Comida o con Comida apagado en sus servicios no recibe nada', async () => {
    const { q, admin, pedidoListo, repartidor, ofertas, encender } = await escenario();
    await encender(true);
    const bloqueado = await repartidor('Rep Bloqueado', 25.771);
    const apagado = await repartidor('Rep Apagado', 25.772);
    await q(
      "INSERT INTO conductor_bloqueos (id, conductor_id, servicio_id, motivo, creado_por) VALUES ('b1', ?, 'comida', 'revisión', ?)",
      bloqueado.id,
      admin.id,
    );
    await q(
      "INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'comida', 0)",
      apagado.id,
    );
    await pedidoListo();
    expect(await ofertas(bloqueado.token)).toHaveLength(0);
    expect(await ofertas(apagado.token)).toHaveLength(0);
  });

  it('el interruptor: solo el equipo, zona que existe, no se enciende donde Comida no está y queda en la auditoría', async () => {
    const { m, q, admin, encender } = await escenario();
    const cli = await m.cuenta('cliente', 'Curioso');
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/despacho-catalogo/US-FL-MIAMI',
          { activo: true },
          cli.token,
        )
      ).estado,
    ).toBe(403);
    expect((await encender(true, 'NO-EXISTE')).estado).toBe(404);
    await q(
      "UPDATE servicios_zona SET estado = 'suspendido' WHERE servicio_id = 'comida' AND zona_id = 'US-FL-MIAMI'",
    );
    expect((await encender(true)).estado).toBe(409);
    // Apagarlo siempre se puede.
    expect((await encender(false)).estado).toBe(200);
    const a = await m.DB.prepare(
      "SELECT actor_id FROM auditoria_admin WHERE accion = 'despacho_catalogo.cambiar'",
    ).first<{ actor_id: string }>();
    expect(a?.actor_id).toBe(admin.id);
  });

  it('NXT-6x: un no habilitado en la celda del restaurante no tapa a un habilitado del resto de la zona', async () => {
    const { m, q, pedidoListo, repartidor, ofertas, encender } = await escenario();
    await encender(true);
    const cerca = await repartidor('Rep Suspendido', 25.771);
    const lejos = await repartidor('Rep Habilitado', 25.85);
    await q(
      "INSERT INTO habilitaciones (conductor_id, servicio_id, estado) VALUES (?, 'comida', 'suspendida')",
      cerca.id,
    );
    // El suspendido está en la MISMA celda del restaurante (la búsqueda rápida lo encuentra primero).
    await q(
      'UPDATE repartidores SET geohash = (SELECT geohash FROM restaurantes LIMIT 1) WHERE usuario_id = ?',
      cerca.id,
    );
    expect(
      (await m.DB.prepare('SELECT geohash FROM restaurantes LIMIT 1').first<{ geohash: string }>())
        ?.geohash,
    ).toBeTruthy();
    const id = await pedidoListo();
    expect(await ofertas(cerca.token)).toHaveLength(0);
    expect((await ofertas(lejos.token))[0]?.id).toBe(id);
  });

  it('NXT-6x: el agrupable (ya lleva otro pedido del mismo restaurante) solo recibe el segundo si está habilitado', async () => {
    for (const habilitado of [false, true]) {
      const { q, pedidoListo, repartidor, ofertas, encender } = await escenario();
      await encender(true);
      const rep = await repartidor('Rep Agrupa', 25.771);
      if (!habilitado)
        await q(
          "INSERT INTO habilitaciones (conductor_id, servicio_id, estado) VALUES (?, 'comida', 'suspendida')",
          rep.id,
        );
      const primero = await pedidoListo();
      await q("UPDATE ofertas SET estado = 'vencida' WHERE pedido_id = ?", primero);
      await q('UPDATE pedidos SET repartidor_id = ? WHERE id = ?', rep.id, primero);
      const segundo = await pedidoListo();
      const lista = (await ofertas(rep.token)).map((o) => o.id);
      expect(lista.includes(segundo), `habilitado=${habilitado}`).toBe(habilitado);
    }
  });
});

describe('NXT-6x · conectarse con los servicios que sí tiene', () => {
  /** Un conductor con Envíos habilitado (moto, papeles aprobados) en una zona con el interruptor. */
  async function conEnvios() {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    for (const ruta of [
      '/datos/admin/servicios/envios',
      '/datos/admin/servicios/envios/zonas/US-FL-MIAMI',
    ])
      await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token);
    await m.llamar(
      'PUT',
      '/datos/admin/despacho-catalogo/US-FL-MIAMI',
      { activo: true },
      admin.token,
    );
    const cond = await conductorDeMoto(m, { lat: 25.7617, lng: -80.1918 }, 'US-FL-MIAMI', 'envios');
    // Envíos en moto pide licencia de moto y seguro (C-REQUISITOS-VEHICULO): aprobados.
    for (const [veh, req] of [
      ['', 'licencia_moto'],
      [cond.vehiculo, 'seguro_vehiculo'],
    ])
      await m.DB.prepare(
        "INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, aprobado_por) VALUES (?, ?, ?, 'aprobado', 'revision_manual', ?)",
      )
        .bind(cond.id, veh, req, admin.id)
        .run();
    const conectar = (idioma = 'es') =>
      m.crudo('/datos/repartidor/conectar', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cond.token}`,
          'content-type': 'application/json',
          'x-idioma': idioma,
        },
        body: JSON.stringify({ conectado: true, lat: 25.7617, lng: -80.1918 }),
      });
    return { m, admin, cond, conectar };
  }

  it('sin Comida pero con Envíos habilitado se conecta y se le dice por qué no le llega Comida, en su idioma', async () => {
    const { m, cond, conectar } = await conEnvios();
    // Apagó Comida en sus servicios a propósito.
    await m.DB.prepare(
      "INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'comida', 0)",
    )
      .bind(cond.id)
      .run();
    const es = await conectar('es');
    expect(es.status).toBe(200);
    const d = (await es.json()) as { sinComida?: string; avisoComida?: string };
    expect(d.sinComida).toBe('preferencia_apagada');
    expect(d.avisoComida).toBe(
      'Tienes Comida apagado en tus servicios. Enciéndelo para recibir pedidos.',
    );
    const en = (await (await conectar('en')).json()) as { avisoComida?: string };
    expect(en.avisoComida).toBe(
      'Food is turned off in your services. Turn it on to receive orders.',
    );
  });

  it('NXT-6y: con un bloqueo GENERAL no se conecta aunque tenga Envíos habilitado (no puede ningún servicio)', async () => {
    const { m, admin, cond, conectar } = await conEnvios();
    await m.DB.prepare(
      "INSERT INTO conductor_bloqueos (id, conductor_id, servicio_id, motivo, creado_por) VALUES ('bg1', ?, NULL, 'revisión', ?)",
    )
      .bind(cond.id, admin.id)
      .run();
    const r = await conectar();
    expect(r.status).toBe(409);
    expect(JSON.stringify(await r.json())).toMatch(/pausa/);
  });

  it('NXT-6y: la app del Driver muestra el aviso de Comida sin bloquear la conexión', () => {
    const app = readFileSync(
      join(__dirname, '..', '..', 'repartidor', 'src', 'Inicio.tsx'),
      'utf8',
    );
    expect(app).toMatch(/avisoComida\?: string/);
    expect(app).toMatch(/else if \(r\.avisoComida\) setAviso\(r\.avisoComida\)/);
  });
});
