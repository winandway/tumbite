/**
 * C-CAMILA-CORREO-HILO (20 nov 2026) — todos los países. La SALIDA en hilo del correo de Camila.
 *
 * Para que una respuesta caiga en la misma conversación del buzón de la persona hacen falta las
 * cabeceras «In-Reply-To» y «References». El servicio de correo del sitio no las deja pasar (comprobado
 * el 20 nov 2026 con un correo real: llegó sin ellas), y el envío de Cloudflare sí las admite. Por eso
 * SOLO las respuestas que van en un hilo salen por aquí; todo el resto del correo sigue por donde
 * siempre. Si esta puerta falla, el servidor manda la respuesta por el camino de siempre, sin hilo:
 * que llegue importa más que dónde se acomoda.
 *
 * Solo entra quien trae el secreto del gerente, solo salen correos desde nuestras direcciones de
 * soporte y solo viajan las dos cabeceras de hilo.
 */
export type EntornoSalida = {
  GERENTE_SECRETO?: string;
  /** Envío de correo de Cloudflare (wrangler.correo.jsonc → send_email). */
  EMAIL?: {
    send(correo: {
      to: string;
      from: { email: string; name: string };
      replyTo?: string;
      subject: string;
      text: string;
      html?: string;
      headers?: Record<string, string>;
    }): Promise<{ messageId?: string }>;
  };
};

export const RUTA_SALIDA = '/enviar';
/** Las únicas direcciones desde las que esta puerta manda correo. */
const REMITENTES = /^support@(divoox|tumbite)\.com$/;
const DIRECCION = /^[^\s@<>"]{1,64}@[a-z0-9.-]{3,190}$/i;
const ID_DE_MENSAJE = /^<[^<>\s]{3,300}>$/;
const MAX_CUERPO = 400_000;

type Pedido = {
  de?: { address?: unknown; name?: unknown };
  para?: unknown;
  asunto?: unknown;
  texto?: unknown;
  html?: unknown;
  responderA?: unknown;
  cabeceras?: Record<string, unknown>;
};

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const unaLinea = (v: unknown, max: number) =>
  texto(v, max)
    .replace(/[\r\n]+/g, ' ')
    .trim();

function idsDe(v: unknown): string | null {
  const ids = unaLinea(v, 1800).split(/\s+/).filter(Boolean);
  return ids.length && ids.every((id) => ID_DE_MENSAJE.test(id)) ? ids.join(' ') : null;
}

function mismoSecreto(a: string, b: string) {
  if (a.length !== b.length) return false;
  let distinto = 0;
  for (let i = 0; i < a.length; i += 1) distinto |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return distinto === 0;
}

const responder = (estado: number, cuerpo: Record<string, unknown>) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });

export async function enviarEnHilo(peticion: Request, env: EntornoSalida): Promise<Response> {
  const ruta = new URL(peticion.url).pathname;
  if (peticion.method !== 'POST' || ruta !== RUTA_SALIDA) return responder(404, { ok: false });
  const dado = (peticion.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!env.GERENTE_SECRETO || !dado || !mismoSecreto(dado, env.GERENTE_SECRETO))
    return responder(401, { ok: false, motivo: 'Sin permiso.' });
  if (!env.EMAIL) return responder(503, { ok: false, motivo: 'Sin envío de correo.' });

  const crudo = await peticion.text();
  if (crudo.length > MAX_CUERPO) return responder(413, { ok: false, motivo: 'Muy grande.' });
  let p: Pedido;
  try {
    p = JSON.parse(crudo) as Pedido;
  } catch {
    return responder(400, { ok: false, motivo: 'Pedido mal formado.' });
  }
  const de = unaLinea(p.de?.address, 200).toLowerCase();
  const para = unaLinea(p.para, 260);
  const asunto = unaLinea(p.asunto, 300);
  const cuerpo = texto(p.texto, MAX_CUERPO);
  const enRespuestaA = idsDe(p.cabeceras?.['In-Reply-To']);
  if (!REMITENTES.test(de) || !DIRECCION.test(para) || !asunto || !cuerpo.trim() || !enRespuestaA)
    return responder(400, { ok: false, motivo: 'Pedido incompleto.' });
  const referencias = idsDe(p.cabeceras?.References) ?? enRespuestaA;
  const responderA = unaLinea(p.responderA, 260);
  const html = texto(p.html, MAX_CUERPO);

  try {
    const r = await env.EMAIL.send({
      to: para,
      from: { email: de, name: unaLinea(p.de?.name, 80) || 'Divoox' },
      ...(DIRECCION.test(responderA) ? { replyTo: responderA } : {}),
      subject: asunto,
      text: cuerpo,
      ...(html ? { html } : {}),
      headers: { 'In-Reply-To': enRespuestaA, References: referencias },
    });
    return responder(200, { ok: true, id: r.messageId ?? '' });
  } catch (e) {
    const codigo = String((e as { code?: unknown }).code ?? '');
    // Queda en el registro del Worker, sin el contenido del correo.
    console.warn('correo de Camila: no salió en hilo', codigo);
    return responder(502, { ok: false, codigo, motivo: 'No se pudo enviar en hilo.' });
  }
}
