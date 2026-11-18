/**
 * C-UBICACION-AL-CONECTAR (18 nov 2026, todos los países): la ubicación para conectarse. Como Uber
 * Driver y Dasher, «Conectarme» no espera a una lectura nueva del GPS si ya hay una reciente; si no,
 * espera como mucho `topeMs` y después usa la última conocida del sistema (con su propio tope). El
 * robot de Android vio «Buscando tu ubicación…» unos 3 minutos en el primer arranque. Sin React ni
 * Expo, para probarla en node.
 */
type Lectura = { coords: { latitude: number; longitude: number } };

export const VIGENCIA_LECTURA_MS = 60_000;
export const TOPE_GPS_MS = 10_000;
export const TOPE_ULTIMA_MS = 3_000;

const conTope = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    p.catch(() => null),
    new Promise<null>((r) => {
      setTimeout(() => r(null), ms);
    }),
  ]);

export async function ubicacionParaConectar(o: {
  reciente: (Lectura & { recibidaEn?: number }) | null;
  ahora: number;
  leer: () => Promise<Lectura | null>;
  ultimaConocida: () => Promise<Lectura | null>;
}): Promise<{ lat: number; lng: number } | null> {
  const punto = (l: Lectura) => ({ lat: l.coords.latitude, lng: l.coords.longitude });
  if (o.reciente?.recibidaEn != null && o.ahora - o.reciente.recibidaEn < VIGENCIA_LECTURA_MS)
    return punto(o.reciente);
  const nueva = await conTope(o.leer(), TOPE_GPS_MS);
  if (nueva) return punto(nueva);
  const ultima = await conTope(o.ultimaConocida(), TOPE_ULTIMA_MS);
  return ultima ? punto(ultima) : null;
}
