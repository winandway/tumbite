import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';
import { tiffConGps } from '../pruebas/fotoConGps';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';

// Cabecera mínima de un WebP de verdad: RIFF....WEBP
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 4, 0, 0, 0,
  1, 2, 3, 4,
]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function preparar() {
  const r2 = crearAlmacenPruebas();
  const m = mundo({ BUCKET: r2.bucket });
  async function subir(token: string, cuerpo: Uint8Array, tipo = 'image/webp') {
    const res = await app.request(
      '/datos/mi-restaurante/fotos',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': tipo,
          'cf-connecting-ip': '10.1.1.1',
        },
        body: cuerpo as BodyInit,
      },
      { DB: m.DB, BUCKET: r2.bucket },
    );
    return { estado: res.status, datos: (await res.json()) as { url?: string; error?: string } };
  }
  const ver = (url: string) => app.request(url, {}, { DB: m.DB, BUCKET: r2.bucket });
  return { ...m, r2, subir, ver };
}

describe('fotos de restaurantes y platos', () => {
  it('reconoce el tipo por los bytes, no por lo que dice el navegador', () => {
    expect(tipoReal(WEBP)).toBe('image/webp');
    expect(tipoReal(JPG)).toBe('image/jpeg');
    expect(tipoReal(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });

  it('el dueño sube una foto, se guarda en el almacén y se ve en público', async () => {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const r = await m.subir(dueno.token, WEBP);
    expect(r.estado).toBe(201);
    expect(r.datos.url).toMatch(/^\/media\/fotos\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/);
    expect(m.r2.datos.size).toBe(1);
    const res = await m.ver(r.datos.url!);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(WEBP);
  });

  it('la foto queda puesta en el restaurante y en el plato, y no se pierde al editar', async () => {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const { datos } = await m.subir(dueno.token, WEBP);
    const rest = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, imagen: datos.url },
      dueno.token,
    );
    expect(rest.datos.restaurante.imagen).toBe(datos.url);
    const plato = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pizza margarita', precioCentavos: 1400, imagen: datos.url },
      dueno.token,
    );
    expect(plato.datos.plato.imagen).toBe(datos.url);
  });

  it('no acepta enlaces a sitios ajenos como foto', async () => {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    const r = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, imagen: 'https://sitio-ajeno.example/foto.png' },
      dueno.token,
    );
    expect(r.estado).toBe(400);
    expect(r.datos.campo).toBe('imagen');
  });

  it('rechaza lo que no es foto, lo que pesa de más y a quien no es restaurante', async () => {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    expect((await m.subir(dueno.token, WEBP)).estado).toBe(422); // aún no tiene restaurante
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const svg = await m.subir(dueno.token, new TextEncoder().encode('<svg/>'), 'image/png');
    expect(svg.estado).toBe(415);
    const grande = new Uint8Array(MAX_FOTO_BYTES + 1);
    grande.set(JPG);
    expect((await m.subir(dueno.token, grande, 'image/jpeg')).estado).toBe(413);
    const cliente = await m.cuenta('cliente');
    expect((await m.subir(cliente.token, WEBP)).estado).toBe(403);
    expect(m.r2.datos.size).toBe(0);
  });

  it('no deja leer fuera de la carpeta de fotos', async () => {
    const m = preparar();
    expect((await m.ver('/media/fotos/..%2F..%2Fsecreto/x.webp')).status).toBe(404);
    expect((await m.ver('/media/fotos/abc/no-existe.webp')).status).toBe(404);
  });
});

/** Un WebP con cabecera VP8X que dice sus medidas, del largo pedido (relleno en un bloque VP8). */
function webpDe(ancho: number, alto: number, largo = 64, extra: number[] = []) {
  const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
  const le32 = (n: number) => [...le24(n), (n >>> 24) & 0xff];
  const relleno = Math.max(4, largo - 38);
  const cuerpo = [
    ...[0x57, 0x45, 0x42, 0x50],
    ...[0x56, 0x50, 0x38, 0x58],
    ...le32(10),
    0,
    0,
    0,
    0,
    ...le24(ancho - 1),
    ...le24(alto - 1),
    ...[0x56, 0x50, 0x38, 0x20],
    ...le32(relleno),
    ...Array.from({ length: relleno + (relleno % 2) }, () => 7),
    ...extra,
  ];
  return new Uint8Array([0x52, 0x49, 0x46, 0x46, ...le32(cuerpo.length), ...cuerpo]);
}

describe('NXT-7 · C-FOTOS-LIVIANAS: tres tamaños en WebP', () => {
  async function conFoto() {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const completa = webpDe(1400, 1050, 3000);
    const r = await m.subir(dueno.token, completa);
    expect(r.estado).toBe(201);
    const id = r.datos.url!.split('/').pop()!.replace('.webp', '');
    const subirTam = async (bytes: Uint8Array, tam: string, de = id, tipo = 'image/webp') => {
      const res = await app.request(
        `/datos/mi-restaurante/fotos?de=${de}&tam=${tam}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${dueno.token}`,
            'content-type': tipo,
            'cf-connecting-ip': '10.1.1.2',
          },
          body: bytes as BodyInit,
        },
        { DB: m.DB, BUCKET: m.r2.bucket },
      );
      return { estado: res.status, datos: (await res.json()) as { url?: string; error?: string } };
    };
    return { m, dueno, id, url: r.datos.url!, completa, subirTam };
  }

  it('la tarjeta y la miniatura se guardan junto a la completa y cada una se sirve aparte', async () => {
    const { m, url, subirTam, id } = await conFoto();
    const tarjeta = webpDe(640, 480, 2000);
    const mini = webpDe(200, 150, 500);
    const t = await subirTam(tarjeta, 'tarjeta');
    expect(t.estado).toBe(201);
    expect(t.datos.url).toBe(url.replace('.webp', '-m.webp'));
    const s = await subirTam(mini, 'miniatura');
    expect(s.datos.url).toBe(url.replace('.webp', '-s.webp'));
    expect(new Uint8Array(await (await m.ver(s.datos.url!)).arrayBuffer())).toEqual(mini);
    expect(new Uint8Array(await (await m.ver(t.datos.url!)).arrayBuffer())).toEqual(tarjeta);
    expect((await m.ver(t.datos.url!)).headers.get('cache-control')).toContain('immutable');
    expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('peso y medidas: una miniatura grande o pesada, un JPEG o un tamaño raro no se guardan', async () => {
    const { subirTam } = await conFoto();
    expect((await subirTam(webpDe(800, 600, 500), 'miniatura')).estado).toBe(422);
    expect((await subirTam(webpDe(200, 150, 60 * 1024), 'miniatura')).estado).toBe(422);
    expect((await subirTam(webpDe(1400, 1050, 3000), 'tarjeta')).estado).toBe(422);
    expect((await subirTam(JPG, 'miniatura', undefined, 'image/jpeg')).estado).toBe(422);
    expect((await subirTam(webpDe(200, 150, 500), 'gigante')).estado).toBe(400);
    expect((await subirTam(webpDe(200, 150, 500), 'miniatura', '../otro')).estado).toBe(400);
    expect((await subirTam(webpDe(200, 150, 500), 'miniatura', 'no-existe')).estado).toBe(404);
  });

  it('una foto vieja sin tamaños entrega la completa (WebP o JPG), sin caché larga', async () => {
    const { m, url, completa } = await conFoto();
    const res = await m.ver(url.replace('.webp', '-s.webp'));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(completa);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    const dueno = await m.cuenta('restaurante', 'Dueño JPG');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const vieja = await m.subir(dueno.token, JPG, 'image/jpeg');
    const jpg = await m.ver(vieja.datos.url!.replace('.jpg', '-m.webp'));
    expect(jpg.status).toBe(200);
    expect(jpg.headers.get('content-type')).toBe('image/jpeg');
    expect((await m.ver('/media/fotos/nada/nada-s.webp')).status).toBe(404);
  });

  it('el tamaño chico de la foto de OTRO restaurante no se puede subir', async () => {
    const { id } = await conFoto();
    const m2 = await conFoto();
    expect((await m2.subirTam(webpDe(200, 150, 500), 'miniatura', id)).estado).toBe(404);
  });

  it('NXT-7x: la tarjeta y la miniatura también pasan por la limpieza (sin GPS ni modelo del teléfono)', async () => {
    const { m, subirTam } = await conFoto();
    const tiff = tiffConGps();
    const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
    const exif = [
      ...[0x45, 0x58, 0x49, 0x46],
      ...le32(tiff.length),
      ...tiff,
      ...(tiff.length % 2 ? [0] : []),
    ];
    const xmp = [...'XMP '].map((c) => c.charCodeAt(0));
    const texto = [...'<x:xmpmeta>GPS</x:xmpmeta>'].map((c) => c.charCodeAt(0));
    const bloqueXmp = [...xmp, ...le32(texto.length), ...texto];
    for (const tam of ['miniatura', 'tarjeta']) {
      const conGps = webpDe(200, 150, 500, [...exif, ...bloqueXmp]);
      expect(String.fromCharCode(...conGps)).toContain('PixelFone');
      const r = await subirTam(conGps, tam);
      expect(r.estado, tam).toBe(201);
      const servida = new Uint8Array(await (await m.ver(r.datos.url!)).arrayBuffer());
      const textoServido = String.fromCharCode(...servida);
      expect(textoServido, tam).not.toContain('PixelFone');
      expect(textoServido, tam).not.toContain('xmpmeta');
    }
  });

  // C-DOCS-LUPA (15 nov 2026): la captura nítida de Docs se sirve desde el almacén.
  it('sirve la captura nítida de Docs desde el almacén, y nada con nombres raros', async () => {
    const r2 = crearAlmacenPruebas();
    const m = mundo({ BUCKET: r2.bucket });
    await r2.bucket.put('docs-grande/flex-billetera-es-0a1b2c3d.webp', WEBP);
    const ver = (url: string) => app.request(url, {}, { DB: m.DB, BUCKET: r2.bucket });
    const ok = await ver('/media/docs-grande/flex-billetera-es-0a1b2c3d.webp');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/webp');
    expect(ok.headers.get('cache-control')).toContain('immutable');
    expect((await ver('/media/docs-grande/no-existe-0a1b2c3d.webp')).status).toBe(404);
    expect((await ver('/media/docs-grande/..%2Fsecreto-0a1b2c3d.webp')).status).toBe(404);
    expect((await ver('/media/docs-grande/sin-huella.webp')).status).toBe(404);
  });

  // C-PAQUETE-DIETA (21 nov 2026): las presentaciones en PDF salen del almacén, en su dirección de siempre.
  it('sirve la presentación en PDF desde el almacén en /docs/presentaciones, y nada con nombres raros', async () => {
    const r2 = crearAlmacenPruebas();
    const m = mundo({ BUCKET: r2.bucket });
    await r2.bucket.put('docs-pdf/divoox-clientes-es.pdf', new Uint8Array([37, 80, 68, 70, 45]));
    const ver = (url: string, method = 'GET') =>
      app.request(url, { method }, { DB: m.DB, BUCKET: r2.bucket });
    const ok = await ver('/docs/presentaciones/divoox-clientes-es.pdf');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('application/pdf');
    expect(new Uint8Array(await ok.arrayBuffer())).toHaveLength(5);
    expect((await ver('/docs/presentaciones/divoox-clientes-es.pdf', 'HEAD')).status).toBe(200);
    expect((await ver('/docs/presentaciones/no-existe.pdf')).status).toBe(404);
    expect((await ver('/docs/presentaciones/..%2Fsecreto.pdf')).status).toBe(404);
    expect((await ver('/docs/presentaciones/Con-Mayuscula.PDF')).status).toBe(404);
  });

  // C-DOCS-VIDEO (19 nov 2026): el video de Docs se sirve por partes desde el almacén.
  describe('el video de Docs', () => {
    const VIDEO = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);
    const preparar = async () => {
      const r2 = crearAlmacenPruebas();
      const m = mundo({ BUCKET: r2.bucket });
      await r2.bucket.put('docs-video/lineas-es-0a1b2c3d.mp4', VIDEO);
      // Una base que anota todo lo que no sea leer.
      const escritas: string[] = [];
      const DB = new Proxy(m.DB, {
        get(base, llave) {
          const valor = Reflect.get(base, llave) as unknown;
          if (llave !== 'prepare' || typeof valor !== 'function') return valor;
          return (sql: string) => {
            if (!/^\s*(select|pragma)/i.test(sql)) escritas.push(sql);
            return (valor as (sql: string) => unknown).call(base, sql);
          };
        },
      });
      return {
        escrituras: () => escritas.length,
        ver: (url: string, range?: string, method = 'GET') =>
          app.request(url, { method, headers: range ? { range } : {} }, { DB, BUCKET: r2.bucket }),
      };
    };
    const bytes = async (r: Response) => [...new Uint8Array(await r.arrayBuffer())];

    it('entero: 200, como video, con caché larga y avisando que entiende partes', async () => {
      const { ver } = await preparar();
      const r = await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4');
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toBe('video/mp4');
      expect(r.headers.get('accept-ranges')).toBe('bytes');
      expect(r.headers.get('content-length')).toBe('1000');
      expect(r.headers.get('cache-control')).toContain('immutable');
      expect(await bytes(r)).toEqual([...VIDEO]);
    });

    it('por partes (lo que pide el iPhone): 206 con la parte exacta', async () => {
      const { ver } = await preparar();
      const primera = await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', 'bytes=0-1');
      expect(primera.status).toBe(206);
      expect(primera.headers.get('content-range')).toBe('bytes 0-1/1000');
      expect(primera.headers.get('content-length')).toBe('2');
      expect(await bytes(primera)).toEqual([0, 1]);
      const medio = await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', 'bytes=100-199');
      expect(medio.headers.get('content-range')).toBe('bytes 100-199/1000');
      expect(await bytes(medio)).toEqual([...VIDEO.slice(100, 200)]);
      const resto = await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', 'bytes=990-');
      expect(resto.headers.get('content-range')).toBe('bytes 990-999/1000');
      const cola = await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', 'bytes=-10');
      expect(cola.headers.get('content-range')).toBe('bytes 990-999/1000');
      // Pedir más allá del final se recorta al final.
      const largo = await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', 'bytes=500-99999');
      expect(largo.headers.get('content-range')).toBe('bytes 500-999/1000');
    });

    it('una parte imposible responde 416, y HEAD da el tamaño sin cuerpo', async () => {
      const { ver } = await preparar();
      const fuera = await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', 'bytes=1000-');
      expect(fuera.status).toBe(416);
      expect(fuera.headers.get('content-range')).toBe('bytes */1000');
      expect((await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', 'bytes=abc')).status).toBe(416);
      const cabeza = await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', undefined, 'HEAD');
      expect(cabeza.status).toBe(200);
      expect(cabeza.headers.get('content-length')).toBe('1000');
      expect((await cabeza.arrayBuffer()).byteLength).toBe(0);
    });

    it('nada con nombres raros, y mirar un video no escribe en la base', async () => {
      const { ver, escrituras } = await preparar();
      expect((await ver('/media/docs-video/no-existe-0a1b2c3d.mp4')).status).toBe(404);
      expect((await ver('/media/docs-video/..%2Fsecreto-0a1b2c3d.mp4')).status).toBe(404);
      expect((await ver('/media/docs-video/sin-huella.mp4')).status).toBe(404);
      expect((await ver('/media/docs-video/lineas-es-0a1b2c3d.webp')).status).toBe(404);
      await ver('/media/docs-video/lineas-es-0a1b2c3d.mp4', 'bytes=0-99');
      expect(escrituras()).toBe(0);
    });
  });
});
