/**
 * NXT-7 · C-FOTOS-LIVIANAS (3 nov 2026): las fotos de platos y restaurantes se convierten en el
 * teléfono o en el navegador (sin servicios de pago) a WebP en tres tamaños, y cada pantalla pide
 * el que le toca, como los grandes: la lista una miniatura, la tarjeta del restaurante una mediana,
 * la ficha del plato la grande. DoorDash pide fotos de al menos 1400 × 800 [DOC]; por eso la grande
 * mide 1400 de lado. Ficha: docs/investigaciones-rea/2026-11-03-fotos-livianas.md.
 *
 * Se guardan como `/media/fotos/<restaurante>/<id>.webp` (completa), `<id>-m.webp` (tarjeta) y
 * `<id>-s.webp` (miniatura). Una foto vieja (JPG, PNG o WebP sin tamaños) sigue funcionando: el
 * servidor entrega la completa cuando el tamaño no existe.
 */
export type TamanoFoto = 'miniatura' | 'tarjeta' | 'completa';

/** Lado mayor (px), peso máximo (bytes) y calidad WebP de cada tamaño. */
export const TAMANOS_FOTO: Record<TamanoFoto, { lado: number; maxBytes: number; calidad: number }> =
  {
    miniatura: { lado: 200, maxBytes: 40 * 1024, calidad: 0.7 },
    tarjeta: { lado: 640, maxBytes: 200 * 1024, calidad: 0.78 },
    completa: { lado: 1400, maxBytes: 1024 * 1024, calidad: 0.82 },
  };

export const SUFIJO_TAMANO: Record<Exclude<TamanoFoto, 'completa'>, 's' | 'm'> = {
  miniatura: 's',
  tarjeta: 'm',
};

const FOTO_WEBP = /^(\/media\/fotos\/[a-z0-9-]{1,64}\/[a-z0-9-]{1,64})\.webp$/;

/** La ruta del tamaño pedido; si la foto no es nuestra o no es WebP, la misma ruta. */
export function rutaFotoTamano(ruta: string, tam: TamanoFoto): string {
  if (tam === 'completa') return ruta;
  const m = FOTO_WEBP.exec(ruta);
  return m
    ? `${m[1]}-${tam === 'tarjeta' ? SUFIJO_TAMANO.tarjeta : SUFIJO_TAMANO.miniatura}.webp`
    : ruta;
}

/** El id de la foto completa que devolvió la subida («/media/fotos/r/abc.webp» → «abc»). */
export function idDeFoto(ruta: string): string | null {
  const m = FOTO_WEBP.exec(ruta);
  return m ? (m[1]!.split('/').pop() ?? null) : null;
}

/** Medidas de lo que se pide al convertir: el lado mayor queda en `lado`, nunca se agranda. */
export function medidasReducidas(ancho: number, alto: number, lado: number) {
  const escala = Math.min(1, lado / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/** Ancho y alto de un WebP leyendo su cabecera (VP8, VP8L o VP8X); null si no lo es. */
export function medidasWebp(b: Uint8Array): { ancho: number; alto: number } | null {
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length < 30 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') return null;
  const tipo = ascii(12, 4);
  const u8 = (i: number) => b.at(i) ?? 0;
  if (tipo === 'VP8X') {
    const w = 1 + (u8(24) | (u8(25) << 8) | (u8(26) << 16));
    const h = 1 + (u8(27) | (u8(28) << 8) | (u8(29) << 16));
    return { ancho: w, alto: h };
  }
  if (tipo === 'VP8L') {
    if (u8(20) !== 0x2f) return null;
    const v = u8(21) | (u8(22) << 8) | (u8(23) << 16) | (u8(24) << 24);
    return { ancho: (v & 0x3fff) + 1, alto: ((v >>> 14) & 0x3fff) + 1 };
  }
  if (tipo === 'VP8 ') {
    if (u8(23) !== 0x9d || u8(24) !== 0x01 || u8(25) !== 0x2a) return null;
    return { ancho: (u8(26) | (u8(27) << 8)) & 0x3fff, alto: (u8(28) | (u8(29) << 8)) & 0x3fff };
  }
  return null;
}
