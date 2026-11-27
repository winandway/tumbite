import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, subirA } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';

/**
 * C-VERIFICACIONES-VEHICULOS (25 nov 2026, Richard: «Verificaciones verifica TODO… no hay dónde ver ni
 * aprobar vehículos») — todos los países. La pestaña «Vehículos» de Verificaciones lista los que esperan
 * revisión y los que quedaron «registrado, sin enviar», con sus totales y su buscador; el número del
 * menú cuenta a la persona aunque no haya empezado su verificación de identidad, y baja al aprobar.
 */
async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  const conductor = async (nombre: string) => {
    const rep = await m.cuenta('repartidor', nombre);
    const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
      m.llamar(metodo, ruta, cuerpo, rep.token);
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
    // Cuenta real (no de prueba), para que cuente en el menú.
    await m.DB.prepare('UPDATE usuarios SET es_prueba = 0 WHERE id = ?').bind(rep.id).run();
    const placa = `VX${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
    const v = await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Motos Divoox',
      modelo: 'M150',
      anio: 2023,
      color: 'Negro',
      placa,
      placaEstado: 'FL',
    });
    return { rep, id: v.datos.id as string, placa };
  };
  const menu = async () => {
    const r = await equipo('GET', '/datos/panel/avisos');
    return (
      (r.datos.menu as { clave: string; cantidad: number }[]).find(
        (x) => x.clave === 'verifications',
      )?.cantidad ?? 0
    );
  };
  return { m, e, equipo, conductor, menu };
}

describe('C-VERIFICACIONES-VEHICULOS: los vehículos se verifican en Verificaciones', () => {
  it('el que espera revisión cuenta en el menú (sin verificación de identidad), se busca y baja al aprobar', async () => {
    const s = await escenario();
    const antes = await s.menu();
    const c = await s.conductor('Conductor Sin Identidad');
    await subirA(s.e, `/datos/conductor/vehiculos/${c.id}/documentos?tipo=registro`, c.rep.token);
    expect(await s.menu()).toBe(antes + 1);
    const lista = await s.equipo('GET', '/datos/admin/vehiculos?estado=en_revision&cuentas=reales');
    expect(lista.datos.totales.en_revision).toBeGreaterThanOrEqual(1);
    expect(lista.datos.vehiculos.some((v: { id: string }) => v.id === c.id)).toBe(true);
    // El buscador encuentra por la placa y por el nombre, sin acentos ni mayúsculas.
    const porPlaca = await s.equipo(
      'GET',
      `/datos/admin/vehiculos?estado=en_revision&q=${c.placa.toLowerCase()}`,
    );
    expect(porPlaca.datos.vehiculos.map((v: { id: string }) => v.id)).toEqual([c.id]);
    const porNombre = await s.equipo(
      'GET',
      '/datos/admin/vehiculos?estado=en_revision&q=sin%20ident',
    );
    expect(porNombre.datos.vehiculos.map((v: { id: string }) => v.id)).toEqual([c.id]);
    // Aprobar desde ahí mismo (las rutas de siempre): el número del menú baja.
    for (const d of lista.datos.vehiculos.find((v: { id: string }) => v.id === c.id).documentos)
      await s.equipo('PUT', `/datos/admin/vehiculos/${c.id}/documentos/${d.id}`, {
        estado: 'aprobado',
        venceEn: '2030-01-01',
      });
    expect(
      (await s.equipo('PUT', `/datos/admin/vehiculos/${c.id}`, { estado: 'aprobado' })).estado,
    ).toBe(200);
    expect(await s.menu()).toBe(antes);
  });

  it('el «registrado, sin enviar» sale en su lista con su total, y no cuenta como tarea del equipo', async () => {
    const s = await escenario();
    const antes = await s.menu();
    const c = await s.conductor('Conductor A Medias');
    const lista = await s.equipo('GET', '/datos/admin/vehiculos?estado=registrado&cuentas=reales');
    expect(lista.datos.vehiculos.some((v: { id: string }) => v.id === c.id)).toBe(true);
    expect(lista.datos.totales.registrado).toBeGreaterThanOrEqual(1);
    // Le toca al conductor enviarlo: el número del menú (tareas del equipo) no sube.
    expect(await s.menu()).toBe(antes);
  });
});
