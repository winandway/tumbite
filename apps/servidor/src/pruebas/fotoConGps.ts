/**
 * Fotos de prueba de verdad (C-FOTOS-SIN-METADATOS): un JPEG con EXIF que trae GPS de Miami
 * (25° 46' 30" N, 80° 11' 24" W), el modelo «PixelFone», XMP y comentarios. Lo usan las pruebas
 * de la limpieza y las de cada subida que guarda el GPS aparte (SIG-6x).
 */
export const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
export const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
export const txt = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** TIFF big-endian: IFD0 con modelo «PixelFone», orientación y puntero al GPS. */
export function tiffConGps(orientacion = 6): number[] {
  const t: number[] = [...txt('MM'), 0, 42, ...be32(8)];
  // IFD0 en 8: 3 entradas → 2 + 36 + 4 = 42 → termina en 50.
  const modeloEn = 50;
  const gpsEn = modeloEn + 10;
  t.push(...be16(3));
  t.push(...be16(0x0110), ...be16(2), ...be32(10), ...be32(modeloEn)); // modelo
  t.push(...be16(0x0112), ...be16(3), ...be32(1), ...be16(orientacion), 0, 0);
  t.push(...be16(0x8825), ...be16(4), ...be32(1), ...be32(gpsEn));
  t.push(...be32(0));
  t.push(...txt('PixelFone'), 0);
  // GPS IFD en 60: 4 entradas → 2 + 48 + 4 = 54 → racionales desde 114.
  const lat = gpsEn + 54;
  const lng = lat + 24;
  t.push(...be16(4));
  t.push(...be16(1), ...be16(2), ...be32(2), ...txt('N'), 0, 0, 0);
  t.push(...be16(2), ...be16(5), ...be32(3), ...be32(lat));
  t.push(...be16(3), ...be16(2), ...be32(2), ...txt('W'), 0, 0, 0);
  t.push(...be16(4), ...be16(5), ...be32(3), ...be32(lng));
  t.push(...be32(0));
  for (const [a, b] of [
    [25, 1],
    [46, 1],
    [30, 1],
    [80, 1],
    [11, 1],
    [24, 1],
  ])
    t.push(...be32(a!), ...be32(b!));
  return t;
}
export const segmento = (marca: number, datos: number[]) => [
  0xff,
  marca,
  ...be16(datos.length + 2),
  ...datos,
];

export function jpegConGps(orientacion = 6) {
  return new Uint8Array([
    0xff,
    0xd8,
    ...segmento(0xe0, [...txt('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...segmento(0xe1, [...txt('Exif'), 0, 0, ...tiffConGps(orientacion)]),
    ...segmento(0xe1, [...txt('http://ns.adobe.com/xap/1.0/'), 0, ...txt('<x:xmpmeta GPS/>')]),
    ...segmento(0xe2, [...txt('ICC_PROFILE'), 0, 1, 1, 9, 9]),
    ...segmento(0xed, [...txt('Photoshop 3.0'), 0, 1, 2]),
    ...segmento(0xfe, txt('Tomada en casa de Ana')),
    ...segmento(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]),
    0xff,
    0xda,
    ...be16(8),
    1,
    1,
    0,
    0,
    0x3f,
    0,
    0x12,
    0x34,
    0xff,
    0xd9,
  ]);
}

/** Una caja ISO BMFF (HEIF): largo, tipo y contenido. `ver` la vuelve «full box». */
export const caja = (tipo: string, datos: number[], ver?: number) => {
  const cuerpo = ver === undefined ? datos : [ver, 0, 0, 0, ...datos];
  return [...be32(cuerpo.length + 8), ...txt(tipo), ...cuerpo];
};

/**
 * NXT-4: un HEIC como el del iPhone (ftyp «heic», meta con iinf + iloc, mdat): un ítem de imagen
 * hvc1, un ítem Exif con el GPS de Miami y el modelo «PixelFone», y un ítem XMP («mime»).
 * `exifEnIdat` guarda el Exif dentro de la caja idat (método de construcción 1) en vez de mdat.
 */
export function heicConGps(op: { exifEnIdat?: boolean; refExterna?: boolean } = {}) {
  const imagen = [0x12, 0x34, 0x56, 0x78, 0x9a];
  const exif = [...be32(6), ...txt('Exif'), 0, 0, ...tiffConGps()];
  const xmp = txt('<x:xmpmeta><exif:GPSLatitude>25,46.5N</exif:GPSLatitude></x:xmpmeta>');
  const ftyp = caja('ftyp', [...txt('heic'), 0, 0, 0, 0, ...txt('mif1heic')]);
  const infe = (id: number, tipo: string, extra: number[] = []) =>
    caja('infe', [...be16(id), 0, 0, ...txt(tipo), 0, ...extra], 2);
  const iinf = caja(
    'iinf',
    [
      ...be16(3),
      ...infe(1, 'hvc1'),
      ...infe(2, 'Exif'),
      ...infe(3, 'mime', [...txt('application/rdf+xml'), 0]),
    ],
    0,
  );
  const armarMeta = (base: number) => {
    // iloc v1: offset 4 bytes, largo 4, base 0, índice 0.
    const item = (id: number, metodo: number, off: number, lar: number, ref = 0) => [
      ...be16(id),
      ...be16(metodo),
      ...be16(ref),
      ...be16(1),
      ...be32(off),
      ...be32(lar),
    ];
    const enMdat = (n: number) => base + n;
    const iloc = caja(
      'iloc',
      [
        0x44,
        0x00,
        ...be16(3),
        ...item(1, 0, enMdat(0), imagen.length),
        ...(op.exifEnIdat
          ? item(2, 1, 0, exif.length)
          : item(2, 0, enMdat(imagen.length), exif.length, op.refExterna ? 1 : 0)),
        ...item(3, 0, enMdat(imagen.length + (op.exifEnIdat ? 0 : exif.length)), xmp.length),
      ],
      1,
    );
    return caja(
      'meta',
      [
        ...caja('hdlr', [0, 0, 0, 0, ...txt('pict'), ...Array(12).fill(0), 0], 0),
        ...caja('pitm', be16(1), 0),
        ...iinf,
        ...iloc,
        ...(op.exifEnIdat ? caja('idat', exif) : []),
      ],
      0,
    );
  };
  const largoMeta = armarMeta(0).length;
  const base = ftyp.length + largoMeta + 8;
  const mdat = caja('mdat', [...imagen, ...(op.exifEnIdat ? [] : exif), ...xmp]);
  return new Uint8Array([...ftyp, ...armarMeta(base), ...mdat]);
}
