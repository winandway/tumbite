import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { FOTO_EVIDENCIA, achicarFotoEvidencia } from '../../../packages/movil/src/fotoLiviana';

/**
 * C-FOTO-EVIDENCIA-LIVIANA y C-FOTOS-AL-COMERCIO (15 nov 2026, prueba real de Richard en Novi):
 * la foto del restaurante tardaba en subir (salía en tamaño completo del teléfono) y el restaurante
 * no veía las fotos del pedido; su pantalla se quedaba en «Recogido / En camino». Todos los países.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('la foto de prueba se achica en el teléfono (C-FOTO-EVIDENCIA-LIVIANA)', () => {
  it('una foto de 12 megapíxeles sale a 1280 px de lado mayor y JPEG 0,6', async () => {
    const manipular = vi.fn(async () => ({ uri: 'file:///chica.jpg' }));
    const uri = await achicarFotoEvidencia(
      { uri: 'file:///grande.jpg', width: 4032, height: 3024 },
      manipular,
      'jpeg',
    );
    expect(uri).toBe('file:///chica.jpg');
    expect(manipular).toHaveBeenCalledWith(
      'file:///grande.jpg',
      [{ resize: { width: 1280, height: 960 } }],
      { compress: 0.6, format: 'jpeg' },
    );
    expect(FOTO_EVIDENCIA).toEqual({ lado: 1280, calidad: 0.6 });
  });

  it('si achicar falla se sube la original: la foto nunca se pierde', async () => {
    const uri = await achicarFotoEvidencia(
      { uri: 'file:///grande.jpg', width: 4032, height: 3024 },
      async () => {
        throw new Error('sin memoria');
      },
      'jpeg',
    );
    expect(uri).toBe('file:///grande.jpg');
  });

  it('el Driver achica todas las fotos de un pedido, de Envíos y de Flex antes de subirlas', () => {
    const inicio = leer('apps/repartidor/src/Inicio.tsx');
    // tomarFoto (recogida, entrega, ticket) y la foto del chat.
    expect(inicio.match(/achicarFotoEvidencia\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    // La ubicación se pide mientras la cámara está abierta, no después.
    expect(inicio.indexOf('const ubicacion = ubicacionConLimite();')).toBeGreaterThan(0);
    expect(inicio.indexOf('const ubicacion = ubicacionConLimite();')).toBeLessThan(
      inicio.indexOf('quality: 0.5,\n        ...(frontal'),
    );
    // La recogida también se reintenta sola sin señal.
    expect(inicio).toContain("ruta.includes('/foto-recogida')");
    const viaje = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    expect(viaje.match(/achicarFotoEvidencia\(/g)?.length ?? 0).toBe(2);
    const ruta = leer('apps/repartidor/src/flex/MiRuta.tsx');
    expect(ruta).toContain('FOTO_EVIDENCIA.lado');
    expect(ruta).not.toContain('base64: true,\n    });\n    const a = r.canceled');
  });
});

describe('el restaurante ve las dos fotos del pedido (C-FOTOS-AL-COMERCIO)', () => {
  it('la app del restaurante muestra «Entregado al cliente» y las fotos al recoger y al entregar', () => {
    const app = leer('apps/restaurante/src/Inicio.tsx');
    expect(app).toContain('<FotosDelPedido');
    expect(app).toMatch(
      /\(p\.estado === 'en_camino' \|\| p\.estado === 'entregado'\) && p\.entrega !== 'recoger'/,
    );
    expect(app).toContain('recogida={p.fotoRecogida}');
    expect(app).toContain('entrega={p.fotoEntrega}');
    const textos = leer('apps/restaurante/src/piezas/textos.ts');
    expect(textos).toContain("entregadoCliente: 'Entregado al cliente'");
    expect(textos).toContain("entregadoCliente: 'Delivered to the customer'");
  });

  it('la pieza del celular y la del panel piden la MISMA foto guardada, sin copiarla', () => {
    for (const r of [
      'packages/movil/src/FotosDelPedido.tsx',
      'apps/panel/src/panel/FotosDelPedido.tsx',
    ]) {
      const f = leer(r);
      expect(f).toContain('/datos/pedidos/${pedidoId}/evidencia/${tipo}');
      expect(f).toContain("recogida: 'Al recoger'");
      expect(f).toContain("entrega: 'Al entregar'");
      expect(f).toContain("recogida: 'At pickup'");
      expect(f).toContain("entrega: 'At drop-off'");
    }
    expect(leer('apps/panel/src/panel/Pedidos.tsx')).toContain('<FotosDelPedido');
  });
});
