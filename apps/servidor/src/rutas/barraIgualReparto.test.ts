import { describe, expect, it } from 'vitest';
import { abrirCaracas, conductorListoVe, escenarioVe } from '../pruebas/motoVe';

/**
 * C-BARRA-IGUAL-REPARTO (24 nov 2026, Gerencia mirando a un conductor real de madrugada) — todos los
 * países. La barra decía «Está recibiendo carreras de Envíos, Moto ahora mismo» y la ficha «En línea»
 * a un conductor con `conectado = 1` pero sin ubicación desde hacía 4 horas: el reparto no le ofrece
 * nada (exige ubicación de los últimos minutos). Y la ficha decía «Habilitación para Carro: Habilitado
 * · No le falta nada para Carro» a quien solo tiene una moto.
 */
describe('C-BARRA-IGUAL-REPARTO: la barra y la ficha dicen lo mismo que el reparto', () => {
  it('conectado con la ubicación de hace horas: ni «ahora mismo» ni «En línea»', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const c = await conductorListoVe(e, 300);
    const equipo = (ruta: string) => e.m.llamar('GET', ruta, undefined, e.admin.token);
    // Recién conectado y con ubicación: sí.
    expect((await equipo(`/datos/admin/conductores/${c.rep.id}/activacion`)).datos).toMatchObject({
      recibiendo: true,
    });
    await e.m.DB.prepare(
      "UPDATE repartidores SET ubicacion_en = datetime('now', '-4 hours') WHERE usuario_id = ?",
    )
      .bind(c.rep.id)
      .run();
    expect((await equipo(`/datos/admin/conductores/${c.rep.id}/activacion`)).datos).toMatchObject({
      recibiendo: false,
    });
    const f = (await equipo(`/datos/admin/repartidores/${c.rep.id}`)).datos.repartidor;
    expect(f.recibeViajes).toBe(false);
    expect((f.faltas as { clave: string }[]).map((x) => x.clave)).toContain('ubicacion_vieja');
  });

  it('con solo una moto, Carro dice que no tiene carro (no «no le falta nada»)', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const c = await conductorListoVe(e, 300);
    const d = (
      await e.m.llamar(
        'GET',
        `/datos/admin/conductores/${c.rep.id}/pasajeros`,
        undefined,
        e.admin.token,
      )
    ).datos as { servicios: { servicioId: string; tieneVehiculo: boolean }[] };
    expect(d.servicios.find((s) => s.servicioId === 'moto')?.tieneVehiculo).toBe(true);
    expect(d.servicios.find((s) => s.servicioId === 'carro')?.tieneVehiculo).toBe(false);
  });
});
