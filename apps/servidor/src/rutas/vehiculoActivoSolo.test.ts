import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, subirA } from '../pruebas/motoVe';
import { mundo } from '../pruebas/ayuda';
import {
  CLAVE_REPARACION_VEHICULO_ACTIVO,
  repararVehiculoActivo,
} from '../reparacionVehiculoActivo';

/**
 * C-VEHICULO-ACTIVO-SOLO (23 nov 2026, Gerencia por Richard: «la moto aprobada y única debe quedar
 * activa sola, para todos»). Un conductor real de Venezuela con la moto aprobada no recibía viajes
 * porque nunca tocó «Usar este vehículo».
 */
async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  const conductor = async (nombre = 'Conductor de ejemplo') => {
    const rep = await m.cuenta('repartidor', nombre);
    const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
      m.llamar(metodo, ruta, cuerpo, rep.token);
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
    await yo('GET', '/datos/conductor/verificacion');
    const moto = async () => {
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
      // Con el registro llega sola a revisión (C-LLEGA-SOLO-A-REVISION, plazo vigente).
      await subirA(e, `/datos/conductor/vehiculos/${id}/documentos?tipo=registro`, rep.token);
      return id;
    };
    const aprobar = async (id: string) => {
      const cola = await equipo('GET', '/datos/admin/vehiculos?estado=en_revision');
      const fila = cola.datos.vehiculos.find((x: { id: string }) => x.id === id);
      for (const d of fila.documentos)
        await equipo('PUT', `/datos/admin/vehiculos/${id}/documentos/${d.id}`, {
          estado: 'aprobado',
          venceEn: '2030-01-01',
        });
      return equipo('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' });
    };
    const activo = async () =>
      (
        await m.DB.prepare('SELECT vehiculo_activo_id AS v FROM repartidores WHERE usuario_id = ?')
          .bind(rep.id)
          .first<{ v: string | null }>()
      )?.v ?? null;
    const preferencia = async (servicio: string) =>
      (
        await m.DB.prepare(
          'SELECT activa FROM preferencias_servicio WHERE conductor_id = ? AND servicio_id = ?',
        )
          .bind(rep.id, servicio)
          .first<{ activa: number }>()
      )?.activa ?? null;
    return { rep, yo, moto, aprobar, activo, preferencia };
  };
  return { m, conductor };
}

describe('C-VEHICULO-ACTIVO-SOLO: el vehículo aprobado queda activo solo', () => {
  it('aprobar su única moto la deja activa y Moto elegido, listo para conectarse', async () => {
    const s = await escenario();
    const c = await s.conductor();
    const id = await c.moto();
    expect(await c.activo()).toBeNull();
    const r = await c.aprobar(id);
    expect(r.estado).toBe(200);
    expect(r.datos.activo).toBe(true);
    expect(await c.activo()).toBe(id);
    expect(await c.preferencia('moto')).toBe(1);
    const moto = (await c.yo('GET', '/datos/conductor/servicios')).datos.servicios.find(
      (x: { servicioId: string }) => x.servicioId === 'moto',
    );
    expect(moto.puedeActivar).toBe(true);
  });

  it('con otro vehículo activo y válido no se le cambia, y si él apagó Moto no se le enciende', async () => {
    const s = await escenario();
    const c = await s.conductor();
    const primera = await c.moto();
    await c.aprobar(primera);
    expect(await c.activo()).toBe(primera);
    await s.m.DB.prepare(
      "UPDATE preferencias_servicio SET activa = 0 WHERE conductor_id = ? AND servicio_id = 'moto'",
    )
      .bind(c.rep.id)
      .run();
    const segunda = await c.moto();
    const r = await c.aprobar(segunda);
    expect(r.datos.activo).toBe(false);
    expect(await c.activo()).toBe(primera);
    expect(await c.preferencia('moto')).toBe(0);
  });

  it('la reparación corre una vez, deja activo el único aprobado y no toca cuentas de prueba ni de revisión', async () => {
    const s = await escenario();
    const real = await s.conductor('Conductor real');
    const prueba = await s.conductor('Conductor de prueba');
    const revisor = await s.conductor('Revisor de la tienda');
    const motos = new Map<string, string>();
    for (const c of [real, prueba, revisor]) {
      const id = await c.moto();
      await c.aprobar(id);
      motos.set(c.rep.id, id);
      // Como quedaron antes del cambio: aprobada pero sin activo.
      await s.m.DB.prepare('UPDATE repartidores SET vehiculo_activo_id = NULL WHERE usuario_id = ?')
        .bind(c.rep.id)
        .run();
      await s.m.DB.prepare('DELETE FROM preferencias_servicio WHERE conductor_id = ?')
        .bind(c.rep.id)
        .run();
    }
    await s.m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?')
      .bind(prueba.rep.id)
      .run();
    await s.m.DB.prepare(
      "INSERT INTO revisores (correo, rol) SELECT correo, 'repartidor' FROM usuarios WHERE id = ?",
    )
      .bind(revisor.rep.id)
      .run();
    await s.m.DB.prepare('DELETE FROM config WHERE clave = ?')
      .bind(CLAVE_REPARACION_VEHICULO_ACTIVO)
      .run();
    expect(await repararVehiculoActivo(s.m.DB)).toEqual([real.rep.id]);
    expect(await real.activo()).toBe(motos.get(real.rep.id));
    expect(await real.preferencia('moto')).toBe(1);
    expect(await prueba.activo()).toBeNull();
    expect(await revisor.activo()).toBeNull();
    expect(await repararVehiculoActivo(s.m.DB)).toBeNull();
  });
});
