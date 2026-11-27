import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, subirA } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import { ESQUEMA_FASE3 } from './esquemaFase3';
import { aprobadosNoElegibles, saludAprobadosNoElegibles, sqlAptos } from './aprobadosNoElegibles';

/**
 * C-APROBADOS-NO-ELEGIBLES (23 nov 2026, Richard): el canario ve en rojo a quien tiene la moto
 * aprobada y aun así no recibiría viajes, con su motivo; y dice lo MISMO que el reparto.
 */
async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  await yo('GET', '/datos/conductor/verificacion');
  const v = await yo('POST', '/datos/conductor/vehiculos', {
    tipo: 'moto',
    marca: 'Motos Divoox',
    modelo: 'M150',
    anio: 2023,
    color: 'Negro',
    placa: `AB${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
    placaEstado: 'FL',
  });
  const id = v.datos.id as string;
  await subirA(e, `/datos/conductor/vehiculos/${id}/documentos?tipo=registro`, rep.token);
  const cola = await equipo('GET', '/datos/admin/vehiculos?estado=en_revision');
  const fila = cola.datos.vehiculos.find((x: { id: string }) => x.id === id);
  for (const d of fila.documentos)
    await equipo('PUT', `/datos/admin/vehiculos/${id}/documentos/${d.id}`, {
      estado: 'aprobado',
      venceEn: '2030-01-01',
    });
  expect((await equipo('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' })).estado).toBe(
    200,
  );
  const elegibleConectado = async () => {
    await m.DB.prepare(
      "UPDATE repartidores SET conectado = 1, lat = 10.5, lng = -66.9, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(rep.id)
      .run();
    const f = await m.DB.prepare('SELECT 1 AS si FROM conductores_elegibles WHERE conductor_id = ?')
      .bind(rep.id)
      .first<{ si: number }>();
    await m.DB.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?')
      .bind(rep.id)
      .run();
    return Boolean(f);
  };
  return { m, rep, id, elegibleConectado };
}

describe('C-APROBADOS-NO-ELEGIBLES: el canario dice lo mismo que el reparto', () => {
  it('la vista de aptos sale del mismo texto del reparto y se rompe si la vista cambia de forma', () => {
    const vista = ESQUEMA_FASE3.find((s) => s.includes('conductores_elegibles AS'));
    expect(sqlAptos()).not.toContain('conectado = 1');
    expect(sqlAptos()).toContain('preferencias_servicio');
    expect(() => sqlAptos(vista?.replace('d.conectado = 1', 'd.conectado <> 0'))).toThrow(
      /cambió de forma/,
    );
  });

  it('moto aprobada y lista: fuera del canario, y el reparto la toma al conectarse', async () => {
    const s = await escenario();
    expect(await aprobadosNoElegibles(s.m.DB)).toEqual([]);
    expect(await saludAprobadosNoElegibles(s.m.DB)).toBe('ok');
    expect(await s.elegibleConectado()).toBe(true);
  });

  it('moto aprobada sin vehículo activo: rojo con su motivo, y el reparto tampoco la toma', async () => {
    const s = await escenario();
    await s.m.DB.prepare('UPDATE repartidores SET vehiculo_activo_id = NULL WHERE usuario_id = ?')
      .bind(s.rep.id)
      .run();
    const lista = await aprobadosNoElegibles(s.m.DB);
    expect(lista.map((x) => [x.conductorId, x.motivo])).toEqual([
      [s.rep.id, 'sin_vehiculo_activo'],
    ]);
    expect(await saludAprobadosNoElegibles(s.m.DB)).toBe('error');
    expect(await s.elegibleConectado()).toBe(false);
  });

  it('Moto apagada por el conductor: rojo «servicio_apagado»; una cuenta de prueba no pone rojo', async () => {
    const s = await escenario();
    await s.m.DB.prepare('UPDATE preferencias_servicio SET activa = 0 WHERE conductor_id = ?')
      .bind(s.rep.id)
      .run();
    expect((await aprobadosNoElegibles(s.m.DB))[0]?.motivo).toBe('servicio_apagado');
    expect(await s.elegibleConectado()).toBe(false);
    await s.m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?').bind(s.rep.id).run();
    expect(await saludAprobadosNoElegibles(s.m.DB)).toBe('ok');
  });
});

describe('C-APROBADOS-NO-ELEGIBLES en la salud y el panel', () => {
  it('la salud lo muestra en rojo sin dar 503, y el panel lo lista con su motivo', async () => {
    const s = await escenario();
    await s.m.DB.prepare('UPDATE repartidores SET vehiculo_activo_id = NULL WHERE usuario_id = ?')
      .bind(s.rep.id)
      .run();
    const salud = await s.m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.aprobadosNoElegibles).toBe('error');
    const admin = await s.m.cuenta('admin', 'Soporte Divoox');
    const panel = await s.m.llamar(
      'GET',
      '/datos/admin/repartidores/no-elegibles',
      undefined,
      admin.token,
    );
    expect(panel.estado).toBe(200);
    expect(panel.datos.conductores.map((x: { motivo: string }) => x.motivo)).toEqual([
      'sin_vehiculo_activo',
    ]);
    const conductor = await s.m.llamar(
      'GET',
      '/datos/admin/repartidores/no-elegibles',
      undefined,
      s.rep.token,
    );
    expect(conductor.estado).toBe(403);
  });
});
