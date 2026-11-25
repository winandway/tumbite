import type { Env } from './env';
import { ErrorDatos } from './validar';
import { guardarError } from './errores';
import { zonaPara } from './rutas/zonas';

/**
 * C-DESTINO-EN-EL-PAIS (25 nov 2026, Richard en la prueba real de Tucaní a Caja Seca) — todos los
 * países, Moto, Carro y Envíos. La RECOGIDA tiene que estar en una ciudad abierta; el DESTINO (y cada
 * parada) puede ser cualquier punto del MISMO país: Tucaní a Caja Seca o a Caracas, sí; a Cúcuta, no.
 * La tarifa es la de siempre (por kilómetro y minuto), sin tope de distancia.
 *
 * Si el punto cae en una ciudad nuestra, su país sale de ahí (sin gastar nada). Si cae fuera, se le
 * pregunta a Google (búsqueda cercana, la misma API de lugares que ya usamos) y la respuesta se guarda
 * en memoria por cuadrícula de ~1 km. Si Google no responde, NO se deja pasar (podría ser otro país):
 * el pasajero ve «prueba otra vez» y el fallo queda en el registro de errores.
 */
const MEMORIA = new Map<string, string>();
const MAX_MEMORIA = 2000;
const celda = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

export async function paisDelPunto(env: Env, lat: number, lng: number): Promise<string | null> {
  const k = celda(lat, lng);
  const guardado = MEMORIA.get(k);
  if (guardado) return guardado;
  const llave = env.GOOGLE_PLACES_KEY;
  if (!llave) throw new Error('destino-en-el-pais: falta GOOGLE_PLACES_KEY');
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': llave,
      'X-Goog-FieldMask': 'places.addressComponents',
    },
    body: JSON.stringify({
      maxResultCount: 1,
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } },
    }),
  });
  if (!r.ok) throw new Error(`destino-en-el-pais: Google respondió ${r.status}`);
  const d = (await r.json()) as {
    places?: { addressComponents?: { shortText?: string; types?: string[] }[] }[];
  };
  const pais =
    d.places?.[0]?.addressComponents
      ?.find((c) => c.types?.includes('country'))
      ?.shortText?.toUpperCase() ?? null;
  if (pais && /^[A-Z]{2}$/.test(pais)) {
    if (MEMORIA.size >= MAX_MEMORIA) MEMORIA.clear();
    MEMORIA.set(k, pais);
    return pais;
  }
  // Sin lugares en 5 km (mar abierto, selva): no se puede saber el país.
  return null;
}

/** Para las pruebas: olvida lo guardado. */
export const olvidarPaisesDePuntos = () => MEMORIA.clear();

export async function exigirPuntoEnElPais(
  env: Env,
  db: D1Database,
  zona: { id: string; pais: string },
  punto: { lat: number; lng: number },
  campo: 'destino' | 'paradas',
): Promise<void> {
  const z = await zonaPara(db, punto.lat, punto.lng, false);
  if (z?.id === zona.id) return;
  if (z && z.pais.toUpperCase() === zona.pais.toUpperCase()) return;
  let pais: string | null;
  try {
    pais = await paisDelPunto(env, punto.lat, punto.lng);
  } catch (e) {
    await guardarError(db, 'POST', '/viajes · destino-en-el-pais', e).catch((x: unknown) =>
      console.error('destino-en-el-pais: no se pudo guardar el error', x),
    );
    throw new ErrorDatos(
      'No pudimos comprobar esa dirección. Prueba otra vez en un momento.',
      campo,
      503,
    );
  }
  if (pais === zona.pais.toUpperCase()) return;
  throw new ErrorDatos(
    campo === 'destino'
      ? 'El destino tiene que estar en el mismo país del viaje.'
      : 'Una parada tiene que estar en el mismo país del viaje.',
    campo,
    422,
  );
}
