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
/**
 * SIG-6z: PNG y WebP se recorren bloque a bloque y su estructura tiene que cuadrar. Si no cuadra
 * (un bloque que se sale del archivo, un PNG sin IEND, un largo RIFF imposible o que no coincide
 * con sus bloques), la foto se RECHAZA con el 415 de «foto dañada»: nunca se devuelve el original
 * ni se guarda mordida. Lo pegado después del fin real de la imagen (IEND, largo RIFF) se corta.
 */
function limpiarPng(b: Uint8Array): FotoLimpia {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const partes: Uint8Array[] = [b.subarray(0, 8)];
  let gps: GpsFoto | null = null;
  let quitados = 0;
  let i = 8;
  for (;;) {
    if (i + 12 > b.length) throw ROTA();
    const tipo = ascii(b, i + 4, 4);
    const largo = v.getUint32(i);
    const fin = i + 12 + largo;
    if (fin > b.length) throw ROTA();
    if (PNG_FUERA.has(tipo)) {
      if (tipo === 'eXIf') gps ??= leerTiff(b.subarray(i + 8, i + 8 + largo)).gps;
      quitados++;
    } else partes.push(b.subarray(i, fin));
    i = fin;
    if (tipo === 'IEND') {
      // Lo pegado después del fin de la imagen (otra imagen, un video) no se guarda.
      if (i < b.length) quitados++;
      return { bytes: quitados ? unir(partes) : b, gps, quitados };
    }
  }
}

function limpiarWebp(b: Uint8Array): FotoLimpia {
  if (b.length < 12) throw ROTA();
  const riff = new DataView(b.buffer, b.byteOffset + 4, 4).getUint32(0, true);
  // El largo RIFF cuenta desde «WEBP»: menos de 4 o más que el archivo es imposible.
  if (riff < 4 || 8 + riff > b.length) throw ROTA();
  const finRiff = 8 + riff;
  const partes: Uint8Array[] = [];
  let gps: GpsFoto | null = null;
  let quitados = finRiff < b.length ? 1 : 0;
  let i = 12;
  while (i < finRiff) {
    if (i + 8 > finRiff) throw ROTA();
    const tipo = ascii(b, i, 4);
    const largo = new DataView(b.buffer, b.byteOffset + i + 4, 4).getUint32(0, true);
    // Cada bloque va con su relleno a par; el último puede venir sin él.
    const fin = i + 8 + largo + (largo % 2);
    if (i + 8 + largo > finRiff) throw ROTA();
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
  if (!partes.length) throw ROTA();
  if (!quitados) return { bytes: b, gps, quitados };
  const cuerpo = unir(partes);
  const cab = new Uint8Array(12);
  cab.set(b.subarray(0, 12));
  new DataView(cab.buffer).setUint32(4, cuerpo.length + 4, true);
  return { bytes: unir([cab, cuerpo]), gps, quitados };
}

/**
 * NXT-4 (3 nov 2026): el HEIC del iPhone no se pudo limpiar y se rechaza con este mensaje claro
 * (nunca se guarda el original con su GPS). El iPhone manda JPEG si en Ajustes → Cámara → Formatos
 * se elige «Más compatible», y casi todas las apps lo convierten solas al compartir.
 */
export const HEIC_SIN_LIMPIAR = () =>
  new ErrorDatos(
    'No pudimos abrir esta foto HEIC del iPhone. Mándala en JPG (en el iPhone: Ajustes → Cámara → Formatos → Más compatible) o haz una captura de pantalla y vuelve a intentar.',
    'foto',
    415,
  );

/**
 * NXT-4 · HEIC/HEIF (ISO/IEC 23008-12, sobre el formato de cajas ISO BMFF). El iPhone guarda la
 * ubicación, el modelo y la hora en un «ítem» Exif y el XMP en un ítem «mime»; la caja `iinf` dice
 * qué ítems hay y la caja `iloc` dónde están sus bytes (en `mdat` o en `idat`). Aquí se buscan esos
 * ítems y sus bytes se BORRAN en el lugar (se llenan de ceros): la estructura queda igual, la
 * imagen y sus miniaturas no se tocan y los visores ignoran un Exif vacío. Se lee el GPS antes.
 * Todo lo que no cuadre (cajas que se salen del archivo, un ítem con sus datos en otro archivo,
 * versiones que no conocemos, una secuencia con `moov`) se rechaza con HEIC_SIN_LIMPIAR.
 */
const HEIF_ARRIBA = new Set(['ftyp', 'meta', 'mdat', 'free', 'skip']);
const HEIF_OCULTOS = new Set(['Exif', 'mime', 'uri ']);
type Caja = { tipo: string; ini: number; datos: number; fin: number };

function cajas(b: Uint8Array, ini: number, fin: number): Caja[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const lista: Caja[] = [];
  let i = ini;
  while (i < fin) {
    if (i + 8 > fin) throw HEIC_SIN_LIMPIAR();
    let largo = v.getUint32(i);
    const tipo = ascii(b, i + 4, 4);
    let datos = i + 8;
    if (largo === 1) {
      if (i + 16 > fin) throw HEIC_SIN_LIMPIAR();
      const alto = v.getUint32(i + 8);
      if (alto !== 0) throw HEIC_SIN_LIMPIAR();
      largo = v.getUint32(i + 12);
      datos = i + 16;
    } else if (largo === 0) largo = fin - i;
    if (largo < datos - i || i + largo > fin) throw HEIC_SIN_LIMPIAR();
    lista.push({ tipo, ini: i, datos, fin: i + largo });
    i += largo;
  }
  return lista;
}

function limpiarHeif(b: Uint8Array): FotoLimpia {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const arriba = cajas(b, 0, b.length);
  if (arriba[0]?.tipo !== 'ftyp') throw HEIC_SIN_LIMPIAR();
  if (arriba.some((c) => !HEIF_ARRIBA.has(c.tipo))) throw HEIC_SIN_LIMPIAR();
  const metas = arriba.filter((c) => c.tipo === 'meta');
  if (metas.length !== 1) throw HEIC_SIN_LIMPIAR();
  const meta = metas[0]!;
  const dentro = cajas(b, meta.datos + 4, meta.fin);
  const una = (tipo: string) => {
    const l = dentro.filter((c) => c.tipo === tipo);
    if (l.length > 1) throw HEIC_SIN_LIMPIAR();
    return l[0];
  };
  const iinf = una('iinf');
  const iloc = una('iloc');
  const idat = una('idat');
  if (!iinf) return { bytes: b, gps: null, quitados: 0 };

  // Qué ítems son datos ocultos (Exif, XMP u otro texto «mime», un enlace «uri »).
  const ocultos = new Map<number, string>();
  const verInf = b[iinf.datos] ?? 0;
  const primeraInfe = iinf.datos + 4 + (verInf === 0 ? 2 : 4);
  if (primeraInfe > iinf.fin) throw HEIC_SIN_LIMPIAR();
  for (const e of cajas(b, primeraInfe, iinf.fin)) {
    if (e.tipo !== 'infe') continue;
    const ver = b[e.datos] ?? 0;
    if (ver < 2 || ver > 3) throw HEIC_SIN_LIMPIAR();
    const p = e.datos + 4;
    if (p + (ver === 2 ? 8 : 10) > e.fin) throw HEIC_SIN_LIMPIAR();
    const id = ver === 2 ? v.getUint16(p) : v.getUint32(p);
    const tipo = ascii(b, p + (ver === 2 ? 4 : 6), 4);
    if (HEIF_OCULTOS.has(tipo)) ocultos.set(id, tipo);
  }
  if (!ocultos.size) return { bytes: b, gps: null, quitados: 0 };
  if (!iloc) throw HEIC_SIN_LIMPIAR();

  // Dónde están sus bytes (iloc, versiones 0, 1 y 2).
  const ver = b[iloc.datos] ?? 0;
  if (ver > 2) throw HEIC_SIN_LIMPIAR();
  let p = iloc.datos + 4;
  const fuera = (n: number) => {
    if (p + n > iloc.fin) throw HEIC_SIN_LIMPIAR();
  };
  const leer = (n: number) => {
    fuera(n);
    let x = 0;
    if (n === 8) {
      if (v.getUint32(p) !== 0) throw HEIC_SIN_LIMPIAR();
      x = v.getUint32(p + 4);
    } else if (n === 4) x = v.getUint32(p);
    else if (n === 2) x = v.getUint16(p);
    else if (n !== 0) throw HEIC_SIN_LIMPIAR();
    p += n;
    return x;
  };
  fuera(2);
  const t1 = b.at(p) ?? 0;
  const t2 = b.at(p + 1) ?? 0;
  p += 2;
  const [tOff, tLar, tBase] = [t1 >> 4, t1 & 15, t2 >> 4];
  const tIdx = ver === 0 ? 0 : t2 & 15;
  const cuantos = leer(ver < 2 ? 2 : 4);
  const salida = b.slice();
  const borrados = new Set<number>();
  let gps: GpsFoto | null = null;
  for (let k = 0; k < cuantos; k++) {
    const id = leer(ver < 2 ? 2 : 4);
    const metodo = ver === 0 ? 0 : leer(2) & 15;
    const refDatos = leer(2);
    const baseOff = leer(tBase);
    const extensiones = leer(2);
    const tramos: [number, number][] = [];
    for (let e = 0; e < extensiones; e++) {
      leer(tIdx);
      tramos.push([leer(tOff), leer(tLar)]);
    }
    if (!ocultos.has(id)) continue;
    // Los datos tienen que estar en ESTE archivo (mdat o idat) y con su largo dicho.
    if (refDatos !== 0 || metodo > 1 || (metodo === 1 && !idat)) throw HEIC_SIN_LIMPIAR();
    const origen = metodo === 1 ? idat!.datos : 0;
    const limite = metodo === 1 ? idat!.fin : b.length;
    const trozos: Uint8Array[] = [];
    for (const [off, lar] of tramos) {
      const ini = origen + baseOff + off;
      if (lar === 0 || ini + lar > limite) throw HEIC_SIN_LIMPIAR();
      trozos.push(b.subarray(ini, ini + lar));
      salida.fill(0, ini, ini + lar);
    }
    if (ocultos.get(id) === 'Exif' && trozos.length) {
      // Ítem Exif: 4 bytes con el desplazamiento hasta la cabecera TIFF, después el EXIF.
      const d = unir(trozos);
      if (d.length >= 4) {
        const salto = new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(0);
        const tiff = d.subarray(Math.min(d.length, 4 + salto));
        gps ??= leerTiff(ascii(tiff, 0, 6) === 'Exif\0\0' ? tiff.subarray(6) : tiff).gps;
      }
    }
    borrados.add(id);
  }
  // Un ítem oculto sin dónde están sus datos: no sabemos dónde vive, no se guarda.
  for (const id of ocultos.keys()) if (!borrados.has(id)) throw HEIC_SIN_LIMPIAR();
  return { bytes: salida, gps, quitados: borrados.size };
}

/**
 * Quita los datos ocultos de una foto JPEG, PNG, WebP o HEIC/HEIF. Cualquier otra imagen se
 * rechaza (nunca se guarda tal cual); lo que no es imagen (un PDF de evidencia) pasa igual.
 */
export function limpiarFoto(bytes: Uint8Array, tipo: string): FotoLimpia {
  if (tipo === 'image/jpeg') return limpiarJpeg(bytes);
  if (tipo === 'image/png') return limpiarPng(bytes);
  if (tipo === 'image/webp') return limpiarWebp(bytes);
  if (tipo === 'image/heic' || tipo === 'image/heif') return limpiarHeif(bytes);
  if (tipo.startsWith('image/'))
    throw new ErrorDatos('Sube una foto en JPG, PNG, WebP o HEIC.', 'foto', 415);
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
