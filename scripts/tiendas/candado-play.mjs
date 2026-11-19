// C-PRUEBAS-OTRO-PAQUETE (18 nov 2026, aprobado por Gerencia) — todos los países. Candado de las subidas
// a Google Play: NINGUNA pista recibe un archivo de pruebas. Se niega si el paquete termina en
// «.pruebas» o si el contenido del archivo (ya descomprimido) apunta al sitio de pruebas. Lo llama
// `google-play.mjs` antes de mandar cualquier .aab o .apk, así ningún guion se lo puede saltar.
import { inflateRawSync } from 'node:zlib';

export const SITIO_PRUEBAS = 'staging.tumbite.com';
export const SUFIJO_PRUEBAS = '.pruebas';

/** Las entradas de un .zip (.aab y .apk lo son), descomprimidas, sin librerías de fuera. */
export function* entradasZip(bytes) {
  const b = Buffer.from(bytes);
  // El final del directorio central: firma 0x06054b50, en los últimos 64 KB.
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--)
    if (b.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  if (fin < 0) throw new Error('el archivo no es un .aab ni un .apk (no es un zip)');
  const total = b.readUInt16LE(fin + 10);
  let p = b.readUInt32LE(fin + 16);
  for (let n = 0; n < total; n++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('el zip está dañado');
    const metodo = b.readUInt16LE(p + 10);
    const comprimido = b.readUInt32LE(p + 20);
    const largoNombre = b.readUInt16LE(p + 28);
    const largoExtra = b.readUInt16LE(p + 30);
    const largoComentario = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const nombre = b.toString('utf8', p + 46, p + 46 + largoNombre);
    const datos = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const crudo = b.subarray(datos, datos + comprimido);
    yield { nombre, contenido: metodo === 8 ? inflateRawSync(crudo) : crudo };
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
}

const buscar = (contenido, texto) =>
  contenido.includes(Buffer.from(texto, 'utf8')) ||
  contenido.includes(Buffer.from(texto, 'utf16le'));

/**
 * Lanza un error en palabras si el archivo no puede ir a Google Play. `paquete` es el de la ficha a la
 * que se sube; `bytes`, el .aab o .apk entero.
 */
export function revisarArchivoParaPlay(paquete, bytes) {
  if (String(paquete).endsWith(SUFIJO_PRUEBAS))
    throw new Error(
      `NO SE SUBE: ${paquete} es una app de PRUEBAS. Las de pruebas se instalan por enlace, nunca por Google Play.`,
    );
  for (const { nombre, contenido } of entradasZip(bytes)) {
    if (buscar(contenido, SITIO_PRUEBAS))
      throw new Error(
        `NO SE SUBE: el archivo apunta al sitio de pruebas (${SITIO_PRUEBAS}, en ${nombre}). Compílalo con el perfil «production».`,
      );
    if (buscar(contenido, `${paquete}${SUFIJO_PRUEBAS}`))
      throw new Error(
        `NO SE SUBE: el archivo es la app de pruebas (${paquete}${SUFIJO_PRUEBAS}, en ${nombre}). Compílalo con el perfil «production».`,
      );
  }
}
