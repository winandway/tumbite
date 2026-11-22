import type { Env } from './env';

/**
 * C-SMS-VENEZUELA (22 nov 2026, Venezuela): los SMS a celulares de Venezuela (+58) salen por SMS Masivo
 * Venezuela, un proveedor local, unas cinco veces más barato que Twilio para ese país. Una solicitud =
 * un destinatario. Nace APAGADO: solo manda con SMSMASIVO_ENCENDIDO=si Y su llave; sin eso todo sigue
 * como antes (Twilio, y a Venezuela solo el pánico).
 *
 * Qué NO tocar: el tope diario (C-NUBE-PRESUPUESTO aplicado al dinero), la dirección fija del proveedor
 * (solo se cambia a localhost para el simulador) y la llave, que vive solo en la variable del servidor.
 */
const SMSMASIVO_REAL = 'https://smsmasivovenezuela.com';
export const PROVEEDOR_SMSMASIVO = 'smsmasivo';
export const PREFIJO_VENEZUELA = '+58';
/** Tope de fábrica: 150 SMS al día (unos 6,75 USD al precio básico). Se cambia con SMSMASIVO_TOPE_DIA. */
export const TOPE_SMSMASIVO_DIA = 150;
const TIEMPO_MS = 10_000;
/** Si el proveedor pide esperar (429), se espera como mucho esto y se reintenta UNA vez. */
const ESPERA_MAXIMA_MS = 2_000;

export let ultimoErrorSmsMasivo: { cuando: string; motivo: string } | null = null;
/** Solo para pruebas. */
export function olvidarErrorSmsMasivo() {
  ultimoErrorSmsMasivo = null;
}
export function anotarErrorSmsMasivo(motivo: string) {
  ultimoErrorSmsMasivo = { cuando: new Date().toISOString(), motivo };
}

export const smsMasivoConfigurado = (env: Env) => Boolean(env.SMSMASIVO_API_KEY);
/** Encendido de verdad: la llave y el interruptor. Uno solo no basta. */
export const smsMasivoEncendido = (env: Env) =>
  smsMasivoConfigurado(env) && env.SMSMASIVO_ENCENDIDO === 'si';
/** ¿Este número sale por el proveedor de Venezuela? */
export const vaPorSmsMasivo = (env: Env, para: string) =>
  smsMasivoEncendido(env) && para.startsWith(PREFIJO_VENEZUELA);

export function topeSmsMasivo(env: Env): number {
  const n = Number(env.SMSMASIVO_TOPE_DIA);
  return Number.isInteger(n) && n >= 0 && n <= 5000 ? n : TOPE_SMSMASIVO_DIA;
}

function base(env: Env) {
  const u = env.SMSMASIVO_API_URL;
  if (!u) return SMSMASIVO_REAL;
  try {
    const o = new URL(u);
    return o.hostname === 'localhost' || o.hostname === '127.0.0.1' ? o.origin : SMSMASIVO_REAL;
  } catch {
    return SMSMASIVO_REAL;
  }
}

type Respuesta = {
  requestId?: string;
  id?: string;
  status?: string;
  errorCode?: string;
  error?: string | { code?: string; message?: string };
  message?: string;
  data?: Respuesta;
};
const ESTADOS_FALLIDOS: ReadonlySet<string> = new Set([
  'FAILED',
  'REJECTED',
  'ERROR',
  'UNDELIVERED',
]);

function leer(r: Respuesta | null) {
  const d = r?.data ?? r ?? {};
  const error = typeof d.error === 'object' ? (d.error?.code ?? d.error?.message) : d.error;
  return {
    requestId: d.requestId ?? d.id ?? '',
    estado: String(d.status ?? '').toUpperCase(),
    motivo: d.errorCode ?? error ?? d.message ?? '',
  };
}

/** Cuántos SMS salieron por este proveedor en las últimas 24 horas (cuentan también los fallidos). */
export async function smsMasivoDeHoy(db: D1Database): Promise<number> {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM sms_enviados WHERE proveedor = ? AND creado_en >= datetime('now', '-1 day')",
    )
    .bind(PROVEEDOR_SMSMASIVO)
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

/**
 * Manda UN SMS. «referencia» es nuestro id del envío: va como Idempotency-Key (el proveedor no cobra dos
 * veces el mismo) y como «reference». Devuelve el requestId del proveedor o lanza con el motivo.
 */
export async function enviarPorSmsMasivo(
  env: Env,
  para: string,
  texto: string,
  referencia: string,
  esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<string> {
  if (!smsMasivoEncendido(env)) throw new Error('SMS Masivo Venezuela está apagado');
  const pedir = () =>
    fetch(`${base(env)}/api/v1/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.SMSMASIVO_API_KEY}`,
        'content-type': 'application/json',
        'idempotency-key': referencia,
      },
      body: JSON.stringify({ channel: 'SMS', to: para, message: texto, reference: referencia }),
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
  let res = await pedir();
  if (res.status === 429) {
    const pide = Number(res.headers.get('retry-after') ?? '');
    const ms = Number.isFinite(pide) && pide > 0 ? pide * 1000 : ESPERA_MAXIMA_MS;
    if (ms > ESPERA_MAXIMA_MS)
      throw new Error(`SMS Masivo Venezuela pide esperar ${Math.round(ms / 1000)} s (429)`);
    await esperar(ms);
    res = await pedir();
  }
  const r = leer((await res.json().catch(() => null)) as Respuesta | null);
  if (!res.ok)
    throw new Error(
      `SMS Masivo Venezuela respondió ${res.status}${r.motivo ? `: ${r.motivo}` : ''}`,
    );
  if (ESTADOS_FALLIDOS.has(r.estado))
    throw new Error(`SMS Masivo Venezuela: ${r.estado}${r.motivo ? ` / ${r.motivo}` : ''}`);
  if (!r.requestId) throw new Error('SMS Masivo Venezuela no devolvió el número de solicitud');
  return r.requestId;
}

/** El estado de un envío ya hecho, tal como lo dice el proveedor (ENTREGADO, FALLIDO…). Solo lee. */
export async function estadoEnSmsMasivo(
  env: Env,
  requestId: string,
): Promise<{ estado: string; motivo: string }> {
  if (!smsMasivoConfigurado(env)) throw new Error('SMS Masivo Venezuela no tiene llave');
  const res = await fetch(`${base(env)}/api/v1/messages/${encodeURIComponent(requestId)}`, {
    headers: { authorization: `Bearer ${env.SMSMASIVO_API_KEY}` },
    signal: AbortSignal.timeout(TIEMPO_MS),
  });
  const r = leer((await res.json().catch(() => null)) as Respuesta | null);
  if (!res.ok) throw new Error(`SMS Masivo Venezuela respondió ${res.status}`);
  return { estado: r.estado || 'DESCONOCIDO', motivo: r.motivo };
}

/**
 * La pieza del canario. «pendiente» = apagado o sin llave (lo normal hoy); «tope» = se alcanzó el
 * máximo del día y los SMS a Venezuela dejaron de salir; «error» = el último envío falló.
 */
export async function saludSmsMasivo(
  env: Env,
  db: D1Database | undefined,
): Promise<'ok' | 'error' | 'pendiente' | 'tope'> {
  if (!smsMasivoEncendido(env)) return 'pendiente';
  if (db && (await smsMasivoDeHoy(db)) >= topeSmsMasivo(env)) return 'tope';
  return ultimoErrorSmsMasivo ? 'error' : 'ok';
}
