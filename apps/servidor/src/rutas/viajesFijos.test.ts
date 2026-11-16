import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIANZA } from '@tumbite/compartido';
import type { Env } from '../env';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { repartirOperaciones } from '../operaciones';
import { TAREAS_RELOJ } from './operacion';
import { activarViajesProgramados } from './viajesProgramados';
import { correrViajesFijos } from './viajesFijos';

/**
 * C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026, todos los países): el conductor de confianza
 * recibe primero el viaje (un minuto, solo él) y después pasa a los demás; los viajes fijos nacen
 * solos 24 horas antes, se pausan y se saltan; el viaje de un menor lleva su PIN fijo, solo va a un
 * vehículo que acepta menores y el responsable recibe un aviso en cada paso; el conductor ve su
 * agenda y puede decir «no puedo»; el equipo lo ve en el monitoreo.
 */
type Mundo = ReturnType<typeof mundo>;
const env = (m: Mundo) => m.extra as unknown as Env;
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Casa' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Escuela' };
const LEJOS = { lat: 25.7717, lng: -80.1918 }; // ~1,1 km: el conductor de confianza, más lejos
const TARIFA = { base: 300, porKm: 120, porMinuto: 25, minimo: 800, cargoCancelacion: 500 };

afterEach(() => vi.unstubAllGlobals());

/** Los avisos a los teléfonos (Expo) que salieron durante la prueba. */
function capturarAvisos() {
  const avisos: { to: string; title: string; body: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('exp.host')) {
      const cuerpo = JSON.parse(String(init?.body)) as {
        to: string;
        title: string;
        body: string;
      }[];
      avisos.push(...cuerpo);
      return new Response(JSON.stringify({ data: cuerpo.map(() => ({ status: 'ok' })) }), {
        status: 200,
      });
    }
    return new Response('{}', { status: 200 });
  });
  return avisos;
}

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Marta Madre');
  await m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    '/datos/admin/servicios/moto/zonas/US-FL-MIAMI',
    { estado: 'disponible' },
    admin.token,
  );
  const t = await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona: 'US-FL-MIAMI', tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    admin.token,
  );
  expect(t.estado).toBeLessThan(300);
  await m.DB.prepare("UPDATE usuarios SET idioma = 'es' WHERE id = ?").bind(cliente.id).run();
  await m.DB.prepare(
    "INSERT INTO dispositivos (token, usuario_id, plataforma) VALUES ('ExponentPushToken[cliente]', ?, 'android')",
  )
    .bind(cliente.id)
    .run();
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenario>>;

async function pedir(e: E, extra: Record<string, unknown> = {}) {
  const cot = (
    await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
      e.cliente.token,
    )
  ).datos.cotizacion as { id: string };
  const r = await e.m.llamar(
    'POST',
    '/datos/viajes',
    { cotizacionId: cot.id, metodoPago: 'efectivo', ...extra },
    e.cliente.token,
  );
  expect(r.estado).toBe(201);
  return r.datos.viaje.id as string;
}

/** Un viaje de punta a punta con ese conductor (lo que hace falta para marcarlo de confianza). */
async function viajeCompleto(e: E, cond: Awaited<ReturnType<typeof conductorDeMoto>>) {
  const id = await pedir(e, { confianza: 'ninguno' });
  await repartirOperaciones(env(e.m), e.m.DB);
  expect(await cond.paso(id, 'aceptar')).toBe(200);
  expect(await cond.paso(id, 'llegue')).toBe(200);
  const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
    .viaje.pin as string | null;
  expect(await cond.paso(id, 'iniciar', pin ? { pin } : {})).toBe(200);
  expect(await cond.paso(id, 'terminar')).toBe(200);
  return id;
}

const ofertaDe = async (e: E, operacionId: string) =>
  (await e.m.DB.prepare(
    "SELECT conductor_id, CAST((julianday(expira_en) - julianday('now')) * 86400 AS INTEGER) AS s FROM ofertas_operacion WHERE operacion_id = ? AND estado = 'ofrecida'",
  )
    .bind(operacionId)
    .first<{ conductor_id: string; s: number }>()) ?? null;

/** La hora local de Miami dentro de `min` minutos, «HH:MM». */
function horaMiami(min: number) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(Date.now() + min * 60_000));
}

const rutinaBase = (extra: Record<string, unknown> = {}) => ({
  nombre: 'Escuela de Sofía',
  servicio: 'moto',
  origen: ORIGEN,
  destino: DESTINO,
  dias: [1, 2, 3, 4, 5, 6, 7],
  horaIda: horaMiami(180),
  metodoPago: 'efectivo',
  ...extra,
});

describe('C-CONDUCTOR-CONFIANZA', () => {
  it('solo se marca a un conductor con quien ya viajó; hasta 3; Mis viajes lo dice', async () => {
    const e = await escenario();
    const cond = await conductorDeMoto(e.m, ORIGEN);
    const id = await pedir(e, { confianza: 'ninguno' });
    // Sin viaje terminado todavía: no se puede.
    await repartirOperaciones(env(e.m), e.m.DB);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(
      (await e.m.llamar('PUT', `/datos/viajes/${id}/confianza`, {}, e.cliente.token)).estado,
    ).toBe(409);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    const pin = (await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token)).datos
      .viaje.pin as string | null;
    expect(await cond.paso(id, 'iniciar', pin ? { pin } : {})).toBe(200);
    expect(await cond.paso(id, 'terminar')).toBe(200);
    expect(
      (await e.m.llamar('PUT', `/datos/viajes/${id}/confianza`, {}, e.cliente.token)).estado,
    ).toBe(200);
    // Repetir no duplica.
    expect(
      (await e.m.llamar('PUT', `/datos/viajes/${id}/confianza`, {}, e.cliente.token)).estado,
    ).toBe(200);
    // La foto: solo para quien lo tiene de confianza.
    const otraCuenta = await e.m.cuenta('cliente', 'Otra Persona');
    const foto = await e.m.llamar(
      'GET',
      `/datos/confianza/${cond.id}/foto`,
      undefined,
      otraCuenta.token,
    );
    expect(foto.estado).toBe(404);
    const lista = await e.m.llamar('GET', '/datos/confianza', undefined, e.cliente.token);
    expect(lista.datos.conductores).toHaveLength(1);
    expect(lista.datos.conductores[0]).toMatchObject({
      id: cond.id,
      nombre: 'Conductor',
      viajes: 1,
    });
    const hist = await e.m.llamar('GET', '/datos/viajes/historial', undefined, e.cliente.token);
    expect(hist.datos.viajes[0]).toMatchObject({ id, deConfianza: true, conductor: 'Conductor' });
    // El tope: 3.
    for (let i = 0; i < 3; i++) {
      const otro = await conductorDeMoto(e.m, ORIGEN);
      await e.m.DB.prepare(
        'UPDATE repartidores SET conectado = 0, ubicacion_en = NULL WHERE usuario_id = ?',
      )
        .bind(cond.id)
        .run();
      const v = await viajeCompleto(e, otro);
      const r = await e.m.llamar('PUT', `/datos/viajes/${v}/confianza`, {}, e.cliente.token);
      expect(r.estado).toBe(i < 2 ? 200 : 409);
      await e.m.DB.prepare(
        'UPDATE repartidores SET conectado = 0, ubicacion_en = NULL WHERE usuario_id = ?',
      )
        .bind(otro.id)
        .run();
    }
  });

  it('al pedir, el viaje se le ofrece SOLO a él por un minuto aunque haya otro más cerca; si lo rechaza, pasa a los demás', async () => {
    const e = await escenario();
    const fiel = await conductorDeMoto(e.m, ORIGEN);
    await viajeCompleto(e, fiel);
    await e.m.DB.prepare(
      "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(LEJOS.lat, LEJOS.lng, fiel.id)
      .run();
    const ultimo = (await e.m.llamar('GET', '/datos/viajes/historial', undefined, e.cliente.token))
      .datos.viajes[0].id;
    expect(
      (await e.m.llamar('PUT', `/datos/viajes/${ultimo}/confianza`, {}, e.cliente.token)).estado,
    ).toBe(200);
    const cerca = await conductorDeMoto(e.m, ORIGEN);
    const id = await pedir(e);
    const o = await ofertaDe(e, id);
    expect(o?.conductor_id).toBe(fiel.id);
    expect(o?.s).toBeGreaterThan(CONFIANZA.segundosOfertaExclusiva - 5);
    await repartirOperaciones(env(e.m), e.m.DB);
    // El de al lado no ve nada mientras dura su minuto.
    const nada = await e.m.llamar(
      'GET',
      '/datos/conductor/operaciones/ofertas',
      undefined,
      cerca.token,
    );
    expect(nada.datos.ofertas).toHaveLength(0);
    const suya = await e.m.llamar(
      'GET',
      '/datos/conductor/operaciones/ofertas',
      undefined,
      fiel.token,
    );
    expect(suya.datos.ofertas[0]).toMatchObject({ operacionId: id, deConfianza: true });
    expect(await fiel.paso(id, 'rechazar')).toBe(200);
    expect((await ofertaDe(e, id))?.conductor_id).toBe(cerca.id);
  });

  it('si no está conectado, un viaje para ya va directo a los demás (no se espera)', async () => {
    const e = await escenario();
    const fiel = await conductorDeMoto(e.m, ORIGEN);
    const v = await viajeCompleto(e, fiel);
    await e.m.llamar('PUT', `/datos/viajes/${v}/confianza`, {}, e.cliente.token);
    await e.m.DB.prepare(
      "UPDATE repartidores SET ubicacion_en = datetime('now', '-1 hour') WHERE usuario_id = ?",
    )
      .bind(fiel.id)
      .run();
    const otro = await conductorDeMoto(e.m, ORIGEN);
    const id = await pedir(e);
    const pref = await e.m.DB.prepare(
      'SELECT conductor_preferido_id FROM viajes WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ conductor_preferido_id: string | null }>();
    // Sin conectado, el más cercano conectado de los suyos no existe: nadie preferido.
    expect(pref?.conductor_preferido_id).toBeNull();
    expect((await ofertaDe(e, id))?.conductor_id).toBe(otro.id);
  });
});

describe('C-VIAJES-FIJOS', () => {
  it('nace solo 24 horas antes, una sola vez, con su conductor de confianza; pausar y reanudar', async () => {
    const e = await escenario();
    const fiel = await conductorDeMoto(e.m, ORIGEN);
    const v = await viajeCompleto(e, fiel);
    await e.m.llamar('PUT', `/datos/viajes/${v}/confianza`, {}, e.cliente.token);
    const r = await e.m.llamar(
      'POST',
      '/datos/rutinas',
      rutinaBase({ conductorId: fiel.id }),
      e.cliente.token,
    );
    expect(r.estado).toBe(201);
    const rid = r.datos.rutina.id as string;
    const a = await correrViajesFijos(env(e.m), e.m.DB);
    expect(a.creadas).toBe(1);
    expect((await correrViajesFijos(env(e.m), e.m.DB)).creadas).toBe(0);
    const p = await e.m.DB.prepare(
      'SELECT id, conductor_preferido_id, estado FROM viajes_programados WHERE rutina_id = ?',
    )
      .bind(rid)
      .first<{ id: string; conductor_preferido_id: string; estado: string }>();
    expect(p).toMatchObject({ conductor_preferido_id: fiel.id, estado: 'programado' });
    // Lo ve en su lista de programados, con el nombre del viaje fijo.
    const prog = await e.m.llamar('GET', '/datos/viajes/programados', undefined, e.cliente.token);
    expect(prog.datos.programados[0].rutina).toMatchObject({ id: rid, nombre: 'Escuela de Sofía' });
    // Pausar suelta la reserva (falta más de una hora: gratis) y no vuelve a nacer.
    expect(
      (await e.m.llamar('POST', `/datos/rutinas/${rid}/pausar`, { hasta: null }, e.cliente.token))
        .estado,
    ).toBe(200);
    const cancelada = await e.m.DB.prepare('SELECT estado FROM viajes_programados WHERE id = ?')
      .bind(p!.id)
      .first<{ estado: string }>();
    expect(cancelada?.estado).toBe('cancelado');
    await e.m.DB.prepare(
      "UPDATE rutinas_viaje SET proxima_revision_en = datetime('now') WHERE id = ?",
    )
      .bind(rid)
      .run();
    expect((await correrViajesFijos(env(e.m), e.m.DB)).creadas).toBe(0);
    // Reanudar: vuelve a nacer.
    expect(
      (await e.m.llamar('POST', `/datos/rutinas/${rid}/reanudar`, {}, e.cliente.token)).estado,
    ).toBe(200);
    expect((await correrViajesFijos(env(e.m), e.m.DB)).creadas).toBe(1);
    const deudas = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM deudas_pasajero').first<{
      n: number;
    }>();
    expect(deudas?.n).toBe(0);
  });

  it('saltar un día lo cancela gratis y no vuelve a nacer ese día', async () => {
    const e = await escenario();
    const r = await e.m.llamar('POST', '/datos/rutinas', rutinaBase(), e.cliente.token);
    const rid = r.datos.rutina.id as string;
    await correrViajesFijos(env(e.m), e.m.DB);
    const s = await e.m.DB.prepare('SELECT fecha FROM rutina_salidas WHERE rutina_id = ?')
      .bind(rid)
      .first<{ fecha: string }>();
    const salto = await e.m.llamar(
      'POST',
      `/datos/rutinas/${rid}/saltar`,
      { fecha: s!.fecha },
      e.cliente.token,
    );
    expect(salto.estado).toBe(200);
    const fila = await e.m.DB.prepare(
      'SELECT estado FROM rutina_salidas WHERE rutina_id = ? AND fecha = ?',
    )
      .bind(rid, s!.fecha)
      .first<{ estado: string }>();
    expect(fila?.estado).toBe('saltada');
    await e.m.DB.prepare(
      "UPDATE rutinas_viaje SET proxima_revision_en = datetime('now') WHERE id = ?",
    )
      .bind(rid)
      .run();
    expect((await correrViajesFijos(env(e.m), e.m.DB)).creadas).toBe(0);
    const vivas = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM viajes_programados WHERE rutina_id = ? AND estado = 'programado'",
    )
      .bind(rid)
      .first<{ n: number }>();
    expect(vivas?.n).toBe(0);
  });

  it('el viaje de un menor: PIN fijo, solo vehículo que acepta menores y avisos al responsable', async () => {
    const e = await escenario();
    const avisos = capturarAvisos();
    const fiel = await conductorDeMoto(e.m, ORIGEN);
    const v = await viajeCompleto(e, fiel);
    await e.m.llamar('PUT', `/datos/viajes/${v}/confianza`, {}, e.cliente.token);
    const menor = { nombre: 'Sofía', pin: '2580' };
    // «Acepto llevar menores» nace APAGADO (no es el interruptor de categorías de Carro): no se puede.
    const no = await e.m.llamar(
      'POST',
      '/datos/rutinas',
      rutinaBase({ conductorId: fiel.id, menor }),
      e.cliente.token,
    );
    expect(no.estado).toBe(409);
    // El conductor lo enciende desde su app.
    const enc = await e.m.llamar(
      'PUT',
      `/datos/conductor/vehiculos/${fiel.vehiculo}/lleva-menores`,
      { acepta: true },
      fiel.token,
    );
    expect(enc.estado).toBe(200);
    const r = await e.m.llamar(
      'POST',
      '/datos/rutinas',
      rutinaBase({ conductorId: fiel.id, menor }),
      e.cliente.token,
    );
    expect(r.estado).toBe(201);
    expect(r.datos.rutina.menor).toEqual(menor);
    const rid = r.datos.rutina.id as string;
    await correrViajesFijos(env(e.m), e.m.DB);
    const p = await e.m.DB.prepare('SELECT id FROM viajes_programados WHERE rutina_id = ?')
      .bind(rid)
      .first<{ id: string }>();
    // Otro conductor más cerca, con moto que NO acepta menores.
    const otro = await conductorDeMoto(e.m, ORIGEN);
    // Trae `acepta_menores` = 1 (categorías de Carro), que NO cuenta para llevar menores.
    await e.m.DB.prepare('UPDATE vehiculos SET acepta_menores = 1 WHERE id = ?')
      .bind(otro.vehiculo)
      .run();
    // Faltan 25 minutos: nace (con conductor de confianza, 30 minutos antes) y se le ofrece a él.
    await e.m.DB.prepare(
      "UPDATE viajes_programados SET programado_para = datetime('now', '+25 minutes') WHERE id = ?",
    )
      .bind(p!.id)
      .run();
    expect((await activarViajesProgramados(env(e.m), e.m.DB)).activados).toBe(1);
    const viaje = await e.m.DB.prepare(
      'SELECT pin_recogida, pin_requerido, menor_nombre, rutina_id FROM viajes WHERE operacion_id = ?',
    )
      .bind(p!.id)
      .first<{
        pin_recogida: string;
        pin_requerido: number;
        menor_nombre: string;
        rutina_id: string;
      }>();
    expect(viaje).toMatchObject({
      pin_recogida: '2580',
      pin_requerido: 1,
      menor_nombre: 'Sofía',
      rutina_id: rid,
    });
    expect((await ofertaDe(e, p!.id))?.conductor_id).toBe(fiel.id);
    // Si él no lo toma, NO va a una moto que no acepta menores.
    await fiel.paso(p!.id, 'rechazar');
    await e.m.DB.prepare(
      "UPDATE viajes SET programado_para = datetime('now', '+2 minutes') WHERE operacion_id = ?",
    )
      .bind(p!.id)
      .run();
    await repartirOperaciones(env(e.m), e.m.DB);
    expect(await ofertaDe(e, p!.id)).toBeNull();
    // Vuelve a ofrecérsele (la prueba borra su rechazo) y sigue el viaje con los avisos.
    await e.m.DB.prepare('DELETE FROM ofertas_operacion WHERE operacion_id = ?').bind(p!.id).run();
    await repartirOperaciones(env(e.m), e.m.DB);
    expect(await fiel.paso(p!.id, 'aceptar')).toBe(200);
    expect(await fiel.paso(p!.id, 'llegue')).toBe(200);
    expect(await fiel.paso(p!.id, 'iniciar', { pin: '1111' })).toBe(409);
    expect(await fiel.paso(p!.id, 'iniciar', { pin: '2580' })).toBe(200);
    expect(await fiel.paso(p!.id, 'terminar')).toBe(200);
    const alResponsable = avisos
      .filter((a) => a.to === 'ExponentPushToken[cliente]')
      .map((a) => a.title);
    expect(alResponsable).toEqual(
      expect.arrayContaining([
        'Conductor va por Sofía',
        'Conductor llegó por Sofía',
        'Sofía ya va en camino',
        'Sofía llegó',
      ]),
    );
  });

  it('el conductor ve su agenda, dice «no puedo» y el viaje va a cualquiera; el cliente lo sabe', async () => {
    const e = await escenario();
    const avisos = capturarAvisos();
    const fiel = await conductorDeMoto(e.m, ORIGEN);
    const v = await viajeCompleto(e, fiel);
    await e.m.llamar('PUT', `/datos/viajes/${v}/confianza`, {}, e.cliente.token);
    const r = await e.m.llamar(
      'POST',
      '/datos/rutinas',
      rutinaBase({
        conductorId: fiel.id,
        horaVuelta: horaMiami(181) < horaMiami(180) ? null : horaMiami(240),
      }),
      e.cliente.token,
    );
    expect(r.estado).toBe(201);
    const rid = r.datos.rutina.id as string;
    await correrViajesFijos(env(e.m), e.m.DB);
    const ag = await e.m.llamar('GET', '/datos/conductor/clientes-fijos', undefined, fiel.token);
    expect(ag.datos.clientes[0]).toMatchObject({ nombre: 'Marta', fijos: 1 });
    expect(ag.datos.rutinas[0]).toMatchObject({ id: rid, cliente: 'Marta' });
    const hoy = ag.datos.agenda.find((x: { creada: boolean }) => x.creada);
    expect(hoy).toBeTruthy();
    const np = await e.m.llamar(
      'POST',
      `/datos/conductor/rutinas/${rid}/no-puedo`,
      { fecha: hoy.fecha, sentido: hoy.sentido },
      fiel.token,
    );
    expect(np.estado).toBe(200);
    const p = await e.m.DB.prepare(
      'SELECT conductor_preferido_id FROM viajes_programados WHERE rutina_id = ? AND estado = ?',
    )
      .bind(rid, 'programado')
      .first<{ conductor_preferido_id: string | null }>();
    expect(p?.conductor_preferido_id).toBeNull();
    expect(
      avisos.some((a) => a.to === 'ExponentPushToken[cliente]' && /no puede ir/.test(a.title)),
    ).toBe(true);
    // Otro conductor no puede marcar «no puedo» en un viaje fijo ajeno.
    const ajeno = await conductorDeMoto(e.m, ORIGEN);
    const x = await e.m.llamar(
      'POST',
      `/datos/conductor/rutinas/${rid}/no-puedo`,
      { fecha: hoy.fecha, sentido: 'ida' },
      ajeno.token,
    );
    expect(x.estado).toBe(404);
  });

  it('el aviso previo al conductor sale una vez, 30 minutos antes', async () => {
    const e = await escenario();
    const avisos = capturarAvisos();
    const fiel = await conductorDeMoto(e.m, ORIGEN);
    await e.m.DB.prepare(
      "INSERT INTO dispositivos (token, usuario_id, plataforma) VALUES ('ExponentPushToken[conductor]', ?, 'android')",
    )
      .bind(fiel.id)
      .run();
    const v = await viajeCompleto(e, fiel);
    await e.m.llamar('PUT', `/datos/viajes/${v}/confianza`, {}, e.cliente.token);
    const r = await e.m.llamar(
      'POST',
      '/datos/rutinas',
      rutinaBase({ conductorId: fiel.id }),
      e.cliente.token,
    );
    const rid = r.datos.rutina.id as string;
    await correrViajesFijos(env(e.m), e.m.DB);
    expect(avisos.filter((a) => /Viaje fijo a las|Regular ride at/.test(a.title))).toHaveLength(0);
    await e.m.DB.prepare(
      "UPDATE rutina_salidas SET hora = datetime('now', '+20 minutes') WHERE rutina_id = ?",
    )
      .bind(rid)
      .run();
    await correrViajesFijos(env(e.m), e.m.DB);
    await correrViajesFijos(env(e.m), e.m.DB);
    expect(
      avisos.filter(
        (a) =>
          a.to === 'ExponentPushToken[conductor]' &&
          /Viaje fijo a las|Regular ride at/.test(a.title),
      ),
    ).toHaveLength(1);
  });

  it('valida: el conductor tiene que ser de confianza, envío con paquete, y el tope de 10', async () => {
    const e = await escenario();
    const extrano = await conductorDeMoto(e.m, ORIGEN);
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/rutinas',
          rutinaBase({ conductorId: extrano.id }),
          e.cliente.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/rutinas',
          rutinaBase({ servicio: 'envios' }),
          e.cliente.token,
        )
      ).estado,
    ).toBe(400);
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/rutinas',
          rutinaBase({ horaIda: '08:00', horaVuelta: '07:00' }),
          e.cliente.token,
        )
      ).estado,
    ).toBe(400);
    for (let i = 0; i < 10; i++)
      expect(
        (await e.m.llamar('POST', '/datos/rutinas', rutinaBase(), e.cliente.token)).estado,
      ).toBe(201);
    expect((await e.m.llamar('POST', '/datos/rutinas', rutinaBase(), e.cliente.token)).estado).toBe(
      409,
    );
  });

  it('el monitoreo del equipo los ve; el reloj la tiene y sin nada que vencer no escribe', async () => {
    const e = await escenario();
    const r = await e.m.llamar(
      'POST',
      '/datos/rutinas',
      rutinaBase({ menor: { nombre: 'Sofía', pin: '1234' } }),
      e.cliente.token,
    );
    await correrViajesFijos(env(e.m), e.m.DB);
    const mon = await e.m.llamar(
      'GET',
      '/datos/admin/viajes-fijos?menores=1',
      undefined,
      e.admin.token,
    );
    expect(mon.estado).toBe(200);
    expect(mon.datos.rutinas[0]).toMatchObject({ id: r.datos.rutina.id, cliente: 'Marta Madre' });
    // El equipo no ve el PIN del menor.
    expect(mon.datos.rutinas[0].menor).toEqual({ nombre: 'Sofía', pin: null });
    expect(mon.datos.resumen.salidas7d.creada).toBe(1);
    const tarea = TAREAS_RELOJ.find((t) => t.nombre === 'viajes_fijos');
    expect(tarea?.critica).toBe(true);
    const total = async () =>
      Number((await e.m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0);
    const antes = await total();
    await tarea!.correr(env(e.m), e.m.DB);
    expect(await total()).toBe(antes);
  });

  it('borrar la cuenta borra sus viajes fijos (direcciones, menor y PIN) y sus conductores de confianza', async () => {
    const e = await escenario();
    const r = await e.m.llamar(
      'POST',
      '/datos/rutinas',
      rutinaBase({ menor: { nombre: 'Sofía', pin: '1234' } }),
      e.cliente.token,
    );
    await e.m.DB.prepare(
      'INSERT INTO conductores_confianza (cliente_id, conductor_id) VALUES (?, ?)',
    )
      .bind(e.cliente.id, e.admin.id)
      .run();
    const b = await e.m.llamar('DELETE', '/datos/cuentas/yo', undefined, e.cliente.token);
    expect(b.estado).toBeLessThan(300);
    const f = await e.m.DB.prepare(
      'SELECT estado, origen_direccion, menor_nombre, pin_menor FROM rutinas_viaje WHERE id = ?',
    )
      .bind(r.datos.rutina.id)
      .first();
    expect(f).toMatchObject({
      estado: 'borrada',
      origen_direccion: '',
      menor_nombre: null,
      pin_menor: null,
    });
    const k = await e.m.DB.prepare(
      'SELECT COUNT(*) AS n FROM conductores_confianza WHERE cliente_id = ?',
    )
      .bind(e.cliente.id)
      .first<{ n: number }>();
    expect(k?.n).toBe(0);
  });
});
