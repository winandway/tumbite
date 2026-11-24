import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { ORIGEN_CCS, abrirCaracas, conductorListoVe, escenarioVe, subirA } from '../pruebas/motoVe';
import {
  CLAVE_REPARACION_SERVICIOS_VEHICULO,
  repararServiciosVehiculo,
} from '../reparacionServiciosVehiculo';

/**
 * C-SERVICIOS-DEL-VEHICULO (23 nov 2026, Tucaní). Un envío quedó «buscando» con cero ofertas: el único
 * conductor de la zona tenía la moto aprobada, en plazo de papeles y conectado, pero solo «moto»
 * encendido (su preferencia de Envíos nunca se creó). Lo que el vehículo en uso permite sin otro
 * registro queda encendido solo, sin pisar a quien lo apagó.
 */
const PAQUETE = {
  descripcion: 'Una caja con documentos',
  valorDeclarado: 2_000,
  destinatario: { nombre: 'Persona que recibe', telefono: '04140000000' },
  sinProhibidos: true,
};

async function escenario() {
  const e = await escenarioVe();
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, e.admin.token);
  // Envíos abierto en la misma ciudad, con su tarifa (como lo abre el equipo).
  await equipo('PUT', '/datos/admin/servicios/envios', { estado: 'disponible' });
  await equipo('PUT', `/datos/admin/servicios/envios/zonas/${CCS.id}`, { estado: 'disponible' });
  const t = await equipo('POST', '/datos/admin/viajes/tarifas', {
    servicio: 'envios',
    zona: CCS.id,
    tarifa: { base: 100, porKm: 40, porMinuto: 5, minimo: 200, valorMaximo: 10_000 },
    motivo: 'Tarifa de prueba',
  });
  expect(t.estado, JSON.stringify(t.datos)).toBeLessThan(300);
  const conductor = async (nombre = 'Conductor de ejemplo') => {
    const rep = await e.m.cuenta('repartidor', nombre);
    const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
      e.m.llamar(metodo, ruta, cuerpo, rep.token);
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
    await yo('GET', '/datos/conductor/verificacion');
    const v = await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Motos Divoox',
      modelo: 'M150',
      anio: 2023,
      color: 'Negro',
      placa: `AB${Math.floor(Math.random() * 1e6)}`,
      placaEstado: 'FL',
    });
    expect(v.estado).toBe(201);
    const id = v.datos.id as string;
    await subirA(e, `/datos/conductor/vehiculos/${id}/documentos?tipo=registro`, rep.token);
    const aprobar = async () => {
      const cola = await equipo('GET', '/datos/admin/vehiculos?estado=en_revision');
      const fila = cola.datos.vehiculos.find((x: { id: string }) => x.id === id);
      for (const d of fila.documentos)
        await equipo('PUT', `/datos/admin/vehiculos/${id}/documentos/${d.id}`, {
          estado: 'aprobado',
          venceEn: '2030-01-01',
        });
      return equipo('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' });
    };
    const preferencia = async (servicio: string) =>
      (
        await e.m.DB.prepare(
          'SELECT activa FROM preferencias_servicio WHERE conductor_id = ? AND servicio_id = ?',
        )
          .bind(rep.id, servicio)
          .first<{ activa: number }>()
      )?.activa ?? null;
    return { rep, yo, id, aprobar, preferencia };
  };
  return { e, conductor };
}

describe('C-SERVICIOS-DEL-VEHICULO: lo que su vehículo permite queda encendido solo', () => {
  it('conductor con moto aprobada recibe la oferta de un envío sin haber tocado nada', async () => {
    const s = await escenario();
    // Aprobado como lo hace el equipo (identidad, papeles y la moto), con saldo y conectado en la
    // recogida. Nadie toca el interruptor de Envíos.
    const c = await conductorListoVe(s.e, 1_000, 'Conductor de Envíos');
    const pref = await s.e.m.DB.prepare(
      "SELECT activa FROM preferencias_servicio WHERE conductor_id = ? AND servicio_id = 'envios'",
    )
      .bind(c.rep.id)
      .first<{ activa: number }>();
    expect(pref?.activa).toBe(1);
    const cot = await s.e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      {
        servicio: 'envios',
        origen: ORIGEN_CCS,
        destino: { lat: 10.4906, lng: -66.8806, direccion: 'Destino' },
      },
      s.e.cliente.token,
    );
    expect(cot.estado, JSON.stringify(cot.datos)).toBe(201);
    const v = await s.e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.datos.cotizacion.id, metodoPago: 'efectivo', paquete: PAQUETE },
      s.e.cliente.token,
    );
    expect(v.estado, JSON.stringify(v.datos)).toBe(201);
    const oferta = await s.e.m.DB.prepare(
      'SELECT 1 FROM ofertas_operacion WHERE operacion_id = ? AND conductor_id = ?',
    )
      .bind(v.datos.viaje.id, c.rep.id)
      .first();
    expect(oferta).not.toBeNull();
  });

  it('si él apagó Envíos, aprobar otra vez no se lo enciende', async () => {
    const s = await escenario();
    const c = await s.conductor();
    await s.e.m.DB.prepare(
      "INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'envios', 0)",
    )
      .bind(c.rep.id)
      .run();
    await c.aprobar();
    expect(await c.preferencia('envios')).toBe(0);
  });

  it('la reparación enciende Envíos a quien ya estaba aprobado, una sola vez, y no toca cuentas de prueba', async () => {
    const s = await escenario();
    const real = await s.conductor('Conductor real');
    const prueba = await s.conductor('Conductor de prueba');
    for (const c of [real, prueba]) {
      await c.aprobar();
      // Como quedaron antes del cambio: solo «moto».
      await s.e.m.DB.prepare(
        "DELETE FROM preferencias_servicio WHERE conductor_id = ? AND servicio_id = 'envios'",
      )
        .bind(c.rep.id)
        .run();
    }
    await s.e.m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?')
      .bind(prueba.rep.id)
      .run();
    await s.e.m.DB.prepare('DELETE FROM config WHERE clave = ?')
      .bind(CLAVE_REPARACION_SERVICIOS_VEHICULO)
      .run();
    expect(await repararServiciosVehiculo(s.e.m.DB)).toEqual([real.rep.id]);
    expect(await real.preferencia('envios')).toBe(1);
    expect(await prueba.preferencia('envios')).toBeNull();
    expect(await repararServiciosVehiculo(s.e.m.DB)).toBeNull();
  });
});
