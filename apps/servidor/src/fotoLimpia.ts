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
 * NXT-4 y NXT-4x · HEIC/HEIF (ISO/IEC 23008-12, sobre las cajas de ISO BMFF). El iPhone guarda la
 * ubicación, el modelo y la hora en un «ítem» Exif y el XMP en un ítem «mime»; `iinf` dice qué
 * ítems hay e `iloc` dónde están sus bytes (en `mdat` o en `idat`).
 *
 * Regla de LISTA BLANCA (NXT-4x, lo devolvió el revisor): de todo el archivo solo sobrevive lo que
 * la imagen necesita. Los bytes que no son de un ítem de imagen se llenan de ceros en una COPIA: los
 * ítems Exif/XMP/uri, las cajas `free`/`skip`, todo lo de `mdat` (también un segundo `mdat` o uno
 * «hasta el final») e `idat` que ningún ítem de imagen usa, los nombres de los ítems y del `hdlr`.
 * Dentro de `meta`, de `iprp` y de `ipco` solo se aceptan las cajas conocidas, y las que solo llevan
 * números tienen que medir justo lo que deben. Lo demás (y todo lo que no cuadre) da HEIC_SIN_LIMPIAR.
 * La estructura y el largo no cambian, así los desplazamientos de `iloc` siguen valiendo.
 */
const HEIF_ARRIBA = new Set(['ftyp', 'meta', 'mdat', 'free', 'skip']);
const HEIF_META = new Set(['hdlr', 'pitm', 'iinf', 'iloc', 'iref', 'iprp', 'idat', 'dinf']);
const HEIF_PROPIEDADES = new Set([
  'hvcC',
  'av1C',
  'lhvC',
  'ispe',
  'colr',
  'pixi',
  'irot',
  'imir',
  'clap',
  'auxC',
  'clli',
  'mdcv',
  'cclv',
  'amve',
  'pasp',
  'rloc',
  'lsel',
  'a1op',
  'a1lx',
  'oinf',
  'tols',
  'jpgC',
]);
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

/** Fin del texto que empieza en `i` (sin contar el cero); sin cero antes de `fin`, no cuadra. */
function finTexto(b: Uint8Array, i: number, fin: number) {
  let j = i;
  while (j < fin && b.at(j) !== 0) j++;
  if (j >= fin) throw HEIC_SIN_LIMPIAR();
  return j;
}

function limpiarHeif(b: Uint8Array): FotoLimpia {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const no = (cond: boolean) => {
    if (cond) throw HEIC_SIN_LIMPIAR();
  };
  const u16 = (o: number) => v.getUint16(o);
  const u32 = (o: number) => v.getUint32(o);
  const arriba = cajas(b, 0, b.length);
  no(arriba[0]?.tipo !== 'ftyp');
  no(arriba.some((c) => !HEIF_ARRIBA.has(c.tipo)));
  const metas = arriba.filter((c) => c.tipo === 'meta');
  no(metas.length !== 1);
  const meta = metas[0]!;
  const dentro = cajas(b, meta.datos + 4, meta.fin);
  no(dentro.some((c) => !HEIF_META.has(c.tipo)));
  const una = (tipo: string) => {
    const l = dentro.filter((c) => c.tipo === tipo);
    no(l.length > 1);
    return l[0];
  };
  const [hdlr, pitm, iinf, iloc, iref, iprp, idat, dinf] = [...HEIF_META].map(una);
  no(!hdlr || !iinf || !iloc);

  // Lo que se va a llenar de ceros (todo se aplica al final, sobre una copia).
  const ceros: [number, number][] = [];
  // hdlr: versión, pre_defined, tipo y 12 reservados; el nombre que sigue se borra.
  no(hdlr!.datos + 24 > hdlr!.fin);
  ceros.push([hdlr!.datos + 24, hdlr!.fin]);
  // pitm y dinf: solo números (dinf: una referencia «este mismo archivo», sin dirección).
  if (pitm) no(pitm.fin - pitm.datos !== ((b[pitm.datos] ?? 0) === 0 ? 6 : 8));
  if (dinf) {
    const dref = cajas(b, dinf.datos, dinf.fin);
    no(dref.length !== 1 || dref[0]!.tipo !== 'dref');
    const entradas = cajas(b, dref[0]!.datos + 8, dref[0]!.fin);
    no(u32(dref[0]!.datos + 4) !== entradas.length);
    for (const e of entradas)
      no(e.tipo !== 'url ' || e.fin - e.datos !== 4 || ((b[e.datos + 3] ?? 0) & 1) !== 1);
  }
  // iref: cada referencia mide justo lo que dicen sus números.
  if (iref) {
    const t = (b[iref.datos] ?? 0) === 0 ? 2 : 4;
    for (const r of cajas(b, iref.datos + 4, iref.fin)) {
      no(r.datos + t + 2 > r.fin);
      no(r.fin - r.datos !== t + 2 + u16(r.datos + t) * t);
    }
  }
  // iprp: solo ipco (propiedades conocidas) e ipma (que mide justo lo que dice).
  if (iprp)
    for (const c of cajas(b, iprp.datos, iprp.fin)) {
      if (c.tipo === 'ipco') {
        no(cajas(b, c.datos, c.fin).some((x) => !HEIF_PROPIEDADES.has(x.tipo)));
      } else if (c.tipo === 'ipma') {
        const ver = b[c.datos] ?? 0;
        const largo = ((b[c.datos + 3] ?? 0) & 1) === 1 ? 2 : 1;
        let q = c.datos + 4;
        no(q + 4 > c.fin);
        const n = u32(q);
        q += 4;
        for (let k = 0; k < n; k++) {
          q += ver < 1 ? 2 : 4;
          no(q + 1 > c.fin);
          q += 1 + (b.at(q) ?? 0) * largo;
          no(q > c.fin);
        }
        no(q !== c.fin);
      } else no(true);
    }

  // Qué ítems hay; los nombres se borran; los ocultos se marcan.
  const ocultos = new Map<number, string>();
  const verInf = b[iinf!.datos] ?? 0;
  const primeraInfe = iinf!.datos + 4 + (verInf === 0 ? 2 : 4);
  no(primeraInfe > iinf!.fin);
  const infes = cajas(b, primeraInfe, iinf!.fin);
  no(infes.length !== (verInf === 0 ? u16(iinf!.datos + 4) : u32(iinf!.datos + 4)));
  for (const e of infes) {
    no(e.tipo !== 'infe');
    const ver = b[e.datos] ?? 0;
    no(ver < 2 || ver > 3);
    const p = e.datos + 4;
    no(p + (ver === 2 ? 8 : 10) > e.fin);
    const id = ver === 2 ? u16(p) : u32(p);
    const tipo = ascii(b, p + (ver === 2 ? 4 : 6), 4);
    const nombre = p + (ver === 2 ? 8 : 10);
    // El nombre y lo que venga detrás (tipo de contenido, codificación) no hacen falta.
    finTexto(b, nombre, e.fin);
    ceros.push([nombre, e.fin]);
    if (HEIF_OCULTOS.has(tipo)) ocultos.set(id, tipo);
  }

  // Dónde están los bytes de cada ítem (iloc, versiones 0, 1 y 2).
  const ver = b[iloc!.datos] ?? 0;
  no(ver > 2);
  let p = iloc!.datos + 4;
  const leer = (n: number) => {
    no(p + n > iloc!.fin);
    let x = 0;
    if (n === 8) {
      no(u32(p) !== 0);
      x = u32(p + 4);
    } else if (n === 4) x = u32(p);
    else if (n === 2) x = u16(p);
    else no(n !== 0);
    p += n;
    return x;
  };
  no(p + 2 > iloc!.fin);
  const t1 = b.at(p) ?? 0;
  const t2 = b.at(p + 1) ?? 0;
  p += 2;
  const [tOff, tLar, tBase] = [t1 >> 4, t1 & 15, t2 >> 4];
  const tIdx = ver === 0 ? 0 : t2 & 15;
  const cuantos = leer(ver < 2 ? 2 : 4);
  const mdats = arriba.filter((c) => c.tipo === 'mdat');
  const guardar: [number, number][] = [];
  const borrar: [number, number][] = [];
  const conIloc = new Set<number>();
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
      const off = leer(tOff);
      const lar = leer(tLar);
      // Los datos tienen que estar en ESTE archivo (mdat o idat) y con su largo dicho.
      no(refDatos !== 0 || metodo > 1 || (metodo === 1 && !idat) || lar === 0);
      const ini = (metodo === 1 ? idat!.datos : 0) + baseOff + off;
      const caja = metodo === 1 ? [idat!] : mdats;
      no(!caja.some((c) => ini >= c.datos && ini + lar <= c.fin));
      tramos.push([ini, ini + lar]);
    }
    conIloc.add(id);
    if (!ocultos.has(id)) {
      guardar.push(...tramos);
      continue;
    }
    borrar.push(...tramos);
    if (ocultos.get(id) === 'Exif' && tramos.length) {
      // Ítem Exif: 4 bytes con el desplazamiento hasta la cabecera TIFF, después el EXIF.
      const d = unir(tramos.map(([a, z]) => b.subarray(a, z)));
      if (d.length >= 4) {
        const salto = new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(0);
        const tiff = d.subarray(Math.min(d.length, 4 + salto));
        gps ??= leerTiff(ascii(tiff, 0, 6) === 'Exif\0\0' ? tiff.subarray(6) : tiff).gps;
      }
    }
  }
  no(p !== iloc!.fin);
  // Un ítem oculto sin dónde están sus datos: no sabemos dónde vive, no se guarda.
  for (const id of ocultos.keys()) no(!conIloc.has(id));

  // free/skip: fuera todo su contenido. mdat e idat: fuera lo que no es de un ítem de imagen.
  for (const c of arriba) if (c.tipo === 'free' || c.tipo === 'skip') ceros.push([c.datos, c.fin]);
  for (const c of [...mdats, ...(idat ? [idat] : [])]) {
    const dentroDe = guardar
      .filter(([a, z]) => a >= c.datos && z <= c.fin)
      .sort((x, y) => x[0] - y[0]);
    let desde = c.datos;
    for (const [a, z] of dentroDe) {
      if (a > desde) ceros.push([desde, a]);
      desde = Math.max(desde, z);
    }
    if (desde < c.fin) ceros.push([desde, c.fin]);
  }
  // Los ocultos van al final: ganan aunque un ítem de imagen diga que comparte sus bytes.
  ceros.push(...borrar);

  const salida = b.slice();
  let cambios = 0;
  for (const [a, z] of ceros) {
    const tramo = salida.subarray(a, z);
    if (tramo.some((x) => x !== 0)) {
      cambios++;
      tramo.fill(0);
    }
  }
  if (!cambios) return { bytes: b, gps, quitados: 0 };
  return { bytes: salida, gps, quitados: Math.max(1, ocultos.size) };
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
