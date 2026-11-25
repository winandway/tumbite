import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-CHAT-VIAJE-LLEGA (24 nov 2026, prueba real: el pasajero no vio los mensajes del conductor; todos
 * los países). En los dos sentidos (conductor → pasajero y pasajero → conductor): el mensaje se
 * guarda, el aviso sale a la app correcta (la del pasajero a la app de clientes, la del conductor a
 * Driver, aunque la misma cuenta tenga las dos), y la otra parte lo ve en la ficha del viaje que su
 * app YA consulta (`mensajesSinLeer` y `ultimoMensaje`) sin abrir nada. Abrir el chat
 * (`POST …/mensajes/visto`) deja el número en cero con una sola escritura; abrirlo otra vez sin nada
 * nuevo no escribe.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

type Push = { to: string; body: string; data?: Record<string, unknown> };
let pushes: Push[] = [];
function capturarExpo() {
  pushes = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('exp.host')) {
      const lote = JSON.parse(String(init?.body)) as Push[];
      pushes.push(...lote);
      return new Response(JSON.stringify({ data: lote.map(() => ({ status: 'ok' })) }), {
        status: 200,
      });
    }
    return new Response('{}', { status: 200 });
  });
}
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  await m.llamar('PUT', '/datos/admin/servicios/carro', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    '/datos/admin/servicios/carro/zonas/US-FL-MIAMI',
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'carro',
      zona: 'US-FL-MIAMI',
      tarifa: { base: 300, porKm: 120, porMinuto: 25, minimo: 800 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  const cond = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
  const cot = (
    await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
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
  expect(await cond.paso(id, 'aceptar')).toBe(200);
  // Cuenta Única: cada uno tiene también un teléfono con la OTRA app; el aviso no debe ir ahí.
  for (const [token, usuario, app] of [
    ['ExponentPushToken[cliente-app-clientes]', cliente.id, 'cliente'],
    ['ExponentPushToken[cliente-app-driver]', cliente.id, 'repartidor'],
    ['ExponentPushToken[conductor-app-driver]', cond.id, 'repartidor'],
    ['ExponentPushToken[conductor-app-clientes]', cond.id, 'cliente'],
  ] as const)
    await m.DB.prepare(
      "INSERT INTO dispositivos (token, usuario_id, plataforma, app) VALUES (?, ?, 'android', ?)",
    )
      .bind(token, usuario, app)
      .run();
  const fichaPasajero = async () =>
    (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos.viaje as {
      mensajesSinLeer: number;
      ultimoMensaje: { texto: string; mio: boolean; nombre: string } | null;
    };
  const fichaConductor = async () =>
    (await m.llamar('GET', '/datos/conductor/operaciones/actual', undefined, cond.token)).datos
      .operacion as {
      mensajesSinLeer: number;
      ultimoMensaje: { texto: string; mio: boolean; nombre: string } | null;
    };
  const marcas = async () =>
    m.DB.prepare(
      'SELECT chat_visto_cliente AS c, chat_visto_conductor AS d FROM viajes WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ c: number | null; d: number | null }>();
  return { m, cliente, cond, id, fichaPasajero, fichaConductor, marcas };
}

describe('C-CHAT-VIAJE-LLEGA', () => {
  it('conductor → pasajero: se guarda, avisa a la app de clientes y el pasajero lo ve en su ficha', async () => {
    capturarExpo();
    const { m, cliente, cond, id, fichaPasajero, fichaConductor, marcas } = await escenario();
    expect((await fichaPasajero()).mensajesSinLeer).toBe(0);
    pushes = [];
    const r = await m.llamar(
      'POST',
      `/datos/viajes/${id}/mensajes`,
      { texto: 'Estoy afuera, en el carro gris' },
      cond.token,
    );
    expect(r.estado).toBe(200);
    const guardado = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM mensajes_viaje WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ n: number }>();
    expect(guardado?.n).toBe(1);
    // El aviso, solo a la app de clientes del pasajero.
    const a = pushes.map((p) => p.to);
    expect(a).toContain('ExponentPushToken[cliente-app-clientes]');
    expect(a).not.toContain('ExponentPushToken[cliente-app-driver]');
    expect(a.filter((t) => t.includes('conductor'))).toEqual([]);
    expect(pushes.find((p) => p.to.includes('cliente-app-clientes'))?.data).toMatchObject({
      tipo: 'viaje',
      viajeId: id,
    });
    // Sin abrir nada: la ficha que la app ya consulta trae el número y el último mensaje.
    const f = await fichaPasajero();
    expect(f.mensajesSinLeer).toBe(1);
    expect(f.ultimoMensaje).toMatchObject({ texto: 'Estoy afuera, en el carro gris', mio: false });
    // También en la ficha de ESE viaje (la que abre la app al tocar el aviso).
    const porId = (await m.llamar('GET', `/datos/viajes/${id}`, undefined, cliente.token)).datos
      .viaje as { mensajesSinLeer: number };
    expect(porId.mensajesSinLeer).toBe(1);
    // Quien lo escribió no tiene nada sin leer (es suyo).
    expect((await fichaConductor()).mensajesSinLeer).toBe(0);
    // Abrir el chat lo deja en cero con UNA escritura; abrirlo otra vez no escribe.
    // Otro pasajero no puede marcarlo.
    const ajeno = await m.cuenta('cliente', 'Otra Persona');
    expect(
      (await m.llamar('POST', `/datos/viajes/${id}/mensajes/visto`, {}, ajeno.token)).estado,
    ).toBe(404);
    const abrir = await m.llamar('POST', `/datos/viajes/${id}/mensajes/visto`, {}, cliente.token);
    expect(abrir.estado).toBe(200);
    expect(abrir.datos.mensajesSinLeer).toBe(0);
    expect((await fichaPasajero()).mensajesSinLeer).toBe(0);
    const marca = (await marcas())?.c;
    expect(marca).toBeGreaterThan(0);
    await m.llamar('POST', `/datos/viajes/${id}/mensajes/visto`, {}, cliente.token);
    expect((await marcas())?.c).toBe(marca);
  });

  it('pasajero → conductor: se guarda, avisa a Driver y el conductor lo ve en su ficha', async () => {
    capturarExpo();
    const { m, cliente, cond, id, fichaPasajero, fichaConductor } = await escenario();
    pushes = [];
    const r = await m.llamar(
      'POST',
      `/datos/viajes/${id}/mensajes`,
      { texto: 'Salgo en un minuto' },
      cliente.token,
    );
    expect(r.estado).toBe(200);
    const a = pushes.map((p) => p.to);
    expect(a).toContain('ExponentPushToken[conductor-app-driver]');
    expect(a).not.toContain('ExponentPushToken[conductor-app-clientes]');
    expect(a.filter((t) => t.includes('cliente-app'))).toEqual([]);
    const f = await fichaConductor();
    expect(f.mensajesSinLeer).toBe(1);
    expect(f.ultimoMensaje).toMatchObject({ texto: 'Salgo en un minuto', mio: false });
    expect((await fichaPasajero()).ultimoMensaje).toMatchObject({ mio: true });
    const abrir = await m.llamar('POST', `/datos/viajes/${id}/mensajes/visto`, {}, cond.token);
    expect(abrir.datos.mensajesSinLeer).toBe(0);
    expect((await fichaConductor()).mensajesSinLeer).toBe(0);
    // Un mensaje nuevo vuelve a contar.
    await m.llamar('POST', `/datos/viajes/${id}/mensajes`, { texto: 'Ya bajé' }, cliente.token);
    expect((await fichaConductor()).mensajesSinLeer).toBe(1);
  });
});
