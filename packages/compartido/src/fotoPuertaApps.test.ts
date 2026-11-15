import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { subirFotoPuertaApp } from '../../movil/src/fotoLiviana';

/**
 * C-FOTO-PUERTA (15 nov 2026) — todos los países. Las apps no corren en vitest: se prueba la
 * conversión común con un convertidor de mentira y se mira el código de las pantallas como candado.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');

const convertidor = (pedidos: { lado: number; compress: number; format: string }[]) =>
  async function manipular(
    _uri: string,
    acciones: { resize: { width: number; height: number } }[],
    op: { compress: number; format: string },
  ) {
    const r = acciones[0]!.resize;
    pedidos.push({ lado: Math.max(r.width, r.height), compress: op.compress, format: op.format });
    return { uri: `file://${r.width}.webp` };
  };

describe('foto de la puerta: conversión y subida en el teléfono', () => {
  it('sube la grande (1024, 0,75) y después la miniatura (200, 0,7), en WebP; nunca la original', async () => {
    const pedidos: { lado: number; compress: number; format: string }[] = [];
    const subidas: { ruta: string; tipo: string }[] = [];
    await subirFotoPuertaApp(
      async (b, ruta) => {
        subidas.push({ ruta: ruta ?? '', tipo: b.type });
        return { url: 'ok' };
      },
      { uri: 'file://original.jpg', width: 4032, height: 3024 },
      convertidor(pedidos),
      'webp',
      '/datos/mis-direcciones/d1/fotos/1',
      async () => new Blob([new Uint8Array(4)], { type: 'image/webp' }),
    );
    expect(pedidos).toEqual([
      { lado: 1024, compress: 0.75, format: 'webp' },
      { lado: 200, compress: 0.7, format: 'webp' },
    ]);
    expect(subidas).toEqual([
      { ruta: '/datos/mis-direcciones/d1/fotos/1', tipo: 'image/webp' },
      { ruta: '/datos/mis-direcciones/d1/fotos/1?tam=mini', tipo: 'image/webp' },
    ]);
  });

  it('una foto chica no se agranda', async () => {
    const pedidos: { lado: number; compress: number; format: string }[] = [];
    await subirFotoPuertaApp(
      async () => ({ url: 'ok' }),
      { uri: 'file://chica.jpg', width: 800, height: 600 },
      convertidor(pedidos),
      'webp',
      '/datos/mis-direcciones/d1/fotos/2',
      async () => new Blob([new Uint8Array(1)]),
    );
    expect(pedidos.map((p) => p.lado)).toEqual([800, 200]);
  });

  it('si la subida falla, lanza el error (la pantalla deja la foto con «Reintentar»)', async () => {
    await expect(
      subirFotoPuertaApp(
        async () => {
          throw new Error('Sin conexión');
        },
        { uri: 'file://x.jpg', width: 100, height: 100 },
        async () => ({ uri: 'file://x.webp' }),
        'webp',
        '/datos/mis-direcciones/d1/fotos/1',
        async () => new Blob([new Uint8Array(1)]),
      ),
    ).rejects.toThrow('Sin conexión');
    let n = 0;
    await expect(
      subirFotoPuertaApp(
        async () => {
          if (n++ === 1) throw new Error('falló la miniatura');
          return { url: 'ok' };
        },
        { uri: 'file://x.jpg', width: 100, height: 100 },
        async () => ({ uri: 'file://x.webp' }),
        'webp',
        '/datos/mis-direcciones/d1/fotos/1',
        async () => new Blob([new Uint8Array(1)]),
      ),
    ).rejects.toThrow('falló la miniatura');
  });
});

describe('candado: pantallas de la foto de la puerta', () => {
  it('la hoja común tiene los dos botones visibles, la privacidad y el reintento', () => {
    const s = leer('packages', 'movil', 'src', 'FotosPuerta.tsx');
    expect(s).toMatch(/tc\.camara/);
    expect(s).toMatch(/tc\.archivos/);
    expect(s).toMatch(/t\.privacidad/);
    expect(s).toMatch(/t\.reintentar/);
    expect(s).toMatch(/presentationStyle="pageSheet"/);
    // Borrar va dentro del menú de tres puntos, con confirmación.
    expect(s).toMatch(/MenuTresPuntos[\s\S]*t\.borrarFoto/);
    expect(s).toMatch(/confirmar\(t\.borrarTitulo/);
    // El paquete compartido no depende de los módulos nativos de la cámara.
    expect(s).not.toMatch(/from 'expo-image-(picker|manipulator)'/);
  });

  it('el carrito guarda la dirección ANTES de crear el pedido', () => {
    const s = leer('apps', 'cliente', 'src', 'app', 'cart.tsx');
    const guardar = s.indexOf('await guardarDireccionActual()');
    const pedido = s.indexOf("api.pedir<Cobro>('POST', '/datos/pedidos'");
    expect(guardar).toBeGreaterThan(0);
    expect(pedido).toBeGreaterThan(guardar);
    expect(s).toMatch(/x\.campo === 'fotoPuerta'/);
    expect(s).toMatch(/<TarjetaFotosPuerta/);
  });

  it('el repartidor ve la miniatura de la puerta y las notas a tres líneas', () => {
    const s = leer('apps', 'repartidor', 'src', 'Inicio.tsx');
    expect(s).toMatch(/<MiniaturaPuerta/);
    expect(s).toMatch(/numberOfLines=\{activo\.estado === 'en_camino' \? 3 : 1\}/);
    const hoja = leer('apps', 'repartidor', 'src', 'piezas', 'FotosPuerta.tsx');
    // Media altura, nunca pantalla completa; sin compartir ni guardar.
    expect(hoja).toMatch(/height \* 0\.55/);
    expect(hoja).toMatch(/<Modal transparent/);
    expect(hoja).not.toMatch(/Share|share\(|MediaLibrary/);
  });
});
