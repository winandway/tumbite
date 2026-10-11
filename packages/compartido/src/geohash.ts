/**
 * Geohash: convierte una coordenada en un texto corto que nombra una «celda» del mapa.
 * Celdas vecinas comparten el comienzo del texto, y SQLite lo puede indexar.
 * Se usa para prefiltrar repartidores cerca de un restaurante sin recorrer toda la tabla.
 * Precisión 5 ≈ celdas de 4,9 km × 4,9 km.
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
export const PRECISION_CELDA = 5;

export function geohash(lat: number, lng: number, precision = PRECISION_CELDA): string {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let texto = '';
  let bits = 0;
  let valor = 0;
  let esLng = true;
  while (texto.length < precision) {
    if (esLng) {
      const medio = (minLng + maxLng) / 2;
      if (lng >= medio) {
        valor = (valor << 1) | 1;
        minLng = medio;
      } else {
        valor <<= 1;
        maxLng = medio;
      }
    } else {
      const medio = (minLat + maxLat) / 2;
      if (lat >= medio) {
        valor = (valor << 1) | 1;
        minLat = medio;
      } else {
        valor <<= 1;
        maxLat = medio;
      }
    }
    esLng = !esLng;
    if (++bits === 5) {
      texto += BASE32.charAt(valor);
      bits = 0;
      valor = 0;
    }
  }
  return texto;
}

/** Centro y tamaño de una celda. */
export function decodificarGeohash(texto: string): {
  lat: number;
  lng: number;
  altoLat: number;
  anchoLng: number;
} {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let esLng = true;
  for (const ch of texto) {
    const v = BASE32.indexOf(ch);
    if (v < 0) throw new Error(`geohash inválido: ${texto}`);
    for (let b = 4; b >= 0; b--) {
      const bit = (v >> b) & 1;
      if (esLng) {
        const medio = (minLng + maxLng) / 2;
        if (bit) minLng = medio;
        else maxLng = medio;
      } else {
        const medio = (minLat + maxLat) / 2;
        if (bit) minLat = medio;
        else maxLat = medio;
      }
      esLng = !esLng;
    }
  }
  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
    altoLat: maxLat - minLat,
    anchoLng: maxLng - minLng,
  };
}

/** La celda y sus 8 vecinas: el área donde se buscan repartidores primero. */
export function celdasVecinas(texto: string): string[] {
  const { lat, lng, altoLat, anchoLng } = decodificarGeohash(texto);
  const celdas = new Set<string>();
  for (const dLat of [-1, 0, 1]) {
    for (const dLng of [-1, 0, 1]) {
      const la = Math.max(-89.999, Math.min(89.999, lat + dLat * altoLat));
      let lo = lng + dLng * anchoLng;
      if (lo > 180) lo -= 360;
      if (lo < -180) lo += 360;
      celdas.add(geohash(la, lo, texto.length));
    }
  }
  return [...celdas];
}
