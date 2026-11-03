import { ErrorDatos } from './validar';

/**
 * C-FOTOS-SIN-METADATOS (SIG-6, 2 nov 2026): ninguna foto llega al almacén con datos ocultos. Los
 * celulares guardan dentro del JPEG/PNG/WebP la ubicación exacta (GPS), el modelo del teléfono, la
 * hora y a veces el nombre del dueño (bloques EXIF y XMP). Cloudflare Images y las redes grandes los
 * quitan al publicar [DOC]; aquí se quitan ANTES de cada `BUCKET.put`, con esta sola pieza.
 *
 * - JPEG: se quitan APP1 (EXIF y XMP), APP3–APP13, APP15 y los comentarios. Se conservan JFIF
 *   (APP0), el perfil de color (APP2 ICC) y Adobe (APP14). La orientación se conserva en un EXIF
 *   mínimo con SOLO ese dato: si no, las fotos de celular se verían giradas.
 * - PNG: se quitan eXIf, tEXt, zTXt, iTXt y tIME.
 * - WebP: se quitan EXIF y XMP y se apagan sus marcas en VP8X.
 * - Antes de quitarlo se lee el GPS: la foto de entrega lo guarda aparte, como prueba.
 * - Una foto con la estructura rota se rechaza con un mensaje claro (nunca se guarda a medias).
 * - Los documentos de identidad y de vehículo conservan el original (`conservarOriginal`): son la
 *   evidencia que se revisa; viven en carpetas privadas.
 */
export type GpsFoto = { lat: number; lng: number };
export type FotoLimpia = { bytes: Uint8Array; gps: GpsFoto | null; quitados: number };

const ROTA = () =>
  new ErrorDatos(
    'La foto llegó dañada y no se pudo abrir. Tómala otra vez y vuelve a intentar.',
    'foto',
    415,
  );
const ascii = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...b.subarray(i, Math.min(b.length, i + n)));

/** Lee orientación y GPS de un bloque TIFF (el corazón del EXIF). Nunca lanza: lo dudoso es null. */
export function leerTiff(t: Uint8Array): { orientacion: number; gps: GpsFoto | null } {
  const vacio = { orientacion: 1, gps: null };
  if (t.length < 8) return vacio;
  const le = ascii(t, 0, 2) === 'II';
  if (!le && ascii(t, 0, 2) !== 'MM') return vacio;
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const u16 = (o: number) => (o + 2 <= t.length ? v.getUint16(o, le) : NaN);
  const u32 = (o: number) => (o + 4 <= t.length ? v.getUint32(o, le) : NaN);
  if (u16(2) !== 42) return vacio;
  const entradas = (ifd: number) => {
    const n = u16(ifd);
    const m = new Map<number, number>();
    if (!Number.isFinite(n) || n > 500) return m;
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      if (e + 12 > t.length) break;
      m.set(u16(e), e);
    }
    return m;
  };
  const ifd0 = entradas(u32(4));
  const eo = ifd0.get(0x0112);
  const orientacion = eo !== undefined ? u16(eo + 8) : 1;
  const ep = ifd0.get(0x8825);
  let gps: GpsFoto | null = null;
  if (ep !== undefined) {
    const g = entradas(u32(ep + 8));
    const ref = (tag: number) => {
      const e = g.get(tag);
      return e === undefined ? '' : ascii(t, e + 8, 1);
    };
    const grados = (tag: number) => {
      const e = g.get(tag);
      if (e === undefined || u32(e + 4) !== 3) return NaN;
      const o = u32(e + 8);
      const r = (i: number) => u32(o + i * 8) / u32(o + i * 8 + 4);
      return r(0) + r(1) / 60 + r(2) / 3600;
    };
    const lat = grados(2) * (ref(1) === 'S' ? -1 : 1);
    const lng = grados(4) * (ref(3) === 'W' ? -1 : 1);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
      gps = { lat, lng };
  }
  return {
    orientacion:
      Number.isInteger(orientacion) && orientacion >= 1 && orientacion <= 8 ? orientacion : 1,
    gps,
  };
}

/** APP1 con un EXIF que solo lleva la orientación (big-endian). */
function exifSoloOrientacion(o: number): Uint8Array {
  const tiff = [
    0x4d,
    0x4d,
    0,
    42,
    0,
    0,
    0,
    8,
    0,
    1,
    0x01,
    0x12,
    0,
    3,
    0,
    0,
    0,
    1,
    0,
    o,
    0,
    0,
    0,
    0,
    0,
    0,
  ];
  const cuerpo = [...'Exif'].map((c) => c.charCodeAt(0)).concat([0, 0], tiff);
  const largo = cuerpo.length + 2;
  return new Uint8Array([0xff, 0xe1, largo >> 8, largo & 0xff, ...cuerpo]);
}

function unir(partes: Uint8Array[]) {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

function limpiarJpeg(b: Uint8Array): FotoLimpia {
  const partes: Uint8Array[] = [b.subarray(0, 2)];
  let gps: GpsFoto | null = null;
  let quitados = 0;
  let orientacionPuesta = false;
  let i = 2;
  while (i < b.length) {
    if (b.at(i) !== 0xff) throw ROTA();
    while (b[i + 1] === 0xff) i++;
    const marca = b[i + 1];
    if (marca === undefined) return { bytes: quitados ? unir(partes) : b, gps, quitados };
    if (marca === 0xd9) {
      // SIG-6x: fin de la imagen. Lo que venga pegado detrás (la segunda imagen MPF de iPhone y
      // Samsung, el video de una foto en movimiento de Pixel) trae su propio EXIF y su GPS: se corta.
      partes.push(b.subarray(i, i + 2));
      if (i + 2 < b.length) quitados++;
      return { bytes: quitados ? unir(partes) : b, gps, quitados };
    }
    if (marca === 0xda) {
      // SIG-6x: el escaneo se copia con su cabecera y sus datos hasta el siguiente marcador de
      // verdad (0xFF00 es un 0xFF de los datos; RST0–RST7 y el relleno 0xFFFF siguen dentro). Así
      // los marcadores entre escaneos de un JPEG progresivo pasan por la misma limpieza.
      const largoSos = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
      if (largoSos < 2) throw ROTA();
      let j = i + 2 + largoSos;
      while (j < b.length) {
        if (b.at(j) !== 0xff) {
          j++;
          continue;
        }
        const sig = b.at(j + 1);
        if (sig === undefined) break;
        if (sig === 0x00 || sig === 0xff || (sig >= 0xd0 && sig <= 0xd7)) {
          j += sig === 0xff ? 1 : 2;
          continue;
        }
        break;
      }
      partes.push(b.subarray(i, Math.min(j, b.length)));
      if (j >= b.length) return { bytes: quitados ? unir(partes) : b, gps, quitados };
      i = j;
      continue;
    }
    if ((marca >= 0xd0 && marca <= 0xd7) || marca === 0x01) {
      partes.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const largo = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    const oculto =
      marca === 0xe1 || (marca >= 0xe3 && marca <= 0xed) || marca === 0xef || marca === 0xfe;
    if (largo < 2) throw ROTA();
    if (i + 2 + largo > b.length) {
      // Archivo cortado: lo que queda se copia si es imagen; un bloque oculto se descarta.
      if (oculto) quitados++;
      else partes.push(b.subarray(i));
      return { bytes: quitados ? unir(partes) : b, gps, quitados };
    }
    const seg = b.subarray(i, i + 2 + largo);
    const datos = seg.subarray(4);
    let guardar: boolean;
    if (marca === 0xe1) {
      guardar = false;
      if (ascii(datos, 0, 6) === 'Exif\0\0') {
        const t = leerTiff(datos.subarray(6));
        gps ??= t.gps;
        if (t.orientacion !== 1 && !orientacionPuesta) {
          partes.push(exifSoloOrientacion(t.orientacion));
          orientacionPuesta = true;
        }
      }
    } else if (marca === 0xe0) guardar = ascii(datos, 0, 5) === 'JFIF\0';
    else if (marca === 0xe2) guardar = ascii(datos, 0, 12) === 'ICC_PROFILE\0';
    else if (marca === 0xee) guardar = true;
    else guardar = !((marca >= 0xe3 && marca <= 0xef) || marca === 0xfe);
    if (guardar) partes.push(seg);
    else quitados++;
    i += 2 + largo;
  }
  throw ROTA();
}

const PNG_FUERA = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
function limpiarPng(b: Uint8Array): FotoLimpia {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const partes: Uint8Array[] = [b.subarray(0, 8)];
  let gps: GpsFoto | null = null;
  let quitados = 0;
  let i = 8;
  while (i < b.length) {
    const tipo = ascii(b, i + 4, 4);
    const fin = i + 12 + (i + 4 <= b.length ? v.getUint32(i) : 0);
    if (i + 12 > b.length || fin > b.length) {
      // Archivo cortado: lo que queda se copia si es imagen; un bloque oculto se descarta.
      if (PNG_FUERA.has(tipo)) quitados++;
      else partes.push(b.subarray(i));
      break;
    }
    const largo = fin - i - 12;
    if (PNG_FUERA.has(tipo)) {
      if (tipo === 'eXIf') gps ??= leerTiff(b.subarray(i + 8, i + 8 + largo)).gps;
      quitados++;
    } else partes.push(b.subarray(i, fin));
    i = fin;
    if (tipo === 'IEND') {
      // SIG-6y: lo pegado después del fin de la imagen (otra imagen, un video) no se guarda.
      if (i < b.length) quitados++;
      break;
    }
  }
  return { bytes: quitados ? unir(partes) : b, gps, quitados };
}

function limpiarWebp(b: Uint8Array): FotoLimpia {
  const partes: Uint8Array[] = [];
  let gps: GpsFoto | null = null;
  let quitados = 0;
  let i = 12;
  // SIG-6y: la imagen termina donde dice su largo RIFF; lo pegado detrás no se guarda. Un largo
  // imposible (más que el archivo) vale como «hasta el final», como un archivo cortado.
  const riff = b.length >= 8 ? new DataView(b.buffer, b.byteOffset + 4, 4).getUint32(0, true) : 0;
  const finRiff = riff >= 4 && 8 + riff <= b.length ? 8 + riff : b.length;
  if (finRiff < b.length) quitados++;
  while (i < finRiff) {
    if (i + 8 > finRiff) {
      partes.push(b.slice(i, finRiff));
      break;
    }
    const tipo = ascii(b, i, 4);
    const largo = new DataView(b.buffer, b.byteOffset + i + 4, 4).getUint32(0, true);
    const fin = i + 8 + largo + (largo % 2);
    if (i + 8 + largo > finRiff) {
      // Último trozo cortado: si es imagen se copia tal cual (no es dato oculto); si es EXIF o
      // XMP, se descarta. Nunca se deja pasar un dato oculto.
      if (tipo !== 'EXIF' && tipo !== 'XMP ') partes.push(b.slice(i, finRiff));
      else quitados++;
      break;
    }
    if (tipo === 'EXIF' || tipo === 'XMP ') {
      if (tipo === 'EXIF') {
        const d = b.subarray(i + 8, i + 8 + largo);
        gps ??= leerTiff(ascii(d, 0, 6) === 'Exif\0\0' ? d.subarray(6) : d).gps;
      }
      quitados++;
    } else {
      const trozo = b.slice(i, Math.min(fin, finRiff));
      // VP8X: apagar las marcas de «trae EXIF» (0x08) y «trae XMP» (0x04).
      if (tipo === 'VP8X' && trozo.length > 8) trozo[8] = (trozo[8] ?? 0) & ~0x0c;
      partes.push(trozo);
    }
    i = fin;
  }
  if (!quitados) return { bytes: b, gps, quitados };
  const cuerpo = unir(partes);
  const cab = new Uint8Array(12);
  cab.set(b.subarray(0, 12));
  new DataView(cab.buffer).setUint32(4, cuerpo.length + 4, true);
  return { bytes: unir([cab, cuerpo]), gps, quitados };
}

/** Quita los datos ocultos de una foto JPEG, PNG o WebP. Otros tipos (PDF, HEIC) pasan igual. */
export function limpiarFoto(bytes: Uint8Array, tipo: string): FotoLimpia {
  if (tipo === 'image/jpeg') return limpiarJpeg(bytes);
  if (tipo === 'image/png') return limpiarPng(bytes);
  if (tipo === 'image/webp') return limpiarWebp(bytes);
  return { bytes, gps: null, quitados: 0 };
}

/**
 * La única forma de guardar una foto en el almacén: limpia y guarda. Devuelve el GPS que traía
 * (para guardarlo aparte cuando es prueba de entrega). `conservarOriginal` solo para documentos de
 * identidad o de vehículo, que son evidencia y viven en carpetas privadas.
 */
export async function guardarFoto(
  bucket: R2Bucket,
  clave: string,
  bytes: Uint8Array,
  tipo: string,
  op: { cacheControl?: string; conservarOriginal?: 'evidencia' } = {},
): Promise<{ gps: GpsFoto | null }> {
  const limpia = op.conservarOriginal ? { bytes, gps: null } : limpiarFoto(bytes, tipo);
  await bucket.put(clave, limpia.bytes, {
    httpMetadata: {
      contentType: tipo,
      ...(op.cacheControl ? { cacheControl: op.cacheControl } : {}),
    },
  });
  return { gps: limpia.gps };
}

/** El GPS que traía la foto, guardado aparte como prueba (la foto ya se guardó sin él). */
export async function anotarGpsFoto(db: D1Database, clave: string, gps: GpsFoto) {
  await db
    .prepare('INSERT OR REPLACE INTO fotos_gps (clave, lat, lng) VALUES (?, ?, ?)')
    .bind(clave, gps.lat, gps.lng)
    .run();
}
