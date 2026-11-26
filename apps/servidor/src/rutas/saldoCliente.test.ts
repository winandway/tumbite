import { describe, expect, it } from 'vitest';
import { equivalenteLocal } from '@tumbite/compartido';
import {
  ORIGEN_CCS,
  abrirCaracas,
  cargarPagoMovilVe,
  conductorListoVe,
  escenarioVe,
} from '../pruebas/motoVe';
import {
  apartarSaldoViaje,
  barrerSaldos,
  cerrarSaldoDeViaje,
  saldoDeCliente,
  saludSaldoClientes,
} from '../saldoCliente';
import { CUENTA_TUMBITE } from '../internacional/libro';

/**
 * C-SALDO-CLIENTE (25 nov 2026, Venezuela): el Saldo Divoox del pasajero de punta a punta. El equipo
 * lo carga desde el panel (topes, auditoría, idempotencia), el pasajero lo usa en la pantalla «Método
 * de pago» (todo con saldo, o parte con saldo y el resto en efectivo o Pago Móvil), se aparta al pedir,
 * vuelve si el viaje no se hace y al terminar se le acredita al conductor solo si el viaje fue real.
 * El libro cuadra: lo que sale del saldo del cliente es lo que Divoox le paga al conductor.
 */
const DESTINO = { lat: 10.4806, lng: -66.8406, direccion: 'Destino' };
const TASA = 236.4567;

async function preparar() {
  const e = await escenarioVe();
  await abrirCaracas(e);
  const tasa = await e.m.llamar(
    'PUT',
    '/datos/admin/tasas-referencia/VE',
    { tasa: TASA },
    e.admin.token,
  );
  expect(tasa.estado).toBe(200);
  let n = 0;
  const pasajero = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, e.cliente.token, {
      'idempotency-key': `pedir-saldo-${++n}-abcdef`,
    });
  const cargar = (monto: number, extra: Record<string, unknown> = {}, token = e.admin.token) =>
    e.m.llamar(
      'POST',
      `/datos/admin/saldo-clientes/${e.cliente.id}/cargas`,
      {
        monto,
        motivo: 'carrera_regalo',
        idempotencia: `carga-${Math.random().toString(36).slice(2, 12)}`,
        ...extra,
      },
      token,
    );
  const cotizar = async () => {
    const r = await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN_CCS,
      destino: DESTINO,
    });
    expect(r.estado).toBe(201);
    return r.datos.cotizacion as {
      id: string;
      total: number;
      saldoDivoox: { disponible: number; moneda: string } | null;
      disponibles: Record<string, boolean>;
    };
  };
  return { e, pasajero, cargar, cotizar };
}
type P = Awaited<ReturnType<typeof preparar>>;

/** Un viaje de verdad: empezó hace 25 minutos, recorrió lo cotizado y el conductor está en el destino. */
async function recorrer(p: P, conductorId: string, id: string) {
  await p.e.m.DB.batch([
    p.e.m.DB.prepare(
      `UPDATE viajes SET iniciado_en = datetime('now', '-25 minutes'),
              distancia_m_real = (SELECT distancia_m FROM cotizaciones_viaje WHERE operacion_id = ?1)
        WHERE operacion_id = ?1`,
    ).bind(id),
    p.e.m.DB.prepare(
      "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    ).bind(DESTINO.lat, DESTINO.lng, conductorId),
  ]);
}

async function hastaIniciar(
  p: P,
  c: Awaited<ReturnType<typeof conductorListoVe>>,
  cuerpo: Record<string, unknown>,
) {
  const q = await p.cotizar();
  const v = await p.pasajero('POST', '/datos/viajes', { cotizacionId: q.id, ...cuerpo });
  expect(v.estado).toBe(201);
  const id = v.datos.viaje.id as string;
  expect((await c.paso(id, 'aceptar')).estado).toBe(200);
  expect((await c.paso(id, 'llegue')).estado).toBe(200);
  const pin = (await p.pasajero('GET', `/datos/viajes/${id}`)).datos.viaje.pin;
  expect((await c.paso(id, 'iniciar', { pin })).estado).toBe(200);
  return { id, q };
}

const movimientoConductor = (p: P, id: string) =>
  p.e.m.DB.prepare(
    "SELECT usuario_id, monto, concepto FROM movimientos WHERE referencia = 'saldo-divoox:' || ?",
  )
    .bind(id)
    .first<{ usuario_id: string; monto: number; concepto: string }>();
const libroDivoox = (p: P, id: string) =>
  p.e.m.DB.prepare(
    "SELECT cuenta_id, monto, concepto FROM libro WHERE referencia = 'saldo-divoox:' || ? || ':divoox'",
  )
    .bind(id)
    .first<{ cuenta_id: string; monto: number; concepto: string }>();
const usoDe = (p: P, id: string) =>
  p.e.m.DB.prepare(
    'SELECT estado, monto, apartado, conductor_id FROM usos_saldo_divoox WHERE operacion_id = ?',
  )
    .bind(id)
    .first<{ estado: string; monto: number; apartado: number; conductor_id: string | null }>();

describe('C-SALDO-CLIENTE: el equipo carga el saldo desde el panel', () => {
  it('carga con motivo, queda en la auditoría, avisa y no carga dos veces con la misma clave', async () => {
    const p = await preparar();
    const clave = 'carga-idempotente-1';
    const r = await p.cargar(1500, { idempotencia: clave, nota: 'Bienvenida' });
    expect(r.estado).toBe(201);
    expect(r.datos.saldo).toBe(1500);
    const otra = await p.cargar(1500, { idempotencia: clave, nota: 'Bienvenida' });
    expect(otra.estado).toBe(200);
    expect(otra.datos.repetida).toBe(true);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(1500);
    const aud = await p.e.m.DB.prepare(
      "SELECT actor_id, objeto, despues_json FROM auditoria_admin WHERE accion = 'saldo_cliente_carga'",
    ).all<{ actor_id: string; objeto: string; despues_json: string }>();
    expect(aud.results).toHaveLength(1);
    expect(aud.results[0]).toMatchObject({
      actor_id: p.e.admin.id,
      objeto: `cliente:${p.e.cliente.id}`,
    });
    expect(JSON.parse(aud.results[0]?.despues_json ?? '{}')).toMatchObject({
      monto: 1500,
      motivo: 'carrera_regalo',
    });
    const ficha = await p.e.m.llamar(
      'GET',
      `/datos/admin/saldo-clientes/${p.e.cliente.id}`,
      undefined,
      p.e.admin.token,
    );
    expect(ficha.datos.saldo).toBe(1500);
    expect(ficha.datos.movimientos[0]).toMatchObject({ monto: 1500, concepto: 'regalo' });
    // El cliente lo ve en su app.
    const mio = await p.pasajero('GET', '/datos/cliente/saldo-divoox');
    expect(mio.datos).toMatchObject({ disponible: 1500, moneda: 'USD' });
  });

  it('respeta el tope por carga y el del día del cliente; el prepago pide su referencia; solo el equipo', async () => {
    const p = await preparar();
    expect((await p.cargar(2001)).estado).toBe(422); // tope por carga: 20 $
    expect((await p.cargar(2000)).estado).toBe(201);
    expect((await p.cargar(2000)).estado).toBe(201);
    expect((await p.cargar(1001)).estado).toBe(422); // tope del día del cliente: 50 $
    expect((await p.cargar(1000, { motivo: 'prepago' })).estado).toBe(422); // sin referencia
    expect((await p.cargar(1000, { motivo: 'prepago', comprobante: 'REF-0001' })).estado).toBe(201);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(5000);
    // Un cliente no se carga saldo solo.
    expect((await p.cargar(100, {}, p.e.cliente.token)).estado).toBe(403);
    // Los topes se cambian sin pasar el máximo del código, y el cambio queda auditado.
    const topes = await p.e.m.llamar(
      'PUT',
      '/datos/admin/saldo-clientes/topes',
      { porCarga: 999_999, porDiaEquipo: 20_000, porDiaCliente: 5_000 },
      p.e.admin.token,
    );
    expect(topes.estado).toBe(422);
    const bien = await p.e.m.llamar(
      'PUT',
      '/datos/admin/saldo-clientes/topes',
      { porCarga: 3_000, porDiaEquipo: 20_000, porDiaCliente: 8_000 },
      p.e.admin.token,
    );
    expect(bien.datos.topes.porCarga).toBe(3_000);
    expect((await p.cargar(2500)).estado).toBe(201);
  });

  it('el buscador de la pantalla encuentra al cliente por su nombre con su saldo', async () => {
    const p = await preparar();
    await p.cargar(700);
    const r = await p.e.m.llamar(
      'GET',
      '/datos/admin/saldo-clientes?q=pasajero',
      undefined,
      p.e.admin.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.clientes.find((x: { id: string }) => x.id === p.e.cliente.id)).toMatchObject({
      saldo: 700,
    });
    expect(r.datos.resumen.disponible).toBe(700);
  });
});

describe('C-SALDO-CLIENTE: el saldo nunca queda negativo ni se gasta dos veces', () => {
  it('dos apartados a la vez por todo el saldo: solo uno entra', async () => {
    const p = await preparar();
    await p.cargar(1000);
    const [a, b] = await Promise.all([
      apartarSaldoViaje(p.e.m.DB, {
        operacionId: 'op-a-123456',
        clienteId: p.e.cliente.id,
        monto: 1000,
        pais: 'VE',
      }),
      apartarSaldoViaje(p.e.m.DB, {
        operacionId: 'op-b-123456',
        clienteId: p.e.cliente.id,
        monto: 1000,
        pais: 'VE',
      }),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(0);
    // Repetir el mismo apartado no aparta otra vez (referencia única).
    await p.cargar(1000);
    const op = a ? 'op-a-123456' : 'op-b-123456';
    expect(
      await apartarSaldoViaje(p.e.m.DB, {
        operacionId: op,
        clienteId: p.e.cliente.id,
        monto: 500,
        pais: 'VE',
      }),
    ).toBe(false);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(1000);
    // Y la base misma no deja un movimiento que lo deje en negativo (segunda llave).
    await expect(
      p.e.m.DB.prepare(
        "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia) VALUES ('x1', ?, -5000, 'ajuste', 'x1')",
      )
        .bind(p.e.cliente.id)
        .run(),
    ).rejects.toThrow(/saldo_insuficiente/);
    // El libro es inmutable.
    await expect(
      p.e.m.DB.prepare('UPDATE saldo_cliente_movimientos SET monto = 1').run(),
    ).rejects.toThrow(/no se cambia/);
    await expect(p.e.m.DB.prepare('DELETE FROM saldo_cliente_movimientos').run()).rejects.toThrow(
      /no se borra/,
    );
    expect(await saludSaldoClientes(p.e.m.DB)).toBe('ok');
  });
});

describe('C-SALDO-CLIENTE: pagar el viaje con Saldo Divoox', () => {
  it('saldo que cubre todo: el viaje es «saldo», el conductor no cobra nada en mano y Divoox le paga todo', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const q0 = await p.cotizar();
    expect(q0.saldoDivoox).toEqual({ disponible: 2000, moneda: 'USD' });
    const { id, q } = await hastaIniciar(p, c, { metodoPago: 'saldo', usarSaldo: true });
    expect(q.total).toBeLessThan(2000);
    // Se apartó al pedir.
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(2000 - q.total);
    const fila = await p.e.m.DB.prepare(
      'SELECT metodo_pago, saldo_divoox FROM viajes WHERE operacion_id = ?',
    )
      .bind(id)
      .first();
    expect(fila).toEqual({ metodo_pago: 'saldo', saldo_divoox: q.total });
    const actual = (await c.yo('GET', '/datos/conductor/operaciones/actual')).datos.operacion;
    expect(actual.cobrar_en_mano).toBe(0);
    expect(actual.saldo_divoox).toBe(q.total);
    await recorrer(p, c.rep.id, id);
    const fin = await c.paso(id, 'terminar');
    expect(fin.estado).toBe(200);
    expect(fin.datos).toMatchObject({
      cobrarEnMano: 0,
      saldoDivoox: q.total,
      regaloEnRevision: false,
    });
    expect(await usoDe(p, id)).toMatchObject({ estado: 'cobrado', monto: q.total });
    // El libro cuadra: lo que salió del saldo del cliente es lo que Divoox le paga al conductor.
    expect(await movimientoConductor(p, id)).toEqual({
      usuario_id: c.rep.id,
      monto: q.total,
      concepto: 'regalo',
    });
    expect(await libroDivoox(p, id)).toEqual({
      cuenta_id: CUENTA_TUMBITE,
      monto: -q.total,
      concepto: 'saldo_divoox_pagado',
    });
    const salio = await p.e.m.DB.prepare(
      'SELECT -SUM(monto) AS s FROM saldo_cliente_movimientos WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ s: number }>();
    expect(salio?.s).toBe(q.total);
    // La comisión de Divoox sale del prepago del conductor como siempre, sobre el precio del viaje.
    const comision = await p.e.m.DB.prepare(
      "SELECT -SUM(monto) AS c FROM libro WHERE cuenta_id = ? AND bolsillo = 'prepago' AND concepto LIKE 'reserva_viaje%'",
    )
      .bind(c.rep.id)
      .first<{ c: number | null }>();
    expect(Number(comision?.c ?? 0)).toBe(Math.round(q.total / 10));
    // Lo que Divoox le debe aparece en sus ganancias por cobrar, como un regalo.
    const { porCobrarRegalos } = await import('../regalosDivoox');
    expect((await porCobrarRegalos(p.e.m.DB, c.rep.id))?.monto).toBe(q.total);
    expect(await saludSaldoClientes(p.e.m.DB)).toBe('ok');
  });

  it('parte con saldo y el resto en efectivo: el mismo monto en mano en todas las pantallas, en $ y en Bs', async () => {
    const p = await preparar();
    await p.cargar(100);
    const c = await conductorListoVe(p.e, 2000);
    const q = await p.cotizar();
    // Sin elegir cómo pagar el resto, el servidor no deja pedir «todo con saldo».
    const mal = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'saldo',
      usarSaldo: true,
    });
    expect(mal.estado).toBe(422);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(100);
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
    });
    expect(v.estado).toBe(201);
    const id = v.datos.viaje.id as string;
    const resto = q.total - 100;
    const bs = equivalenteLocal(resto, TASA);
    const oferta = (await c.yo('GET', '/datos/conductor/operaciones/ofertas')).datos.ofertas[0];
    expect(oferta).toMatchObject({
      saldoDivoox: 100,
      enMano: { monto: resto, local: { monto: bs } },
    });
    expect((await c.paso(id, 'aceptar')).estado).toBe(200);
    const actual = (await c.yo('GET', '/datos/conductor/operaciones/actual')).datos.operacion;
    expect(actual.cobrar_en_mano).toBe(resto);
    expect(actual.en_mano).toMatchObject({ monto: resto, local: { monto: bs } });
    const vista = (await p.pasajero('GET', '/datos/viajes/actual')).datos.viaje;
    expect(vista).toMatchObject({ saldoDivoox: 100, metodoPago: 'efectivo' });
    expect(vista.enMano).toMatchObject({ monto: resto, local: { monto: bs } });
    await c.paso(id, 'llegue');
    await c.paso(id, 'iniciar', { pin: vista.pin });
    await recorrer(p, c.rep.id, id);
    const fin = await c.paso(id, 'terminar');
    expect(fin.datos).toMatchObject({ cobrarEnMano: resto, saldoDivoox: 100 });
    expect(fin.datos.enMano).toMatchObject({ monto: resto, local: { monto: bs } });
    const recibo = (await p.pasajero('GET', `/datos/viajes/${id}`)).datos.viaje;
    expect(recibo.enMano).toMatchObject({ monto: resto, local: { monto: bs } });
    // El panel ve lo mismo.
    const panel = await p.e.m.llamar('GET', '/datos/admin/viajes', undefined, p.e.admin.token);
    const fila = (
      panel.datos.viajes as { id: string; enMano?: number; saldoDivoox?: number }[]
    ).find((x) => x.id === id);
    expect(fila).toMatchObject({ saldoDivoox: 100, enMano: resto });
    expect((await movimientoConductor(p, id))?.monto).toBe(100);
  });

  it('parte con saldo y el resto por Pago Móvil: el pago esperado es solo el resto', async () => {
    const p = await preparar();
    await p.cargar(150);
    const c = await conductorListoVe(p.e, 2000);
    await cargarPagoMovilVe(c);
    const { id, q } = await hastaIniciar(p, c, { metodoPago: 'pago_movil', usarSaldo: true });
    const pm = await c.paso(id, 'pago-movil', { recibido: true, referencia: '000111' });
    expect(pm.estado).toBe(200);
    const esperado = await p.e.m.DB.prepare(
      'SELECT monto FROM viajes_pago_movil WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ monto: number }>();
    expect(esperado?.monto).toBe(q.total - 150);
    await recorrer(p, c.rep.id, id);
    const fin = await c.paso(id, 'terminar');
    expect(fin.datos).toMatchObject({ cobrarEnMano: q.total - 150, saldoDivoox: 150 });
  });

  it('el total final sube (espera): el saldo no crece y la diferencia va en mano', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
    });
    const id = v.datos.viaje.id as string;
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(2000 - q.total);
    await c.paso(id, 'aceptar');
    await c.paso(id, 'llegue');
    // Esperó 20 minutos al pasajero: se cobra la espera de más.
    await p.e.m.DB.prepare(
      "UPDATE viajes SET llego_en = datetime('now', '-45 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    const pin = (await p.pasajero('GET', `/datos/viajes/${id}`)).datos.viaje.pin;
    await c.paso(id, 'iniciar', { pin });
    await recorrer(p, c.rep.id, id);
    const fin = await c.paso(id, 'terminar');
    const total = fin.datos.totalFinal as number;
    expect(total).toBeGreaterThan(q.total);
    expect(fin.datos).toMatchObject({ saldoDivoox: q.total, cobrarEnMano: total - q.total });
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(2000 - q.total);
  });

  it('el total final baja: lo que sobra de lo apartado vuelve al saldo del cliente', async () => {
    const p = await preparar();
    await p.cargar(1000);
    const c = await conductorListoVe(p.e, 2000);
    const { id } = await hastaIniciar(p, c, { metodoPago: 'efectivo', usarSaldo: true });
    const apartado = (await usoDe(p, id))?.apartado ?? 0;
    await recorrer(p, c.rep.id, id);
    // Una corrección dejó el total final 40 centavos por debajo de lo apartado.
    const cierre = await cerrarSaldoDeViaje(p.e.m.DB, {
      operacionId: id,
      conductorId: c.rep.id,
      maximo: apartado - 40,
      alTerminar: true,
    });
    expect(cierre).toEqual({ monto: apartado - 40, enRevision: false });
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(1000 - apartado + 40);
    expect((await movimientoConductor(p, id))?.monto).toBe(apartado - 40);
    // Repetir el cierre no devuelve ni paga dos veces.
    await cerrarSaldoDeViaje(p.e.m.DB, {
      operacionId: id,
      conductorId: c.rep.id,
      maximo: apartado - 40,
      alTerminar: false,
    });
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(1000 - apartado + 40);
  });
});

describe('C-SALDO-CLIENTE: lo apartado vuelve si el viaje no se hace', () => {
  it('al cancelar el pasajero, el saldo vuelve entero', async () => {
    const p = await preparar();
    await p.cargar(1000);
    await conductorListoVe(p.e, 2000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
    });
    const id = v.datos.viaje.id as string;
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(1000 - Math.min(1000, q.total));
    expect((await p.pasajero('POST', `/datos/viajes/${id}/cancelar`, {})).estado).toBe(200);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(1000);
    expect(await usoDe(p, id)).toMatchObject({ estado: 'liberado', monto: 0 });
    const vista = (await p.pasajero('GET', `/datos/viajes/${id}`)).datos.viaje;
    expect(vista.saldoDevuelto).toBe(Math.min(1000, q.total));
  });

  it('sin conductor, el reloj lo devuelve; el canario ve lo que se queda colgado', async () => {
    const p = await preparar();
    await p.cargar(1000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
    });
    const id = v.datos.viaje.id as string;
    const { cambiarEstadoViaje } = await import('../operaciones');
    expect(
      await cambiarEstadoViaje(p.e.m.DB, {
        operacionId: id,
        desde: 'buscando',
        hacia: 'sin_conductor',
        actor: 'sistema',
        actorId: null,
        clave: 'prueba-sin-conductor-1',
      }),
    ).toBe(true);
    await p.e.m.DB.prepare(
      "UPDATE operaciones SET actualizado_en = datetime('now', '-2 hours') WHERE id = ?",
    )
      .bind(id)
      .run();
    // Colgado más de una hora: el canario se pone en rojo hasta que el reloj lo cierre.
    expect(await saludSaldoClientes(p.e.m.DB)).toBe('error');
    expect(await barrerSaldos(p.e.m.DB)).toBe(1);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(1000);
    expect(await saludSaldoClientes(p.e.m.DB)).toBe('ok');
  });
});

describe('C-SALDO-CLIENTE: al conductor solo se le paga un viaje real', () => {
  it('un viaje que no parece real queda en revisión; el equipo lo aprueba o lo devuelve al cliente', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const { id, q } = await hastaIniciar(p, c, { metodoPago: 'saldo', usarSaldo: true });
    // Termina sin recorrer nada.
    const fin = await c.paso(id, 'terminar');
    expect(fin.datos).toMatchObject({ regaloEnRevision: true, cobrarEnMano: 0 });
    expect(await usoDe(p, id)).toMatchObject({ estado: 'en_revision', monto: q.total });
    expect(await movimientoConductor(p, id)).toBeNull();
    const lista = await p.e.m.llamar(
      'GET',
      '/datos/admin/saldo-clientes',
      undefined,
      p.e.admin.token,
    );
    expect(lista.datos.revisiones[0]).toMatchObject({ operacionId: id, monto: q.total });
    // Rechazado: el saldo vuelve al cliente y el conductor no recibe nada.
    const no = await p.e.m.llamar(
      'POST',
      `/datos/admin/saldo-clientes/revisiones/${id}`,
      { aprobar: false, nota: 'El viaje no se hizo' },
      p.e.admin.token,
    );
    expect(no.estado).toBe(200);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(2000);
    expect(await movimientoConductor(p, id)).toBeNull();
    const otra = await p.e.m.llamar(
      'POST',
      `/datos/admin/saldo-clientes/revisiones/${id}`,
      { aprobar: true, nota: 'Segundo toque' },
      p.e.admin.token,
    );
    expect(otra.estado).toBe(409);
  });

  it('aprobado por el equipo: se le acredita al conductor', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const { id, q } = await hastaIniciar(p, c, { metodoPago: 'saldo', usarSaldo: true });
    await c.paso(id, 'terminar');
    const si = await p.e.m.llamar(
      'POST',
      `/datos/admin/saldo-clientes/revisiones/${id}`,
      { aprobar: true, nota: 'Revisado con el conductor' },
      p.e.admin.token,
    );
    expect(si.datos.pagado).toBe(q.total);
    expect((await movimientoConductor(p, id))?.monto).toBe(q.total);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(2000 - q.total);
  });

  it('el conductor no toma un viaje pagado con el saldo de su propio celular', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    await p.e.m.DB.prepare(
      "UPDATE usuarios SET telefono_canonico = '584120009999' WHERE id IN (?, ?)",
    )
      .bind(p.e.cliente.id, c.rep.id)
      .run();
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'saldo',
      usarSaldo: true,
    });
    expect((await c.paso(v.datos.viaje.id as string, 'aceptar')).estado).toBe(409);
  });
});

describe('C-PAGO-MOVIL-DISPONIBLE: Pago Móvil solo si alguien cerca lo recibe', () => {
  it('sin conductor con Pago Móvil sale apagado; con uno conectado, encendido', async () => {
    const p = await preparar();
    const c = await conductorListoVe(p.e, 2000);
    expect((await p.cotizar()).disponibles).toEqual({ efectivo: true, pago_movil: false });
    await cargarPagoMovilVe(c);
    expect((await p.cotizar()).disponibles).toEqual({ efectivo: true, pago_movil: true });
    // Desconectado (sin ubicación reciente) ya no cuenta.
    await p.e.m.DB.prepare(
      "UPDATE repartidores SET ubicacion_en = datetime('now', '-1 hour') WHERE usuario_id = ?",
    )
      .bind(c.rep.id)
      .run();
    expect((await p.cotizar()).disponibles.pago_movil).toBe(false);
  });
});
