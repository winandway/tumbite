/**
 * C-CARA-EN-NEGRO (ensayo general, 24 nov 2026; todos los países). Richard vio en «Así te ven los
 * pasajeros» un círculo NEGRO con «Identidad verificada»: la app pintaba bien la foto (comprobado con
 * una foto real en Driver y en «Tu conductor»), pero la cara que se aprobó era una foto en negro (la
 * cámara entregó un cuadro oscuro). El pasajero vería un círculo negro. Una cara así no se aprueba:
 * se pide de nuevo.
 *
 * Regla pura: los píxeles RGBA de la foto reducida (32×32 bastan). Negra = casi sin luz y casi sin
 * contraste. Una foto de noche con una cara sigue teniendo contraste.
 */
export function esFotoEnNegro(rgba: ArrayLike<number>): boolean {
  let n = 0;
  let suma = 0;
  let sumaCuadrados = 0;
  const v = Array.from(rgba);
  for (let i = 0; i + 3 < v.length; i += 4) {
    const [r = 0, g = 0, b = 0] = v.slice(i, i + 3);
    const luz = 0.299 * r + 0.587 * g + 0.114 * b;
    suma += luz;
    sumaCuadrados += luz * luz;
    n += 1;
  }
  if (!n) return false;
  const media = suma / n;
  const desvio = Math.sqrt(Math.max(0, sumaCuadrados / n - media * media));
  return media < 18 && desvio < 8;
}

/** En el navegador: abre la foto, la reduce a 32×32 y aplica la regla. Si no se puede leer, no frena. */
export async function fotoEnNegro(foto: Blob): Promise<boolean> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return false;
  const img = await createImageBitmap(foto).catch(() => null);
  if (!img) return false;
  const lienzo = document.createElement('canvas');
  lienzo.width = 32;
  lienzo.height = 32;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, 32, 32);
  return esFotoEnNegro(ctx.getImageData(0, 0, 32, 32).data);
}

/** ¿La cara de esta verificación salió en negro? (la original, con la sesión del equipo). */
export async function caraEnNegro(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/datos/admin/kyc/${id}/foto/selfie`, { credentials: 'same-origin' });
    if (!r.ok) return false;
    return await fotoEnNegro(await r.blob());
  } catch {
    return false;
  }
}
