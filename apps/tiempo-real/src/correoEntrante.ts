import PostalMime, { type Email } from 'postal-mime';
import { enviarEnHilo, type EntornoSalida } from './correoSalida';

/**
 * C-CAMILA-CORREO-HILO (20 nov 2026, pedido de Richard: «que le escriban un correo y le llegue como
 * si fuese el chat») — todos los países. La ENTRADA de correo de Camila.
 *
 * Cloudflare Email Routing entrega a este Worker (`divoox-correo`, wrangler.correo.jsonc) los correos
 * que llegan a las direcciones «support» y «soporte» de divoox.com, con o sin el identificador «+c…» de una conversación.
 * El Worker lee el correo y se lo pasa al servidor (POST /datos/gerente/camila/correo, con el secreto
 * del gerente), que decide si Camila lo atiende. Lo que Camila NO toma (correo automático, rebote,
 * tope del día, remitente sin autenticar, o el servidor caído) se DESVÍA al buzón del equipo: ningún
 * correo se pierde ni se queda sin dueño.
 *
 * Secreto (nunca aquí): GERENTE_SECRETO → `wrangler secret put GERENTE_SECRETO -c wrangler.correo.jsonc`.
 * Apagar en una emergencia: volver las reglas de support@ y soporte@ a «reenviar a soporte@windoce.com»
 * (docs/CAMILA-CORREO.md trae los comandos). El envío de correos no pasa por aquí.
 */
export type EntornoCorreo = {
  BACKEND_URL: string;
  /** El buzón del equipo (dirección de destino verificada en Email Routing). */
  BUZON_EQUIPO: string;
  GERENTE_SECRETO?: string;
};

export const RUTA_CORREO = '/datos/gerente/camila/correo';
/** Una imagen más pesada que esto no viaja al servidor (el correo se atiende igual, sin ella). */
export const MAX_IMAGEN_BASE64 = 6_000_000;
/** Los logos de las firmas pesan menos que esto: no son una captura. */
const MIN_IMAGEN_BASE64 = 27_000;
const MAX_CRUDO = 20 * 1024 * 1024;
const CABECERAS_QUE_DELATAN = [
  'auto-submitted',
  'precedence',
  'list-id',
  'list-unsubscribe',
  'x-autoreply',
  'x-autorespond',
  'x-auto-response-suppress',
  'x-spam-flag',
  'content-type',
  'return-path',
];

const dominioDe = (correo: string) => correo.trim().toLowerCase().split('@').pop() ?? '';
/** example.co.uk y mail.example.co.uk comparten dueño si uno termina en el otro. */
const mismoDominio = (a: string, b: string) =>
  Boolean(a && b) && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));

/**
 * ¿Quien firma el correo es de verdad quien dice ser? Solo vale el resultado que puso Cloudflare
 * (el primero, con su nombre): los demás «Authentication-Results» los pudo escribir cualquiera.
 * Pasa con DMARC aprobado; o, si el dominio no publica DMARC, con SPF o DKIM del MISMO dominio que
 * aparece en el «De».
 */
export function estaAutenticado(resultados: string | null, de: string, sobre: string): boolean {
  const propio = /^\s*mx\.cloudflare\.net\s*;([\s\S]*?)(?:,\s*[a-z0-9.-]+\.[a-z]{2,}\s*;|$)/i.exec(
    resultados ?? '',
  )?.[1];
  if (!propio) return false;
  if (/\bdmarc=pass\b/i.test(propio)) return true;
  if (/\bdmarc=fail\b/i.test(propio)) return false;
  const dominio = dominioDe(de);
  if (/\bspf=pass\b/i.test(propio) && mismoDominio(dominioDe(sobre), dominio)) return true;
  const firmado = /\bdkim=pass\b[^;]*?header\.d=([a-z0-9.-]+)/i.exec(propio)?.[1] ?? '';
  return mismoDominio(firmado.toLowerCase(), dominio);
}

const sinEtiquetas = (html: string) =>
  html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<blockquote[\s\S]*$/i, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

export type CuerpoParaCamila = {
  de: string;
  nombre: string;
  asunto: string;
  texto: string;
  para: string;
  messageId?: string;
  referencias?: string;
  autenticado: boolean;
  cabeceras: Record<string, string>;
  adjuntos: { nombre?: string; tipo: string; base64: string }[];
};

/** Lo que el servidor necesita del correo, y nada más. null = no hay a quién contestarle. */
export function armarCuerpo(
  correo: Email,
  sobre: { de: string; para: string; cabeceras: Headers },
): CuerpoParaCamila | null {
  const de = (correo.from?.address ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(de)) return null;
  const delatan = new Map<string, string>();
  for (const nombre of CABECERAS_QUE_DELATAN) {
    const valor = sobre.cabeceras.get(nombre);
    if (valor) delatan.set(nombre, valor.slice(0, 500));
  }
  // Un sobre sin remitente es un rebote: se dice con la cabecera que el servidor ya conoce.
  if (!sobre.de.trim()) delatan.set('return-path', '<>');
  const cabeceras: Record<string, string> = Object.fromEntries(delatan);
  const adjuntos = (correo.attachments ?? [])
    .filter(
      (a) =>
        /^image\/(jpeg|png|webp|heic|heif)$/i.test(a.mimeType) &&
        typeof a.content === 'string' &&
        a.content.length >= MIN_IMAGEN_BASE64 &&
        a.content.length <= MAX_IMAGEN_BASE64,
    )
    .slice(0, 2)
    .map((a) => ({
      ...(a.filename ? { nombre: a.filename.slice(0, 200) } : {}),
      tipo: a.mimeType.toLowerCase(),
      base64: a.content as string,
    }));
  return {
    de,
    nombre: (correo.from?.name ?? '').trim().slice(0, 80),
    asunto: (correo.subject ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
    texto: (correo.text?.trim() || sinEtiquetas(correo.html ?? '')).slice(0, 20_000),
    para: sobre.para.slice(0, 200),
    ...(correo.messageId ? { messageId: correo.messageId.slice(0, 500) } : {}),
    ...(correo.references ? { referencias: String(correo.references).slice(0, 6000) } : {}),
    autenticado: estaAutenticado(sobre.cabeceras.get('authentication-results'), de, sobre.de),
    cabeceras,
    adjuntos,
  };
}

export type Veredicto = { atendido: boolean; motivo: string };

/** Le pasa el correo al servidor. Nunca lanza: un fallo es «no atendido» con su motivo. */
export async function entregar(
  env: EntornoCorreo,
  cuerpo: CuerpoParaCamila,
  hacer: typeof fetch = (...a) => fetch(...a),
  intentos = 2,
): Promise<Veredicto> {
  if (!env.GERENTE_SECRETO) return { atendido: false, motivo: 'sin_secreto' };
  let motivo = 'servidor';
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await hacer(new URL(RUTA_CORREO, env.BACKEND_URL).toString(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.GERENTE_SECRETO}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(90_000),
      });
      if (r.ok) {
        const d = (await r.json().catch(() => null)) as {
          atendido?: boolean;
          motivo?: string;
        } | null;
        return d?.atendido
          ? { atendido: true, motivo: d.motivo ?? 'atendido' }
          : { atendido: false, motivo: d?.motivo ?? 'sin_respuesta' };
      }
      motivo = `servidor_${r.status}`;
      // Un pedido que el servidor rechaza no mejora por repetirlo.
      if (r.status >= 400 && r.status < 500 && r.status !== 429) break;
    } catch (e) {
      motivo = 'servidor_sin_respuesta';
      console.error('correo de Camila: intento', i, e);
    }
  }
  return { atendido: false, motivo };
}

type CorreoQueLlega = Pick<
  ForwardableEmailMessage,
  'from' | 'to' | 'headers' | 'raw' | 'rawSize' | 'forward' | 'setReject'
>;

export async function atender(
  mensaje: CorreoQueLlega,
  env: EntornoCorreo,
  hacer: typeof fetch = (...a) => fetch(...a),
): Promise<Veredicto> {
  let veredicto: Veredicto = { atendido: false, motivo: 'ilegible' };
  try {
    if (mensaje.rawSize > MAX_CRUDO) veredicto = { atendido: false, motivo: 'muy_grande' };
    else {
      // El cuerpo crudo se lee UNA sola vez.
      const crudo = await new Response(mensaje.raw).arrayBuffer();
      const correo = await PostalMime.parse(crudo, { attachmentEncoding: 'base64' });
      const cuerpo = armarCuerpo(correo, {
        de: mensaje.from,
        para: mensaje.to,
        cabeceras: mensaje.headers,
      });
      veredicto = cuerpo ? await entregar(env, cuerpo, hacer) : veredicto;
    }
  } catch (e) {
    console.error('correo de Camila: no se pudo leer el correo', e);
  }
  if (veredicto.atendido) return veredicto;
  // Camila no lo tomó: va al buzón del equipo, con el motivo en una cabecera. Nunca se pierde.
  try {
    await mensaje.forward(
      env.BUZON_EQUIPO,
      new Headers({ 'X-Divoox-Camila': veredicto.motivo.slice(0, 60) }),
    );
  } catch (e) {
    console.error('correo de Camila: no se pudo desviar al equipo', veredicto.motivo, e);
    // Ni Camila ni el equipo lo recibieron por un fallo NUESTRO: el remitente recibe el rechazo y su
    // servidor lo sabe (mejor que un silencio). Lo automático no se rechaza: no merece respuesta.
    if (/^(servidor|sin_secreto|ilegible|tope)/.test(veredicto.motivo))
      mensaje.setReject('Temporary failure, please try again later.');
  }
  return veredicto;
}

export default {
  async email(mensaje: ForwardableEmailMessage, env: EntornoCorreo) {
    const v = await atender(mensaje, env);
    // Queda en el registro del Worker (observability) lo que NO tomó Camila, sin su contenido.
    if (!v.atendido) console.warn('correo de Camila: desviado al equipo', v.motivo);
  },
  // La salida en hilo (correoSalida.ts): solo el servidor, con el secreto del gerente.
  fetch: (peticion: Request, env: EntornoCorreo & EntornoSalida) => enviarEnHilo(peticion, env),
} satisfies ExportedHandler<EntornoCorreo & EntornoSalida>;
