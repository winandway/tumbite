import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, empresa, envios, llamar, ruta, vincular } from '../pruebas/flex';

/**
 * C-FLEX-PRIMEROS-PASOS (1 nov 2026): el inicio del panel sabe qué pasos ya hizo la empresa (como
 * los asistentes de arranque de Onfleet y Spoke): centro, conductor, envío, ruta asignada y entrega.
 */
describe('primeros pasos de la empresa', () => {
  it('el resumen cuenta las rutas y las rutas con conductor', async () => {
    const m = mundo();
    const e = await empresa(m);
    const leer = async () =>
      (await llamar(m, 'GET', `${B}/empresas/${e.id}`, undefined, e.dueno.token)).datos.resumen;
    expect(await leer()).toMatchObject({ centros: 1, conductores: 0, rutas: 0, rutasAsignadas: 0 });
    const rep = await m.cuenta('repartidor', 'Rita Ruta');
    await vincular(m, e, rep.id, 'propio');
    const id = await ruta(m, e, await envios(m, e, 2));
    expect(await leer()).toMatchObject({ conductores: 1, envios: 2, rutas: 1, rutasAsignadas: 0 });
    const a = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${id}/asignar`,
      { conductorId: rep.id },
      e.dueno.token,
    );
    expect(a.estado).toBe(200);
    expect(await leer()).toMatchObject({ rutas: 1, rutasAsignadas: 1 });
  });
});
