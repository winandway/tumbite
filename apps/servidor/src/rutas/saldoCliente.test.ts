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
  TOPE_DIARIO_SALDO_CONDUCTOR,
  apartarSaldoViaje,
  barrerSaldos,
  liberarSaldoViaje,
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
const APARATO = 'aparato-saldo-pasajero-1';

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
      'x-aparato': APARATO,
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

// ───────────── Devolución del revisor (25 nov 2026): piezas vecinas del saldo ─────────────

async function conRegaloCodigo(p: P, valor: number) {
  await p.e.m.DB.prepare(
    "UPDATE usuarios SET telefono = '+584120000077', telefono_canonico = '584120000077' WHERE id = ?",
  )
    .bind(p.e.cliente.id)
    .run();
  const r = await p.e.m.llamar(
    'POST',
    '/datos/admin/regalos-divoox',
    {
      codigo: 'SALDOREG',
      nombreEs: 'Regalo de prueba',
      nombreEn: 'Test gift',
      tipo: 'monto',
      valor,
      servicios: ['moto'],
      zonas: ['VE-DC-CCS-PRUEBAS'],
      venceEn: null,
      presupuesto: 10_000,
      bienvenida: true,
    },
    p.e.admin.token,
  );
  if (r.estado !== 201) {
    // La zona de pruebas tiene otro id: se toma la de la cotización.
    const z = await p.e.m.DB.prepare("SELECT id FROM zonas WHERE pais = 'VE' LIMIT 1").first<{
      id: string;
    }>();
    const r2 = await p.e.m.llamar(
      'POST',
      '/datos/admin/regalos-divoox',
      {
        codigo: 'SALDOREG',
        nombreEs: 'Regalo de prueba',
        nombreEn: 'Test gift',
        tipo: 'monto',
        valor,
        servicios: ['moto'],
        zonas: [z?.id],
        venceEn: null,
        presupuesto: 10_000,
        bienvenida: true,
      },
      p.e.admin.token,
    );
    expect(r2.estado).toBe(201);
  }
  await p.e.m.llamar(
    'PATCH',
    '/datos/admin/regalos-divoox/SALDOREG',
    { activo: true },
    p.e.admin.token,
  );
}

describe('C-SALDO-CLIENTE (revisión): regalo por código y saldo en el mismo viaje', () => {
  it('primero el regalo, después el saldo; el conductor pasa a su saldo lo de los dos (B1, mixto)', async () => {
    const p = await preparar();
    await conRegaloCodigo(p, 100);
    await p.cargar(150);
    const c = await conductorListoVe(p.e, 2000);
    const q = await p.cotizar();
    expect((q as { regalo?: { monto: number } }).regalo?.monto).toBe(100);
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
      regalo: 'SALDOREG',
    });
    expect(v.estado).toBe(201);
    const id = v.datos.viaje.id as string;
    expect((await usoDe(p, id))?.apartado).toBe(150);
    expect((await c.paso(id, 'aceptar')).estado).toBe(200);
    await c.paso(id, 'llegue');
    const pin = (await p.pasajero('GET', `/datos/viajes/${id}`)).datos.viaje.pin;
    await c.paso(id, 'iniciar', { pin });
    await recorrer(p, c.rep.id, id);
    const fin = await c.paso(id, 'terminar');
    expect(fin.datos).toMatchObject({
      regaloDivoox: 100,
      saldoDivoox: 150,
      cobrarEnMano: q.total - 250,
    });
    // B1: «Pasar a mi saldo» toma lo del regalo Y lo del saldo del pasajero.
    const pasa = await p.e.m.llamar('POST', '/datos/repartidor/regalos/a-saldo', {}, c.rep.token);
    expect(pasa.estado).toBe(200);
    expect(pasa.datos.monto).toBe(250);
  });

  it('B1: con solo lo acreditado por Saldo Divoox (0 de cupón) también se pasa a su saldo', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const { id, q } = await hastaIniciar(p, c, { metodoPago: 'saldo', usarSaldo: true });
    await recorrer(p, c.rep.id, id);
    await c.paso(id, 'terminar');
    const pasa = await p.e.m.llamar('POST', '/datos/repartidor/regalos/a-saldo', {}, c.rep.token);
    expect(pasa.estado).toBe(200);
    expect(pasa.datos.monto).toBe(q.total);
  });

  it('M2: si el regalo ya cubre todo, «saldo» no dice «no alcanza» ni suelta el regalo', async () => {
    const p = await preparar();
    await conRegaloCodigo(p, 2000);
    await p.cargar(500);
    await conductorListoVe(p.e, 2000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'saldo',
      usarSaldo: true,
      regalo: 'SALDOREG',
    });
    expect(v.estado).toBe(201);
    const id = v.datos.viaje.id as string;
    const uso = await p.e.m.DB.prepare(
      'SELECT estado FROM usos_cupon_divoox WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ estado: string }>();
    expect(uso?.estado).toBe('apartado');
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(500);
  });
});

describe('C-SALDO-CLIENTE (revisión): ganancias, billetera y antifraude del conductor', () => {
  it('B2 e I1: el viaje todo con saldo no sale «en mano» y su crédito se liga al viaje', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const { id, q } = await hastaIniciar(p, c, { metodoPago: 'saldo', usarSaldo: true });
    await recorrer(p, c.rep.id, id);
    await c.paso(id, 'terminar');
    const g = await c.yo('GET', '/datos/repartidor/ganancias');
    expect((g.datos.viajesEnMano as { viajeId: string }[]).some((v) => v.viajeId === id)).toBe(
      false,
    );
    const b = await c.yo('GET', '/datos/billetera');
    const m = (
      b.datos.movimientos as { operacionId: string | null; origen: string | null; monto: number }[]
    ).find((x) => x.origen === 'saldo_divoox');
    expect(m).toMatchObject({ operacionId: id, monto: q.total });
  });

  it('B2: parte con saldo, en mano sale solo el resto', async () => {
    const p = await preparar();
    await p.cargar(100);
    const c = await conductorListoVe(p.e, 2000);
    const { id, q } = await hastaIniciar(p, c, { metodoPago: 'efectivo', usarSaldo: true });
    await recorrer(p, c.rep.id, id);
    await c.paso(id, 'terminar');
    const g = await c.yo('GET', '/datos/repartidor/ganancias');
    const fila = (g.datos.viajesEnMano as { viajeId: string; monto: number }[]).find(
      (v) => v.viajeId === id,
    );
    expect(fila?.monto).toBe(q.total - 100);
  });

  it('I2: no toma un viaje con saldo pedido desde su mismo aparato, ni pasa el tope diario; deja alerta', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'saldo',
      usarSaldo: true,
    });
    const id = v.datos.viaje.id as string;
    const aceptar = (aparato: string) =>
      p.e.m.crudo(`/datos/conductor/operaciones/${id}/aceptar`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${c.rep.token}`,
          'content-type': 'application/json',
          'idempotency-key': `aceptar-saldo-${aparato}-${id.slice(0, 6)}`,
          'x-aparato': aparato,
        },
        body: '{}',
      });
    expect((await aceptar(APARATO)).status).toBe(409);
    const propia = await p.e.m.DB.prepare(
      "SELECT 1 FROM alertas_regalo WHERE tipo = 'saldo_propio' AND operacion_id = ?",
    )
      .bind(id)
      .first();
    expect(propia).not.toBeNull();
    // El tope diario: ya tomó todos los viajes con saldo permitidos hoy.
    for (let i = 0; i < TOPE_DIARIO_SALDO_CONDUCTOR; i++)
      await p.e.m.DB.prepare(
        `INSERT INTO usos_saldo_divoox (operacion_id, cliente_id, conductor_id, monto, apartado, pais, estado, tomado_en)
         VALUES (?, 'otro-cliente', ?, 100, 100, 'VE', 'cobrado', datetime('now'))`,
      )
        .bind(`op-tope-${i}-xxxxxx`, c.rep.id)
        .run();
    expect((await aceptar('otro-aparato-1')).status).toBe(409);
    const tope = await p.e.m.DB.prepare(
      "SELECT 1 FROM alertas_regalo WHERE tipo = 'saldo_tope_diario' AND operacion_id = ?",
    )
      .bind(id)
      .first();
    expect(tope).not.toBeNull();
  });
});

describe('C-SALDO-CLIENTE (revisión): no-show, carreras simultáneas y el reloj', () => {
  it('I6: «no se presentó» devuelve el saldo apartado', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'saldo',
      usarSaldo: true,
    });
    const id = v.datos.viaje.id as string;
    await c.paso(id, 'aceptar');
    await c.paso(id, 'llegue');
    await p.e.m.DB.prepare(
      "UPDATE viajes SET llego_en = datetime('now', '-20 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    expect((await c.paso(id, 'no-se-presento')).estado).toBe(200);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(2000);
  });

  it('I6: cerrar y liberar a la vez: el dinero sale una sola vez (o al conductor o de vuelta al cliente)', async () => {
    const p = await preparar();
    await p.cargar(2000);
    const c = await conductorListoVe(p.e, 2000);
    const { id, q } = await hastaIniciar(p, c, { metodoPago: 'saldo', usarSaldo: true });
    await recorrer(p, c.rep.id, id);
    await Promise.all([
      cerrarSaldoDeViaje(p.e.m.DB, {
        operacionId: id,
        conductorId: c.rep.id,
        maximo: q.total,
        alTerminar: false,
      }),
      liberarSaldoViaje(p.e.m.DB, id, 'prueba'),
    ]);
    const cliente = await saldoDeCliente(p.e.m.DB, p.e.cliente.id);
    const conductor = Number((await movimientoConductor(p, id))?.monto ?? 0);
    expect(cliente + conductor).toBe(2000);
    expect([0, q.total]).toContain(conductor);
  });

  it('I6: dos pedidos a la vez con el mismo saldo: uno pasa y el otro recibe un 409 en palabras', async () => {
    const p = await preparar();
    const q1 = await p.cotizar();
    await p.cargar(q1.total);
    const q2 = await p.cotizar();
    const pedir = (id: string) =>
      p.pasajero('POST', '/datos/viajes', {
        cotizacionId: id,
        metodoPago: 'efectivo',
        usarSaldo: true,
      });
    const r = await Promise.all([pedir(q1.id), pedir(q2.id)]);
    expect(r.map((x) => x.estado).sort()).toEqual([201, 409]);
    expect(String(r.find((x) => x.estado === 409)?.datos.error ?? '').length).toBeGreaterThan(10);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(0);
    expect(await saludSaldoClientes(p.e.m.DB)).toBe('ok');
  });

  it('I5: el reloj usa su índice y no deja nada sin barrer aunque haya más de 100 viajes en curso', async () => {
    const p = await preparar();
    await p.cargar(1000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
    });
    const id = v.datos.viaje.id as string;
    // 120 viajes «en curso» más viejos (sin nada que barrer) por delante del que sí hay que devolver.
    for (let i = 0; i < 120; i++)
      await p.e.m.DB.prepare(
        `INSERT INTO usos_saldo_divoox (operacion_id, cliente_id, monto, apartado, pais, creado_en)
         VALUES (?, 'otro', 100, 100, 'VE', datetime('now', '-1 minute'))`,
      )
        .bind(`op-vivo-${i}-xxxxxx`)
        .run();
    await p.e.m.DB.prepare(
      "UPDATE usos_saldo_divoox SET creado_en = datetime('now') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    const { cambiarEstadoViaje } = await import('../operaciones');
    await cambiarEstadoViaje(p.e.m.DB, {
      operacionId: id,
      desde: 'buscando',
      hacia: 'sin_conductor',
      actor: 'sistema',
      actorId: null,
      clave: 'prueba-reloj-120',
    });
    await barrerSaldos(p.e.m.DB);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(1000);
    const plan = await p.e.m.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT operacion_id FROM usos_saldo_divoox WHERE estado = 'apartado' ORDER BY creado_en LIMIT 100",
    ).all<{ detail: string }>();
    const texto = plan.results.map((x) => x.detail).join(' | ');
    expect(texto).toMatch(/usos_saldo_divoox_estado/);
    expect(texto).not.toMatch(/TEMP B-TREE/);
  });
});

describe('C-SALDO-CLIENTE (revisión): borrar la cuenta y el prepago', () => {
  it('I4: con saldo pide confirmación; al borrar se cierra a cero y el prepago queda para devolver', async () => {
    const p = await preparar();
    await p.cargar(500);
    await p.cargar(700, { motivo: 'prepago', comprobante: 'REF-PREPAGO-1' });
    // M4: el prepago real entra al libro de Divoox, aparte de los regalos.
    const libro = await p.e.m.DB.prepare(
      "SELECT bolsillo, monto FROM libro WHERE concepto = 'saldo_cliente_prepago_recibido'",
    ).all<{ bolsillo: string; monto: number }>();
    expect(libro.results).toEqual([{ bolsillo: 'directo', monto: 700 }]);
    const visto = await p.pasajero('GET', '/datos/cuentas/yo/saldo-divoox');
    expect(visto.datos.disponible).toBe(1200);
    const sinAceptar = await p.e.m.llamar(
      'DELETE',
      '/datos/cuentas/yo',
      undefined,
      p.e.cliente.token,
    );
    expect(sinAceptar.estado).toBe(409);
    const borrado = await p.e.m.llamar(
      'DELETE',
      '/datos/cuentas/yo?saldo=acepto',
      undefined,
      p.e.cliente.token,
    );
    expect(borrado.estado).toBe(200);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(0);
    const cierre = await p.e.m.DB.prepare(
      "SELECT monto FROM saldo_cliente_movimientos WHERE concepto = 'cierre_cuenta' AND cliente_id = ?",
    )
      .bind(p.e.cliente.id)
      .first<{ monto: number }>();
    expect(cierre?.monto).toBe(-1200);
    const caso = await p.e.m.DB.prepare(
      "SELECT tipo, monto_esperado FROM incidencias_dinero WHERE tipo = 'saldo_cliente_por_devolver'",
    ).first<{ tipo: string; monto_esperado: number }>();
    expect(caso?.monto_esperado).toBe(700);
  });
});

// ───────────── Ajustes finales del revisor (25 nov 2026) ─────────────

describe('C-SALDO-CLIENTE (ajustes finales): borrar la cuenta sin callejón y devolver el prepago', () => {
  it('1: una app vieja recibe un 409 que dice la salida en palabras (es y en)', async () => {
    const p = await preparar();
    await p.cargar(500);
    const es = await p.e.m.llamar('DELETE', '/datos/cuentas/yo', undefined, p.e.cliente.token, {
      'x-idioma': 'es',
    });
    expect(es.estado).toBe(409);
    // La dirección en español es la de la página en español (/es/…); la de inglés, sin prefijo.
    expect(es.datos.error).toContain('divoox.com/es/delete-account');
    expect(es.datos.error).toContain('actualiza la app');
    const en = await p.e.m.llamar('DELETE', '/datos/cuentas/yo', undefined, p.e.cliente.token, {
      'x-idioma': 'en',
    });
    expect(en.datos.error).toContain('divoox.com/delete-account');
    expect(en.datos.error).not.toContain('/es/');
    expect(en.datos.error).toContain('update the app');
  });

  it('2: el caso de la bandeja trae monto, referencia y fecha; «devuelto» deja su asiento y el canario cuadra', async () => {
    const p = await preparar();
    await p.cargar(700, { motivo: 'prepago', comprobante: 'REF-PREPAGO-9' });
    expect(
      (await p.e.m.llamar('DELETE', '/datos/cuentas/yo?saldo=acepto', undefined, p.e.cliente.token))
        .estado,
    ).toBe(200);
    const lista = await p.e.m.llamar(
      'GET',
      '/datos/admin/bandeja-dinero?tipo=incidencia',
      undefined,
      p.e.admin.token,
    );
    const caso = (
      lista.datos.casos as {
        clave: string;
        detalle: string;
        detalleEn: string;
        acciones: string[];
        montos: Record<string, number>;
      }[]
    ).find((x) => x.acciones.includes('saldo_devuelto'));
    expect(caso).toBeDefined();
    expect(caso?.montos.porDevolver).toBe(700);
    expect(caso?.detalle).toContain('REF-PREPAGO-9');
    expect(caso?.detalle).toMatch(/política de borrado/);
    expect(caso?.detalleEn).toContain('REF-PREPAGO-9');
    expect(caso?.detalleEn).toMatch(/deletion policy/);
    const hecho = await p.e.m.llamar(
      'POST',
      `/datos/admin/bandeja-dinero/${encodeURIComponent(caso?.clave ?? '')}/acciones`,
      {
        accion: 'saldo_devuelto',
        nota: 'Pago móvil de devolución, ref 000777',
        idempotencia: 'devolver-1-abc',
      },
      p.e.admin.token,
    );
    expect(hecho.estado).toBe(200);
    const asiento = await p.e.m.DB.prepare(
      "SELECT bolsillo, monto FROM libro WHERE concepto = 'saldo_cliente_prepago_devuelto'",
    ).all<{ bolsillo: string; monto: number }>();
    expect(asiento.results).toEqual([{ bolsillo: 'directo', monto: -700 }]);
    const inc = await p.e.m.DB.prepare(
      "SELECT estado FROM incidencias_dinero WHERE tipo = 'saldo_cliente_por_devolver'",
    ).first<{ estado: string }>();
    expect(inc?.estado).toBe('resuelta');
    expect(await saludSaldoClientes(p.e.m.DB)).toBe('ok');
    // Un uso cobrado (con su crédito al conductor) pero SIN su asiento contra Divoox: el libro no
    // cuadra y el canario se pone en rojo.
    await p.e.m.DB.batch([
      p.e.m.DB.prepare(
        `INSERT INTO usos_saldo_divoox (operacion_id, cliente_id, conductor_id, monto, apartado, pais, estado, cerrado_en)
         VALUES ('op-sin-asiento-xx', 'otro', ?, 100, 100, 'VE', 'cobrado', datetime('now'))`,
      ).bind(p.e.admin.id),
      p.e.m.DB.prepare(
        "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES ('mx', ?, 100, 'regalo', 'saldo-divoox:op-sin-asiento-xx')",
      ).bind(p.e.admin.id),
    ]);
    expect(await saludSaldoClientes(p.e.m.DB)).toBe('error');
  });

  it('2b: el caso del prepago no se cierra con «resolver»: solo devolviendo con referencia o diciendo por qué no corresponde', async () => {
    const p = await preparar();
    await p.cargar(500, { motivo: 'prepago', comprobante: 'REF-PREPAGO-2' });
    expect(
      (await p.e.m.llamar('DELETE', '/datos/cuentas/yo?saldo=acepto', undefined, p.e.cliente.token))
        .estado,
    ).toBe(200);
    const lista = await p.e.m.llamar(
      'GET',
      '/datos/admin/bandeja-dinero?tipo=incidencia',
      undefined,
      p.e.admin.token,
    );
    const caso = (lista.datos.casos as { clave: string; acciones: string[] }[]).find((x) =>
      x.acciones.includes('saldo_devuelto'),
    );
    // El panel pinta los botones que manda el servidor: «Marcar resuelto» no aparece.
    expect(caso?.acciones).toEqual(['tomar', 'nota', 'saldo_devuelto', 'saldo_no_corresponde']);
    const accion = (accion: string, nota: string, idem: string) =>
      p.e.m.llamar(
        'POST',
        `/datos/admin/bandeja-dinero/${encodeURIComponent(caso?.clave ?? '')}/acciones`,
        { accion, nota, idempotencia: idem },
        p.e.admin.token,
      );
    expect((await accion('resolver', 'Ya quedó listo', 'resolver-1-abc')).estado).toBe(409);
    const sinRef = await accion('saldo_devuelto', 'Le devolvimos el dinero', 'devolver-2-abc');
    expect(sinRef.estado).toBe(422);
    expect(sinRef.datos.error).toMatch(/referencia|reference/);
    const no = await accion(
      'saldo_no_corresponde',
      'El cliente pidió por escrito no recibir la devolución (correo del 25 nov)',
      'no-corresponde-1',
    );
    expect(no.estado).toBe(200);
    const inc = await p.e.m.DB.prepare(
      "SELECT estado FROM incidencias_dinero WHERE tipo = 'saldo_cliente_por_devolver'",
    ).first<{ estado: string }>();
    expect(inc?.estado).toBe('resuelta');
    const aud = await p.e.m.DB.prepare(
      "SELECT actor_id, detalle_json FROM finanzas_auditoria WHERE accion = 'saldo_cliente.no_corresponde_devolver'",
    ).first<{ actor_id: string; detalle_json: string }>();
    expect(aud?.actor_id).toBe(p.e.admin.id);
    expect(JSON.parse(aud?.detalle_json ?? '{}')).toMatchObject({ porDevolver: 500 });
    // Sin dinero movido: ningún asiento de devolución.
    const asiento = await p.e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM libro WHERE concepto = 'saldo_cliente_prepago_devuelto'",
    ).first<{ n: number }>();
    expect(asiento?.n).toBe(0);
  });

  it('3b: un uso del saldo que quedó abierto: si el viaje no se hizo vuelve y se borra; si se hizo, 409 en palabras', async () => {
    const p = await preparar();
    await p.cargar(1000);
    const c = await conductorListoVe(p.e, 2000);
    const { id } = await hastaIniciar(p, c, { metodoPago: 'efectivo', usarSaldo: true });
    await recorrer(p, c.rep.id, id);
    expect((await c.paso(id, 'terminar')).estado).toBe(200);
    // El viaje terminó pero el cierre del saldo «se cortó»: el uso sigue apartado.
    await p.e.m.DB.prepare(
      "UPDATE usos_saldo_divoox SET estado = 'apartado', monto = 0, cerrado_en = NULL WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    const borrar = () =>
      p.e.m.llamar('DELETE', '/datos/cuentas/yo?saldo=acepto', undefined, p.e.cliente.token, {
        'x-idioma': 'es',
      });
    const r = await borrar();
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/todavía estamos cerrando/);
    expect((await usoDe(p, id))?.estado).toBe('apartado');
  });

  it('3b2: un uso abierto de un viaje cancelado se devuelve y la cuenta se borra cerrando el saldo', async () => {
    const p = await preparar();
    await p.cargar(1000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
    });
    const id = v.datos.viaje.id as string;
    // La cancelación se hizo pero la devolución «se cortó» (el uso quedó apartado sin su devolución).
    await p.e.m.DB.prepare(
      "UPDATE usos_saldo_divoox SET estado = 'apartado' WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    const { cambiarEstadoViaje } = await import('../operaciones');
    expect(
      await cambiarEstadoViaje(p.e.m.DB, {
        operacionId: id,
        desde: 'buscando',
        hacia: 'sin_conductor',
        actor: 'sistema',
        actorId: null,
        clave: 'prueba-borrar-sin-conductor',
      }),
    ).toBe(true);
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBeLessThan(1000);
    const r = await p.e.m.llamar(
      'DELETE',
      '/datos/cuentas/yo?saldo=acepto',
      undefined,
      p.e.cliente.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect((await usoDe(p, id))?.estado).toBe('liberado');
    expect(await saldoDeCliente(p.e.m.DB, p.e.cliente.id)).toBe(0);
    expect(await saludSaldoClientes(p.e.m.DB)).toBe('ok');
  });

  it('3c: si el saldo cambia entre la lectura y el lote del borrado, 409 en palabras y no se borra nada', async () => {
    const p = await preparar();
    await p.cargar(900);
    const { borrarCuenta } = await import('../borrarCuenta');
    const real = p.e.m.DB;
    let hecho = false;
    const cambia = new Proxy(real, {
      get(t, k) {
        if (k === 'batch')
          return async (s: D1PreparedStatement[]) => {
            // Justo antes del lote grande del borrado, el equipo le carga saldo.
            if (s.length > 3 && !hecho) {
              hecho = true;
              await p.cargar(100);
            }
            return t.batch(s);
          };
        const v = Reflect.get(t, k) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    const u = await real
      .prepare('SELECT id, correo, rol, nombre FROM usuarios WHERE id = ?')
      .bind(p.e.cliente.id)
      .first<{ id: string; correo: string; rol: string; nombre: string }>();
    const error = await borrarCuenta({} as never, cambia, u as never, {
      saldoAceptado: true,
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ estado: 409 });
    expect(String((error as Error).message)).toMatch(/Tu Saldo Divoox cambió/);
    expect(await saldoDeCliente(real, p.e.cliente.id)).toBe(1000);
    const sigue = await real
      .prepare('SELECT activo FROM usuarios WHERE id = ?')
      .bind(p.e.cliente.id)
      .first<{ activo: number }>();
    expect(sigue?.activo).toBe(1);
  });

  it('3: el cierre del saldo va en el mismo lote que el borrado: si el borrado falla, el saldo sigue', async () => {
    const p = await preparar();
    await p.cargar(900);
    const { borrarCuenta } = await import('../borrarCuenta');
    const real = p.e.m.DB;
    const falla = new Proxy(real, {
      get(t, k) {
        if (k === 'batch')
          return async (s: D1PreparedStatement[]) => {
            // Los lotes chicos pasan; el del borrado (muchas sentencias) se corta.
            if (s.length > 3) throw new Error('corte a mitad del borrado');
            return t.batch(s);
          };
        const v = Reflect.get(t, k) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    const u = await real
      .prepare('SELECT id, correo FROM usuarios WHERE id = ?')
      .bind(p.e.cliente.id)
      .first<{ id: string; correo: string }>();
    await expect(
      borrarCuenta({ BUCKET: undefined } as never, falla, u!, { saldoAceptado: true }),
    ).rejects.toThrow(/corte/);
    expect(await saldoDeCliente(real, p.e.cliente.id)).toBe(900);
  });
});

describe('C-SALDO-CLIENTE (ajustes finales): regalo y saldo en el mismo viaje', () => {
  it('4: si el saldo frena al conductor, el regalo que tomó se suelta (no le cuenta para su tope)', async () => {
    const p = await preparar();
    await conRegaloCodigo(p, 100);
    await p.cargar(500);
    const c = await conductorListoVe(p.e, 2000);
    const q = await p.cotizar();
    const v = await p.pasajero('POST', '/datos/viajes', {
      cotizacionId: q.id,
      metodoPago: 'efectivo',
      usarSaldo: true,
      regalo: 'SALDOREG',
    });
    const id = v.datos.viaje.id as string;
    for (let i = 0; i < TOPE_DIARIO_SALDO_CONDUCTOR; i++)
      await p.e.m.DB.prepare(
        `INSERT INTO usos_saldo_divoox (operacion_id, cliente_id, conductor_id, monto, apartado, pais, estado, tomado_en)
         VALUES (?, 'otro-cliente', ?, 100, 100, 'VE', 'cobrado', datetime('now'))`,
      )
        .bind(`op-tope4-${i}-xxxxxx`, c.rep.id)
        .run();
    expect((await c.paso(id, 'aceptar')).estado).toBe(409);
    const regalo = await p.e.m.DB.prepare(
      'SELECT conductor_id, tomado_en FROM usos_cupon_divoox WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ conductor_id: string | null; tomado_en: string | null }>();
    expect(regalo).toEqual({ conductor_id: null, tomado_en: null });
  });
});
