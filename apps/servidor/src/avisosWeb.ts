import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './env';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';

/**
 * C-AVISOS-WEB (13 nov 2026) — todos los países, urgente para Venezuela. Avisos al celular para las
 * apps instaladas desde el navegador (/app, /driver, /restaurant): el estándar Web Push (RFC 8030),
 * firmado con VAPID (RFC 8292, ES256) y cifrado aes128gcm (RFC 8291). Sin bibliotecas: la API Web
 * Crypto del Worker. Sin las llaves VAPID todo queda apagado sin errores (canario «pendiente»).
 *
 * Presupuesto (regla de la nube): suscribirse = UNA escritura (INSERT … ON CONFLICT); mirar no
 * escribe; un aviso solo lee las suscripciones de la persona y escribe únicamente si el servicio
 * responde 404/410 (la borra), igual que el canal de Expo con DeviceNotRegistered.
 */

const codificador = new TextEncoder();
/** Texto a bytes con su propio ArrayBuffer (lo que piden los tipos de Web Crypto). */
const enc = { encode: (t: string) => new Uint8Array(codificador.encode(t)) };
const TAMANO_REGISTRO = 4096;
/** Lo que cabe en un aviso cifrado de un solo registro (4096 − cabecera − etiqueta − delimitador). */
const MAX_TEXTO = 3000;
const SUJETO_POR_DEFECTO = 'mailto:soporte@windoce.com';

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function desdeB64url(texto: string): Uint8Array<ArrayBuffer> {
  const s = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function unir(...partes: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const r = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    r.set(p, i);
    i += p.length;
  }
  return r;
}

async function hkdf(
  sal: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  bytes: number,
) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: sal, info },
      k,
      bytes * 8,
    ),
  );
}

/** Los tipos del Worker llaman «$public» a la llave del otro lado; el motor espera «public». */
const ecdhCon = (otra: CryptoKey) =>
  ({ name: 'ECDH', public: otra }) as unknown as SubtleCryptoDeriveKeyAlgorithm;

/** JWK de una llave P-256 a partir de su forma pública sin comprimir (65 bytes) y su `d`. */
function jwk(publica: Uint8Array, d: string): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: b64url(publica.slice(1, 33)),
    y: b64url(publica.slice(33, 65)),
    d,
    ext: true,
  };
}

/**
 * Cifra el texto para UNA suscripción (RFC 8291, aes128gcm, un registro). `fijo` solo lo usan las
 * pruebas para reproducir el ejemplo publicado de la RFC; en uso real la sal y la llave efímera son
 * nuevas en cada aviso.
 */
export async function cifrarAvisoWeb(
  texto: Uint8Array,
  p256dh: string,
  auth: string,
  fijo?: { sal: Uint8Array<ArrayBuffer>; privada: string; publica: string },
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPub = desdeB64url(p256dh);
  const curva = { name: 'ECDH', namedCurve: 'P-256' } as const;
  let asPriv: CryptoKey;
  let asPub: Uint8Array<ArrayBuffer>;
  if (fijo) {
    asPub = desdeB64url(fijo.publica);
    asPriv = await crypto.subtle.importKey('jwk', jwk(asPub, fijo.privada), curva, false, [
      'deriveBits',
    ]);
  } else {
    const par = (await crypto.subtle.generateKey(curva, true, ['deriveBits'])) as CryptoKeyPair;
    asPriv = par.privateKey;
    asPub = new Uint8Array((await crypto.subtle.exportKey('raw', par.publicKey)) as ArrayBuffer);
  }
  const uaKey = await crypto.subtle.importKey('raw', uaPub, curva, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits(ecdhCon(uaKey), asPriv, 256));
  const ikm = await hkdf(
    desdeB64url(auth),
    ecdh,
    unir(enc.encode('WebPush: info\0'), uaPub, asPub),
    32,
  );
  const sal = fijo?.sal ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const clave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Un solo registro: el texto y el delimitador 0x02 (último registro), sin relleno.
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      clave,
      unir(new Uint8Array(texto), Uint8Array.of(2)),
    ),
  );
  const cab = new Uint8Array(21 + asPub.length);
  cab.set(sal, 0);
  new DataView(cab.buffer).setUint32(16, TAMANO_REGISTRO);
  cab[20] = asPub.length;
  cab.set(asPub, 21);
  return unir(cab, cifrado);
}

/** Cabecera Authorization con VAPID (RFC 8292): JWT ES256 para el origen del servicio, 12 horas. */
export async function cabeceraVapid(
  endpoint: string,
  publica: string,
  privada: string,
  sujeto: string,
  ahora = Date.now(),
): Promise<string> {
  const cab = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(ahora / 1000) + 12 * 3600,
        sub: sujeto,
      }),
    ),
  );
  const llave = await crypto.subtle.importKey(
    'jwk',
    jwk(desdeB64url(publica), privada),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // Web Crypto entrega la firma como r‖s (64 bytes), que es lo que pide JWS.
  const firma = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      llave,
      enc.encode(`${cab}.${cuerpo}`),
    ),
  );
  return `vapid t=${cab}.${cuerpo}.${b64url(firma)}, k=${publica}`;
}

/** Las dos llaves puestas (pública como variable del sitio y privada como secreto). */
export function avisosWebConfigurado(env: Env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export let ultimoErrorAvisoWeb: { cuando: string; motivo: string } | null = null;

type Transporte = (url: string, init: RequestInit) => Promise<Response>;
let transporte: Transporte = (u, i) => fetch(u, i);
/** Solo para pruebas: ninguna prueba le pega a un servicio de avisos real. */
export function usarTransporteAvisosWeb(t: Transporte | null) {
  transporte = t ?? ((u, i) => fetch(u, i));
  ultimoErrorAvisoWeb = null;
}

/**
 * Los servicios de avisos de los navegadores (Chrome/Android, Safari/iPhone, Firefox, Edge). Solo a
 * esos se manda: así nadie puede usar el servidor para llamar a otra dirección registrando una
 * «suscripción» falsa.
 */
const SERVICIOS_EXACTOS = new Set(['fcm.googleapis.com', 'android.googleapis.com']);
const SERVICIOS_DOMINIO = ['push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];
export function esServicioDeAvisos(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    const h = u.hostname;
    return (
      u.protocol === 'https:' &&
      !u.port &&
      (SERVICIOS_EXACTOS.has(h) || SERVICIOS_DOMINIO.some((d) => h === d || h.endsWith(`.${d}`)))
    );
  } catch {
    return false;
  }
}

export type AvisoWeb = { titulo: string; cuerpo: string; datos?: Record<string, string> };

/**
 * Manda el aviso a todas las apps web de la persona. Nunca lanza ni frena el flujo: un fallo queda
 * en el canario. Sin llaves, no hace nada (ni siquiera lee).
 */
export async function notificarWeb(
  env: Env,
  db: D1Database,
  usuarioId: string,
  aviso: AvisoWeb,
): Promise<number> {
  if (!avisosWebConfigurado(env)) return 0;
  const publica = env.VAPID_PUBLIC_KEY as string;
  const privada = env.VAPID_PRIVATE_KEY as string;
  try {
    const { results } = await db
      .prepare('SELECT endpoint, p256dh, auth, app FROM suscripciones_web WHERE usuario_id = ?')
      .bind(usuarioId)
      .all<{ endpoint: string; p256dh: string; auth: string; app: string }>();
    if (!results.length) return 0;
    const texto = enc.encode(
      JSON.stringify({
        titulo: aviso.titulo.slice(0, 200),
        cuerpo: aviso.cuerpo.slice(0, 600),
        datos: aviso.datos ?? {},
      }).slice(0, MAX_TEXTO),
    );
    const enviados = await Promise.all(
      results.map(async (s) => {
        try {
          const res = await transporte(s.endpoint, {
            method: 'POST',
            headers: {
              authorization: await cabeceraVapid(
                s.endpoint,
                publica,
                privada,
                env.VAPID_SUBJECT ?? SUJETO_POR_DEFECTO,
              ),
              'content-encoding': 'aes128gcm',
              'content-type': 'application/octet-stream',
              // Un pedido de hace una hora ya no sirve: el servicio lo descarta pasado este tiempo.
              ttl: '3600',
              urgency: 'high',
            },
            body: await cifrarAvisoWeb(texto, s.p256dh, s.auth),
            signal: AbortSignal.timeout(10_000),
          });
          if (res.status === 404 || res.status === 410) {
            // El navegador ya no tiene esa suscripción (app quitada, permiso retirado): se borra.
            await db
              .prepare('DELETE FROM suscripciones_web WHERE endpoint = ?')
              .bind(s.endpoint)
              .run();
            return 0;
          }
          if (!res.ok) {
            ultimoErrorAvisoWeb = {
              cuando: new Date().toISOString(),
              motivo: `el servicio de avisos respondió ${res.status}`,
            };
            console.error('avisos web:', ultimoErrorAvisoWeb.motivo);
            return 0;
          }
          return 1;
        } catch (e) {
          ultimoErrorAvisoWeb = { cuando: new Date().toISOString(), motivo: String(e) };
          console.error('avisos web: no se pudo mandar', e);
          return 0;
        }
      }),
    );
    return enviados.reduce<number>((n, x) => n + x, 0);
  } catch (e) {
    ultimoErrorAvisoWeb = { cuando: new Date().toISOString(), motivo: String(e) };
    console.error('avisos web: no se pudieron leer las suscripciones', e);
    return 0;
  }
}

/** Canario: sin llaves «pendiente»; con un fallo reciente «error». */
export function saludAvisosWeb(env: Env): 'ok' | 'error' | 'pendiente' {
  if (!avisosWebConfigurado(env)) return 'pendiente';
  return ultimoErrorAvisoWeb ? 'error' : 'ok';
}

const esquemaSuscripcion = z.object({
  endpoint: z
    .string()
    .max(1000)
    .refine(esServicioDeAvisos, { error: 'Ese destino de avisos no es válido.' }),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{86,88}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{20,24}$/),
  }),
  app: z.enum(['cliente', 'repartidor', 'restaurante', 'panel']),
});
const esquemaBaja = z.object({ endpoint: z.string().max(1000) });

export const rutasAvisosWeb = new Hono<{ Bindings: Env; Variables: Variables }>();

/** La llave pública (la usa la app si no la trae compilada). Solo lee el entorno. */
rutasAvisosWeb.get('/llave', (c) =>
  c.json({ llave: avisosWebConfigurado(c.env) ? (c.env.VAPID_PUBLIC_KEY as string) : null }),
);

/**
 * Guarda la suscripción del navegador con su usuario y su app. Quien tiene el endpoint (secreto e
 * imposible de adivinar) tiene ese navegador: si estaba a nombre de otra cuenta que no cerró sesión,
 * pasa a la que entra ahora.
 */
rutasAvisosWeb.post('/suscripcion', async (c) => {
  const u = exigir(c);
  if (!avisosWebConfigurado(c.env))
    throw new ErrorDatos('Los avisos en el navegador todavía no están encendidos.', undefined, 409);
  const d = await leerCuerpo(c, esquemaSuscripcion);
  await base(c)
    .prepare(
      `INSERT INTO suscripciones_web (endpoint, usuario_id, app, p256dh, auth) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET usuario_id = excluded.usuario_id, app = excluded.app,
         p256dh = excluded.p256dh, auth = excluded.auth
       WHERE suscripciones_web.usuario_id != excluded.usuario_id OR suscripciones_web.app != excluded.app
         OR suscripciones_web.p256dh != excluded.p256dh OR suscripciones_web.auth != excluded.auth`,
    )
    .bind(d.endpoint, u.id, d.app, d.keys.p256dh, d.keys.auth)
    .run();
  return c.json({ ok: true });
});

/** Al cerrar sesión (o al apagar los avisos): se borra. Solo la suya. */
rutasAvisosWeb.delete('/suscripcion', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaBaja);
  await base(c)
    .prepare('DELETE FROM suscripciones_web WHERE endpoint = ? AND usuario_id = ?')
    .bind(d.endpoint, u.id)
    .run();
  return c.json({ ok: true });
});
