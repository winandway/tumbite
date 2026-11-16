import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOTO_PRUEBA, RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-FICHA-OPERACION, C-TIEMPOS-OPERACION y C-MONITOREO-SERVICIOS (15 nov 2026, pedido de Richard:
 * «fotos y cierre en la misma ficha», «nadie va a sumar la bitácora con calculadora», y separar el
 * monitoreo por servicio). Todos los países.
 */

afterEach(() => vi.unstubAllGlobals());

async function conPedido() {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ id: 're_1' }), { status: 200 }));
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const restauranteId = String(r.datos.restaurante.id);
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
  const p = await m.llamar(
    'POST',
    '/datos/pedidos',
    {
      restauranteId,
      lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
      propinaCentavos: 400,
      direccion: '200 Calle Prueba',
      lat: 25.78,
      lng: -80.2,
    },
    cliente.token,
  );
  const id = String(p.datos.pedidoId);
  await m.DB.prepare(
    "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
  )
    .bind(id)
    .run();
  const rep = await m.cuenta('repartidor', 'Pedro Repartidor');
  await m.llamar(
    'POST',
    '/datos/repartidor/conectar',
    { conectado: true, lat: 25.771, lng: -80.191 },
    rep.token,
  );
  return { m, dueno, admin, cliente, rep, id, restauranteId };
}

describe('C-FICHA-OPERACION · ficha del pedido', () => {
  it('trae línea de tiempo única, evidencias con su foto, tiempos contra lo previsto y el cierre', async () => {
    const { m, dueno, admin, rep, id } = await conPedido();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    // La oferta guarda la distancia al restaurante (mismo INSERT) y la hora en que se aceptó.
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);
    const oferta = await m.DB.prepare(
      'SELECT km, respondida_en FROM ofertas WHERE pedido_id = ? AND estado = ?',
    )
      .bind(id, 'aceptada')
      .first<{ km: number | null; respondida_en: string | null }>();
    expect(oferta?.km).toBeGreaterThan(0);
    expect(oferta?.respondida_en).toMatch(/^\d{4}-\d{2}-\d{2} /);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    expect((await m.entregar(id, rep.token)).estado).toBe(200);

    const r = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(r.estado).toBe(200);
    const f = r.datos.pedido;
    expect(f).toMatchObject({ estado: 'entregado', servicio: 'comida', vivo: false });
    expect(f.recogida).toMatchObject({
      tipo: 'recogida',
      conFoto: true,
      foto: `/datos/pedidos/${id}/evidencia/recogida`,
      retenidaPorReclamo: false,
    });
    expect(f.recogida.confirmadaPor).toMatchObject({ rol: 'restaurante' });
    expect(f.recogida.seGuardaHasta).toMatch(/^\d{4}-\d{2}-\d{2} /);
    expect(f.entrega).toMatchObject({ tipo: 'entrega', conFoto: true });
    expect(f.entrega.confirmadaPor).toMatchObject({ rol: 'repartidor' });
    expect(f.cierre).toMatchObject({ tipo: 'entregado', por: { rol: 'repartidor' } });
    // La línea de tiempo junta estados, la aceptación del repartidor, las fotos y la confirmación.
    const eventos = f.linea.map((x: { evento: string }) => x.evento);
    expect(eventos).toEqual(
      expect.arrayContaining([
        'creado',
        'aceptado',
        'repartidor_acepto',
        'listo',
        'foto_recogida',
        'recogida_confirmada',
        'en_camino',
        'foto_entrega',
        'entregado',
      ]),
    );
    expect(eventos.indexOf('creado')).toBe(0);
    const principales = f.linea.filter((x: { capa: string }) => x.capa === 'principal');
    expect(principales[0].desdeAnteriorS).toBeNull();
    expect(principales[1].desdeAnteriorS).toBeGreaterThanOrEqual(0);
    // Los cinco tiempos, y la ida del repartidor con su previsto (sale de la distancia guardada).
    expect(f.tiempos.map((t: { clave: string }) => t.clave)).toEqual([
      'preparacion',
      'ida',
      'espera',
      'entrega',
      'total',
    ]);
    expect(f.tiempos.find((t: { clave: string }) => t.clave === 'preparacion')).toMatchObject({
      previstoS: 300,
      resultado: 'cumplio',
    });
    expect(f.tiempos.find((t: { clave: string }) => t.clave === 'ida').previstoS).toBeGreaterThan(
      0,
    );
    expect(f.tiempos.find((t: { clave: string }) => t.clave === 'total').resultado).toBe('cumplio');
    // C-FOTO-PUERTA: la foto de la puerta de la casa nunca sale en la ficha del superadmin.
    expect(JSON.stringify(f)).not.toMatch(/puertas\/|direcciones_fotos|foto-puerta|fotoPuerta/i);
    // La foto se sirve por la ruta de evidencias que ya existía (con sesión del equipo, sin caché).
    const fotoRes = await m.crudo(`/datos/pedidos/${id}/evidencia/recogida`, {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(fotoRes.status).toBe(200);
    expect(fotoRes.headers.get('cache-control')).toBe('private, no-store');
  });

  it('el cliente con la cuenta borrada sale sin nombre y la ficha no se rompe', async () => {
    const { m, admin, cliente, id } = await conPedido();
    await m.DB.prepare("UPDATE usuarios SET nombre = 'Cuenta borrada', activo = 0 WHERE id = ?")
      .bind(cliente.id)
      .run();
    const f = (await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token)).datos
      .pedido;
    expect(f.cliente).toEqual({ id: cliente.id, nombre: null });
    expect(f.linea[0]).toMatchObject({ evento: 'creado', quien: null });
  });

  it('entrega en mano: sin foto, sin pintarlo como fallo; foto borrada dice cuándo', async () => {
    const { m, admin, id } = await conPedido();
    await m.DB.batch([
      m.DB.prepare(
        "INSERT INTO evidencias (pedido_id, tipo, clave, modo, nota, confirmada_en) VALUES (?, 'entrega', '', 'mano', '', datetime('now'))",
      ).bind(id),
      m.DB.prepare(
        "INSERT INTO evidencias (pedido_id, tipo, clave, creada_en, borrada_en) VALUES (?, 'recogida', '', datetime('now', '-31 days'), datetime('now', '-1 days'))",
      ).bind(id),
    ]);
    const f = (await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token)).datos
      .pedido;
    expect(f.entrega).toMatchObject({ conFoto: false, modo: 'mano', foto: null });
    expect(f.linea.map((x: { evento: string }) => x.evento)).toContain('entrega_sin_foto');
    expect(f.recogida).toMatchObject({ conFoto: false, foto: null });
    expect(f.recogida.borradaEn).toMatch(/^\d{4}-\d{2}-\d{2} /);
  });

  it('solo el equipo ve la ficha', async () => {
    const { m, cliente, id } = await conPedido();
    expect(
      (await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, cliente.token)).estado,
    ).toBe(403);
  });
});

const VIAJE = 'beefcafe-0000-4000-8000-000000000001';
const ENVIO = 'beefd00d-0000-4000-8000-000000000002';
const TARIFA = JSON.stringify({
  base: 200,
  porKm: 100,
  porMinuto: 20,
  minimo: 500,
  moneda: 'USD',
  esperaGratisS: 300,
  factorCallePb: 13_000,
  velocidadKmh: 24,
});

async function conViajes() {
  const m = mundo();
  const admin = await m.cuenta('admin');
  const pasajero = await m.cuenta('cliente', 'Lucía Pasajera');
  const conductor = await m.cuenta('repartidor', 'Mario Conductor');
  const sql = (s: string, ...v: unknown[]) => m.DB.prepare(s).bind(...v);
  await m.DB.batch([
    sql(
      "INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado) VALUES ('ve-1', ?, 'moto', 'Honda', 'CB190', 'Roja', 'ABC12D', 'FL')",
      conductor.id,
    ),
    sql(
      `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo, espera_gratis_s,
         por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion, cargo_no_se_presento, tope_dinamico_pb, redondeo, activa)
       VALUES ('t-1', 'moto', 'US-FL-MIAMI', 'USD', 200, 100, 20, 500, 300, 10, 120, 300, 300, 10000, 1, 0)`,
    ),
    sql(
      `INSERT INTO cotizaciones_viaje (id, cliente_id, servicio_id, zona_id, tarifa_id, origen_lat, origen_lng,
         origen_direccion, destino_lat, destino_lng, destino_direccion, distancia_m, duracion_s, desglose_json,
         tarifa_json, total, moneda, vence_en)
       VALUES ('q-1', ?, 'moto', 'US-FL-MIAMI', 't-1', 25.7, -80.2, 'Origen', 25.8, -80.1, 'Destino', 5000, 900, '{}', ?, 1150, 'USD', datetime('now'))`,
      pasajero.id,
      TARIFA,
    ),
  ]);
  for (const [id, tipo, servicio] of [
    [VIAJE, 'viaje_pasajero', 'moto'],
    [ENVIO, 'envio_paquete', 'envios'],
  ] as const) {
    await m.DB.batch([
      sql(
        `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, vehiculo_id, zona_id,
           estado_general, creado_en)
         VALUES (?, ?, ?, ?, ?, 've-1', 'US-FL-MIAMI', 'terminada', datetime('now', '-40 minutes'))`,
        id,
        servicio,
        tipo,
        pasajero.id,
        conductor.id,
      ),
      sql(
        `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion,
           destino_lat, destino_lng, destino_direccion, pin_recogida, cotizacion_id, intentos_pin,
           asignado_en, llego_en, iniciado_en, terminado_en)
         VALUES (?, 'terminado', 'conductor', 'k', 25.7, -80.2, 'Origen', 25.8, -80.1, 'Destino', '8642', 'q-1', 1,
           datetime('now', '-38 minutes'), datetime('now', '-30 minutes'), datetime('now', '-27 minutes'), datetime('now', '-12 minutes'))`,
        id,
      ),
    ]);
  }
  await m.DB.batch([
    sql(
      `INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en, respondida_en, km)
       VALUES (?, ?, 've-1', 'aceptada', datetime('now'), datetime('now', '-38 minutes'), 1.2)`,
      VIAJE,
      conductor.id,
    ),
    sql(
      `INSERT INTO eventos_operacion (operacion_id, tipo, estado_anterior, estado_nuevo, actor_id, actor_rol, creado_en)
       VALUES (?, 'transicion', 'pago_pendiente', 'buscando', NULL, 'sistema', datetime('now', '-40 minutes')),
              (?, 'transicion', 'buscando', 'asignado', ?, 'conductor', datetime('now', '-38 minutes')),
              (?, 'transicion', 'en_curso', 'terminado', ?, 'conductor', datetime('now', '-12 minutes'))`,
      VIAJE,
      VIAJE,
      conductor.id,
      VIAJE,
      conductor.id,
    ),
    sql(
      "INSERT INTO emergencias_viaje (id, operacion_id, actor_id, rol, creado_en) VALUES ('em-1', ?, ?, 'pasajero', datetime('now', '-20 minutes'))",
      VIAJE,
      pasajero.id,
    ),
    sql(
      `INSERT INTO envios_persona (operacion_id, descripcion, valor_declarado, destinatario_nombre, destinatario_telefono,
         pin_entrega, foto_recogida, recogido_en)
       VALUES (?, 'Caja de libros', 2000, 'Rosa Destino', '+13055550000', '5555', ?, datetime('now', '-26 minutes'))`,
      ENVIO,
      `envios/${ENVIO}/recogida-1`,
    ),
  ]);
  await m.extra.BUCKET.put(`envios/${ENVIO}/recogida-1`, FOTO_PRUEBA, {
    httpMetadata: { contentType: 'image/jpeg' },
  });
  return { m, admin, pasajero, conductor };
}

describe('C-FICHA-OPERACION · ficha del viaje', () => {
  it('línea de tiempo con actor, conductor y placa, PIN sin el número, emergencias y tiempos', async () => {
    const { m, admin } = await conViajes();
    const r = await m.llamar('GET', `/datos/admin/viajes/${VIAJE}`, undefined, admin.token);
    expect(r.estado).toBe(200);
    const v = r.datos.viaje;
    expect(v).toMatchObject({
      servicio: 'moto',
      estado: 'terminado',
      origen: { direccion: 'Origen' },
      destino: { direccion: 'Destino' },
      pasajero: { nombre: 'Lucía Pasajera' },
      vehiculo: { placa: 'ABC12D' },
      pin: { requerido: true, usado: true, intentosFallidos: 1 },
      importe: { cotizado: 1150, moneda: 'USD' },
      envio: null,
    });
    // El PIN nunca viaja en la ficha.
    expect(JSON.stringify(v)).not.toContain('8642');
    expect(v.emergencias).toHaveLength(1);
    const eventos = v.linea.map((x: { evento: string }) => x.evento);
    expect(eventos).toEqual(
      expect.arrayContaining(['creado', 'buscando', 'asignado', 'emergencia', 'terminado']),
    );
    expect(v.linea.find((x: { evento: string }) => x.evento === 'asignado')).toMatchObject({
      rol: 'conductor',
      quien: 'Mario Conductor',
    });
    const t = new Map(v.tiempos.map((x: { clave: string }) => [x.clave, x]));
    expect(t.get('asignacion')).toMatchObject({ realS: 120, previstoS: 600, resultado: 'cumplio' });
    expect(t.get('espera_pasajero')).toMatchObject({
      realS: 180,
      previstoS: 300,
      resultado: 'cumplio',
    });
    expect(t.get('recorrido')).toMatchObject({ realS: 900, previstoS: 900, resultado: 'cumplio' });
    expect((t.get('llegada') as { previstoS: number }).previstoS).toBeGreaterThan(0);
  });

  it('un envío muestra la foto de la recogida del paquete (y solo al equipo)', async () => {
    const { m, admin, pasajero } = await conViajes();
    const v = (await m.llamar('GET', `/datos/admin/viajes/${ENVIO}`, undefined, admin.token)).datos
      .viaje;
    expect(v.envio).toMatchObject({
      descripcion: 'Caja de libros',
      fotoRecogida: `/datos/admin/viajes/${ENVIO}/foto/recogida`,
      fotoEntrega: null,
    });
    const foto = await m.crudo(`/datos/admin/viajes/${ENVIO}/foto/recogida`, {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(foto.status).toBe(200);
    expect(foto.headers.get('cache-control')).toBe('private, no-store');
    const ajeno = await m.crudo(`/datos/admin/viajes/${ENVIO}/foto/recogida`, {
      headers: { authorization: `Bearer ${pasajero.token}` },
    });
    expect(ajeno.status).toBe(403);
    // Un viaje de personas no tiene foto.
    expect(
      (
        await m.crudo(`/datos/admin/viajes/${VIAJE}/foto/recogida`, {
          headers: { authorization: `Bearer ${admin.token}` },
        })
      ).status,
    ).toBe(404);
  });

  it('las rutas fijas de viajes siguen respondiendo (no las tapa la ficha)', async () => {
    const { m, admin } = await conViajes();
    expect(
      (await m.llamar('GET', '/datos/admin/viajes/tarifas', undefined, admin.token)).estado,
    ).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/admin/viajes/ajustes', undefined, admin.token)).estado,
    ).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/admin/viajes/no-existe', undefined, admin.token)).estado,
    ).toBe(404);
  });
});

describe('C-MONITOREO-SERVICIOS · reclamos de un viaje y pestañas', () => {
  it('el equipo abre un reclamo enlazado a un viaje por su código; la ficha y la bandeja lo muestran con su servicio', async () => {
    const { m, admin } = await conViajes();
    const creado = await m.llamar(
      'POST',
      '/datos/admin/tickets',
      { enlace: '#BEEFCA', asunto: 'Cobro de espera', mensaje: 'La pasajera dice que no esperó.' },
      admin.token,
    );
    expect(creado.estado).toBe(201);
    expect(creado.datos.enlace).toMatchObject({ que: 'viaje', id: VIAJE });
    const v = (await m.llamar('GET', `/datos/admin/viajes/${VIAJE}`, undefined, admin.token)).datos
      .viaje;
    expect(v.tickets).toEqual([
      expect.objectContaining({ asunto: 'Cobro de espera', estado: 'abierto' }),
    ]);
    const motos = await m.llamar(
      'GET',
      '/datos/admin/tickets?servicio=moto',
      undefined,
      admin.token,
    );
    expect(motos.datos.tickets.map((t: { id: string }) => t.id)).toEqual([creado.datos.id]);
    expect(motos.datos.tickets[0]).toMatchObject({ servicio: 'moto', operacionId: VIAJE });
    expect(
      (await m.llamar('GET', '/datos/admin/tickets?servicio=comida', undefined, admin.token)).datos
        .tickets,
    ).toEqual([]);
    const detalle = await m.llamar(
      'GET',
      `/datos/admin/tickets/${creado.datos.id}`,
      undefined,
      admin.token,
    );
    expect(detalle.datos.ticket.operacionId).toBe(VIAJE);
    // Código ambiguo o inexistente: se dice en palabras, no se adivina.
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/tickets',
          { enlace: 'BEEF', asunto: 'xx x', mensaje: 'xx x' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/tickets',
          { enlace: 'FFFFFF', asunto: 'xx x', mensaje: 'xx x' },
          admin.token,
        )
      ).estado,
    ).toBe(404);
  });

  it('las pestañas separan comida, moto y envíos; los contadores dicen vivos y en problemas', async () => {
    const { m, admin } = await conViajes();
    const lista = async (q: string) =>
      (await m.llamar('GET', `/datos/admin/pedidos?${q}`, undefined, admin.token)).datos;
    const moto = await lista('estado=cerrados&servicio=moto');
    expect(moto.pedidos.map((x: { id: string }) => x.id)).toEqual([VIAJE]);
    expect(moto.pedidos[0]).toMatchObject({ tipo: 'viaje', servicio: 'moto', luz: 'verde' });
    const envios = await lista('estado=cerrados&servicio=envios');
    expect(envios.pedidos.map((x: { id: string }) => x.id)).toEqual([ENVIO]);
    expect((await lista('estado=cerrados&servicio=comida')).pedidos).toEqual([]);
    // Un viaje vivo con una emergencia abierta va en rojo y cuenta como «en problemas».
    const VIVO = 'beefaaaa-0000-4000-8000-000000000003';
    await m.DB.batch([
      m.DB.prepare(
        `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, vehiculo_id, zona_id, estado_general)
         SELECT ?, 'moto', 'viaje_pasajero', cliente_id, conductor_id, 've-1', 'US-FL-MIAMI', 'en_curso' FROM operaciones WHERE id = ?`,
      ).bind(VIVO, VIAJE),
      m.DB.prepare(
        `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion,
           destino_lat, destino_lng, destino_direccion, pin_recogida, cotizacion_id, asignado_en, llego_en, iniciado_en)
         VALUES (?, 'en_curso', 'conductor', 'k2', 25.7, -80.2, 'Origen', 25.8, -80.1, 'Destino', '1111', 'q-1',
           datetime('now', '-9 minutes'), datetime('now', '-6 minutes'), datetime('now', '-5 minutes'))`,
      ).bind(VIVO),
      m.DB.prepare(
        "INSERT INTO emergencias_viaje (id, operacion_id, actor_id, rol) SELECT 'em-2', ?, cliente_id, 'pasajero' FROM operaciones WHERE id = ?",
      ).bind(VIVO, VIVO),
    ]);
    const vivos = await lista('estado=vivos&servicio=moto');
    expect(vivos.pedidos.map((x: { id: string }) => x.id)).toEqual([VIVO]);
    expect(vivos.pedidos[0]).toMatchObject({ id: VIVO, luz: 'rojo', emergencia: true });
    expect((await lista('estado=vivos&servicio=auto')).pedidos).toEqual([]);
    const c = (await m.llamar('GET', '/datos/admin/pedidos/contadores', undefined, admin.token))
      .datos;
    expect(c.contadores.moto).toEqual({ vivos: 1, problemas: 1 });
    expect(c.contadores.todos.vivos).toBeGreaterThanOrEqual(1);
    expect(c.hayEnvios).toBe(true);
    expect(c.limitado).toBe(false);
  });
});

describe('C-MONITOREO-SERVICIOS · índices parciales de los reclamos (cada índice se justifica)', () => {
  it('los reclamos de un viaje y de un pedido se leen por su índice parcial, no recorriendo tickets', async () => {
    const m = mundo();
    await m.cuenta('admin'); // arma el esquema (columnas e índices)
    const plan = async (sql: string) =>
      (await m.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind('x').all<{ detail: string }>()).results
        .map((r) => r.detail)
        .join(' | ');
    expect(
      await plan(
        'SELECT id, asunto, estado, tipo, creado_en FROM tickets WHERE operacion_id = ? ORDER BY creado_en DESC LIMIT 20',
      ),
    ).toMatch(/SEARCH tickets USING INDEX tickets_operacion \(operacion_id=\?\)/);
    expect(
      await plan(
        'SELECT id, asunto, estado, tipo, creado_en FROM tickets WHERE pedido_id = ? ORDER BY creado_en DESC LIMIT 20',
      ),
    ).toMatch(/SEARCH tickets USING INDEX tickets_pedido \(pedido_id=\?\)/);
    // La retención de fotos (reclamo abierto de un pedido) también va por el índice.
    expect(
      await plan("SELECT 1 FROM tickets t WHERE t.pedido_id = ? AND t.estado != 'cerrado'"),
    ).toMatch(/USING INDEX tickets_pedido/);
  });
});
