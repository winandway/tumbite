import { describe, expect, it } from 'vitest';
import { abrirCaracas, conductorListoVe, escenarioVe, pedirMotoVe } from '../pruebas/motoVe';

/**
 * C-FICHA-TODOS-LOS-SERVICIOS (24 nov 2026, Gerencia mirando un conductor real) — todos los países. La
 * ficha del conductor decía Entregas 0, Ganado 0, Saldo 0,00 y Calificación «—» a un conductor que
 * terminó un viaje de Moto de 1,00 USD, con 4,90 de saldo prepago y 5 estrellas de un pasajero: las
 * tarjetas solo contaban comida. Ahora cuentan viajes y entregas, lo que le quedó al conductor, su
 * saldo prepago (libro) y las estrellas de los pasajeros.
 */
describe('C-FICHA-TODOS-LOS-SERVICIOS: la ficha dice la verdad de todos los servicios', () => {
  it('un viaje de Moto terminado y calificado cuenta en la ficha', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const c = await conductorListoVe(e, 300);
    const v = await pedirMotoVe(e, 'efectivo');
    const comision = Math.round(v.total / 10);
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await c.paso(v.id, 'llegue')).estado).toBe(200);
    const pin = (await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token)).datos
      .viaje.pin;
    expect((await c.paso(v.id, 'iniciar', { pin })).estado).toBe(200);
    expect((await c.paso(v.id, 'terminar')).estado).toBe(200);
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/viajes/${v.id}/calificar`,
          { estrellas: 5 },
          e.cliente.token,
        )
      ).estado,
    ).toBe(200);

    const f = (
      await e.m.llamar('GET', `/datos/admin/repartidores/${c.rep.id}`, undefined, e.admin.token)
    ).datos.repartidor;
    expect(f.entregas).toBe(1);
    expect(f.porMoneda).toEqual([
      expect.objectContaining({ moneda: 'USD', entregas: 1, ganado: v.total - comision }),
    ]);
    expect(f.ganado).toBe(v.total - comision);
    expect(f.saldoPrepago).toEqual({ monto: 300 - comision, moneda: 'USD' });
    expect(f.calificacion).toBe(5);
    expect(f.calificaciones).toBe(1);
  });
});
