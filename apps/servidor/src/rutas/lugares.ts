import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { partirDireccion } from '@tumbite/compartido';
import { zonaPara } from './zonas';
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
      // C-DESTINO-RESULTADOS: «¿A dónde vas?» busca desde la segunda letra.
      q: z.string().trim().min(2).max(120),
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
  // C-DIRECCION-CERCA (29 oct 2026): las direcciones cercanas van primero, como en DoorDash y Uber
  // Eats. Si la pantalla no manda dónde está la persona, se usa la ciudad aproximada de su conexión
  // (la da Cloudflare en cada petición). Visto en el carrito: desde Miami salían Canadá y Ohio arriba.
  const cerca =
    q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng } : puntoDeLaConexion(c.req.raw);
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
      // C-DESTINO-RESULTADOS: con la ubicación de la persona, Google da la distancia de cada lugar.
      ...(q.lat != null && q.lng != null ? { origin: { latitude: q.lat, longitude: q.lng } } : {}),
      ...(cerca
        ? {
            locationBias: {
              circle: { center: { latitude: cerca.lat, longitude: cerca.lng }, radius: 30_000 },
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
  type Prediccion = {
    placeId: string;
    text?: { text: string };
    structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    distanceMeters?: number;
  };
  const d = (await r.json()) as { suggestions?: { placePrediction?: Prediccion }[] };
  return c.json({
    sugerencias: (d.suggestions ?? [])
      .map((x) => x.placePrediction)
      .filter((x): x is Prediccion => Boolean(x?.placeId))
      .slice(0, 6)
      .map((x) => ({
        id: x.placeId,
        texto: x.text?.text ?? '',
        ...(x.structuredFormat?.mainText?.text
          ? {
              principal: x.structuredFormat.mainText.text,
              secundario: x.structuredFormat.secondaryText?.text ?? '',
            }
          : {}),
        ...(typeof x.distanceMeters === 'number' ? { distanciaM: x.distanceMeters } : {}),
      })),
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

/** Ciudad aproximada de la conexión (Cloudflare: `request.cf` o las cabeceras de ubicación). */
export function puntoDeLaConexion(req: Request): { lat: number; lng: number } | null {
  const cf = (req as Request & { cf?: { latitude?: string; longitude?: string } }).cf;
  const lat = Number(cf?.latitude ?? req.headers.get('cf-iplatitude') ?? NaN);
  const lng = Number(cf?.longitude ?? req.headers.get('cf-iplongitude') ?? NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return null;
  return { lat, lng };
}

// ───────────────────── «¿A dónde vas?»: Recientes y Populares (17 nov 2026) ─────────────────────

/**
 * C-DESTINO-RECIENTES: los destinos de los viajes propios (90 días, 60 como mucho), con la fecha. El
 * orden por hora y día lo hace la app con la hora del teléfono (ordenarRecientes, sin IA). Solo lee.
 */
lugares.get('/lugares/recientes', async (c) => {
  const u = exigir(c, 'cliente');
  const { results } = await base(c)
    .prepare(
      `SELECT v.destino_direccion AS direccion, v.destino_lat AS lat, v.destino_lng AS lng, o.creado_en AS en
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
        WHERE o.cliente_id = ? AND o.creado_en >= datetime('now', '-90 days') AND v.estado <> 'pago_pendiente'
        ORDER BY o.creado_en DESC LIMIT 60`,
    )
    .bind(u.id)
    .all<{ direccion: string; lat: number; lng: number; en: string }>();
  c.header('cache-control', 'private, no-store');
  return c.json({
    destinos: results.map((x) => ({
      direccion: x.direccion,
      lat: Number(x.lat),
      lng: Number(x.lng),
      en: `${String(x.en).replace(' ', 'T')}Z`,
    })),
  });
});

/** Mínimo de clientes distintos para que un lugar sea «popular» (nunca la casa de nadie). */
export const MIN_CLIENTES_POPULAR = 10;
const DIA_MS = 86_400_000;
/** «Ninguno» (sin datos ni buscador del mapa) se guarda una hora: no repite la consulta en cada apertura. */
const HORA_MS = 3_600_000;

/**
 * El nombre de un lugar popular, sin el número de ninguna casa (revisión del 18 nov): «43381 Grand
 * River Ave» → «Grand River Ave»; «Av. Bolívar #25» → «Av. Bolívar». La segunda parte (zona o ciudad)
 * solo si no lleva números.
 */
export function nombreSinNumero(direccion: string): { titulo: string; detalle: string } {
  const { titulo, detalle } = partirDireccion(direccion);
  // Por palabras (sin expresiones que puedan atascarse): fuera el número del principio («43381 …») y
  // el del final con su marca («# 25», «No. 25», «25-10»).
  const esNumero = (x: string) => /^\d+[A-Za-z]?$/.test(x) || /^\d+-\d+$/.test(x);
  const marca = new Set(['#', 'no', 'no.', 'nro', 'nro.', 'n°']);
  const p = titulo.split(/\s+/).filter(Boolean);
  if (p.length > 1 && esNumero(p[0] ?? '')) p.shift();
  // Apartamento, unidad, oficina o piso con su número («Apt 4B», «Suite 300», «Apto 5-2», «Piso 8»):
  // desde esa palabra hasta el final.
  const unidad = new Set([
    'apt',
    'apt.',
    'unit',
    'suite',
    'ste',
    'ste.',
    'apto',
    'apto.',
    'piso',
    'ofic',
    'ofic.',
    'oficina',
    'local',
    'depto',
    'depto.',
    'dpto',
    'dpto.',
    'dept',
    'dept.',
    'apartamento',
    'apartment',
    'departamento',
    'floor',
    'fl',
    'fl.',
    'room',
    'rm',
    'casa',
  ]);
  const corte = p.findIndex(
    (x, i) => i > 0 && unidad.has(x.toLowerCase()) && esNumero(p[i + 1] ?? ''),
  );
  if (corte > 0) p.splice(corte);
  const ultimo = p.at(-1) ?? '';
  if (p.length > 1 && /^#\d/.test(ultimo)) p.pop();
  else if (p.length > 2 && esNumero(ultimo) && marca.has((p.at(-2) ?? '').toLowerCase()))
    p.splice(-2);
  else if (p.length > 1 && /^\d+-\d+$/.test(ultimo)) p.pop();
  const limpio = p.join(' ').trim();
  return { titulo: limpio || titulo, detalle: /\d/.test(detalle) ? '' : detalle };
}
type Popular = { titulo: string; detalle: string; lat: number; lng: number };

/**
 * C-DESTINO-POPULARES: lo más pedido en la ciudad por varias personas distintas (5 o más en 90 días),
 * con el punto redondeado a unos 100 metros. Ciudad nueva sin datos: lugares conocidos cercanos del
 * mapa (terminal, hospital, plaza, centro comercial, universidad). Se calcula una vez al día por
 * ciudad y se guarda en `config` (clave `populares:<zona>`, sin tabla nueva): mirar no escribe
 * (una fila por ciudad y día).
 */
lugares.get('/lugares/populares', async (c) => {
  const q = z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    })
    .safeParse(c.req.query());
  if (!q.success) return c.json({ origen: 'ninguno', lugares: [] });
  const db = base(c);
  const zona = await zonaPara(db, q.data.lat, q.data.lng);
  if (!zona) return c.json({ origen: 'ninguno', lugares: [] });
  const clave = `populares:${zona.id}`;
  const guardado = await db
    .prepare('SELECT valor, actualizado_en FROM config WHERE clave = ?')
    .bind(clave)
    .first<{ valor: string; actualizado_en: string }>();
  const g = guardado
    ? (JSON.parse(guardado.valor) as { origen: string; lugares: Popular[] })
    : null;
  if (
    guardado &&
    g &&
    Date.now() - Date.parse(`${guardado.actualizado_en.replace(' ', 'T')}Z`) <
      (g.origen === 'ninguno' ? HORA_MS : DIA_MS)
  ) {
    c.header('cache-control', 'public, max-age=600');
    return c.json(g);
  }
  const { results } = await db
    .prepare(
      `SELECT ROUND(v.destino_lat, 3) AS lat, ROUND(v.destino_lng, 3) AS lng,
              COUNT(DISTINCT o.cliente_id) AS clientes, MAX(v.destino_direccion) AS direccion
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
        WHERE o.zona_id = ? AND o.creado_en >= datetime('now', '-90 days') AND v.estado = 'terminado'
        GROUP BY 1, 2 HAVING clientes >= ? ORDER BY clientes DESC LIMIT 5`,
    )
    .bind(zona.id, MIN_CLIENTES_POPULAR)
    .all<{ lat: number; lng: number; clientes: number; direccion: string }>();
  let origen = 'ciudad';
  let lista: Popular[] = results.map((x) => ({
    ...nombreSinNumero(String(x.direccion)),
    lat: Number(x.lat),
    lng: Number(x.lng),
  }));
  if (!lista.length) {
    origen = 'mapa';
    lista = await conocidosDelMapa(
      c.env,
      { lat: zona.lat, lng: zona.lng },
      c.req.header('x-idioma'),
    );
    if (!lista.length) origen = 'ninguno';
  }
  // «Ninguno» también se guarda, pero solo una hora (el día que se enciende el mapa, sale pronto).
  await db
    .prepare(
      "INSERT INTO config (clave, valor, actualizado_en) VALUES (?, ?, datetime('now')) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en",
    )
    .bind(clave, JSON.stringify({ origen, lugares: lista }))
    .run();
  return c.json({ origen, lugares: lista });
});

/** Lugares conocidos cerca del centro de la ciudad (Google Places, búsqueda cercana por tipo). */
async function conocidosDelMapa(
  env: Env,
  centro: { lat: number; lng: number },
  idioma: string | undefined,
): Promise<Popular[]> {
  if (!env.GOOGLE_PLACES_KEY) return [];
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.shortFormattedAddress,places.location',
    },
    body: JSON.stringify({
      includedTypes: ['bus_station', 'hospital', 'shopping_mall', 'university', 'park'],
      maxResultCount: 5,
      rankPreference: 'POPULARITY',
      languageCode: (idioma ?? 'es').startsWith('en') ? 'en' : 'es',
      locationRestriction: {
        circle: { center: { latitude: centro.lat, longitude: centro.lng }, radius: 8_000 },
      },
    }),
    signal: AbortSignal.timeout(TIEMPO_MS),
  }).catch((e: unknown) => {
    console.error('lugares: Google no respondió (populares)', e);
    return null;
  });
  if (!r?.ok) {
    if (r) console.error('lugares: Google respondió (populares)', r.status);
    return [];
  }
  const d = (await r.json()) as {
    places?: {
      displayName?: { text: string };
      shortFormattedAddress?: string;
      location?: { latitude: number; longitude: number };
    }[];
  };
  return (d.places ?? [])
    .filter((p) => p.displayName?.text && p.location)
    .map((p) => ({
      titulo: p.displayName!.text,
      detalle: p.shortFormattedAddress ?? '',
      lat: Math.round(p.location!.latitude * 1000) / 1000,
      lng: Math.round(p.location!.longitude * 1000) / 1000,
    }));
}
