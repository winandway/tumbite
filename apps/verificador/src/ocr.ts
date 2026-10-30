import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { leerMrz } from './mrz';
import type { DatosDocumento } from './aamva';

/**
 * OCR del motor (como el de Idswyft, aquí con Tesseract, Apache 2.0). Los datos del idioma vienen del
 * paquete @tesseract.js-data/eng (MIT) que va con el motor: nada se baja de internet al verificar.
 */
const requerir = createRequire(import.meta.url);
const DATOS = join(dirname(requerir.resolve('@tesseract.js-data/eng/package.json')), '4.0.0');

export async function leerTexto(foto: Buffer, soloMrz: boolean): Promise<string> {
  const lector = await createWorker('eng', 1, { langPath: DATOS, gzip: true, cachePath: DATOS });
  try {
    if (soloMrz)
      await lector.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
      });
    // Más contraste y tamaño: el OCR lee mejor las letras chicas de los documentos.
    const limpia = await sharp(foto)
      .greyscale()
      .normalize()
      .resize({ width: 1800 })
      .png()
      .toBuffer();
    return (await lector.recognize(limpia)).data.text;
  } finally {
    await lector.terminate();
  }
}

/** Texto del frente del documento, para cruzarlo con el código de barras o la franja. */
export function leerFrente(foto: Buffer): Promise<string> {
  return leerTexto(foto, false);
}

/**
 * La franja del pasaporte desde la foto: las dos líneas de 44 caracteres. Los dígitos de control dicen
 * si el OCR leyó bien; si no cuadran, se devuelve igual con controlesOk en false (va a revisión).
 */
export async function leerMrzDeFoto(
  foto: Buffer,
  hoy = new Date(),
): Promise<{ datos: DatosDocumento; controlesOk: boolean } | null> {
  const lineas = (await leerTexto(foto, true))
    .split('\n')
    .map((l) => l.replace(/\s/g, ''))
    .filter((l) => l.length >= 40);
  for (let i = 0; i + 1 < lineas.length; i++) {
    const a = (lineas.at(i) ?? '').padEnd(44, '<').slice(0, 44);
    const b = (lineas.at(i + 1) ?? '').padEnd(44, '<').slice(0, 44);
    const r = leerMrz([a, b], hoy);
    if (r) return r;
  }
  return null;
}
