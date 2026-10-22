import type { Env } from './env';
import { nuevoId } from './cripto';

/**
 * SMS de respaldo y llamadas con número oculto, por Twilio. Como dicen los estudios: el push no
 * garantiza sonido, así que «en tu puerta» y «no te encuentran» también van por SMS; y el
 * repartidor y el cliente se llaman a través del número de Divoox, sin ver el del otro.
 * Sin las variables de Twilio, todo esto se apaga solo (el canario lo marca «pendiente»).
 */
const TWILIO_REAL = 'https://api.twilio.com';

export let ultimoErrorSms: { cuando: string; motivo: string } | null = null;

export const smsConfigurado = (env: Env) =>
  Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);

/** La dirección de Twilio: solo se cambia a localhost (el simulador del recorrido). */
function baseTwilio(env: Env) {
  const u = env.TWILIO_API_URL;
  if (!u) return TWILIO_REAL;
  try {
    const o = new URL(u);
    return o.hostname === 'localhost' || o.hostname === '127.0.0.1' ? o.origin : TWILIO_REAL;
  } catch {
    return TWILIO_REAL;
  }
}

/** Teléfono en formato internacional (+1…). Sin prefijo se asume Estados Unidos. */
export function telefonoE164(t: string | null | undefined): string | null {
  const d = String(t ?? '').replace(/[^\d+]/g, '');
  if (!d) return null;
  if (d.startsWith('+')) return d.length >= 8 ? d : null;
  const solo = d.replace(/\D/g, '');
  if (solo.length === 10) return `+1${solo}`;
  if (solo.length === 11 && solo.startsWith('1')) return `+${solo}`;
  return solo.length >= 8 ? `+${solo}` : null;
}

async function twilio(env: Env, recurso: 'Messages' | 'Calls', datos: Record<string, string>) {
  const cuerpo = new URLSearchParams(datos).toString();
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const res = await fetch(
    `${baseTwilio(env)}/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/${recurso}.json`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: cuerpo,
    },
  );
  const r = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
  if (!res.ok || !r?.sid) throw new Error(r?.message ?? `Twilio respondió ${res.status}`);
  return r.sid;
}

/** Manda un SMS si Twilio está configurado y la persona tiene teléfono. Nunca frena la operación. */
export async function enviarSms(
  env: Env,
  db: D1Database,
  a: {
    usuarioId: string;
    pedidoId: string | null;
    tipo: string;
    telefono: string | null;
    texto: string;
  },
): Promise<boolean> {
  if (!smsConfigurado(env)) return false;
  const para = telefonoE164(a.telefono);
  if (!para) return false;
  const id = nuevoId();
  try {
    await twilio(env, 'Messages', { To: para, From: env.TWILIO_FROM!, Body: a.texto });
    await db
      .prepare(
        "INSERT INTO sms_enviados (id, usuario_id, pedido_id, tipo, estado) VALUES (?, ?, ?, ?, 'enviado')",
      )
      .bind(id, a.usuarioId, a.pedidoId, a.tipo)
      .run();
    return true;
  } catch (e) {
    ultimoErrorSms = { cuando: new Date().toISOString(), motivo: String(e) };
    console.error('sms:', ultimoErrorSms.motivo);
    await db
      .prepare(
        "INSERT INTO sms_enviados (id, usuario_id, pedido_id, tipo, estado) VALUES (?, ?, ?, ?, 'error')",
      )
      .bind(id, a.usuarioId, a.pedidoId, a.tipo)
      .run()
      .catch(() => undefined);
    return false;
  }
}

const codificar = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function firmar(env: Env, texto: string) {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.TWILIO_AUTH_TOKEN ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(texto));
  return codificar(String.fromCharCode(...new Uint8Array(firma)));
}

/** El pase (10 minutos) que Twilio presenta para que el puente marque al otro número. */
export async function paseDePuente(env: Env, aTelefono: string, ahora = Date.now()) {
  const vence = ahora + 10 * 60_000;
  const datos = `${aTelefono}|${vence}`;
  return `${codificar(datos)}.${await firmar(env, datos)}`;
}

/** Devuelve el número al que hay que marcar si el pase es válido y no venció. */
export async function abrirPase(
  env: Env,
  pase: string,
  ahora = Date.now(),
): Promise<string | null> {
  const [datosCod, firma] = pase.split('.');
  if (!datosCod || !firma) return null;
  let datos: string;
  try {
    datos = atob(datosCod.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
  if ((await firmar(env, datos)) !== firma) return null;
  const [telefono, vence] = datos.split('|');
  if (!telefono || !vence || Number(vence) < ahora) return null;
  return telefono;
}

/** TwiML del puente: Twilio marca al otro con el número de Divoox como remitente. */
export const twimlPuente = (a: string, desde: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${desde}" timeout="25">${a}</Dial></Response>`;

/**
 * Llama primero a quien pidió la llamada; cuando contesta, Twilio marca al otro. Los dos ven el
 * número de Divoox. Devuelve el id de la llamada en Twilio.
 */
export async function llamarConNumeroOculto(
  env: Env,
  quienLlama: string,
  aQuien: string,
): Promise<string> {
  const base = (env.SITIO_URL ?? '').replace(/\/$/, '');
  const pase = await paseDePuente(env, aQuien);
  return twilio(env, 'Calls', {
    To: quienLlama,
    From: env.TWILIO_FROM!,
    Url: `${base}/datos/twilio/puente?t=${pase}`,
    // F9: sin esto Twilio pide la dirección con POST y la ruta (GET) respondía 404: la llamada caía.
    Method: 'GET',
  });
}
