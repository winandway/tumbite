import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * C-TIENDAS-CATALOGO · todos los países: el comercio elige su tipo y sube su catálogo (planilla
 * estándar o uno por uno), con vista previa y errores por fila; nunca se borra, se agota; las tiendas
 * no salen entre los restaurantes.
 */
async function tienda(m: ReturnType<typeof mundo>, tipo = 'mercado') {
  const dueno = await m.cuenta('restaurante');
  expect(
    (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token)).estado,
  ).toBe(201);
  expect((await m.llamar('PUT', '/datos/mi-restaurante/tipo', { tipo }, dueno.token)).estado).toBe(
    200,
  );
  return dueno;
}

const HOJA = [
  'sku,barcode,name,brand,size,size_unit,category_1,price,available,stock_quantity,restriction',
  'A1,012000161155,Spring water,Brand Sample,500,mL,Drinks,1.25,yes,24,',
  'A2,012000161156,Bad barcode,Brand Sample,1,each,Drinks,2,yes,,',
  'A3,,Beer,Brand Sample,355,mL,Drinks,2.50,yes,,alcohol',
  'A4,,Rx medicine,Brand Sample,1,each,Pharmacy,9,yes,,prescription',
].join('\n');

describe('C-TIENDAS-CATALOGO · catálogo de tiendas', () => {
  it('la planilla: vista previa sin guardar, después guarda solo las filas válidas', async () => {
    const m = mundo();
    const d = await tienda(m);
    const previa = await m.llamar(
      'POST',
      '/datos/mi-restaurante/productos/importar',
      { csv: HOJA },
      d.token,
    );
    expect(previa.estado).toBe(200);
    expect(previa.datos).toMatchObject({
      nuevos: 2,
      actualizados: 0,
      totalErrores: 2,
      guardado: false,
    });
    expect(previa.datos.errores.map((e: { fila: number }) => e.fila)).toEqual([3, 5]);
    expect(
      (await m.llamar('GET', '/datos/mi-restaurante/productos', undefined, d.token)).datos.totales
        .productos,
    ).toBe(0);

    const ok = await m.llamar(
      'POST',
      '/datos/mi-restaurante/productos/importar',
      { csv: HOJA, confirmar: true },
      d.token,
    );
    expect(ok.datos).toMatchObject({ nuevos: 2, guardado: true });
    const lista = await m.llamar('GET', '/datos/mi-restaurante/productos', undefined, d.token);
    expect(lista.datos.totales).toMatchObject({ productos: 2, disponibles: 2 });
    expect(lista.datos.productos.find((p: { sku: string }) => p.sku === 'A1')).toMatchObject({
      nombreEn: 'Spring water',
      precio: 125,
      existencias: 24,
      disponible: true,
    });

    // La misma hoja otra vez con otro precio: actualiza por SKU, no duplica.
    const hoja2 = HOJA.replace('1.25,yes,24', '1.40,yes,10');
    const otra = await m.llamar(
      'POST',
      '/datos/mi-restaurante/productos/importar',
      { csv: hoja2, confirmar: true },
      d.token,
    );
    expect(otra.datos).toMatchObject({ nuevos: 0, actualizados: 2 });
    const busca = await m.llamar(
      'GET',
      '/datos/mi-restaurante/productos?q=012000161155',
      undefined,
      d.token,
    );
    expect(busca.datos.productos).toHaveLength(1);
    expect(busca.datos.productos[0]).toMatchObject({ precio: 140, existencias: 10 });
  });

  it('uno por uno: crear, agotar por hoy y reactivar; receta bloqueada', async () => {
    const m = mundo();
    const d = await tienda(m, 'farmacia');
    const base = {
      sku: 'F1',
      nombreEs: 'Acetaminofén 500 mg',
      marca: 'Marca Ejemplo',
      categoria1: 'Dolor',
      precio: 350,
    };
    const p = await m.llamar('PUT', '/datos/mi-restaurante/productos', base, d.token);
    expect(p.estado).toBe(200);
    const id = p.datos.producto.id as string;
    const ag = await m.llamar(
      'PATCH',
      `/datos/mi-restaurante/productos/${id}/disponible`,
      { disponible: false, hasta: 'hoy' },
      d.token,
    );
    expect(ag.estado).toBe(200);
    const f = await m.DB.prepare(
      'SELECT disponible, agotado_hasta FROM catalogo_ofertas WHERE producto_id = ?',
    )
      .bind(id)
      .first<{ disponible: number; agotado_hasta: string }>();
    expect(f?.disponible).toBe(0);
    expect(f?.agotado_hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const rx = await m.llamar(
      'PUT',
      '/datos/mi-restaurante/productos',
      { ...base, sku: 'F2', restriccion: 'prescription' },
      d.token,
    );
    expect(rx.estado).toBe(422);
    const malo = await m.llamar(
      'PUT',
      '/datos/mi-restaurante/productos',
      { ...base, sku: 'F3', codigoBarras: '7591016816019' },
      d.token,
    );
    expect(malo.estado).toBe(400);
  });

  it('una tienda no sale entre los restaurantes de comida', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const d = await tienda(m);
    const yo = await m.llamar('GET', '/datos/mi-restaurante', undefined, d.token);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${yo.datos.restaurante.id}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const lista = await m.llamar('GET', '/datos/restaurantes');
    expect(lista.datos.restaurantes).toHaveLength(0);
    // Volviendo a restaurante, sí sale.
    await m.llamar('PUT', '/datos/mi-restaurante/tipo', { tipo: 'restaurante' }, d.token);
    expect((await m.llamar('GET', '/datos/restaurantes')).datos.restaurantes).toHaveLength(1);
  });
});
