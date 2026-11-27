import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import {
  CLAVE_REPARACION_VEHICULOS_DE_REPARTO,
  repararVehiculosDeReparto,
} from './vehiculoDeReparto';

/**
 * C-VEHICULO-DE-REPARTO (27 nov 2026, Richard en Michigan): guardó su moto en «Datos para Comida y
 * Envíos» y el panel decía «todavía no registra ninguno». Rojo comprobado el 27 nov 2026 sin la
 * creación del vehículo real.
 */
const MOTO = {
  vehiculoTipo: 'moto',
  marca: 'Yamaha',
  modelo: '150',
  anio: 2003,
  color: 'Negro',
  placa: 'ab-123',
  licenciaNumero: 'D1234567',
  licenciaEstado: 'MI',
};

describe('C-VEHICULO-DE-REPARTO', () => {
  it('la moto escrita en «Datos para Comida y Envíos» queda como su vehículo real', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Richard Prueba');
    const r = await m.llamar('PUT', '/datos/repartidor/datos', MOTO, rep.token);
    expect(r.estado).toBe(200);
    const v = await m.llamar('GET', '/datos/conductor/vehiculos', undefined, rep.token);
    expect(v.datos.vehiculos).toHaveLength(1);
    expect(v.datos.vehiculos[0]).toMatchObject({
      tipo: 'moto',
      marca: 'Yamaha',
      anio: 2003,
      placa: 'AB123',
      estado: 'registrado',
    });
    // Guardar otra vez no crea un segundo vehículo.
    await m.llamar('PUT', '/datos/repartidor/datos', MOTO, rep.token);
    const otra = await m.llamar('GET', '/datos/conductor/vehiculos', undefined, rep.token);
    expect(otra.datos.vehiculos).toHaveLength(1);
  });

  it('la reparación crea el vehículo a quien ya lo había guardado así, una sola vez', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Richard Prueba');
    await m.DB.prepare(
      "INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, marca, modelo, anio, color, placa) VALUES (?, 'moto', 'Yamaha', '150', 2003, 'Negro', 'AB123')",
    )
      .bind(rep.id)
      .run();
    await m.DB.prepare('DELETE FROM config WHERE clave = ?')
      .bind(CLAVE_REPARACION_VEHICULOS_DE_REPARTO)
      .run();
    expect(await repararVehiculosDeReparto(m.DB)).toEqual([rep.id]);
    expect(await repararVehiculosDeReparto(m.DB)).toBeNull();
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM vehiculos WHERE conductor_id = ?')
      .bind(rep.id)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
});
