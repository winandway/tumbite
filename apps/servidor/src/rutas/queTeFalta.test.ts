import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, subirA } from '../pruebas/motoVe';
import { mundo } from '../pruebas/ayuda';
import { contarFilas } from '../presupuestoFilas';

/**
 * C-QUE-TE-FALTA (23 nov 2026) — todos los países. Un conductor real de Venezuela guardó su moto SIN
 * placa, Driver no lo dejaba corregirla y el panel decía «Le falta registrar su vehículo» aunque la
 * tenía. Ahora: la placa se pide al guardar, el vehículo guardado se corrige sin borrarlo, y «qué te
 * falta» sale de UNA pieza del servidor con la regla del reparto (la ve Driver y la ve el panel).
 */
async function conductor(pais: 'VE' | 'US' = 'VE') {
  let conteo!: ReturnType<typeof contarFilas>;
  const m = mundo(
    {},
    { host: 'staging.tumbite.com', envolver: (db) => (conteo = contarFilas(db)).db },
  );
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  if (pais === 'VE') expect((await abrirCaracas(e)).estado).toBe(201);
  const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  if (pais === 'VE')
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  const falta = async () =>
    (
      (await yo('GET', '/datos/conductor/que-te-falta')).datos as {
        faltas: { clave: string; quien: string }[];
      }
    ).faltas.map((x) => x.clave);
  return { m, e, admin, rep, yo, falta, conteo: () => conteo.cuenta };
}

const MOTO = { tipo: 'moto', marca: 'Motos Ejemplo', modelo: 'M150', anio: 2023, color: 'Negro' };

describe('C-QUE-TE-FALTA · la placa', () => {
  it('una moto no se guarda sin placa; el error dice la casilla', async () => {
    const c = await conductor();
    const sin = await c.yo('POST', '/datos/conductor/vehiculos', MOTO);
    expect(sin.estado).toBe(422);
    expect(sin.datos.campo).toBe('placa');
    const con = await c.yo('POST', '/datos/conductor/vehiculos', { ...MOTO, placa: 'AB123CD' });
    expect(con.estado).toBe(201);
  });

  it('en Estados Unidos también se pide el estado que emitió la placa', async () => {
    const c = await conductor('US');
    const r = await c.yo('POST', '/datos/conductor/vehiculos', {
      ...MOTO,
      tipo: 'carro',
      placa: 'ABC1234',
    });
    expect(r.estado).toBe(422);
    expect(r.datos.campo).toBe('placaEstado');
  });

  it('una moto vieja sin placa sale como «sin_placa» y se corrige sin borrarla', async () => {
    const c = await conductor();
    const id = 'vehiculo-viejo-sin-placa';
    await c.m.DB.prepare(
      "INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, placa, placa_estado) VALUES (?, ?, 'moto', 'Motos Ejemplo', 'M150', '', 'VE')",
    )
      .bind(id, c.rep.id)
      .run();
    expect(await c.falta()).toContain('sin_placa');
    const sinPlaca = await c.yo('PUT', `/datos/conductor/vehiculos/${id}`, MOTO);
    expect(sinPlaca.estado).toBe(422);
    const ok = await c.yo('PUT', `/datos/conductor/vehiculos/${id}`, { ...MOTO, placa: 'ab123cd' });
    expect(ok.estado).toBe(200);
    expect(await c.falta()).not.toContain('sin_placa');
    const v = await c.m.DB.prepare('SELECT placa, estado FROM vehiculos WHERE id = ?')
      .bind(id)
      .first<{ placa: string; estado: string }>();
    expect(v).toEqual({ placa: 'AB123CD', estado: 'registrado' });
  });
});

describe('C-QUE-TE-FALTA · lo que le falta, en orden, con la regla del reparto', () => {
  it('Venezuela: primero la cara, después la moto, después activarla; mirar no escribe', async () => {
    const c = await conductor();
    const antes = c.conteo().escritas;
    const primero = await c.falta();
    expect(primero[0]).toBe('cara');
    expect(primero).toContain('sin_vehiculo');
    expect(c.conteo().escritas - antes, 'mirar no escribe').toBeLessThanOrEqual(1); // el plazo, una vez
    expect((await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true })).estado).toBe(200);
    expect(
      (await subirA(c.e, '/datos/conductor/verificacion/foto/cara?origen=camara', c.rep.token))
        .estado,
    ).toBe(201);
    expect((await c.falta())[0]).toBe('sin_vehiculo');
    const v = await c.yo('POST', '/datos/conductor/vehiculos', { ...MOTO, placa: 'AB123CD' });
    // Dentro del plazo la moto registrada se puede usar ya: lo que falta es activarla.
    expect((await c.falta())[0]).toBe('vehiculo_sin_activar');
    expect(
      (await c.yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: v.datos.id })).estado,
    ).toBe(200);
    expect(await c.falta()).not.toEqual(
      expect.arrayContaining(['sin_vehiculo', 'vehiculo_sin_activar', 'cara']),
    );
    // Lecturas medidas: una consulta de «qué te falta» lee poco.
    const leidas = c.conteo().leidas;
    await c.falta();
    expect(c.conteo().leidas - leidas).toBeLessThan(200);
  });

  it('sin plazo: la moto registrada falta enviarla; en revisión, «lo hacemos nosotros»', async () => {
    const c = await conductor('US');
    const v = await c.yo('POST', '/datos/conductor/vehiculos', {
      ...MOTO,
      placa: 'ABC1234',
      placaEstado: 'FL',
    });
    expect(v.estado).toBe(201);
    expect(await c.falta()).toContain('vehiculo_sin_enviar');
    await c.m.DB.prepare("UPDATE vehiculos SET estado = 'en_revision' WHERE id = ?")
      .bind(v.datos.id)
      .run();
    const r = (await c.yo('GET', '/datos/conductor/que-te-falta')).datos.faltas as {
      clave: string;
      quien: string;
    }[];
    expect(r.find((x) => x.clave === 'vehiculo_en_revision')?.quien).toBe('divoox');
    // En revisión no se edita (se respeta el estado).
    expect(
      (
        await c.yo('PUT', `/datos/conductor/vehiculos/${v.datos.id}`, {
          ...MOTO,
          placa: 'ZZZ9999',
          placaEstado: 'FL',
        })
      ).estado,
    ).toBe(409);
  });

  it('la ficha del panel lee la tabla real de vehículos y dice lo mismo que Driver', async () => {
    const c = await conductor();
    await c.yo('POST', '/datos/conductor/vehiculos', { ...MOTO, placa: 'AB123CD' });
    const f = await c.m.llamar(
      'GET',
      `/datos/admin/repartidores/${c.rep.id}`,
      undefined,
      c.admin.token,
    );
    expect(f.estado).toBe(200);
    expect(f.datos.repartidor.vehiculos).toEqual([
      expect.objectContaining({
        tipo: 'moto',
        placa: 'AB123CD',
        estado: 'registrado',
        activo: false,
      }),
    ]);
    expect(f.datos.repartidor.falta).not.toBe('sin_vehiculo');
    expect(f.datos.repartidor.faltas.map((x: { clave: string }) => x.clave)).toEqual(
      await c.falta(),
    );
  });
});
