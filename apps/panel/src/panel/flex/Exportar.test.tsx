import { describe, expect, it } from 'vitest';
import { exportarCsv } from './Exportar';

/** C-FLEX-EXPORTAR: el panel junta las páginas con el cursor del servidor y lleva los filtros. */
describe('C-FLEX-EXPORTAR · panel', () => {
  it('pide página tras página con el cursor y los filtros puestos, y junta el archivo', async () => {
    const urls: string[] = [];
    const paginas = [
      { texto: 'id,estado\r\na,creado\r\n', siguiente: 'c1', filas: 1 },
      { texto: 'b,creado\r\n', siguiente: '', filas: 1 },
    ];
    const r = await exportarCsv('emp', 'envios', { estado: 'creado', q: '' }, async (url) => {
      urls.push(url);
      const p = paginas[urls.length - 1]!;
      return new Response(p.texto, {
        headers: { 'x-siguiente': p.siguiente, 'x-filas': String(p.filas) },
      });
    });
    expect(urls[0]).toBe('/datos/v1/flex/empresas/emp/exportar/envios?estado=creado');
    expect(urls[1]).toBe('/datos/v1/flex/empresas/emp/exportar/envios?estado=creado&cursor=c1');
    expect(r).toEqual({ texto: 'id,estado\r\na,creado\r\nb,creado\r\n', filas: 2, cortado: false });
  });

  it('se detiene en el tope y lo dice; un error del servidor llega en palabras', async () => {
    let n = 0;
    const r = await exportarCsv('emp', 'paquetes', {}, async () => {
      n++;
      return new Response('x\r\n', { headers: { 'x-siguiente': `c${n}`, 'x-filas': '500' } });
    });
    expect(n).toBe(20);
    expect(r.cortado).toBe(true);
    await expect(
      exportarCsv('emp', 'rutas', {}, async () =>
        Response.json({ error: 'Esa empresa no existe.' }, { status: 404 }),
      ),
    ).rejects.toThrow('Esa empresa no existe.');
  });
});
