import sharp from 'sharp';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

/**
 * Lee el código de barras PDF417 del reverso de una licencia de EE. UU. desde la FOTO, como el servicio
 * `barcode` de Idswyft: la foto se pasa a escala de grises con sharp y la decodifica ZXing (Apache 2.0).
 * Si no lo encuentra derecho, prueba girada (la gente fotografía la licencia de lado).
 */
async function intentar(foto: Buffer, giro: number): Promise<string | null> {
  const { data, info } = await sharp(foto)
    .rotate(giro)
    .greyscale()
    .resize({ width: 1600, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luz = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const fuente = new RGBLuminanceSource(luz, info.width, info.height);
  const lector = new MultiFormatReader();
  const pistas = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  try {
    return lector.decode(new BinaryBitmap(new HybridBinarizer(fuente)), pistas).getText();
  } catch {
    return null;
  }
}

export async function leerCodigoDeFoto(foto: Buffer): Promise<string | null> {
  for (const giro of [0, 90, 180, 270]) {
    const texto = await intentar(foto, giro);
    if (texto) return texto;
  }
  return null;
}
