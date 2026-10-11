import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

describe('lista de espera de la landing', () => {
  it('anota a los tres públicos, con su zona si está cerca', async () => {
    const m = mundo();
    const c = await m.llamar('POST', '/datos/lista-espera', {
      tipo: 'comensal',
      nombre: 'Ana',
      correo: 'Ana@Ejemplo.com',
      ciudad: 'Miami',
      lat: 25.77,
      lng: -80.19,
    });
    expect(c.estado).toBe(201);
    expect(c.datos.zona.id).toBe('US-FL-MIAMI');
    expect(
      (
        await m.llamar('POST', '/datos/lista-espera', {
          tipo: 'restaurante',
          nombre: 'Rosa',
          correo: 'rosa@ejemplo.com',
          ciudad: 'Miami',
          negocio: 'Sabor',
          telefono: '3055550000',
        })
      ).estado,
    ).toBe(201);
    expect(
      (
        await m.llamar('POST', '/datos/lista-espera', {
          tipo: 'repartidor',
          nombre: 'Leo',
          correo: 'leo@ejemplo.com',
          ciudad: 'Ocala',
          telefono: '3525550000',
          vehiculo: 'moto',
        })
      ).estado,
    ).toBe(201);
    const porCiudad = await m.DB.prepare(
      "SELECT zona_id FROM lista_espera WHERE tipo = 'restaurante'",
    ).first<{ zona_id: string }>();
    expect(porCiudad?.zona_id).toBe('US-FL-MIAMI');
    const admin = await m.cuenta('admin');
    const lista = await m.llamar('GET', '/datos/admin/lista-espera', undefined, admin.token);
    expect(lista.datos.totales).toEqual({ comensal: 1, restaurante: 1, repartidor: 1 });
  });

  it('anotarse dos veces actualiza en vez de fallar', async () => {
    const m = mundo();
    const datos = { tipo: 'comensal', nombre: 'Ana', correo: 'ana@ejemplo.com', ciudad: 'Miami' };
    await m.llamar('POST', '/datos/lista-espera', datos);
    expect(
      (await m.llamar('POST', '/datos/lista-espera', { ...datos, ciudad: 'Doral' })).estado,
    ).toBe(201);
    const fila = await m.DB.prepare(
      'SELECT COUNT(*) AS n, MAX(ciudad) AS ciudad FROM lista_espera',
    ).first();
    expect(fila).toEqual({ n: 1, ciudad: 'Doral' });
  });

  it('pide los datos que cada público necesita y solo el admin ve la lista', async () => {
    const m = mundo();
    const sinNegocio = await m.llamar('POST', '/datos/lista-espera', {
      tipo: 'restaurante',
      nombre: 'Rosa',
      correo: 'r@ejemplo.com',
      ciudad: 'Miami',
      telefono: '3055550000',
    });
    expect(sinNegocio.datos.campo).toBe('negocio');
    const sinTel = await m.llamar('POST', '/datos/lista-espera', {
      tipo: 'repartidor',
      nombre: 'Leo',
      correo: 'l@ejemplo.com',
      ciudad: 'Miami',
    });
    expect(sinTel.datos.campo).toBe('telefono');
    const cliente = await m.cuenta('cliente');
    expect(
      (await m.llamar('GET', '/datos/admin/lista-espera', undefined, cliente.token)).estado,
    ).toBe(403);
  });
});
