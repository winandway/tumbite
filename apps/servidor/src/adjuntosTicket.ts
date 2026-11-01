import type { Env } from './env';

/**
 * C-CASOS-CAPTURAS (1 nov 2026): las capturas de los casos de ayuda. Se guardan en el almacén
 * (nunca en /media, que es público) y se ven solo con un enlace firmado con ARCHIVOS_FIRMA
 * (variable del panel) que vale 8 días.
 */
export const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024;
export const MAX_ADJUNTOS_MENSAJE = 3;
const VIGENCIA_S = 8 * 24 * 60 * 60;

/** JPG, PNG, WebP o HEIC (lo que manda el iPhone), por sus primeros bytes, no por lo que dice. */
export function tipoAdjunto(b: Uint8Array): string | null {
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (
    ascii(4, 4) === 'ftyp' &&
    ['heic', 'heix', 'mif1', 'msf1', 'heim', 'heis'].includes(ascii(8, 4))
  )
    return 'image/heic';
  return null;
}

async function hmac(env: Env, texto: string) {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.ARCHIVOS_FIRMA ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(texto));
  return btoa(String.fromCharCode(...new Uint8Array(firma)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** El enlace firmado, o null si falta la llave de firma (nunca un enlace sin firma). */
export async function urlAdjunto(env: Env, id: string, ahora = Date.now()): Promise<string | null> {
  if (!env.ARCHIVOS_FIRMA) return null;
  const exp = Math.floor(ahora / 1000) + VIGENCIA_S;
  const sitio = (env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
  return `${sitio}/datos/adjuntos/${id}?exp=${exp}&firma=${await hmac(env, `${id}.${exp}`)}`;
}

/** Tiempo constante al comparar la firma. */
export async function firmaAdjuntoValida(env: Env, id: string, exp: string, firma: string) {
  if (!env.ARCHIVOS_FIRMA || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  const esperada = await hmac(env, `${id}.${exp}`);
  let d = esperada.length ^ firma.length;
  for (let i = 0; i < Math.min(esperada.length, firma.length); i++)
    d |= esperada.charCodeAt(i) ^ firma.charCodeAt(i);
  return d === 0;
}

export type AdjuntoPublico = { id: string; nombre: string; tipo: string; url: string | null };

/** Los adjuntos de cada mensaje de un caso, con su enlace firmado. */
export async function adjuntosDe(
  env: Env,
  db: D1Database,
  ticketIds: string[],
): Promise<Map<string, AdjuntoPublico[]>> {
  const mapa = new Map<string, AdjuntoPublico[]>();
  if (!ticketIds.length) return mapa;
  const { results } = await db
    .prepare(
      `SELECT id, mensaje_id, nombre, tipo FROM ticket_adjuntos
        WHERE mensaje_id IS NOT NULL AND ticket_id IN (SELECT value FROM json_each(?)) ORDER BY creado_en`,
    )
    .bind(JSON.stringify(ticketIds))
    .all<{ id: string; mensaje_id: string; nombre: string; tipo: string }>();
  for (const a of results) {
    const lista = mapa.get(a.mensaje_id) ?? [];
    lista.push({ id: a.id, nombre: a.nombre, tipo: a.tipo, url: await urlAdjunto(env, a.id) });
    mapa.set(a.mensaje_id, lista);
  }
  return mapa;
}
