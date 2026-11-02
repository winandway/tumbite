import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-CALORIAS (2 nov 2026), como Uber Eats: calorías opcionales por plato (la ley federal de EE. UU.
 * las exige a cadenas de 20 o más locales). Se guardan al crear y al editar, salen en el menú
 * público y quedan vacías si el restaurante no las pone. EE. UU.
 */
describe('calorías por plato', () => {
  it('se guardan, se editan, se quitan y salen en el menú público', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    await m.abrir(dueno.token);
    const nuevo = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pizza', precioCentavos: 1200, calorias: 520 },
      dueno.token,
    );
    expect(nuevo.estado).toBe(201);
    expect(nuevo.datos.plato.calorias).toBe(520);
    const id = nuevo.datos.plato.id as string;
    let menu = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    expect(menu.datos.platos[0].calorias).toBe(520);

    const sin = await m.llamar(
      'PUT',
      `/datos/mi-restaurante/platos/${id}`,
      { nombreEs: 'Pizza', precioCentavos: 1200 },
      dueno.token,
    );
    expect(sin.datos.plato.calorias).toBeNull();
    menu = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    expect(menu.datos.platos[0].calorias).toBeNull();
  });

  it('rechaza calorías imposibles', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const r = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pizza', precioCentavos: 1200, calorias: -5 },
      dueno.token,
    );
    expect(r.estado).toBe(400);
  });
});
