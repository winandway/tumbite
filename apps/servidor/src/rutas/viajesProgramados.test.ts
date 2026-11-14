import { describe, expect, it } from 'vitest';
import type { Env } from '../env';
import { mundo } from '../pruebas/ayuda';
type Mundo = ReturnType<typeof mundo>;
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { repartirOperaciones } from '../operaciones';
import { TAREAS_RELOJ } from './operacion';
import { activarViajesProgramados } from './viajesProgramados';

/**
 * C-VIAJE-PROGRAMADO (14 nov 2026, todos los países): reservar Carro (y Moto, XL, Envíos) para más
 * tarde con el precio fijo, cancelar gratis hasta 60 minutos antes, el reloj lo manda a buscar
 * conductor N minutos antes y, si a la hora no hay conductor, se cancela sin cargo.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 300, porKm: 120, porMinuto: 25, minimo: 800, cargoCancelacion: 500 };

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
  const t = await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'carro', zona: 'US-FL-MIAMI', tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    admin.token,
  );
  expect(t.estado).toBeLessThan(300);
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenario>>;

const enMinutos = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

async function reservar(e: E, minutos: number) {
  const cot = (
    await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
      e.cliente.token,
    )
  ).datos.cotizacion as { id: string; total: number };
  const r = await e.m.llamar(
    'POST',
    '/datos/viajes',
    { cotizacionId: cot.id, metodoPago: 'efectivo', programadoPara: enMinutos(minutos) },
    e.cliente.token,
  );
  return { cot, r };
}

const correrHora = (e: E, id: string, sql: string) =>
  e.m.DB.prepare(`UPDATE viajes_programados SET programado_para = ${sql} WHERE id = ?`)
    .bind(id)
    .run();
const env = (m: Mundo) => m.extra as unknown as Env;

describe('C-VIAJE-PROGRAMADO', () => {
  it('reserva con el precio fijo, sin crear el viaje todavía, y la lista la muestra', async () => {
    const e = await escenario();
    const { cot, r } = await reservar(e, 120);
    expect(r.estado).toBe(201);
    expect(r.datos.programado).toBe(true);
    const id = r.datos.viaje.id as string;
    const lista = await e.m.llamar('GET', '/datos/viajes/programados', undefined, e.cliente.token);
    expect(lista.datos.programados).toHaveLength(1);
    expect(lista.datos.programados[0]).toMatchObject({ id, total: cot.total, servicio: 'carro' });
    const op = await e.m.DB.prepare('SELECT 1 FROM operaciones WHERE id = ?').bind(id).first();
    expect(op).toBeNull();
    // Repetir la reserva con la misma cotización devuelve la misma (doble toque).
    const otra = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo', programadoPara: enMinutos(120) },
      e.cliente.token,
    );
    expect(otra.datos.viaje.id).toBe(id);
  });

  it('desde 30 minutos hasta 7 días', async () => {
    const e = await escenario();
    expect((await reservar(e, 10)).r.estado).toBe(422);
    expect((await reservar(e, 8 * 24 * 60)).r.estado).toBe(422);
  });

  it('cancelar es gratis hasta 60 minutos antes; después queda el cargo de la ciudad como deuda', async () => {
    const e = await escenario();
    const a = (await reservar(e, 180)).r.datos.viaje.id as string;
    const libre = await e.m.llamar(
      'POST',
      `/datos/viajes/programados/${a}/cancelar`,
      {},
      e.cliente.token,
    );
    expect(libre.datos).toEqual({ ok: true, cargo: 0 });
    const b = (await reservar(e, 180)).r.datos.viaje.id as string;
    await correrHora(e, b, "datetime('now', '+40 minutes')");
    const tarde = await e.m.llamar(
      'POST',
      `/datos/viajes/programados/${b}/cancelar`,
      {},
      e.cliente.token,
    );
    expect(tarde.datos).toEqual({ ok: true, cargo: 500 });
    const deuda = await e.m.DB.prepare(
      'SELECT monto FROM deudas_pasajero WHERE operacion_id = ? AND motivo = ?',
    )
      .bind(b, 'cancelacion')
      .first<{ monto: number }>();
    expect(deuda?.monto).toBe(500);
    const lista = await e.m.llamar('GET', '/datos/viajes/programados', undefined, e.cliente.token);
    expect(lista.datos.programados).toHaveLength(0);
  });

  it('el reloj lo manda a buscar 15 minutos antes, una sola vez; la oferta dice para cuándo', async () => {
    const e = await escenario();
    const cond = await conductorDeMoto(e.m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const id = (await reservar(e, 120)).r.datos.viaje.id as string;
    // Todavía falta: no se activa.
    expect((await activarViajesProgramados(env(e.m), e.m.DB)).activados).toBe(0);
    await correrHora(e, id, "datetime('now', '+10 minutes')");
    expect((await activarViajesProgramados(env(e.m), e.m.DB)).activados).toBe(1);
    expect((await activarViajesProgramados(env(e.m), e.m.DB)).activados).toBe(0);
    const v = await e.m.DB.prepare(
      'SELECT estado, programado_para FROM viajes WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ estado: string; programado_para: string }>();
    expect(v?.estado).toBe('buscando');
    expect(v?.programado_para).toBeTruthy();
    const ofertas = await e.m.llamar(
      'GET',
      '/datos/conductor/operaciones/ofertas',
      undefined,
      cond.token,
    );
    expect(ofertas.datos.ofertas[0]?.operacionId).toBe(id);
    expect(ofertas.datos.ofertas[0]?.programadoPara).toMatch(/Z$/);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
  });

  it('si a la hora no hay conductor, se cancela sin cargo (no antes de la hora)', async () => {
    const e = await escenario();
    const id = (await reservar(e, 120)).r.datos.viaje.id as string;
    await correrHora(e, id, "datetime('now', '+10 minutes')");
    await activarViajesProgramados(env(e.m), e.m.DB);
    await e.m.DB.prepare(
      "UPDATE eventos_operacion SET creado_en = datetime('now', '-11 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    await e.m.DB.prepare(
      "UPDATE operaciones SET creado_en = datetime('now', '-11 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    await repartirOperaciones(env(e.m), e.m.DB);
    const antes = await e.m.DB.prepare('SELECT estado FROM viajes WHERE operacion_id = ?')
      .bind(id)
      .first<{ estado: string }>();
    expect(antes?.estado).toBe('buscando');
    await e.m.DB.prepare(
      "UPDATE viajes SET programado_para = datetime('now', '-1 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    await repartirOperaciones(env(e.m), e.m.DB);
    const despues = await e.m.DB.prepare('SELECT estado FROM viajes WHERE operacion_id = ?')
      .bind(id)
      .first<{ estado: string }>();
    expect(despues?.estado).toBe('sin_conductor');
    const deudas = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM deudas_pasajero').first<{
      n: number;
    }>();
    expect(deudas?.n).toBe(0);
  });

  it('la tarea vive en el reloj y una vuelta sin reservas que venzan no escribe nada', async () => {
    const e = await escenario();
    await reservar(e, 300);
    const tarea = TAREAS_RELOJ.find((t) => t.nombre === 'viajes_programados');
    expect(tarea?.critica).toBe(true);
    expect(tarea?.escriturasEsperadas).toBeGreaterThan(0);
    const total = async () =>
      Number((await e.m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0);
    const antes = await total();
    await tarea!.correr(env(e.m), e.m.DB);
    expect(await total()).toBe(antes);
  });

  it('el equipo cambia por ciudad cuántos minutos antes se busca', async () => {
    const e = await escenario();
    const r = await e.m.llamar(
      'PUT',
      '/datos/admin/viajes/ajustes',
      {
        zona: 'US-FL-MIAMI',
        servicio: 'carro',
        pin: 'siempre',
        selfieCasco: false,
        programadoAntesMin: 30,
      },
      e.admin.token,
    );
    expect(r.estado).toBe(200);
    const id = (await reservar(e, 120)).r.datos.viaje.id as string;
    await correrHora(e, id, "datetime('now', '+25 minutes')");
    expect((await activarViajesProgramados(env(e.m), e.m.DB)).activados).toBe(1);
  });
});
