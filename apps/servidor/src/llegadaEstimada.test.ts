import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { contarFilas, type CuentaFilas } from './presupuestoFilas';
import {
  claveContadorLlegada,
  cuerpoLlegada,
  depurarLlegadas,
  reiniciarEstadoLlegada,
} from './llegadaEstimada';
import { URL_RUTAS } from './rutaPorCalles';
import { conductorDeMoto } from './pruebas/conductorMoto';
import { repartirOperaciones } from './operaciones';

/**
 * C-HORA-LLEGADA y C-RASTREO-VIVO (16 nov 2026, orden de Richard). Todos los países. Google va
 * SIMULADO: ninguna prueba le pega de verdad ni gasta dinero.
 */
const LLAVE = 'llave-de-prueba-0123456789abcdef';
type Llamada = { cuerpo: Record<string, unknown>; mascara: string };
let llamadasGoogle: Llamada[] = [];

beforeEach(() => {
  llamadasGoogle = [];
  reiniciarEstadoLlegada();
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url instanceof Request ? url.url : url);
    if (u === URL_RUTAS) {
      llamadasGoogle.push({
        cuerpo: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
        mascara: new Headers(init?.headers).get('x-goog-fieldmask') ?? '',
      });
      return Response.json({
        routes: [
          {
            distanceMeters: 4_200,
            duration: '840s',
            legs: [{ duration: '300s' }, { duration: '540s' }],
            polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC' },
          },
        ],
      });
    }
    // Stripe y demás: una respuesta neutra.
    return new Response(JSON.stringify({ id: 're_1' }), { status: 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

async function conPedidoEnMarcha(extra: Record<string, unknown> = { GOOGLE_PLACES_KEY: LLAVE }) {
  let cuenta: CuentaFilas = { leidas: 0, escritas: 0 };
  const m = mundo(
    { STRIPE_SECRET_KEY: 'sk_test_x', ...extra },
    {
      envolver: (db) => {
        const c = contarFilas(db);
        cuenta = c.cuenta;
        return c.db;
      },
    },
  );
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
      lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
      propinaCentavos: 0,
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
    { conectado: true, lat: 25.75, lng: -80.25 },
    rep.token,
  );
  await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
  await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
  expect(
    (await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
  ).toBe(200);
  // Cada lectura de la prueba llega «sola» (sin la anterior en la ventana de 2 minutos): si no, un
  // salto de cuadras en milisegundos se descarta por imposible (C-GPS) y no llega a la llegada.
  const ubicar = async (lat: number, lng: number) => {
    await m.DB.prepare('DELETE FROM ubicaciones_recientes').run();
    return m.llamar('POST', '/datos/repartidor/ubicacion', { lat, lng, precision: 10 }, rep.token);
  };
  return { m, admin, cliente, rep, dueno, id, ubicar, filas: () => ({ ...cuenta }) };
}

describe('C-HORA-LLEGADA · se calcula en el servidor, con tráfico, una fila por pedido', () => {
  it('una ubicación nueva calcula con Google CON tráfico; otra dentro de los 90 s no vuelve a llamar', async () => {
    const { m, id, ubicar } = await conPedidoEnMarcha();
    expect((await ubicar(25.751, -80.249)).estado).toBe(200);
    expect(llamadasGoogle).toHaveLength(1);
    const g = llamadasGoogle[0]!;
    expect(g.cuerpo.routingPreference).toBe('TRAFFIC_AWARE');
    expect(g.cuerpo.travelMode).toBe('DRIVE');
    // Va al local primero: el local es la parada intermedia y la casa el destino.
    expect(Array.isArray(g.cuerpo.intermediates)).toBe(true);
    expect(g.mascara).toBe(
      'routes.distanceMeters,routes.duration,routes.legs.duration,routes.polyline.encodedPolyline',
    );
    const fila = await m.DB.prepare('SELECT * FROM llegadas_estimadas WHERE clave = ?')
      .bind(`pedido:${id}`)
      .first<Record<string, unknown>>();
    expect(fila).toMatchObject({ fase: 'al_restaurante', fuente: 'trafico', tramo_s: 300 });
    // Se movió mucho, pero no pasaron 90 s: no se le pregunta a Google.
    await ubicar(25.76, -80.24);
    await ubicar(25.765, -80.23);
    expect(llamadasGoogle).toHaveLength(1);
    expect(
      (
        await m.DB.prepare('SELECT n FROM contadores WHERE clave = ?')
          .bind(claveContadorLlegada())
          .first<{ n: number }>()
      )?.n,
    ).toBe(1);
  });

  it('pasado el intervalo y con movimiento, vuelve a calcular; al cambiar de tramo, de una', async () => {
    const { m, id, ubicar } = await conPedidoEnMarcha();
    await ubicar(25.751, -80.249);
    // Se envejece el cálculo 100 s.
    await m.DB.prepare('UPDATE llegadas_estimadas SET calculada_en = calculada_en - 100000').run();
    await ubicar(25.765, -80.23);
    expect(llamadasGoogle).toHaveLength(2);
    // Cambia de tramo (llegó al local): se recalcula aunque no hayan pasado 90 s.
    await m.DB.prepare(
      "INSERT INTO hitos_pedido (pedido_id, hito, creado_en) VALUES (?, 'llego_restaurante', datetime('now'))",
    )
      .bind(id)
      .run();
    await ubicar(25.7651, -80.2301);
    expect(llamadasGoogle).toHaveLength(3);
    expect(
      await m.DB.prepare('SELECT fase FROM llegadas_estimadas WHERE clave = ?')
        .bind(`pedido:${id}`)
        .first(),
    ).toMatchObject({ fase: 'esperando' });
  });

  it('con el tope del día alcanzado NO se llama a Google: fórmula sin error, canario en «tope»', async () => {
    const { m, id, ubicar, admin } = await conPedidoEnMarcha({
      GOOGLE_PLACES_KEY: LLAVE,
      TOPE_LLEGADA_DIA: '1',
    });
    await m.DB.prepare('INSERT INTO contadores (clave, n) VALUES (?, 1)')
      .bind(claveContadorLlegada())
      .run();
    expect((await ubicar(25.751, -80.249)).estado).toBe(200);
    expect(llamadasGoogle).toHaveLength(0);
    expect(
      await m.DB.prepare('SELECT fuente, motivo FROM llegadas_estimadas WHERE clave = ?')
        .bind(`pedido:${id}`)
        .first(),
    ).toMatchObject({ fuente: 'estimada', motivo: 'tope_del_dia' });
    const salud = await m.llamar('GET', '/datos/salud', undefined, admin.token);
    expect(salud.datos.piezas.llegada).toBe('tope');
    expect(salud.datos.llegada).toEqual({ calculosHoy: 1, tope: 1 });
    // El aviso al equipo queda marcado una sola vez al día.
    expect(
      await m.DB.prepare(
        "SELECT COUNT(*) AS n FROM contadores WHERE clave LIKE 'llegada-tope-aviso:%'",
      ).first(),
    ).toMatchObject({ n: 1 });
  });

  it('sin llave: la fórmula de siempre, sin Google y sin error', async () => {
    const { m, id, ubicar } = await conPedidoEnMarcha({});
    expect((await ubicar(25.751, -80.249)).estado).toBe(200);
    expect(llamadasGoogle).toHaveLength(0);
    expect(
      await m.DB.prepare('SELECT fuente, motivo FROM llegadas_estimadas WHERE clave = ?')
        .bind(`pedido:${id}`)
        .first(),
    ).toMatchObject({ fuente: 'estimada', motivo: 'sin_llave' });
  });

  it('el cuerpo nunca pide más de lo necesario (sin rutas alternativas)', () => {
    const c = cuerpoLlegada({ lat: 1, lng: 2 }, [], { lat: 3, lng: 4 });
    expect(c).not.toHaveProperty('intermediates');
    expect(c.computeAlternativeRoutes).toBe(false);
  });
});

describe('C-RASTREO-VIVO · la ficha y el cliente leen la MISMA fila (mirar no escribe)', () => {
  it('la ficha recibe tramo, posición, llegada y ruta; el cliente su «llega a las…»', async () => {
    const { m, admin, cliente, id, ubicar } = await conPedidoEnMarcha();
    await ubicar(25.751, -80.249);
    const r = await m.llamar('GET', `/datos/admin/pedidos/${id}/rastreo`, undefined, admin.token);
    expect(r.estado).toBe(200);
    expect(r.res.headers.get('cache-control')).toContain('no-store');
    expect(r.datos).toMatchObject({
      vivo: true,
      fase: 'al_restaurante',
      ruta: '_p~iF~ps|U_ulLnnqC',
      detenido: null,
    });
    expect(r.datos.posicion).toMatchObject({ lat: 25.751, lng: -80.249 });
    expect(r.datos.llegada).toMatchObject({ fuente: 'trafico', distanciaM: 4200 });
    expect(r.datos.llegada.faltanS).toBeGreaterThanOrEqual(840);
    const s = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(s.datos.pedido.llegadaEnVivo).toMatchObject({
      fase: 'al_restaurante',
      fuente: 'trafico',
    });
    expect(Date.parse(s.datos.pedido.llegadaEnVivo.llegaEn)).toBeGreaterThan(Date.now());
  });

  it('presupuesto: mirar la ficha 10 veces = 0 escrituras y 0 llamadas a Google', async () => {
    const { m, admin, id, ubicar, filas } = await conPedidoEnMarcha();
    await ubicar(25.751, -80.249);
    const antes = filas();
    const google = llamadasGoogle.length;
    for (let i = 0; i < 10; i++) {
      const r = await m.llamar('GET', `/datos/admin/pedidos/${id}/rastreo`, undefined, admin.token);
      expect(r.estado).toBe(200);
    }
    const despues = filas();
    expect(despues.escritas - antes.escritas).toBe(0);
    expect(llamadasGoogle.length).toBe(google);
    // Barata: pocas lecturas por consulta (todo por llave).
    expect((despues.leidas - antes.leidas) / 10).toBeLessThan(40);
  });

  it('privacidad: sin el permiso de ubicación, 403; cerrado, ninguna posición para nadie', async () => {
    const { m, admin, cliente, rep, dueno, id, ubicar } = await conPedidoEnMarcha();
    await ubicar(25.751, -80.249);
    // Una persona del equipo con «Monitor» (sin `viajes.ubicacion_en_vivo`).
    const correo = `emp-${Math.random().toString(36).slice(2)}@ejemplo.com`;
    const inv = await m.llamar(
      'POST',
      '/datos/admin/equipo/invitaciones',
      { correo, nombre: 'Persona Equipo', plantillas: ['monitor'], motivo: 'Alta de prueba' },
      admin.token,
    );
    expect(inv.estado, JSON.stringify(inv.datos)).toBe(201);
    const ac = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
      codigo: new URL(inv.datos.enlace).searchParams.get('code'),
      nombre: 'Persona Equipo',
      clave: 'clave-segura-1',
    });
    const monitor = ac.datos.token as string;
    expect((await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, monitor)).estado).toBe(
      200,
    );
    expect(
      (await m.llamar('GET', `/datos/admin/pedidos/${id}/rastreo`, undefined, monitor)).estado,
    ).toBe(403);
    // Otro cliente no ve nada del pedido.
    const otro = await m.cuenta('cliente', 'Otro Cliente');
    expect(
      (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, otro.token)).estado,
    ).toBe(404);
    // Entregado: ni la ficha ni el cliente reciben posición ni llegada.
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    await m.DB.prepare('DELETE FROM ubicaciones_recientes').run();
    expect((await m.entregar(id, rep.token)).estado).toBe(200);
    const r = await m.llamar('GET', `/datos/admin/pedidos/${id}/rastreo`, undefined, admin.token);
    expect(r.datos).toMatchObject({ vivo: false, posicion: null, llegada: null, ruta: null });
    const s = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(s.datos.pedido.llegadaEnVivo).toBeNull();
    expect(s.datos.pedido.repartidor?.lat ?? null).toBeNull();
    void rep;
  });

  it('detenido: más de 3 min quieto lejos del local y la casa sale en la ficha y en la lista', async () => {
    const { m, admin, id, ubicar } = await conPedidoEnMarcha();
    await ubicar(25.751, -80.249);
    // El último lugar donde se lo vio moverse fue hace 5 minutos, en el mismo punto.
    await m.DB.prepare('UPDATE llegadas_estimadas SET ancla_en = ancla_en - 300000').run();
    const r = await m.llamar('GET', `/datos/admin/pedidos/${id}/rastreo`, undefined, admin.token);
    expect(r.datos.detenido).toMatchObject({ motivo: 'quieto' });
    const lista = await m.llamar(
      'GET',
      '/datos/admin/pedidos?estado=vivos',
      undefined,
      admin.token,
    );
    const fila = lista.datos.pedidos.find((x: { id: string }) => x.id === id);
    expect(fila?.detenido).toMatchObject({ motivo: 'quieto' });
  });

  it('la fila (con la línea de Google) se borra a las 24 horas', async () => {
    const { m, ubicar } = await conPedidoEnMarcha();
    await ubicar(25.751, -80.249);
    expect(await depurarLlegadas(m.DB)).toBe(0);
    expect(await depurarLlegadas(m.DB, Date.now() + 25 * 3_600_000)).toBe(1);
  });
});

describe('C-HORA-LLEGADA · viajes: la recogida y después el destino', () => {
  it('con el conductor en camino calcula hasta la recogida; el pasajero y la ficha leen la misma fila', async () => {
    const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
    const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
    const ZONA = 'US-FL-MIAMI';
    const m = mundo({ GOOGLE_PLACES_KEY: LLAVE }, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const cliente = await m.cuenta('cliente', 'Pasajero Uno');
    await m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin.token);
    await m.llamar(
      'PUT',
      `/datos/admin/servicios/moto/zonas/${ZONA}`,
      { estado: 'disponible' },
      admin.token,
    );
    await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: ZONA,
        tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
    const cond = await conductorDeMoto(m, { lat: 25.755, lng: -80.2 });
    const cot = (
      await m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
        cliente.token,
      )
    ).datos.cotizacion;
    const id = (
      await m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'efectivo' },
        cliente.token,
      )
    ).datos.viaje.id as string;
    await repartirOperaciones(undefined, m.DB);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    llamadasGoogle = [];
    await m.DB.prepare('DELETE FROM ubicaciones_recientes').run();
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/repartidor/ubicacion',
          { lat: 25.756, lng: -80.2, precision: 10 },
          cond.token,
        )
      ).estado,
    ).toBe(200);
    expect(llamadasGoogle).toHaveLength(1);
    // Viniendo a recoger, el destino del cálculo es la recogida (como «llega a las…» de Uber).
    const destino = (
      llamadasGoogle[0]!.cuerpo.destination as { location: { latLng: { latitude: number } } }
    ).location.latLng.latitude;
    expect(destino).toBe(ORIGEN.lat);
    const a = await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token);
    expect(a.datos.viaje.llegadaEnVivo).toMatchObject({ fase: 'a_recogida', fuente: 'trafico' });
    const r = await m.llamar('GET', `/datos/admin/viajes/${id}/rastreo`, undefined, admin.token);
    expect(r.datos).toMatchObject({ vivo: true, fase: 'a_recogida', esEnvio: false });
    expect(r.datos.posicion).toMatchObject({ lat: 25.756 });
  });
});
