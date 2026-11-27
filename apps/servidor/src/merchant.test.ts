import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * Divoox Merchant (27 nov 2026) · todos los países. Una sola app para todos los comercios.
 * C-MERCHANT-TIPO: un comercio nuevo sale con el tipo que eligió (nunca «restaurante» si no lo es),
 * editar sus datos nunca lo devuelve a restaurante, y los restaurantes de siempre siguen igual.
 * C-MERCHANT-CARGA: la carga masiva rechaza las filas malas sin perder las buenas.
 */
describe('C-MERCHANT-TIPO · el tipo de negocio', () => {
  it('una farmacia nueva nace farmacia y sigue farmacia al editar sus datos', async () => {
    const m = mundo();
    const d = await m.cuenta('restaurante');
    const alta = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Farmacia Central', tipoComercio: 'farmacia' },
      d.token,
    );
    expect(alta.estado).toBe(201);
    expect(alta.datos.restaurante.tipoComercio).toBe('farmacia');
    // La app vieja edita sin mandar el tipo: se queda farmacia.
    const editar = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Farmacia Central 2' },
      d.token,
    );
    expect(editar.estado).toBe(200);
    expect(editar.datos.restaurante.tipoComercio).toBe('farmacia');
    const leer = await m.llamar('GET', '/datos/mi-restaurante', undefined, d.token);
    expect(leer.datos.restaurante.tipoComercio).toBe('farmacia');
  });

  it('cada tipo del alta se guarda tal cual, también «Otro»', async () => {
    for (const tipo of ['mercado', 'licores', 'ferreteria', 'tienda', 'otro']) {
      const m = mundo();
      const d = await m.cuenta('restaurante');
      const r = await m.llamar(
        'PUT',
        '/datos/mi-restaurante',
        { ...RESTAURANTE_BASE, tipoComercio: tipo },
        d.token,
      );
      expect(r.datos.restaurante.tipoComercio).toBe(tipo);
    }
  });

  it('un tipo inventado se rechaza en la casilla del tipo', async () => {
    const m = mundo();
    const d = await m.cuenta('restaurante');
    const r = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, tipoComercio: 'casino' },
      d.token,
    );
    expect(r.estado).toBe(400);
  });

  it('el restaurante de siempre (sin tipo) sigue restaurante', async () => {
    const m = mundo();
    const d = await m.cuenta('restaurante');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, d.token);
    expect(r.datos.restaurante.tipoComercio).toBe('restaurante');
  });
});

describe('C-MERCHANT-CARGA · la carga masiva no pierde las filas buenas', () => {
  it('con filas malas en medio, guarda todas las buenas y dice qué fila falló', async () => {
    const m = mundo();
    const d = await m.cuenta('restaurante');
    await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, tipoComercio: 'ferreteria' },
      d.token,
    );
    const hoja = [
      'sku,barcode,name,brand,size,size_unit,category_1,price,available,stock_quantity,restriction',
      'F1,,Martillo,Marca Ejemplo,1,each,Herramientas,12.50,yes,8,',
      'F2,,,Marca Ejemplo,1,each,Herramientas,3,yes,,',
      'F3,,Clavos,Marca Ejemplo,1,lb,Herramientas,abc,yes,,',
      'F4,,Destornillador,Marca Ejemplo,1,each,Herramientas,6,yes,,',
      'F5,,Cinta métrica,Marca Ejemplo,5,m,Herramientas,4.75,no,0,',
    ].join('\n');
    const r = await m.llamar(
      'POST',
      '/datos/mi-restaurante/productos/importar',
      { csv: hoja, confirmar: true },
      d.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({ nuevos: 3, guardado: true, totalErrores: 2 });
    expect(r.datos.errores.map((e: { fila: number }) => e.fila)).toEqual([3, 4]);
    const lista = await m.llamar('GET', '/datos/mi-restaurante/productos', undefined, d.token);
    expect(lista.datos.totales.productos).toBe(3);
    const nombres = (lista.datos.productos as { nombreEs: string; nombreEn: string }[]).map(
      (p) => p.nombreEs || p.nombreEn,
    );
    expect(nombres.sort()).toEqual(['Cinta métrica', 'Destornillador', 'Martillo']);
  });
});
