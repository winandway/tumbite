import { describe, expect, it } from 'vitest';
import {
  TAMANOS_FOTO,
  idDeFoto,
  medidasReducidas,
  medidasWebp,
  rutaFotoTamano,
} from './fotosLivianas';

describe('NXT-7 · C-FOTOS-LIVIANAS', () => {
  it('cada pantalla pide su tamaño; lo que no es nuestro WebP queda igual', () => {
    const r = '/media/fotos/rest-1/abc-123.webp';
    expect(rutaFotoTamano(r, 'miniatura')).toBe('/media/fotos/rest-1/abc-123-s.webp');
    expect(rutaFotoTamano(r, 'tarjeta')).toBe('/media/fotos/rest-1/abc-123-m.webp');
    expect(rutaFotoTamano(r, 'completa')).toBe(r);
    expect(rutaFotoTamano('/media/fotos/rest-1/abc.jpg', 'miniatura')).toBe(
      '/media/fotos/rest-1/abc.jpg',
    );
    expect(rutaFotoTamano('https://images.openfoodfacts.org/x.jpg', 'tarjeta')).toBe(
      'https://images.openfoodfacts.org/x.jpg',
    );
    expect(idDeFoto(r)).toBe('abc-123');
    expect(idDeFoto('/media/fotos/r/a.jpg')).toBeNull();
  });
  it('reduce al lado mayor y nunca agranda', () => {
    expect(medidasReducidas(4032, 3024, TAMANOS_FOTO.tarjeta.lado)).toEqual({
      ancho: 640,
      alto: 480,
    });
    expect(medidasReducidas(3024, 4032, 200)).toEqual({ ancho: 150, alto: 200 });
    expect(medidasReducidas(100, 80, 1400)).toEqual({ ancho: 100, alto: 80 });
  });
  it('lee las medidas de un WebP (VP8X, VP8L y VP8)', () => {
    const base = (tipo: string, datos: number[]) =>
      new Uint8Array([
        ...'RIFF'.split('').map((c) => c.charCodeAt(0)),
        0,
        0,
        0,
        0,
        ...'WEBP'.split('').map((c) => c.charCodeAt(0)),
        ...tipo.split('').map((c) => c.charCodeAt(0)),
        10,
        0,
        0,
        0,
        ...datos,
        ...Array(20).fill(0),
      ]);
    expect(medidasWebp(base('VP8X', [0, 0, 0, 0, 0x7f, 0x02, 0, 0xdf, 0x01, 0]))).toEqual({
      ancho: 640,
      alto: 480,
    });
    // VP8L: firma 0x2f y 14 bits por lado, menos uno (200 × 150).
    const v = 199 | (149 << 14);
    expect(
      medidasWebp(base('VP8L', [0x2f, v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24])),
    ).toEqual({ ancho: 200, alto: 150 });
    // VP8: etiqueta de cuadro (3), firma 9d 01 2a y 16 bits por lado.
    expect(medidasWebp(base('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x78, 0x05, 0x1a, 0x04]))).toEqual({
      ancho: 1400,
      alto: 1050,
    });
    expect(medidasWebp(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(medidasWebp(base('VP8L', [0x00, 0, 0, 0, 0]))).toBeNull();
    expect(medidasWebp(base('VP8 ', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(medidasWebp(base('ALPH', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});
