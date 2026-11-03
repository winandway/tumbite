import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { crearAlmacenPruebas } from './pruebas/r2';
import { anotarGpsFoto, guardarFoto, leerTiff, limpiarFoto } from './fotoLimpia';
import { be16, be32, jpegConGps, segmento, tiffConGps, txt } from './pruebas/fotoConGps';

/**
 * C-FOTOS-SIN-METADATOS (SIG-6): ninguna foto llega al almacén con la ubicación ni los datos de la
 * cámara. Se arman fotos de verdad (JPEG, PNG y WebP) con un EXIF que trae GPS de Miami
 * (25° 46' 30" N, 80° 11' 24" W), el modelo del teléfono, XMP y comentarios.
 */
const contiene = (b: Uint8Array, s: string) => String.fromCharCode(...b).includes(s);

describe('C-FOTOS-SIN-METADATOS · fotos sin datos ocultos', () => {
  it('JPEG: quita EXIF, XMP, Photoshop y comentarios; deja JFIF, color y la orientación; lee el GPS', () => {
    const original = jpegConGps();
    expect(contiene(original, 'PixelFone')).toBe(true);
    const r = limpiarFoto(original, 'image/jpeg');
    expect(r.gps?.lat).toBeCloseTo(25.775, 3);
    expect(r.gps?.lng).toBeCloseTo(-80.19, 3);
    for (const oculto of ['PixelFone', 'xmpmeta', 'Photoshop', 'Ana', 'GPS'])
      expect(contiene(r.bytes, oculto), oculto).toBe(false);
    expect(contiene(r.bytes, 'JFIF')).toBe(true);
    expect(contiene(r.bytes, 'ICC_PROFILE')).toBe(true);
    // La foto de celular no se ve girada: el EXIF nuevo solo trae la orientación.
    const exif = String.fromCharCode(...r.bytes).indexOf('Exif');
    expect(exif).toBeGreaterThan(0);
    const solo = leerTiff(r.bytes.subarray(exif + 6));
    expect(solo).toEqual({ orientacion: 6, gps: null });
    // Termina igual: la imagen (desde SOS) no se toca.
    expect([...r.bytes.slice(-4)]).toEqual([0x12, 0x34, 0xff, 0xd9]);
    expect(r.quitados).toBe(4);
    // Sin giro no se agrega EXIF.
    expect(contiene(limpiarFoto(jpegConGps(1), 'image/jpeg').bytes, 'Exif')).toBe(false);
  });

  it('PNG y WebP: quitan eXIf/tEXt y EXIF/XMP, apagan las marcas y leen el GPS', () => {
    const chunk = (tipo: string, datos: number[]) => [
      ...be32(datos.length),
      ...txt(tipo),
      ...datos,
      0,
      0,
      0,
      0,
    ];
    const png = new Uint8Array([
      0x89,
      ...txt('PNG'),
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
      ...chunk('eXIf', tiffConGps()),
      ...chunk('tEXt', txt('Author\0Ana')),
      ...chunk('IDAT', [1, 2, 3]),
      ...chunk('IEND', []),
    ]);
    const p = limpiarFoto(png, 'image/png');
    expect(p.gps?.lat).toBeCloseTo(25.775, 3);
    expect(contiene(p.bytes, 'PixelFone')).toBe(false);
    expect(contiene(p.bytes, 'Ana')).toBe(false);
    expect(contiene(p.bytes, 'IDAT')).toBe(true);
    expect(contiene(p.bytes, 'IEND')).toBe(true);

    const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
    const trozo = (tipo: string, datos: number[]) => [
      ...txt(tipo),
      ...le32(datos.length),
      ...datos,
      ...(datos.length % 2 ? [0] : []),
    ];
    const exif = [...txt('Exif'), 0, 0, ...tiffConGps()];
    const cuerpo = [
      ...txt('WEBP'),
      ...trozo('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...trozo('VP8 ', [1, 2, 3, 4, 5]),
      ...trozo('EXIF', exif),
      ...trozo('XMP ', txt('<x:xmpmeta/>')),
    ];
    const webp = new Uint8Array([...txt('RIFF'), ...le32(cuerpo.length), ...cuerpo]);
    const w = limpiarFoto(webp, 'image/webp');
    expect(w.gps?.lng).toBeCloseTo(-80.19, 3);
    expect(contiene(w.bytes, 'PixelFone')).toBe(false);
    expect(contiene(w.bytes, 'xmpmeta')).toBe(false);
    expect(w.bytes[20]).toBe(0); // VP8X sin las marcas de EXIF y XMP
    expect(new DataView(w.bytes.buffer).getUint32(4, true)).toBe(w.bytes.length - 8);
  });

  it('una foto sin datos ocultos queda igual; una rota se rechaza; un bloque oculto cortado se descarta', () => {
    const limpia = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, 9, 0xff, 0xd9]);
    expect(limpiarFoto(limpia, 'image/jpeg').bytes).toBe(limpia);
    expect(() => limpiarFoto(new Uint8Array([0xff, 0xd8, 1, 2, 3]), 'image/jpeg')).toThrow(
      /dañada/,
    );
    const cortada = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x10, 0, ...txt('Exif')]);
    expect(limpiarFoto(cortada, 'image/jpeg').bytes).toEqual(new Uint8Array([0xff, 0xd8]));
    const pdf = new Uint8Array(txt('%PDF-1.7'));
    expect(limpiarFoto(pdf, 'application/pdf').bytes).toBe(pdf);
    expect(leerTiff(new Uint8Array([1, 2]))).toEqual({ orientacion: 1, gps: null });
  });

  it('foto de entrega: se guarda sin GPS ni cámara y la ubicación queda aparte como prueba', async () => {
    const { bucket, datos } = crearAlmacenPruebas();
    const m = mundo();
    const r = await guardarFoto(bucket, 'evidencias/p1/entrega-1', jpegConGps(), 'image/jpeg', {
      cacheControl: 'private, no-store',
    });
    expect(r.gps?.lat).toBeCloseTo(25.775, 3);
    await anotarGpsFoto(m.DB, 'evidencias/p1/entrega-1', r.gps!);
    const g = await m.DB.prepare('SELECT lat, lng FROM fotos_gps WHERE clave = ?')
      .bind('evidencias/p1/entrega-1')
      .first<{ lat: number; lng: number }>();
    expect(g?.lng).toBeCloseTo(-80.19, 3);
    const guardada = datos.get('evidencias/p1/entrega-1')!;
    expect(contiene(guardada.bytes, 'PixelFone')).toBe(false);
    expect(guardada.cache).toBe('private, no-store');
    // Un documento de identidad conserva el original (es la evidencia que se revisa).
    await guardarFoto(bucket, 'kyc/u/dni', jpegConGps(), 'image/jpeg', {
      conservarOriginal: 'evidencia',
    });
    expect(contiene(datos.get('kyc/u/dni')!.bytes, 'PixelFone')).toBe(true);
  });

  it('la foto pública de un plato sale del almacén sin la ubicación del restaurante', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const res = await m.crudo('/datos/mi-restaurante/fotos', {
      method: 'POST',
      headers: { authorization: `Bearer ${dueno.token}`, 'content-type': 'image/jpeg' },
      body: jpegConGps() as BodyInit,
    });
    expect(res.status).toBe(201);
    const { url } = (await res.json()) as { url: string };
    const publica = new Uint8Array(await (await m.crudo(url, { method: 'GET' })).arrayBuffer());
    expect(contiene(publica, 'JFIF')).toBe(true);
    expect(contiene(publica, 'PixelFone')).toBe(false);
    expect(
      leerTiff(publica.subarray(String.fromCharCode(...publica).indexOf('Exif') + 6)).gps,
    ).toBeNull();
  });

  // SIG-6x (revisión): lo que va pegado DESPUÉS de la primera imagen (la segunda imagen MPF de
  // iPhone y Samsung, el video de las fotos en movimiento de Pixel) no puede pasar con su EXIF.
  it('JPEG con una segunda imagen pegada al final: se corta en el fin de la primera', () => {
    const primera = jpegConGps(1);
    const r = limpiarFoto(new Uint8Array([...primera, ...jpegConGps(1)]), 'image/jpeg');
    expect(contiene(r.bytes, 'PixelFone')).toBe(false);
    expect(r.bytes.at(-2)).toBe(0xff);
    expect(r.bytes.at(-1)).toBe(0xd9);
    // La imagen sigue entera: lo mismo que limpiar la primera sola.
    expect([...r.bytes]).toEqual([...limpiarFoto(primera, 'image/jpeg').bytes]);
  });

  it('JPEG con el video de una foto en movimiento pegado: el video (con su ubicación) no pasa', () => {
    const video = [
      ...be32(24),
      ...txt('ftypmp42'),
      0,
      0,
      0,
      0,
      ...txt('mp42isom'),
      ...be32(30),
      ...txt('©xyz'),
      ...txt('+25.7750-080.1900/'),
    ];
    const r = limpiarFoto(new Uint8Array([...jpegConGps(1), ...video]), 'image/jpeg');
    expect(contiene(r.bytes, '+25.7750')).toBe(false);
  });

  it('JPEG progresivo: los marcadores entre escaneos se recorren y el relleno 0xFF00 y RST no cortan', () => {
    const progresivo = new Uint8Array([
      0xff,
      0xd8,
      ...segmento(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]),
      ...[0xff, 0xda, ...be16(8), 1, 1, 0, 0, 0x3f, 0],
      ...[0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56],
      ...segmento(0xc4, [0x10, ...Array.from({ length: 16 }, () => 0)]),
      ...segmento(0xfe, txt('comentario entre escaneos')),
      ...[0xff, 0xda, ...be16(8), 1, 1, 0, 0, 0x3f, 0],
      ...[0x78, 0xff, 0xff, 0xd9],
      ...txt('PixelFone'),
    ]);
    const r = limpiarFoto(progresivo, 'image/jpeg');
    const s = String.fromCharCode(...r.bytes);
    expect(s).not.toContain('comentario entre escaneos');
    expect(s).not.toContain('PixelFone');
    expect([...r.bytes.subarray(-4)]).toEqual([0x78, 0xff, 0xff, 0xd9]);
    expect(r.bytes.filter((x, k) => x === 0xff && r.bytes[k + 1] === 0xc4).length).toBe(1);
    expect(s).toContain(String.fromCharCode(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56));
  });
});
