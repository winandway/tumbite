import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { crearAlmacenPruebas } from './pruebas/r2';
import { anotarGpsFoto, guardarFoto, leerTiff, limpiarFoto } from './fotoLimpia';
import {
  be16,
  be32,
  caja,
  heicConGps,
  jpegConGps,
  segmento,
  tiffConGps,
  txt,
} from './pruebas/fotoConGps';

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

  // SIG-6y (revisión): el mismo agujero en PNG y WebP. Se corta en el fin real de la imagen.
  it('PNG: lo pegado después de IEND no pasa, aunque no haya bloques ocultos', () => {
    const cola = [...jpegConGps(1)];
    const png = new Uint8Array([
      ...[0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10],
      ...be32(0),
      ...txt('IEND'),
      0,
      0,
      0,
      0,
      ...cola,
    ]);
    const r = limpiarFoto(png, 'image/png');
    expect(contiene(r.bytes, 'PixelFone')).toBe(false);
    expect(r.bytes.length).toBe(20);
  });

  it('WebP: lo pegado después del largo RIFF no pasa', () => {
    const cuerpo = [...txt('WEBP'), ...txt('VP8 '), 4, 0, 0, 0, 1, 2, 3, 4];
    const webp = new Uint8Array([
      ...txt('RIFF'),
      cuerpo.length & 0xff,
      0,
      0,
      0,
      ...cuerpo,
      ...jpegConGps(1),
    ]);
    const r = limpiarFoto(webp, 'image/webp');
    expect(contiene(r.bytes, 'PixelFone')).toBe(false);
    expect(r.bytes.length).toBe(8 + cuerpo.length);
  });

  // SIG-6z (revisión): un archivo cuya estructura no cuadra se RECHAZA con el 415 de «foto
  // dañada»: nunca se devuelve el original ni se guarda mordido. Las fotos sanas siguen idénticas.
  it('WebP con un largo RIFF imposible (mayor que el archivo, menor que 4 o menor que sus bloques) da el 415', () => {
    const vp8 = [...txt('VP8 '), 4, 0, 0, 0, 1, 2, 3, 4];
    const cuerpo = [...txt('WEBP'), ...vp8];
    const le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
    const webp = (riff: number, extra: number[] = [...jpegConGps(1)]) =>
      new Uint8Array([...txt('RIFF'), ...le(riff), ...cuerpo, ...extra]);
    for (const riff of [cuerpo.length + 1000, 0xffffffff, 0, 3, 4, 6, 13])
      expect(() => limpiarFoto(webp(riff), 'image/webp'), `RIFF ${riff}`).toThrow(/dañada/);
    expect(() => limpiarFoto(webp(9, []), 'image/webp')).toThrow(/dañada/);
    expect(() => limpiarFoto(new Uint8Array([...txt('RIFF'), 1]), 'image/webp')).toThrow(/dañada/);
    // La sana queda idéntica (el mismo objeto).
    const sana = webp(cuerpo.length, []);
    expect(limpiarFoto(sana, 'image/webp').bytes).toBe(sana);
  });

  it('PNG sin IEND da el 415 (aunque traiga algo pegado detrás)', () => {
    const sinIend = new Uint8Array([
      ...[0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10],
      ...be32(1),
      ...txt('IDAT'),
      7,
      0,
      0,
      0,
      0,
      ...jpegConGps(1),
    ]);
    expect(() => limpiarFoto(sinIend, 'image/png')).toThrow(/dañada/);
    const sano = new Uint8Array([
      ...[0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10],
      ...be32(0),
      ...txt('IEND'),
      0,
      0,
      0,
      0,
    ]);
    expect(limpiarFoto(sano, 'image/png').bytes).toBe(sano);
  });

  it('HEIC del iPhone (NXT-4): borra el Exif y el XMP, deja la imagen igual y lee el GPS', () => {
    for (const op of [{}, { exifEnIdat: true }]) {
      const original = heicConGps(op);
      expect(contiene(original, 'PixelFone')).toBe(true);
      expect(contiene(original, 'xmpmeta')).toBe(true);
      const r = limpiarFoto(original, 'image/heic');
      for (const oculto of ['PixelFone', 'xmpmeta', 'GPSLatitude'])
        expect(contiene(r.bytes, oculto), `${oculto} ${JSON.stringify(op)}`).toBe(false);
      expect(r.gps?.lat).toBeCloseTo(25.775, 3);
      expect(r.gps?.lng).toBeCloseTo(-80.19, 3);
      expect(r.quitados).toBe(2);
      // La estructura no cambia: mismo largo, la imagen sigue en su lugar.
      expect(r.bytes.length).toBe(original.length);
      expect(contiene(r.bytes, String.fromCharCode(0x12, 0x34, 0x56, 0x78, 0x9a))).toBe(true);
      // El original no se toca (la limpieza trabaja sobre una copia).
      expect(contiene(original, 'PixelFone')).toBe(true);
    }
    // HEIF con el otro nombre de tipo.
    expect(contiene(limpiarFoto(heicConGps(), 'image/heif').bytes, 'PixelFone')).toBe(false);
  });

  it('HEIC sin datos ocultos sale idéntico; uno que no cuadra o con datos en otro archivo da el 415 claro', () => {
    const ftyp = caja('ftyp', [...txt('heic'), 0, 0, 0, 0]);
    const sinOcultos = heicConGps({ limpio: true });
    expect(limpiarFoto(sinOcultos, 'image/heic').bytes).toBe(sinOcultos);
    expect(() => limpiarFoto(heicConGps({ refExterna: true }), 'image/heic')).toThrow(/JPG/);
    const malos: [string, Uint8Array][] = [
      ['vacío', new Uint8Array()],
      ['solo ftyp cortado', new Uint8Array([0, 0, 0, 0x18, ...txt('ftypheic'), 0, 0])],
      ['caja que se sale', new Uint8Array([...ftyp, ...be32(9999), ...txt('mdat'), 1])],
      ['sin ftyp', new Uint8Array(caja('mdat', [1]))],
      ['sin meta', new Uint8Array([...ftyp, ...caja('mdat', [1, 2, 3])])],
      ['secuencia con moov', new Uint8Array([...ftyp, ...caja('moov', [1, 2])])],
      ['dos meta', new Uint8Array([...ftyp, ...caja('meta', [], 0), ...caja('meta', [], 0)])],
      ['basura detrás', new Uint8Array([...heicConGps(), 1, 2, 3])],
      ['jpeg pegado detrás', new Uint8Array([...heicConGps(), ...jpegConGps()])],
    ];
    for (const [nombre, b] of malos)
      expect(() => limpiarFoto(b, 'image/heic'), nombre).toThrow(/JPG/);
    // Barrido: cortar el HEIC en cualquier punto nunca deja pasar el GPS.
    const h = heicConGps();
    for (let n = 1; n < h.length; n += 7) {
      let salida: Uint8Array | null = null;
      try {
        salida = limpiarFoto(h.subarray(0, n), 'image/heic').bytes;
      } catch (e) {
        expect(String(e)).toMatch(/JPG/);
      }
      if (salida) expect(contiene(salida, 'PixelFone'), `corte ${n}`).toBe(false);
    }
  });

  it('una imagen de otro tipo nunca se guarda tal cual: 415; un PDF de evidencia pasa', () => {
    const gif = new Uint8Array([...txt('GIF89a'), ...tiffConGps()]);
    expect(() => limpiarFoto(gif, 'image/gif')).toThrow(/HEIC/);
    const pdf = new Uint8Array(txt('%PDF-1.7'));
    expect(limpiarFoto(pdf, 'application/pdf').bytes).toBe(pdf);
  });

  it('guardarFoto con un HEIC: en el almacén queda sin el GPS', async () => {
    const bucket = crearAlmacenPruebas().bucket as unknown as R2Bucket;
    const { gps } = await guardarFoto(bucket, 'casos/x/1', heicConGps(), 'image/heic');
    expect(gps?.lat).toBeCloseTo(25.775, 3);
    const guardado = await bucket.get('casos/x/1');
    const bytes = new Uint8Array(await guardado!.arrayBuffer());
    expect(contiene(bytes, 'PixelFone')).toBe(false);
  });

  describe('NXT-4x · HEIC con lista blanca: lo que no es imagen sale en ceros o da el 415', () => {
    const sinRastro = (b: Uint8Array) => {
      for (const x of ['PixelFone', 'xmpmeta', 'GPSLatitude', 'LATITUD-OCULTA'])
        expect(contiene(b, x), x).toBe(false);
    };
    const pegado = [...txt('LATITUD-OCULTA '), ...jpegConGps()];
    const cajasArriba = (b: Uint8Array) => {
      const v = new DataView(b.buffer, b.byteOffset);
      const l: { tipo: string; ini: number; largo: number }[] = [];
      for (let i = 0; i + 8 <= b.length;) {
        const n = v.getUint32(i);
        l.push({ tipo: String.fromCharCode(...b.subarray(i + 4, i + 8)), ini: i, largo: n });
        if (n < 8) break;
        i += n;
      }
      return l;
    };

    it('(1) cajas free/skip, un segundo mdat, mdat hasta el final y bytes de mdat sin ítem: en ceros, la imagen igual', () => {
      const h = heicConGps();
      const mdat = cajasArriba(h).at(-1)!;
      const hasta0 = new Uint8Array([...h, ...pegado]);
      hasta0.set([0, 0, 0, 0], mdat.ini);
      const agrandado = new Uint8Array([...h, ...pegado]);
      agrandado.set(be32(mdat.largo + pegado.length), mdat.ini);
      const casos: [string, Uint8Array][] = [
        ['free al final', new Uint8Array([...h, ...caja('free', pegado)])],
        ['skip al final', new Uint8Array([...h, ...caja('skip', pegado)])],
        ['segundo mdat', new Uint8Array([...h, ...caja('mdat', pegado)])],
        ['mdat hasta el final', hasta0],
        ['mdat agrandado', agrandado],
      ];
      for (const [nombre, b] of casos) {
        const r = limpiarFoto(b, 'image/heic');
        sinRastro(r.bytes);
        expect(r.bytes.length, nombre).toBe(b.length);
        expect(contiene(r.bytes, String.fromCharCode(0x12, 0x34, 0x56, 0x78, 0x9a)), nombre).toBe(
          true,
        );
      }
    });

    it('(2) dentro de meta, iprp o ipco solo cajas conocidas: xml, uuid, free o una propiedad rara dan el 415', () => {
      const oculto = txt('<x:xmpmeta>LATITUD-OCULTA</x:xmpmeta>');
      for (const extraMeta of [
        caja('xml ', oculto, 0),
        caja('uuid', [...Array(16).fill(7), ...oculto]),
        caja('free', oculto),
        caja('grpl', oculto),
      ])
        expect(() => limpiarFoto(heicConGps({ extraMeta }), 'image/heic')).toThrow(/JPG/);
      expect(() =>
        limpiarFoto(heicConGps({ extraIpco: caja('udes', oculto, 0) }), 'image/heic'),
      ).toThrow(/JPG/);
      // Una caja de arriba que no está en la lista (una secuencia, un uuid) tampoco pasa.
      for (const tipo of ['uuid', 'moov', 'udta'])
        expect(
          () => limpiarFoto(new Uint8Array([...heicConGps(), ...caja(tipo, oculto)]), 'image/heic'),
          tipo,
        ).toThrow(/JPG/);
    });

    it('(2b) los nombres de los ítems y del hdlr se borran', () => {
      const h = heicConGps({ limpio: true });
      const conNombre = new Uint8Array(h);
      const hdlrNombre = String.fromCharCode(...h).indexOf('pict') + 4 + 12;
      conNombre[hdlrNombre] = 0x41; // «A» en el nombre del hdlr
      conNombre[hdlrNombre + 1] = 0x00;
      const r = limpiarFoto(conNombre, 'image/heic');
      expect(r.bytes[hdlrNombre]).toBe(0);
    });

    it('(3) iloc v0 y v2, infe v3 e iinf v1: se limpian igual', () => {
      for (const op of [
        { ilocVer: 0 as const },
        { ilocVer: 2 as const },
        { infeVer: 3 as const },
        { iinfVer: 1 as const },
        { ilocVer: 2 as const, infeVer: 3 as const, iinfVer: 1 as const, exifEnIdat: true },
      ]) {
        const r = limpiarFoto(heicConGps(op), 'image/heic');
        sinRastro(r.bytes);
        expect(r.gps?.lat, JSON.stringify(op)).toBeCloseTo(25.775, 3);
      }
    });

    it('(3b) un Exif declarado sin su lugar en iloc da el 415 (no se sabe dónde vive)', () => {
      expect(() => limpiarFoto(heicConGps({ exifSinIloc: true }), 'image/heic')).toThrow(/JPG/);
    });
  });
});
