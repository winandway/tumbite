import { describe, expect, it } from 'vitest';
import {
  CIUDAD_EL_VIGIA as EVG,
  type DesgloseViaje,
  equivalenteLocal,
  horaLocal,
} from '@tumbite/compartido';
import { CUENTA_TUMBITE, saludLibro } from './internacional/libro';
import { cargarPagoMovilVe, conductorListoEn, escenarioVe } from './pruebas/motoVe';
import { saldoDeCliente, saludSaldoClientes } from './saldoCliente';
import { sembrarTabuladorVigia } from './semillaTabuladorVigia';
import { TABULADOR_EL_VIGIA } from './tabuladorElVigia';

/**
 * C-VIGIA-SALDO-CIRCUITO (25 nov 2026) — Venezuela, El Vigía, Moto. La unión de tres paquetes que
 * nadie había probado juntos: el tabulador de la calle con su tarifa nocturna (+30 %, quién paga =
 * conductor en Moto de El Vigía), el Saldo Divoox del pasajero y la pantalla «Método de pago». Por la
 * API, como las apps. Destino de la hoja: KM 9 (3,00 $ de día, 3,90 $ de noche).
 *
 * Lo que se comprueba en cada caso: lo que sale del saldo del pasajero, lo que cobra en mano el
 * conductor (en $ y en Bs, igual en cliente, conductor y panel), lo que Divoox le acredita, la
 * comisión (10 % del precio, del prepago del conductor, una sola vez) y que los libros cuadran.
 */
const CENTRO = { lat: EVG.lat, lng: EVG.lng, direccion: 'Plaza Bolívar de El Vigía' };
const TASA = 236.4567;
const APARATO = 'aparato-vigia-saldo-1';
const km9 = (() => {
  const d = TABULADOR_EL_VIGIA.find((x) => x.nombre === 'KM 9');
  if (!d) throw new Error('KM 9');
  return { lat: d.lat, lng: d.lng, direccion: 'KM 9' };
})();

async function elVigia() {
  const e = await escenarioVe();
  const r = await e.m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'moto',
      zona: {
        id: EVG.id,
        nombre: EVG.nombre,
        lat: EVG.lat,
        lng: EVG.lng,
        radioKm: EVG.radioKm,
        zonaHoraria: EVG.zonaHoraria,
      },
      motivo: 'El Vigía para Moto',
    },
    e.admin.token,
  );
  expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  expect(await sembrarTabuladorVigia(e.m.DB)).not.toBeNull();
  expect(
    (await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: TASA }, e.admin.token))
      .estado,
  ).toBe(200);
  /** La noche alrededor de la hora REAL de Venezuela (la prueba no depende de cuándo corre). */
  const fijarNoche = async (deNoche: boolean) => {
    const h = horaLocal(new Date(), EVG.zonaHoraria);
    const desde = deNoche ? h : (h + 2) % 24;
    await e.m.DB.prepare(
      "UPDATE tarifas_viaje SET noche_desde_h = ?, noche_hasta_h = ? WHERE zona_id = ? AND servicio_id = 'moto' AND activa = 1",
    )
      .bind(desde, (desde + 2) % 24, EVG.id)
      .run();
  };
  let n = 0;
  const pasajero = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, e.cliente.token, {
      'idempotency-key': `vigia-saldo-${++n}-abcdef`,
      'x-aparato': APARATO,
    });
  const cargar = async (monto: number) => {
    const c = await e.m.llamar(
      'POST',
      `/datos/admin/saldo-clientes/${e.cliente.id}/cargas`,
      {
        monto,
        motivo: 'carrera_regalo',
        idempotencia: `carga-${Math.random().toString(36).slice(2, 12)}`,
      },
      e.admin.token,
    );
    expect(c.estado, JSON.stringify(c.datos)).toBe(201);
  };
  const cotizar = async (destino = km9) => {
    const c = await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: CENTRO,
      destino,
      tarifaServicio: true,
    });
    expect(c.estado, JSON.stringify(c.datos)).toBe(201);
    return c.datos.cotizacion as {
      id: string;
      total: number;
      tarifaServicio: number;
      quienPaga: string;
      recargoNoche: { pb: number; monto: number } | null;
      saldoDivoox: { disponible: number } | null;
      enMano: { monto: number; local?: { monto: number } } | null;
      desglose: DesgloseViaje;
    };
  };
  const conductor = () =>
    conductorListoEn(e, { zonaId: EVG.id, origen: CENTRO, saldo: 1000, nombre: 'Conductor Vigía' });
  return { e, fijarNoche, pasajero, cargar, cotizar, conductor };
}
type V = Awaited<ReturnType<typeof elVigia>>;
type Cond = Awaited<ReturnType<V['conductor']>>;

/** Hasta «iniciar». */
async function hastaIniciar(v: V, c: Cond, id: string) {
  expect((await c.paso(id, 'aceptar')).estado).toBe(200);
  expect((await c.paso(id, 'llegue')).estado).toBe(200);
  const pin = (await v.pasajero('GET', `/datos/viajes/${id}`)).datos.viaje.pin;
  expect((await c.paso(id, 'iniciar', { pin })).estado).toBe(200);
}

/** Un viaje de verdad: empezó hace 25 minutos, recorrió lo cotizado y el conductor está en el destino. */
async function recorrer(v: V, c: Cond, id: string, destino = km9) {
  await v.e.m.DB.batch([
    v.e.m.DB.prepare(
      `UPDATE viajes SET iniciado_en = datetime('now', '-25 minutes'),
              distancia_m_real = (SELECT distancia_m FROM cotizaciones_viaje WHERE operacion_id = ?1)
        WHERE operacion_id = ?1`,
    ).bind(id),
    v.e.m.DB.prepare(
      "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    ).bind(destino.lat, destino.lng, c.rep.id),
  ]);
}

const prepago = async (c: Cond) =>
  (await c.yo('GET', '/datos/repartidor/saldo-prepago')).datos as {
    disponible: number;
    reservado: number;
  };

/** Lo que Divoox le acredita al conductor por el Saldo Divoox del pasajero, y su asiento. */
async function acreditado(v: V, id: string) {
  const mov = await v.e.m.DB.prepare(
    "SELECT usuario_id, monto FROM movimientos WHERE referencia = 'saldo-divoox:' || ?",
  )
    .bind(id)
    .first<{ usuario_id: string; monto: number }>();
  const libro = await v.e.m.DB.prepare(
    "SELECT cuenta_id, monto FROM libro WHERE referencia = 'saldo-divoox:' || ? || ':divoox'",
  )
    .bind(id)
    .first<{ cuenta_id: string; monto: number }>();
  const salio = await v.e.m.DB.prepare(
    'SELECT COALESCE(-SUM(monto), 0) AS s FROM saldo_cliente_movimientos WHERE operacion_id = ?',
  )
    .bind(id)
    .first<{ s: number }>();
  return { mov, libro, salio: Number(salio?.s ?? 0) };
}

/**
 * La comisión de Divoox del viaje: una sola vez, en el bolsillo de comisiones. (Lo que Divoox le paga
 * al conductor por el Saldo Divoox sale de ese mismo bolsillo con su propio concepto, como el regalo;
 * se cuenta aparte en `acreditado`.)
 */
async function comisionDelViaje(v: V, id: string) {
  const { results } = await v.e.m.DB.prepare(
    `SELECT monto FROM libro WHERE bolsillo = 'comisiones' AND concepto <> 'saldo_divoox_pagado'
        AND (pedido_id = ?1 OR instr(referencia, ?1) > 0)`,
  )
    .bind(id)
    .all<{ monto: number }>();
  return { n: results.length, suma: results.reduce((a, f) => a + f.monto, 0) };
}

/** El monto en mano, igual en el pasajero, el conductor y el panel, en $ y en Bs. */
async function mismoEnMano(v: V, c: Cond, id: string, resto: number) {
  const bs = equivalenteLocal(resto, TASA);
  const vista = (await v.pasajero('GET', `/datos/viajes/${id}`)).datos.viaje;
  expect(vista.enMano).toMatchObject({ monto: resto, local: { monto: bs } });
  const panel = await v.e.m.llamar('GET', '/datos/admin/viajes', undefined, v.e.admin.token);
  const fila = (panel.datos.viajes as { id: string; enMano?: number }[]).find((x) => x.id === id);
  expect(fila?.enMano).toBe(resto);
  return { bs, vista, conductor: c };
}

async function cuadra(v: V) {
  expect(await saludLibro(v.e.m.DB)).toBe('ok');
  expect(await saludSaldoClientes(v.e.m.DB)).toBe('ok');
}

describe('C-VIGIA-SALDO-CIRCUITO: tabulador de El Vigía + Saldo Divoox + Método de pago', () => {
  it('(a) de noche, todo con saldo: −3,90 del saldo, 0 en mano, Divoox le acredita 3,90 y la comisión 0,39 sale una vez del prepago', async () => {
    const v = await elVigia();
    await v.fijarNoche(true);
    await v.cargar(1000);
    const c = await v.conductor();
    const q = await v.cotizar();
    expect(q.total).toBe(390);
    expect(q.recargoNoche).toEqual({ pb: 3000, monto: 90 });
    expect(q.quienPaga).toBe('conductor');
    expect(q.tarifaServicio).toBe(0);
    // «Monto a pagar» de la pantalla de pago: el mismo total, ya con la noche, en $ y en Bs.
    expect(q.enMano).toMatchObject({ monto: 390, local: { monto: equivalenteLocal(390, TASA) } });
    expect(q.saldoDivoox?.disponible).toBe(1000);

    const p = await v.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'saldo',
      usarSaldo: true,
    });
    expect(p.estado, JSON.stringify(p.datos)).toBe(201);
    const id = p.datos.viaje.id as string;
    expect(await saldoDeCliente(v.e.m.DB, v.e.cliente.id)).toBe(1000 - 390);

    const oferta = (
      (await c.yo('GET', '/datos/conductor/operaciones/ofertas')).datos.ofertas as {
        operacionId: string;
        saldoDivoox: number;
        comisionDivoox: number;
        enMano: { monto: number } | null;
      }[]
    ).find((o) => o.operacionId === id);
    expect(oferta).toMatchObject({ saldoDivoox: 390, comisionDivoox: 39 });
    expect(oferta?.enMano?.monto ?? 0).toBe(0);

    await hastaIniciar(v, c, id);
    expect((await prepago(c)).reservado).toBe(39);
    const actual = (await c.yo('GET', '/datos/conductor/operaciones/actual')).datos.operacion;
    expect(actual.cobrar_en_mano).toBe(0);
    await recorrer(v, c, id);
    const fin = await c.paso(id, 'terminar');
    expect(fin.datos).toMatchObject({ cobrarEnMano: 0, saldoDivoox: 390, regaloEnRevision: false });
    // Repetir «terminar» no acredita ni cobra dos veces.
    expect((await c.paso(id, 'terminar')).estado).toBe(200);

    const a = await acreditado(v, id);
    expect(a.salio).toBe(390);
    expect(a.mov).toEqual({ usuario_id: c.rep.id, monto: 390 });
    expect(a.libro).toEqual({ cuenta_id: CUENTA_TUMBITE, monto: -390 });
    expect(await comisionDelViaje(v, id)).toEqual({ n: 1, suma: 39 });
    expect(await prepago(c)).toMatchObject({ disponible: 1000 - 39, reservado: 0 });
    await cuadra(v);
  });

  it('(b) de día, saldo 1,00 + efectivo 2,00: el mismo monto en mano en cliente, conductor y panel, en $ y Bs', async () => {
    const v = await elVigia();
    await v.fijarNoche(false);
    await v.cargar(100);
    const c = await v.conductor();
    const q = await v.cotizar();
    expect(q.total).toBe(300);
    expect(q.recargoNoche).toBeNull();
    const p = await v.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
    });
    expect(p.estado, JSON.stringify(p.datos)).toBe(201);
    const id = p.datos.viaje.id as string;
    expect(await saldoDeCliente(v.e.m.DB, v.e.cliente.id)).toBe(0);
    const bs = equivalenteLocal(200, TASA);
    const oferta = (
      (await c.yo('GET', '/datos/conductor/operaciones/ofertas')).datos.ofertas as {
        operacionId: string;
      }[]
    ).find((o) => o.operacionId === id);
    expect(oferta).toMatchObject({
      saldoDivoox: 100,
      enMano: { monto: 200, local: { monto: bs } },
    });
    await hastaIniciar(v, c, id);
    const actual = (await c.yo('GET', '/datos/conductor/operaciones/actual')).datos.operacion;
    expect(actual.cobrar_en_mano).toBe(200);
    expect(actual.en_mano).toMatchObject({ monto: 200, local: { monto: bs } });
    await mismoEnMano(v, c, id, 200);
    await recorrer(v, c, id);
    const fin = await c.paso(id, 'terminar');
    expect(fin.datos).toMatchObject({ cobrarEnMano: 200, saldoDivoox: 100 });
    expect(fin.datos.enMano).toMatchObject({ monto: 200, local: { monto: bs } });
    await mismoEnMano(v, c, id, 200);
    expect((await acreditado(v, id)).mov?.monto).toBe(100);
    expect(await comisionDelViaje(v, id)).toEqual({ n: 1, suma: 30 });
    expect(await prepago(c)).toMatchObject({ disponible: 970, reservado: 0 });
    await cuadra(v);
  });

  it('(c) saldo parcial + Pago Móvil con un conductor que lo recibe: el pago esperado es solo el resto', async () => {
    const v = await elVigia();
    await v.fijarNoche(true);
    await v.cargar(150);
    const c = await v.conductor();
    // Sin conductor con Pago Móvil, la opción sale apagada; con uno conectado, encendida.
    expect(
      ((await v.cotizar()) as unknown as { disponibles: Record<string, boolean> }).disponibles
        .pago_movil,
    ).toBe(false);
    await cargarPagoMovilVe(c);
    const q = await v.cotizar();
    expect((q as unknown as { disponibles: Record<string, boolean> }).disponibles.pago_movil).toBe(
      true,
    );
    expect(q.total).toBe(390);
    const p = await v.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'pago_movil',
      usarSaldo: true,
    });
    expect(p.estado, JSON.stringify(p.datos)).toBe(201);
    const id = p.datos.viaje.id as string;
    await hastaIniciar(v, c, id);
    expect((await c.paso(id, 'pago-movil', { recibido: true, referencia: '000222' })).estado).toBe(
      200,
    );
    const esperado = await v.e.m.DB.prepare(
      'SELECT monto FROM viajes_pago_movil WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ monto: number }>();
    expect(esperado?.monto).toBe(240);
    await mismoEnMano(v, c, id, 240);
    await recorrer(v, c, id);
    const fin = await c.paso(id, 'terminar');
    expect(fin.datos).toMatchObject({ cobrarEnMano: 240, saldoDivoox: 150 });
    expect((await acreditado(v, id)).mov?.monto).toBe(150);
    expect(await comisionDelViaje(v, id)).toEqual({ n: 1, suma: 39 });
    await cuadra(v);
  });

  it('(d) de noche, con saldo parcial, paradas cambiadas y espera: el saldo apartado no crece, la diferencia va en mano y el 30 % se conserva', async () => {
    const v = await elVigia();
    await v.fijarNoche(true);
    await v.cargar(100);
    const c = await v.conductor();
    // Fuera de la hoja (con precio de la zona no se cambian paradas).
    const fuera = { lat: 8.58, lng: -71.6, direccion: 'Destino fuera de la lista' };
    const q = await v.cotizar(fuera);
    expect(q.recargoNoche?.pb).toBe(3000);
    const p = await v.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
    });
    expect(p.estado, JSON.stringify(p.datos)).toBe(201);
    const id = p.datos.viaje.id as string;
    expect(await saldoDeCliente(v.e.m.DB, v.e.cliente.id)).toBe(0);
    // Ya de día cuando cambia las paradas: el viaje nació de noche y conserva el recargo.
    await v.fijarNoche(false);
    const cambio = await v.pasajero('POST', `/datos/viajes/${id}/paradas`, {
      paradas: [{ lat: 8.6, lng: -71.62, direccion: 'Una parada' }],
      confirmar: true,
    });
    expect(cambio.estado, JSON.stringify(cambio.datos)).toBe(200);
    const dg = cambio.datos.cambio.desglose as DesgloseViaje;
    expect(dg.recargoNochePb).toBe(3000);
    const conParadas = cambio.datos.cambio.totalNuevo as number;
    expect(conParadas).toBe(dg.total);
    await hastaIniciar(v, c, id);
    // En la parada (el conductor tiene que estar ahí para decir «Llegué»).
    await v.e.m.DB.prepare(
      "UPDATE repartidores SET lat = 8.6, lng = -71.62, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(c.rep.id)
      .run();
    const llegue = await c.paso(id, 'paradas/1/llegue');
    expect(llegue.estado, JSON.stringify(llegue.datos)).toBe(200);
    expect((await c.paso(id, 'paradas/1/seguir')).estado).toBe(200);
    await recorrer(v, c, id, fuera);
    // 10 minutos de espera antes de iniciar (3 gratis): 0,35 $ más el 30 % = 0,45 $.
    await v.e.m.DB.prepare(
      "UPDATE viajes SET llego_en = datetime(iniciado_en, '-10 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    const fin = await c.paso(id, 'terminar');
    expect(fin.estado, JSON.stringify(fin.datos)).toBe(200);
    const total = fin.datos.totalFinal as number;
    expect(total).toBe(conParadas + 45);
    expect(fin.datos).toMatchObject({ saldoDivoox: 100, cobrarEnMano: total - 100 });
    // El saldo apartado no creció: lo demás se pagó en mano.
    const a = await acreditado(v, id);
    expect(a.salio).toBe(100);
    expect(a.mov?.monto).toBe(100);
    expect(await saldoDeCliente(v.e.m.DB, v.e.cliente.id)).toBe(0);
    await mismoEnMano(v, c, id, total - 100);
    // La comisión, una vez: el 10 % del precio del viaje con sus paradas (y su recargo), puesta al
    // día al cambiar las paradas. La espera es entera del conductor (regla de siempre de la espera).
    const com = await comisionDelViaje(v, id);
    expect(com.n).toBe(1);
    expect(com.suma).toBe(Math.round(conParadas / 10));
    await cuadra(v);
  });

  it('(e) de noche, la cancelación devuelve el saldo entero y no deja comisión', async () => {
    const v = await elVigia();
    await v.fijarNoche(true);
    await v.cargar(1000);
    const c = await v.conductor();
    const q = await v.cotizar();
    const p = await v.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'saldo',
      usarSaldo: true,
    });
    expect(p.estado).toBe(201);
    const id = p.datos.viaje.id as string;
    expect(await saldoDeCliente(v.e.m.DB, v.e.cliente.id)).toBe(610);
    expect((await c.paso(id, 'aceptar')).estado).toBe(200);
    expect((await v.pasajero('POST', `/datos/viajes/${id}/cancelar`, {})).estado).toBe(200);
    expect(await saldoDeCliente(v.e.m.DB, v.e.cliente.id)).toBe(1000);
    const vista = (await v.pasajero('GET', `/datos/viajes/${id}`)).datos.viaje;
    expect(vista.saldoDevuelto).toBe(390);
    expect((await acreditado(v, id)).mov).toBeNull();
    expect(await comisionDelViaje(v, id)).toEqual({ n: 0, suma: 0 });
    expect(await prepago(c)).toMatchObject({ disponible: 1000, reservado: 0 });
    await cuadra(v);
  });
});
