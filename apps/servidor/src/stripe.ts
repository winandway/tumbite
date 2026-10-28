/**
 * Stripe por su API REST (sin librería: el servidor corre en el borde).
 * Nunca se toca un número de tarjeta ni de cuenta bancaria: todo eso vive en Stripe.
 */
export class ErrorStripe extends Error {
  constructor(
    message: string,
    public readonly estado: number,
  ) {
    super(message);
  }
}

type Valor = string | number | boolean | null | undefined | Valor[] | { [k: string]: Valor };

/** Convierte un objeto a la forma que pide Stripe: a[b][0][c]=x */
export function formulario(datos: Record<string, Valor>, prefijo = ''): string[] {
  const partes: string[] = [];
  for (const [k, v] of Object.entries(datos)) {
    const clave = prefijo ? `${prefijo}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        if (x !== null && typeof x === 'object' && !Array.isArray(x))
          partes.push(...formulario(x, `${clave}[${i}]`));
        else
          partes.push(`${encodeURIComponent(`${clave}[${i}]`)}=${encodeURIComponent(String(x))}`);
      });
    } else if (typeof v === 'object') {
      partes.push(...formulario(v, clave));
    } else {
      partes.push(`${encodeURIComponent(clave)}=${encodeURIComponent(String(v))}`);
    }
  }
  return partes;
}

/**
 * Para ensayar el recorrido completo en la computadora del programador sin cobrar nada: Stripe
 * puede apuntar a un simulador, pero SOLO en localhost. Cualquier otra dirección se ignora, así
 * que en producción siempre se habla con Stripe de verdad.
 */
const STRIPE_REAL = 'https://api.stripe.com';
let baseStripe = STRIPE_REAL;
export function usarStripeLocal(url: unknown): void {
  baseStripe = STRIPE_REAL;
  if (typeof url !== 'string') return;
  try {
    const u = new URL(url);
    if (
      u.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(u.hostname) &&
      u.pathname === '/'
    )
      baseStripe = u.origin;
  } catch {
    // Dirección mal escrita: se queda Stripe de verdad.
  }
}
export const direccionStripe = () => baseStripe;

export function crearStripe(secreta: string | undefined) {
  if (!secreta) return null;
  async function llamar<T>(
    metodo: 'GET' | 'POST',
    ruta: string,
    datos: Record<string, Valor> = {},
    idempotencia?: string,
  ): Promise<T> {
    const cuerpo = formulario(datos).join('&');
    const headers: Record<string, string> = {
      authorization: `Bearer ${secreta}`,
      'stripe-version': '2025-09-30.clover',
    };
    if (metodo === 'POST') headers['content-type'] = 'application/x-www-form-urlencoded';
    if (idempotencia) headers['idempotency-key'] = idempotencia;
    const res = await fetch(
      `${baseStripe}/v1${ruta}${metodo === 'GET' && cuerpo ? `?${cuerpo}` : ''}`,
      {
        method: metodo,
        headers,
        body: metodo === 'POST' ? cuerpo : undefined,
        // C-LLAMADAS-CON-LIMITE: nunca esperar a Stripe para siempre. Toda escritura lleva clave de
        // idempotencia, así que repetirla después de un corte no cobra dos veces.
        signal: AbortSignal.timeout(25_000),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
    if (!res.ok) {
      console.error('stripe: error', res.status, json.error?.message);
      throw new ErrorStripe(json.error?.message ?? 'Stripe no respondió', res.status);
    }
    return json;
  }
  return {
    post: <T>(ruta: string, datos: Record<string, Valor>, idempotencia?: string) =>
      llamar<T>('POST', ruta, datos, idempotencia),
    get: <T>(ruta: string, datos?: Record<string, Valor>) => llamar<T>('GET', ruta, datos),
  };
}

export type Stripe = NonNullable<ReturnType<typeof crearStripe>>;

const codificador = new TextEncoder();

/**
 * Verifica la firma del aviso de Stripe (cabecera Stripe-Signature: t=...,v1=...).
 * Sin firma válida no se procesa NADA. Tolerancia de 5 minutos contra repeticiones.
 */
export async function firmaValida(
  cuerpo: string,
  cabecera: string | undefined,
  secreto: string,
  ahoraSeg = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!cabecera || !secreto) return false;
  const partes = cabecera.split(',').map((p) => p.split('=') as [string, string]);
  const t = partes.find(([k]) => k === 't')?.[1];
  const firmas = partes.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || firmas.length === 0) return false;
  if (Math.abs(ahoraSeg - Number(t)) > 300) return false;
  const llave = await crypto.subtle.importKey(
    'raw',
    codificador.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', llave, codificador.encode(`${t}.${cuerpo}`));
  const esperada = [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return firmas.some((f) => {
    if (f.length !== esperada.length) return false;
    let diferencia = 0;
    for (let i = 0; i < f.length; i++) diferencia |= f.charCodeAt(i) ^ esperada.charCodeAt(i);
    return diferencia === 0;
  });
}
