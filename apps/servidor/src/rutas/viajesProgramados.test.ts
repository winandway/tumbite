import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { mundo } from '../pruebas/ayuda';
type Mundo = ReturnType<typeof mundo>;
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { repartirOperaciones } from '../operaciones';
import { TAREAS_RELOJ } from './operacion';
import { activarViajesProgramados } from './viajesProgramados';
import { autorizacionViaje } from '../viajesCobro';

/**
 * C-VIAJE-PROGRAMADO (14 nov 2026, todos los países): reservar Carro (y Moto, XL, Envíos) para más
 * tarde con el precio fijo, cancelar gratis hasta 60 minutos antes, el reloj lo manda a buscar
 * conductor N minutos antes y, si a la hora no hay conductor, se cancela sin cargo.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 300, porKm: 120, porMinuto: 25, minimo: 800, cargoCancelacion: 500 };

async function escenario(extra: Record<string, string> = {}) {
  const m = mundo(extra, { host: 'staging.tumbite.com' });
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

  it('un corte al hacer nacer el viaje no deja la reserva «activada» sin viaje, y no frena a las demás', async () => {
    const e = await escenario();
    const a = (await reservar(e, 120)).r.datos.viaje.id as string;
    const b = (await reservar(e, 121)).r.datos.viaje.id as string;
    await correrHora(e, a, "datetime('now', '+9 minutes')");
    await correrHora(e, b, "datetime('now', '+10 minutes')");
    // El corte: el viaje de la primera reserva no se puede escribir.
    await e.m.DB.prepare(
      `CREATE TRIGGER corte_prueba BEFORE INSERT ON viajes WHEN NEW.operacion_id = '${a}'
         BEGIN SELECT RAISE(ABORT, 'corte'); END`,
    ).run();
    const vuelta = await activarViajesProgramados(env(e.m), e.m.DB);
    expect(vuelta).toEqual({ activados: 1, errores: 1 });
    const estado = async (id: string) =>
      (
        await e.m.DB.prepare('SELECT estado FROM viajes_programados WHERE id = ?')
          .bind(id)
          .first<{ estado: string }>()
      )?.estado;
    expect(await estado(a)).toBe('programado');
    expect(await estado(b)).toBe('activado');
    expect(
      await e.m.DB.prepare('SELECT 1 FROM operaciones WHERE id = ?').bind(a).first(),
    ).toBeNull();
    // Pasado el corte, la vuelta siguiente la retoma.
    await e.m.DB.prepare('DROP TRIGGER corte_prueba').run();
    expect((await activarViajesProgramados(env(e.m), e.m.DB)).activados).toBe(1);
    expect(await estado(a)).toBe('activado');
  });

  it('la cancelación tardía, su viaje y su deuda van juntos: un corte no deja la cancelación sin cargo', async () => {
    const e = await escenario();
    const id = (await reservar(e, 180)).r.datos.viaje.id as string;
    await correrHora(e, id, "datetime('now', '+40 minutes')");
    await e.m.DB.prepare(
      `CREATE TRIGGER corte_deuda BEFORE INSERT ON deudas_pasajero BEGIN SELECT RAISE(ABORT, 'corte'); END`,
    ).run();
    const r = await e.m.llamar(
      'POST',
      `/datos/viajes/programados/${id}/cancelar`,
      {},
      e.cliente.token,
    );
    expect(r.estado).toBeGreaterThanOrEqual(500);
    const f = await e.m.DB.prepare('SELECT estado FROM viajes_programados WHERE id = ?')
      .bind(id)
      .first<{ estado: string }>();
    expect(f?.estado).toBe('programado');
    await e.m.DB.prepare('DROP TRIGGER corte_deuda').run();
    const otra = await e.m.llamar(
      'POST',
      `/datos/viajes/programados/${id}/cancelar`,
      {},
      e.cliente.token,
    );
    expect(otra.datos).toEqual({ ok: true, cargo: 500 });
  });

  describe('con tarjeta', () => {
    afterEach(() => vi.unstubAllGlobals());
    const stripe = (rechaza = false) => {
      const llamadas: string[] = [];
      vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
        llamadas.push(
          `${init?.method ?? 'GET'} ${String(url)} ${decodeURIComponent(String(init?.body ?? ''))}`,
        );
        if (String(url).includes('/payment_methods'))
          return new Response(JSON.stringify({ data: [{ id: 'pm_guardada' }] }), { status: 200 });
        if (/\/payment_intents$/.test(String(url)))
          return rechaza
            ? new Response(JSON.stringify({ error: { message: 'card_declined' } }), { status: 402 })
            : new Response(JSON.stringify({ id: 'pi_prog', status: 'requires_capture' }), {
                status: 200,
              });
        return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
      });
      return llamadas;
    };
    const reservarConTarjeta = async (e: E) => {
      const cot = (
        await e.m.llamar(
          'POST',
          '/datos/viajes/cotizar',
          { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
          e.cliente.token,
        )
      ).datos.cotizacion as { id: string };
      return e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'tarjeta', programadoPara: enMinutos(120) },
        e.cliente.token,
      );
    };

    it('sin tarjeta guardada no se reserva; con ella, a la hora se autoriza sin la persona delante', async () => {
      const llamadas = stripe();
      const e = await escenario({ STRIPE_SECRET_KEY: 'sk_test_x' });
      expect((await reservarConTarjeta(e)).estado).toBe(409);
      await e.m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_prueba' WHERE id = ?")
        .bind(e.cliente.id)
        .run();
      const r = await reservarConTarjeta(e);
      expect(r.estado).toBe(201);
      const id = r.datos.viaje.id as string;
      await correrHora(e, id, "datetime('now', '+10 minutes')");
      expect((await activarViajesProgramados(env(e.m), e.m.DB)).activados).toBe(1);
      const autorizacion = llamadas.find((x) => /POST \S+\/payment_intents /.test(x)) ?? '';
      expect(autorizacion).toContain('off_session=true');
      expect(autorizacion).toContain('payment_method=pm_guardada');
      expect(autorizacion).toContain('capture_method=manual');
      const v = await e.m.DB.prepare(
        'SELECT v.estado, c.stripe_pago FROM viajes v JOIN cobros_viaje c ON c.operacion_id = v.operacion_id WHERE v.operacion_id = ?',
      )
        .bind(id)
        .first<{ estado: string; stripe_pago: string }>();
      expect(v).toEqual({ estado: 'pago_pendiente', stripe_pago: 'pi_prog' });
    });

    it('si Stripe rechaza la tarjeta a la hora, se cancela sin cargo', async () => {
      stripe(true);
      const e = await escenario({ STRIPE_SECRET_KEY: 'sk_test_x' });
      await e.m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_prueba' WHERE id = ?")
        .bind(e.cliente.id)
        .run();
      const id = (await reservarConTarjeta(e)).datos.viaje.id as string;
      await correrHora(e, id, "datetime('now', '+10 minutes')");
      await activarViajesProgramados(env(e.m), e.m.DB);
      const v = await e.m.DB.prepare('SELECT estado FROM viajes WHERE operacion_id = ?')
        .bind(id)
        .first<{ estado: string }>();
      expect(v?.estado).toBe('cancelado');
    });
    it('si el aviso de Stripe llega antes de anotar el intento, igual vale', async () => {
      stripe();
      const e = await escenario({ STRIPE_SECRET_KEY: 'sk_test_x' });
      await e.m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_prueba' WHERE id = ?")
        .bind(e.cliente.id)
        .run();
      const id = (await reservarConTarjeta(e)).datos.viaje.id as string;
      await correrHora(e, id, "datetime('now', '+10 minutes')");
      await activarViajesProgramados(env(e.m), e.m.DB);
      // Como si el aviso hubiera llegado antes de la fila: se borra y llega el aviso.
      await e.m.DB.prepare('DELETE FROM cobros_viaje WHERE operacion_id = ?').bind(id).run();
      const total = (
        await e.m.DB.prepare(
          'SELECT q.total FROM viajes v JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE v.operacion_id = ?',
        )
          .bind(id)
          .first<{ total: number }>()
      )?.total;
      const op = await autorizacionViaje(e.m.DB, {
        id: 'pi_prog',
        amount_capturable: total,
        metadata: { viaje_id: id },
      });
      expect(op).toBe(id);
      const c = await e.m.DB.prepare(
        'SELECT estado, stripe_pago FROM cobros_viaje WHERE operacion_id = ?',
      )
        .bind(id)
        .first();
      expect(c).toEqual({ estado: 'autorizado', stripe_pago: 'pi_prog' });
    });

    it('si la llamada a Stripe se corta pero sí autorizó, se suelta la retención y se cancela sin cargo', async () => {
      const llamadas: string[] = [];
      let primera = true;
      vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
        llamadas.push(`${init?.method ?? 'GET'} ${String(url)}`);
        if (String(url).includes('/payment_methods'))
          return new Response(JSON.stringify({ data: [{ id: 'pm_guardada' }] }), { status: 200 });
        if (/\/payment_intents$/.test(String(url))) {
          if (primera) {
            primera = false;
            throw new Error('The operation was aborted due to timeout');
          }
          return new Response(JSON.stringify({ id: 'pi_prog', status: 'requires_capture' }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
      });
      const e = await escenario({ STRIPE_SECRET_KEY: 'sk_test_x' });
      await e.m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_prueba' WHERE id = ?")
        .bind(e.cliente.id)
        .run();
      const id = (await reservarConTarjeta(e)).datos.viaje.id as string;
      await correrHora(e, id, "datetime('now', '+10 minutes')");
      await activarViajesProgramados(env(e.m), e.m.DB);
      expect(llamadas.some((x) => x.includes('/payment_intents/pi_prog/cancel'))).toBe(true);
      const v = await e.m.DB.prepare('SELECT estado FROM viajes WHERE operacion_id = ?')
        .bind(id)
        .first<{ estado: string }>();
      expect(v?.estado).toBe('cancelado');
    });
  });
});
