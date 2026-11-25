import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

type ZonaLista = {
  id: string;
  municipioNombre: string;
  municipioClave: string;
  municipio: { pcode: string } | null;
};

const VIGIA = {
  id: 'VE-MER-EJEMPLO',
  nombre: 'Ciudad de ejemplo',
  pais: 'VE',
  lat: 8.6159,
  lng: -71.6442,
  radioKm: 10,
  activa: false,
  region: 'MER',
  idioma: 'es',
};

/**
 * C-ZONA-MUNICIPIO (24 nov 2026): al crear o editar una zona se elige y se guarda su municipio (de la
 * lista oficial del país o escrito a mano), se ve en la lista y sirve para filtrar. Todos los países.
 */
describe('C-ZONA-MUNICIPIO · el municipio de cada zona', () => {
  async function lista(m: ReturnType<typeof mundo>, token: string) {
    const r = await m.llamar('GET', '/datos/admin/zonas', undefined, token);
    return r.datos.zonas as ZonaLista[];
  }

  it('al crear la zona se guarda el municipio elegido (oficial en Venezuela, a mano en EE. UU.)', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const r = await m.llamar(
      'PUT',
      '/datos/admin/zonas',
      { ...VIGIA, municipio: 'El Vigía' },
      admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    const us = await m.llamar(
      'PUT',
      '/datos/admin/zonas',
      {
        id: 'US-MI-EJEMPLO',
        nombre: 'Ciudad de ejemplo US',
        pais: 'US',
        lat: 42.48,
        lng: -83.47,
        radioKm: 20,
        activa: false,
        region: 'MI',
        municipio: 'Oakland County',
      },
      admin.token,
    );
    expect(us.estado).toBe(200);
    const zonas = await lista(m, admin.token);
    const ve = zonas.find((z) => z.id === 'VE-MER-EJEMPLO');
    expect(ve?.municipioNombre).toBe('Alberto Adriani');
    expect(ve?.municipioClave).toBe('alberto-adriani');
    expect(ve?.municipio?.pcode).toBe('VE1401');
    const mi = zonas.find((z) => z.id === 'US-MI-EJEMPLO');
    expect(mi?.municipioNombre).toBe('Oakland County');
    expect(mi?.municipio).toBeNull();
    const f = await m.DB.prepare('SELECT municipio FROM zonas WHERE id = ?')
      .bind('US-MI-EJEMPLO')
      .first<{ municipio: string }>();
    expect(f?.municipio).toBe('Oakland County');
  });

  it('al editar se cambia (Tucaní, o uno escrito a mano) y editar sin municipio no lo borra', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    await m.llamar('PUT', '/datos/admin/zonas', { ...VIGIA, municipio: 'El Vigía' }, admin.token);
    const p = await m.llamar(
      'PATCH',
      '/datos/admin/zonas/VE-MER-EJEMPLO',
      { municipio: 'Tucaní' },
      admin.token,
    );
    expect(p.estado, JSON.stringify(p.datos)).toBe(200);
    let z = (await lista(m, admin.token)).find((x) => x.id === 'VE-MER-EJEMPLO');
    expect(z?.municipioNombre).toBe('Caracciolo Parra Olmedo');
    expect(z?.municipio?.pcode).toBe('VE1407');
    await m.llamar(
      'PATCH',
      '/datos/admin/zonas/VE-MER-EJEMPLO',
      { municipio: 'Municipio Nuevo' },
      admin.token,
    );
    // Editar la zona con el formulario sin escribir municipio deja el que tenía.
    await m.llamar('PUT', '/datos/admin/zonas', { ...VIGIA, nombre: 'Otro nombre' }, admin.token);
    z = (await lista(m, admin.token)).find((x) => x.id === 'VE-MER-EJEMPLO');
    expect(z?.municipioNombre).toBe('Municipio Nuevo');
    // Solo el equipo: un cliente no lo cambia.
    const cliente = await m.cuenta('cliente');
    expect(
      (
        await m.llamar(
          'PATCH',
          '/datos/admin/zonas/VE-MER-EJEMPLO',
          { municipio: 'Libertador' },
          cliente.token,
        )
      ).estado,
    ).toBe(403);
  });
});
