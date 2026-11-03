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

export type OpcionesHeic = {
  /** El Exif dentro de la caja idat (método de construcción 1) en vez de mdat. */
  exifEnIdat?: boolean;
  /** El Exif con sus datos «en otro archivo» (data_reference_index 1). */
  refExterna?: boolean;
  /** Solo la imagen, sin Exif ni XMP. */
  limpio?: boolean;
  /** Versiones de iloc (0, 1, 2), infe (2, 3) e iinf (0, 1). */
  ilocVer?: 0 | 1 | 2;
  infeVer?: 2 | 3;
  iinfVer?: 0 | 1;
  /** Cajas de más dentro de meta o de ipco (para las pruebas de lista blanca). */
  extraMeta?: number[];
  extraIpco?: number[];
  /** El Exif declarado en iinf pero sin su entrada en iloc. */
  exifSinIloc?: boolean;
};

/**
 * NXT-4 y NXT-4x: un HEIC como el del iPhone (ftyp «heic», meta con hdlr, pitm, iinf, iloc e
 * iprp, y mdat): un ítem de imagen hvc1, un ítem Exif con el GPS de Miami y el modelo
 * «PixelFone», y un ítem XMP («mime»).
 */
export function heicConGps(op: OpcionesHeic = {}) {
  const imagen = [0x12, 0x34, 0x56, 0x78, 0x9a];
  const exif = [...be32(6), ...txt('Exif'), 0, 0, ...tiffConGps()];
  const xmp = txt('<x:xmpmeta><exif:GPSLatitude>25,46.5N</exif:GPSLatitude></x:xmpmeta>');
  const ilocVer = op.ilocVer ?? 1;
  const infeVer = op.infeVer ?? 2;
  const iinfVer = op.iinfVer ?? 0;
  const enIdat = Boolean(op.exifEnIdat) && ilocVer > 0;
  const ftyp = caja('ftyp', [...txt('heic'), 0, 0, 0, 0, ...txt('mif1heic')]);
  const id = (n: number, ancho: number) => (ancho === 4 ? be32(n) : be16(n));
  const infe = (n: number, tipo: string, extra: number[] = []) =>
    caja('infe', [...id(n, infeVer === 3 ? 4 : 2), 0, 0, ...txt(tipo), 0, ...extra], infeVer);
  const items: [number, string, number[]][] = op.limpio
    ? [[1, 'hvc1', []]]
    : [
        [1, 'hvc1', []],
        [2, 'Exif', []],
        [3, 'mime', [...txt('application/rdf+xml'), 0]],
      ];
  const iinf = caja(
    'iinf',
    [...id(items.length, iinfVer === 0 ? 2 : 4), ...items.flatMap(([n, t, e]) => infe(n, t, e))],
    iinfVer,
  );
  const iprp = caja('iprp', [
    ...caja('ipco', [...caja('ispe', [...be32(1), ...be32(1)], 0), ...(op.extraIpco ?? [])]),
    ...caja('ipma', [...be32(1), ...be16(1), 1, 0x81], 0),
  ]);
  const armarMeta = (base: number) => {
    // iloc: offset 4 bytes, largo 4, base 0, índice 0.
    const ancho = ilocVer === 2 ? 4 : 2;
    const item = (n: number, metodo: number, off: number, lar: number, ref = 0) => [
      ...id(n, ancho),
      ...(ilocVer > 0 ? be16(metodo) : []),
      ...be16(ref),
      ...be16(1),
      ...be32(off),
      ...be32(lar),
    ];
    const enMdat = (n: number) => base + n;
    const entradas = op.limpio
      ? [item(1, 0, enMdat(0), imagen.length)]
      : [
          item(1, 0, enMdat(0), imagen.length),
          ...(op.exifSinIloc
            ? []
            : [
                enIdat
                  ? item(2, 1, 0, exif.length)
                  : item(2, 0, enMdat(imagen.length), exif.length, op.refExterna ? 1 : 0),
              ]),
          item(3, 0, enMdat(imagen.length + (enIdat ? 0 : exif.length)), xmp.length),
        ];
    const iloc = caja(
      'iloc',
      [0x44, 0x00, ...id(entradas.length, ancho), ...entradas.flat()],
      ilocVer,
    );
    return caja(
      'meta',
      [
        ...caja('hdlr', [0, 0, 0, 0, ...txt('pict'), ...Array(12).fill(0), 0], 0),
        ...caja('pitm', be16(1), 0),
        ...iinf,
        ...iloc,
        ...iprp,
        ...(enIdat ? caja('idat', exif) : []),
        ...(op.extraMeta ?? []),
      ],
      0,
    );
  };
  const largoMeta = armarMeta(0).length;
  const base = ftyp.length + largoMeta + 8;
  const mdat = caja('mdat', op.limpio ? imagen : [...imagen, ...(enIdat ? [] : exif), ...xmp]);
  return new Uint8Array([...ftyp, ...armarMeta(base), ...mdat]);
}
