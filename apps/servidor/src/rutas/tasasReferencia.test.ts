import { describe, expect, it } from 'vitest';
import { equivalenteLocal } from '@tumbite/compartido';
import { abrirCaracas, conductorListoVe, escenarioVe, pedirMotoVe } from '../pruebas/motoVe';

/**
 * C-BS-REFERENCIA (13 nov 2026, Venezuela): el precio de Moto en dólares lleva al lado su
 * equivalente en bolívares con la tasa que el equipo escribe en el panel. Solo informativo.
 */
describe('C-BS-REFERENCIA: bolívares de referencia en la cotización, el viaje y el cobro', () => {
  it('sin tasa no hay equivalente; con tasa del equipo aparece en todos lados y la comisión no cambia', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const sin = await pedirMotoVe(e, 'efectivo');
    expect(sin.cotizacion.referencia).toBeNull();
    await e.m.llamar('POST', `/datos/viajes/${sin.id}/cancelar`, {}, e.cliente.token, {
      'idempotency-key': 'cancelar-sin-tasa-1',
    });
    // El equipo escribe la tasa del día.
    const puesta = await e.m.llamar(
      'PUT',
      '/datos/admin/tasas-referencia/VE',
      { tasa: 36.5 },
      e.admin.token,
    );
    expect(puesta.estado).toBe(200);
    const lista = await e.m.llamar(
      'GET',
      '/datos/admin/tasas-referencia',
      undefined,
      e.admin.token,
    );
    expect(lista.datos.tasas[0]).toMatchObject({
      pais: 'VE',
      moneda: 'VES',
      tasa: 36.5,
      puestaPor: 'Soporte Divoox',
      vigente: true,
    });
    const c = await conductorListoVe(e, 500);
    const v = await pedirMotoVe(e, 'efectivo');
    const esperado = {
      moneda: 'VES',
      monto: equivalenteLocal(v.total, 36.5),
      tasa: 36.5,
      fecha: puesta.datos.fecha,
    };
    expect(v.cotizacion.referencia).toEqual(esperado);
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    const vista = await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token);
    expect(vista.datos.viaje.referencia).toEqual(esperado);
    const actual = await c.yo('GET', '/datos/conductor/operaciones/actual');
    expect(actual.datos.operacion.referencia).toEqual(esperado);
    await c.paso(v.id, 'llegue');
    await c.paso(v.id, 'iniciar', { pin: vista.datos.viaje.pin });
    const fin = await c.paso(v.id, 'terminar');
    expect(fin.datos.referencia).toEqual(esperado);
    // La comisión sigue en dólares, sobre el precio en dólares.
    const saldo = await c.yo('GET', '/datos/repartidor/saldo-prepago');
    expect(saldo.datos.disponible).toBe(500 - Math.round(v.total / 10));
  });

  it('una tasa de más de 48 horas no se muestra (nunca un número viejo)', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 36.5 }, e.admin.token);
    await e.m.DB.prepare(
      "UPDATE tasas_cambio SET creado_en = datetime('now', '-49 hours') WHERE fuente = 'equipo'",
    ).run();
    const v = await pedirMotoVe(e, 'efectivo');
    expect(v.cotizacion.referencia).toBeNull();
    const lista = await e.m.llamar(
      'GET',
      '/datos/admin/tasas-referencia',
      undefined,
      e.admin.token,
    );
    expect(lista.datos.tasas[0].vigente).toBe(false);
  });

  it('solo el equipo la escribe, y solo donde hace falta', async () => {
    const e = await escenarioVe();
    expect(
      (await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 36.5 }, e.cliente.token))
        .estado,
    ).toBe(403);
    expect(
      (await e.m.llamar('PUT', '/datos/admin/tasas-referencia/US', { tasa: 1 }, e.admin.token))
        .estado,
    ).toBe(422);
    expect(
      (await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 0 }, e.admin.token))
        .estado,
    ).toBe(400);
  });
});
