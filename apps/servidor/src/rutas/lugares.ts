import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import type { Variables } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * Divoox Flex (todos los países): búsqueda de direcciones con Google Places (API nueva), SIEMPRE por
 * el servidor para que la llave nunca viaje a una app ni a la web. Sin la llave GOOGLE_PLACES_KEY
 * la búsqueda queda apagada (503) y la ubicación se marca con el pin en el mapa, que es lo que
 * manda igual en Venezuela (C-FLEX-UBICACION). Cada llamada tiene tiempo límite (C-LLAMADAS-CON-LIMITE).
 */
export const lugares = new Hono<{ Bindings: Env; Variables: Variables }>();

const TIEMPO_MS = 8_000;
/** Código de país de dos letras (ISO 3166-1). */
const PAIS = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .transform((x) => x.toUpperCase());

function llave(env: Env): string {
  const k = env.GOOGLE_PLACES_KEY;
  if (!k)
    throw new ErrorDatos(
      'La búsqueda de direcciones se activa muy pronto. Marca el punto en el mapa.',
      undefined,
      503,
    );
  return k;
}

/** Sugerencias mientras la persona escribe (cualquier persona con sesión, o el enlace del destinatario). */
lugares.get('/lugares/sugerencias', async (c) => {
  const q = z
    .object({
      q: z.string().trim().min(3).max(120),
      pais: PAIS.optional(),
      sesion: z
        .string()
        .regex(/^[A-Za-z0-9_-]{8,64}$/)
        .optional(),
      lat: z.coerce.number().min(-90).max(90).optional(),
      lng: z.coerce.number().min(-180).max(180).optional(),
    })
    .parse(c.req.query());
  const k = llave(c.env);
  // C-DIRECCION-SUGERENCIAS: con país en la pantalla (Flex de una empresa), solo ese país. Sin
  // país (la portada, la app del cliente) se busca en TODO el mundo y el país de la conexión solo
  // va primero: limitarlo escondía Venezuela a quien la buscaba desde EE. UU. (28 oct 2026).
  const ip = c.req.header('cf-ipcountry');
  const deLaConexion = ip && /^[A-Za-z]{2}$/.test(ip) && ip !== 'XX' ? ip.toUpperCase() : null;
  const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': k },
    body: JSON.stringify({
      input: q.q,
      ...(q.pais
        ? { includedRegionCodes: [q.pais.toLowerCase()] }
        : deLaConexion
          ? { regionCode: deLaConexion.toLowerCase() }
          : {}),
      languageCode: (c.req.header('x-idioma') ?? 'es').startsWith('en') ? 'en' : 'es',
      ...(q.sesion ? { sessionToken: q.sesion } : {}),
      ...(q.lat != null && q.lng != null
        ? {
            locationBias: {
              circle: { center: { latitude: q.lat, longitude: q.lng }, radius: 30_000 },
            },
          }
        : {}),
    }),
    signal: AbortSignal.timeout(TIEMPO_MS),
  }).catch((e: unknown) => {
    console.error('lugares: Google no respondió', e);
    return null;
  });
  if (!r?.ok) {
    if (r) console.error('lugares: Google respondió', r.status);
    throw new ErrorDatos(
      'No pudimos buscar la dirección. Marca el punto en el mapa.',
      undefined,
      503,
    );
  }
  const d = (await r.json()) as {
    suggestions?: { placePrediction?: { placeId: string; text?: { text: string } } }[];
  };
  return c.json({
    sugerencias: (d.suggestions ?? [])
      .map((x) => x.placePrediction)
      .filter((x): x is { placeId: string; text?: { text: string } } => Boolean(x?.placeId))
      .slice(0, 6)
      .map((x) => ({ id: x.placeId, texto: x.text?.text ?? '' })),
  });
});

/** El punto exacto de una sugerencia elegida. */
lugares.get('/lugares/punto/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(id))
    throw new ErrorDatos('Esa dirección no existe.', undefined, 404);
  const sesion = c.req.query('sesion');
  const k = llave(c.env);
  const url = new URL(`https://places.googleapis.com/v1/places/${id}`);
  if (sesion && /^[A-Za-z0-9_-]{8,64}$/.test(sesion)) url.searchParams.set('sessionToken', sesion);
  const r = await fetch(url, {
    headers: { 'X-Goog-Api-Key': k, 'X-Goog-FieldMask': 'location,formattedAddress' },
    signal: AbortSignal.timeout(TIEMPO_MS),
  }).catch((e: unknown) => {
    console.error('lugares: Google no respondió', e);
    return null;
  });
  if (!r?.ok)
    throw new ErrorDatos(
      'No pudimos buscar la dirección. Marca el punto en el mapa.',
      undefined,
      503,
    );
  const d = (await r.json()) as {
    location?: { latitude: number; longitude: number };
    formattedAddress?: string;
  };
  if (!d.location) throw new ErrorDatos('Esa dirección no existe.', undefined, 404);
  return c.json({
    punto: { lat: d.location.latitude, lng: d.location.longitude },
    direccion: d.formattedAddress ?? '',
  });
});

/** ¿Está encendida la búsqueda? (las pantallas muestran el buscador solo si sí). */
lugares.get('/lugares/estado', (c) => c.json({ busqueda: Boolean(c.env.GOOGLE_PLACES_KEY) }));
