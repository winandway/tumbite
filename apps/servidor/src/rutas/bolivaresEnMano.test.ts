import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS, equivalenteLocal } from '@tumbite/compartido';
import {
  ORIGEN_CCS,
  abrirCaracas,
  cargarPagoMovilVe,
  conductorListoVe,
  escenarioVe,
} from '../pruebas/motoVe';

/**
 * C-BS-EN-MANO (18 nov 2026, Venezuela): todo lo que se cobra o se paga en mano se ve en dólares Y en
 * bolívares con la tasa FIJADA con el viaje. Conductor y pasajero ven el mismo número aunque la tasa
 * cambie después, y lo cobrado queda guardado con el viaje (tasa, fecha y monto).
 */
const APARATO = 'aparato-bs-en-mano-1';

async function preparar() {
  const e = await escenarioVe();
  await abrirCaracas(e);
  await e.m.DB.prepare(
    "UPDATE usuarios SET telefono = '+584120000001', telefono_canonico = '584120000001' WHERE id = ?",
  )
    .bind(e.cliente.id)
    .run();
  const tasa = await e.m.llamar(
    'PUT',
    '/datos/admin/tasas-referencia/VE',
    { tasa: 236.4567 },
    e.admin.token,
  );
  expect(tasa.estado).toBe(200);
  const pasajero = (metodo: string, ruta: string, cuerpo?: unknown, extra = {}) =>
    e.m.llamar(metodo, ruta, cuerpo, e.cliente.token, { 'x-aparato': APARATO, ...extra });
  return { e, pasajero, fecha: tasa.datos.fecha as string };
}

async function conRegalo(e: Awaited<ReturnType<typeof escenarioVe>>, valor: number) {
  const r = await e.m.llamar(
    'POST',
    '/datos/admin/regalos-divoox',
    {
      codigo: 'BSMANO',
      nombreEs: 'Regalo de prueba',
      nombreEn: 'Test gift',
      tipo: 'monto',
      valor,
      servicios: ['moto'],
      zonas: [CCS.id],
      venceEn: null,
      presupuesto: 10_000,
      bienvenida: true,
    },
    e.admin.token,
  );
  expect(r.estado).toBe(201);
  await e.m.llamar('PATCH', '/datos/admin/regalos-divoox/BSMANO', { activo: true }, e.admin.token);
}

describe('C-BS-EN-MANO: dólares y bolívares con la tasa fijada del viaje', () => {
  it('con regalo: la diferencia en las dos monedas, la misma para los dos, y fija aunque cambie la tasa', async () => {
    const { e, pasajero, fecha } = await preparar();
    await conRegalo(e, 113);
    const c = await conductorListoVe(e, 2000);
    await cargarPagoMovilVe(c);
    const cot = await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN_CCS,
      destino: { lat: 10.4806, lng: -66.8406, direccion: 'Destino' },
    });
    expect(cot.estado).toBe(201);
    const q = cot.datos.cotizacion;
    expect(q.regalo).toMatchObject({ monto: 113 });
    const diferencia = q.total - 113;
    const local = { moneda: 'VES', tasa: 236.4567, fecha };
    const esperado = { ...local, monto: equivalenteLocal(diferencia, 236.4567) };
    expect(q.tasaLocal).toEqual(local);
    expect(q.enMano).toEqual({ monto: diferencia, moneda: 'USD', local: esperado, sinTasa: false });
    const v = await pasajero(
      'POST',
      '/datos/viajes',
      { cotizacionId: q.id, metodoPago: 'pago_movil', regalo: q.regalo.codigo },
      { 'idempotency-key': `pedir-bs-${q.id.slice(0, 10)}` },
    );
    expect(v.estado).toBe(201);
    const id = v.datos.viaje.id as string;
    const oferta = await c.yo('GET', '/datos/conductor/operaciones/ofertas');
    expect(oferta.datos.ofertas[0].enMano).toEqual(q.enMano);
    expect((await c.paso(id, 'aceptar')).estado).toBe(200);
    // El equipo cambia la tasa a mitad del viaje: el viaje conserva la suya.
    await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 300 }, e.admin.token);
    const actual = (await c.yo('GET', '/datos/conductor/operaciones/actual')).datos.operacion;
    expect(actual.en_mano).toEqual(q.enMano);
    expect(actual.referencia).toEqual(esperado);
    expect(actual.total_local).toEqual({ ...local, monto: equivalenteLocal(q.total, 236.4567) });
    const vista = (await pasajero('GET', '/datos/viajes/actual')).datos.viaje;
    expect(vista.enMano).toEqual(q.enMano);
    await c.paso(id, 'llegue');
    await c.paso(id, 'iniciar', { pin: vista.pin });
    const fin = await c.paso(id, 'terminar');
    expect(fin.estado).toBe(200);
    const cobrado = fin.datos.cobrarEnMano as number;
    const final = { ...local, monto: equivalenteLocal(cobrado, 236.4567) };
    expect(fin.datos.referencia).toEqual(final);
    expect(fin.datos.enMano).toEqual({
      monto: cobrado,
      moneda: 'USD',
      local: final,
      sinTasa: false,
    });
    // Guardado con el viaje: tasa, fecha y monto.
    const fila = await e.m.DB.prepare(
      'SELECT ref_tasa, ref_fecha, ref_monto FROM viajes WHERE operacion_id = ?',
    )
      .bind(id)
      .first();
    expect(fila).toEqual({ ref_tasa: 236.4567, ref_fecha: fecha, ref_monto: final.monto });
    // El recibo y «Mis viajes» de los dos dicen lo mismo.
    const detalle = (await pasajero('GET', `/datos/viajes/${id}`)).datos.viaje;
    expect(detalle.enMano.local).toEqual(final);
    const historial = await pasajero('GET', '/datos/viajes/historial');
    expect(historial.datos.viajes[0].enManoLocal).toEqual(final);
    const recibo = await pasajero('GET', `/datos/viajes/${id}/recibo`);
    expect(recibo.datos.recibo.enManoLocal).toEqual(final);
    const suyo = await c.yo('GET', '/datos/conductor/viajes/historial');
    expect(suyo.datos.viajes[0].enManoLocal).toEqual(final);
    const reciboSuyo = await c.yo('GET', `/datos/conductor/viajes/${id}/recibo`);
    expect(reciboSuyo.datos.recibo.enManoLocal).toEqual(final);
  });

  it('sin tasa vigente lo dice (sinTasa) y no inventa un número; nada se guarda en bolívares', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const c = await conductorListoVe(e, 2000);
    const cot = await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      {
        servicio: 'moto',
        origen: ORIGEN_CCS,
        destino: { lat: 10.4806, lng: -66.8406, direccion: 'Destino' },
      },
      e.cliente.token,
    );
    const q = cot.datos.cotizacion;
    expect(q.tasaLocal).toBeNull();
    expect(q.enMano).toMatchObject({ monto: q.total, local: null, sinTasa: true });
    const v = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: q.id, metodoPago: 'efectivo' },
      e.cliente.token,
    );
    const id = v.datos.viaje.id as string;
    await c.paso(id, 'aceptar');
    const actual = (await c.yo('GET', '/datos/conductor/operaciones/actual')).datos.operacion;
    expect(actual.en_mano).toMatchObject({ local: null, sinTasa: true });
    const vista = (await e.m.llamar('GET', `/datos/viajes/${id}`, undefined, e.cliente.token)).datos
      .viaje;
    expect(vista.enMano).toMatchObject({ local: null, sinTasa: true });
    await c.paso(id, 'llegue');
    await c.paso(id, 'iniciar', { pin: vista.pin });
    const fin = await c.paso(id, 'terminar');
    expect(fin.datos.enMano).toMatchObject({ local: null, sinTasa: true });
    const fila = await e.m.DB.prepare(
      'SELECT ref_tasa, ref_monto FROM viajes WHERE operacion_id = ?',
    )
      .bind(id)
      .first();
    expect(fila).toEqual({ ref_tasa: null, ref_monto: null });
  });

  it('un viaje cotizado sin tasa la fija al terminar si ya hay una', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const c = await conductorListoVe(e, 2000);
    const cot = await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      {
        servicio: 'moto',
        origen: ORIGEN_CCS,
        destino: { lat: 10.4806, lng: -66.8406, direccion: 'Destino' },
      },
      e.cliente.token,
    );
    const v = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.datos.cotizacion.id, metodoPago: 'efectivo' },
      e.cliente.token,
    );
    const id = v.datos.viaje.id as string;
    await c.paso(id, 'aceptar');
    const puesta = await e.m.llamar(
      'PUT',
      '/datos/admin/tasas-referencia/VE',
      { tasa: 40 },
      e.admin.token,
    );
    const vista = (await e.m.llamar('GET', `/datos/viajes/${id}`, undefined, e.cliente.token)).datos
      .viaje;
    await c.paso(id, 'llegue');
    await c.paso(id, 'iniciar', { pin: vista.pin });
    const fin = await c.paso(id, 'terminar');
    const monto = equivalenteLocal(fin.datos.cobrarEnMano as number, 40);
    expect(fin.datos.referencia).toEqual({
      moneda: 'VES',
      tasa: 40,
      fecha: puesta.datos.fecha,
      monto,
    });
    const fila = await e.m.DB.prepare(
      'SELECT ref_tasa, ref_fecha, ref_monto FROM viajes WHERE operacion_id = ?',
    )
      .bind(id)
      .first();
    expect(fila).toEqual({ ref_tasa: 40, ref_fecha: puesta.datos.fecha, ref_monto: monto });
  });
});
