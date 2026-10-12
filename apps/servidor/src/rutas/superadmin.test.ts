import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { codigoCiudad, estadoVencimiento } from './superadmin';

describe('superadmin a escala (C-SUPERADMIN-ESCALA)', () => {
  it('cada repartidor recibe su ID País-Ciudad-número, seguido y sin repetirse', async () => {
    const m = mundo();
    const a = await m.cuenta('repartidor', 'Ana Rep');
    const b = await m.cuenta('repartidor', 'Beto Rep');
    const ra = await m.llamar('GET', '/datos/repartidor/datos', undefined, a.token);
    const rb = await m.llamar('GET', '/datos/repartidor/datos', undefined, b.token);
    expect(ra.datos.codigo).toBe('US-MIA-000001');
    expect(rb.datos.codigo).toBe('US-MIA-000002');
    // Pedirlo otra vez no cambia el número.
    expect(
      (await m.llamar('GET', '/datos/repartidor/datos', undefined, a.token)).datos.codigo,
    ).toBe('US-MIA-000001');
  });

  it('el repartidor guarda su vehículo, licencia y seguro; con motor exige placa y licencia', async () => {
    const m = mundo();
    const r = await m.cuenta('repartidor');
    const sinPlaca = await m.llamar(
      'PUT',
      '/datos/repartidor/datos',
      { vehiculoTipo: 'moto' },
      r.token,
    );
    expect(sinPlaca.estado).toBe(400);
    expect(sinPlaca.datos.campo).toBe('placa');
    const ok = await m.llamar(
      'PUT',
      '/datos/repartidor/datos',
      {
        vehiculoTipo: 'moto',
        marca: 'Honda',
        modelo: 'Navi',
        anio: 2023,
        color: 'Rojo',
        placa: 'ab123c',
        licenciaNumero: 'L000000',
        licenciaEstado: 'FL',
        licenciaVence: '2030-01-01',
        seguroAseguradora: 'Aseguradora Ejemplo',
        seguroPoliza: 'P-0000',
        seguroVence: '2020-01-01',
      },
      r.token,
    );
    expect(ok.estado).toBe(200);
    const d = (await m.llamar('GET', '/datos/repartidor/datos', undefined, r.token)).datos.datos;
    expect(d).toMatchObject({
      placa: 'AB123C',
      estadoLicencia: 'vigente',
      estadoSeguro: 'vencido',
    });
  });

  it('el superadmin ve ciudades, busca repartidores por ID o nombre y abre su ficha; nadie más', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const r = await m.cuenta('repartidor', 'Carla Veloz');
    await m.llamar('GET', '/datos/repartidor/datos', undefined, r.token);
    const cliente = await m.cuenta('cliente', 'Diego Cliente');
    for (const ruta of [
      '/datos/admin/ciudades',
      '/datos/admin/repartidores',
      '/datos/admin/clientes',
    ])
      expect((await m.llamar('GET', ruta, undefined, cliente.token)).estado).toBe(403);

    const ciudades = await m.llamar('GET', '/datos/admin/ciudades', undefined, admin.token);
    expect(
      ciudades.datos.ciudades.find((z: { id: string }) => z.id === 'US-FL-MIAMI'),
    ).toMatchObject({
      codigo: 'MIA',
      repartidores: 1,
    });
    const porId = await m.llamar(
      'GET',
      '/datos/admin/repartidores?q=US-MIA-0000',
      undefined,
      admin.token,
    );
    expect(porId.datos.repartidores[0].nombre).toBe('Carla Veloz');
    const porNumero = await m.llamar(
      'GET',
      '/datos/admin/repartidores?q=1',
      undefined,
      admin.token,
    );
    expect(porNumero.datos.repartidores[0].codigo).toBe('US-MIA-000001');
    const porNombre = await m.llamar(
      'GET',
      '/datos/admin/repartidores?q=carl',
      undefined,
      admin.token,
    );
    expect(porNombre.datos.repartidores).toHaveLength(1);
    const ficha = await m.llamar(
      'GET',
      `/datos/admin/repartidores/${r.id}`,
      undefined,
      admin.token,
    );
    expect(ficha.datos.repartidor).toMatchObject({ codigo: 'US-MIA-000001', entregas: 0 });
    // Revisión de antecedentes y seguro de Tumbite.
    await m.llamar(
      'PATCH',
      `/datos/admin/repartidores/${r.id}`,
      { antecedentes: 'aprobado', seguroTumbite: true },
      admin.token,
    );
    const despues = await m.llamar(
      'GET',
      `/datos/admin/repartidores/${r.id}`,
      undefined,
      admin.token,
    );
    expect(despues.datos.repartidor.datos).toMatchObject({
      antecedentes: 'aprobado',
      estadoSeguro: 'vigente',
    });

    const clientes = await m.llamar('GET', '/datos/admin/clientes?q=dieg', undefined, admin.token);
    expect(clientes.datos.clientes).toHaveLength(1);
    const fc = await m.llamar('GET', `/datos/admin/clientes/${cliente.id}`, undefined, admin.token);
    expect(fc.datos.cliente).toMatchObject({ nombre: 'Diego Cliente', pedidos: 0 });
  });

  it('las listas se pagan de a 50 con «siguiente», sin saltos ni repetidos', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    for (let i = 0; i < 55; i++)
      await m.DB.prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, ?, 'cliente', 'x')",
      )
        .bind(crypto.randomUUID(), `c${i}@ejemplo.com`, `Cliente ${i}`)
        .run();
    const p1 = await m.llamar('GET', '/datos/admin/clientes', undefined, admin.token);
    expect(p1.datos.clientes).toHaveLength(50);
    const p2 = await m.llamar(
      'GET',
      `/datos/admin/clientes?despues=${p1.datos.siguiente}`,
      undefined,
      admin.token,
    );
    expect(p2.datos.clientes).toHaveLength(5);
    expect(p2.datos.siguiente).toBeNull();
    const ids = new Set(
      [...p1.datos.clientes, ...p2.datos.clientes].map((x: { id: string }) => x.id),
    );
    expect(ids.size).toBe(55);
  });

  it('códigos de ciudad y vencimientos', () => {
    expect(codigoCiudad({ nombre: 'Novi (pruebas)' })).toBe('NOV');
    expect(codigoCiudad({ codigo_ciudad: 'ord', nombre: 'Orlando' })).toBe('ORD');
    expect(estadoVencimiento('2026-10-20', '2026-10-12')).toBe('por_vencer');
    expect(estadoVencimiento('2026-10-01', '2026-10-12')).toBe('vencido');
    expect(estadoVencimiento(null)).toBe('sin_datos');
  });
});
