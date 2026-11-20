import { CORREOS_SOPORTE, MARCA } from '@tumbite/compartido';
import type { Env } from './env';

/**
 * Correos que manda el sitio, por la API de YaDominios Cloud (incluida en el plan,
 * firmada con DKIM desde divoox.com). Un solo lugar para enviar: nada manda correos por fuera.
 * Nunca falla en silencio: el último error queda en el canario de /datos/salud.
 */
export const SITIO = 'tumbite';
/**
 * Dominio del remitente (27 oct 2026): divoox.com, activado en YaDominios Cloud y conectado al sitio
 * de producción. El sitio de pruebas sigue en tumbite.com (divoox.com no está conectado ahí y el
 * envío sería rechazado): `dominioCorreo` lo decide por la dirección pública del sitio.
 */
export const DOMINIO_CORREO = 'divoox.com';
const DOMINIO_CORREO_PRUEBAS = 'tumbite.com';
/** Lo que ve la gente al pie de cada correo: la marca y su dominio público. */
export const DOMINIO_PUBLICO = 'divoox.com';

export function dominioCorreo(env: Pick<Env, 'SITIO_URL'>): string {
  const host = env.SITIO_URL ? new URL(env.SITIO_URL).hostname : DOMINIO_PUBLICO;
  return host === DOMINIO_PUBLICO || host.endsWith(`.${DOMINIO_PUBLICO}`)
    ? DOMINIO_CORREO
    : DOMINIO_CORREO_PRUEBAS;
}

/** Remitentes oficiales (en inglés, como pidió Richard). Nombre visible bilingüe no hace falta. */
export const REMITENTES = {
  avisos: { address: `no-reply@${DOMINIO_CORREO}`, name: MARCA.nombre },
  soporte: { address: `support@${DOMINIO_CORREO}`, name: `${MARCA.nombre} Support` },
  ventas: { address: `sales@${DOMINIO_CORREO}`, name: `${MARCA.nombre} Sales` },
  pedidos: { address: `orders@${DOMINIO_CORREO}`, name: `${MARCA.nombre} Orders` },
  cuentas: { address: `billing@${DOMINIO_CORREO}`, name: `${MARCA.nombre} Billing` },
  hola: { address: `hello@${DOMINIO_CORREO}`, name: MARCA.nombre },
} as const;
export type Remitente = keyof typeof REMITENTES;

/** El remitente con el dominio que corresponde al sitio (producción: divoox.com; pruebas: tumbite.com). */
export function remitente(env: Pick<Env, 'SITIO_URL'>, de: Remitente) {
  // «de» es una de las llaves fijas de REMITENTES (tipo Remitente), no texto de fuera.
  // eslint-disable-next-line security/detect-object-injection
  const r = REMITENTES[de];
  return { ...r, address: r.address.replace(`@${DOMINIO_CORREO}`, `@${dominioCorreo(env)}`) };
}

/** Un «responder a» en divoox.com se perdería: se cambia por el buzón de soporte. */
function responderA(pedido: string | undefined): string {
  const limpio = pedido?.trim() ?? '';
  const d = limpio.toLowerCase();
  if (!d || d.endsWith('@divoox.com') || d.endsWith('.divoox.com')) return CORREOS_SOPORTE.divoox;
  return limpio;
}

export type Correo = {
  de: Remitente;
  para: string;
  asunto: string;
  texto: string;
  html?: string;
  responderA?: string;
  /** Idioma de los botones y del pie. Sin él se deduce del texto. */
  idioma?: 'es' | 'en';
  /** Una foto debajo del primer párrafo (C-CORREO-ENTREGA: la foto de la entrega). */
  imagen?: { url: string; alt: string };
};

export type ResultadoCorreo =
  { ok: true; id: string; rebotado: false } | { ok: false; motivo: string; rebotado: boolean };

const ENDPOINT = 'https://yapanel.yadominios.com/api/hosting/correo/enviar';

/** Último fallo de envío (para el canario). null = todo bien o nada enviado aún. */
export let ultimoErrorCorreo: { cuando: string; motivo: string } | null = null;
/** Día (UTC) en que ya se anotó la alarma del cupo, para no escribirla en cada envío. */
let cupoAvisadoEl = '';

type Transporte = (entrada: string, init: RequestInit) => Promise<Response>;
let transporte: Transporte = (e, i) => fetch(e, i);
/** Con el servicio real, las direcciones de prueba nunca salen (C-CORREO-RESERVADO). */
let omitirDePrueba = true;
/** Solo para pruebas: nunca se le pega al servicio real desde una prueba. */
export function usarTransporteCorreo(
  t: Transporte | null,
  opciones?: { omitirDePrueba?: boolean },
) {
  transporte = t ?? ((e, i) => fetch(e, i));
  // Con un transporte simulado las pruebas miran los correos a direcciones de ejemplo.
  omitirDePrueba = t === null ? true : (opciones?.omitirDePrueba ?? false);
  ultimoErrorCorreo = null;
  cupoAvisadoEl = '';
}

/** Tiempo máximo para hablar con el servicio de correo (C-LLAMADAS-CON-LIMITE). */
export let TIEMPO_CORREO_MS = 10_000;
/** Solo para pruebas. */
export function usarTiempoCorreo(ms: number | null) {
  TIEMPO_CORREO_MS = ms ?? 10_000;
}

export function correoConfigurado(env: Env): boolean {
  return Boolean(env.YAD_TOKEN);
}

/**
 * C-CORREO-RESERVADO (2 nov 2026): dominios que no existen (RFC 2606 y 6761) y el de las cuentas de
 * demostración. Las cuentas del recorrido del sitio de pruebas viven ahí; mandarles correo gastaba el
 * cupo diario de la cuenta y dejaba sin salir los correos de soporte de gente real.
 */
const DOMINIOS_DE_PRUEBA = ['example.com', 'example.net', 'example.org', 'ejemplo.com'];
const TERMINACIONES_DE_PRUEBA = ['.test', '.invalid', '.example', '.localhost'];

export function esCorreoDePrueba(correo: string): boolean {
  const dominio = correo.trim().toLowerCase().split('@').pop() ?? '';
  return (
    TERMINACIONES_DE_PRUEBA.some((t) => dominio.endsWith(t)) ||
    DOMINIOS_DE_PRUEBA.some((d) => dominio === d || dominio.endsWith(`.${d}`))
  );
}

/** Las direcciones nunca quedan escritas en un motivo que se guarda o se muestra en el canario. */
export const sinDirecciones = (t: string) =>
  t.replace(/[^\s@<>"',;:]+@[^\s@<>"',;:]+/g, '<correo>').slice(0, 300);

/**
 * C-CORREO-HONESTO (19 nov 2026): ¿el proveedor dice que la dirección no existe o está bloqueada?
 * Pasó en producción: Gmail respondió «550 5.1.1 The email account that you tried to reach does not
 * exist», Cloudflare puso la dirección en su lista de bloqueo y el segundo envío volvió con
 * `recipient_suppressed`. Eso es un problema de la dirección, no del sistema.
 *
 * Segunda vuelta (20 nov 2026, devuelto por el revisor): SOLO esas dos señales. Antes bastaba con
 * «suppress», «no existe» o «does not exist» en cualquier parte, y un error del sistema («El sitio no
 * existe», «token no existe») dejaba una dirección buena bloqueada y escondía la caída al canario.
 * La lista `rebotados[]` de la respuesta se mira aparte, en `enviarCorreo`.
 */
const SENAL_REBOTE = [
  /\brecipient_suppressed\b/,
  /\b5\.1\.1\b/,
  /\bemail account\b[^.]*\bdoes not exist\b/,
];
export function esFalloDeDestinatario(motivo: string, codigo?: string): boolean {
  const t = `${codigo ?? ''} ${motivo}`.toLowerCase();
  return SENAL_REBOTE.some((r) => r.test(t));
}

/**
 * C-CORREO-HONESTO: un rebote vale 30 días; después se le puede volver a escribir (el buzón pudo
 * crearse o desbloquearse). Se filtra al leer, sin escrituras de más; las filas vencidas se borran
 * solo cuando ya se está escribiendo un rebote nuevo.
 */
export const DIAS_REBOTE = 30;
export const REBOTE_VIGENTE = `datetime('now', '-${DIAS_REBOTE} days')`;

/** Cuota del día a partir de la que el canario avisa, antes de quedarse sin correos. */
export const CUPO_ALARMA = 0.8;
async function anotarFallo(env: Env, tipo: 'sistema' | 'cupo', motivo: string) {
  if (!env.DB) return;
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO correo_fallos (tipo, motivo) VALUES (?, ?)').bind(
        tipo,
        sinDirecciones(motivo),
      ),
      env.DB.prepare(
        'DELETE FROM correo_fallos WHERE id <= (SELECT MAX(id) FROM correo_fallos) - 200',
      ),
    ]);
  } catch (e) {
    console.error('correo: no se pudo anotar el fallo en la base', e);
  }
}

async function anotarRebote(env: Env, para: string, motivo: string) {
  if (!env.DB) return;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO correos_rebotados (correo, motivo) VALUES (?, ?)
         ON CONFLICT(correo) DO UPDATE SET motivo = excluded.motivo, creado_en = datetime('now')`,
      ).bind(para.trim().toLowerCase(), sinDirecciones(motivo)),
      // Las vencidas ya no cuentan: se van aquí, sin un reloj aparte (usa el índice por fecha).
      env.DB.prepare(`DELETE FROM correos_rebotados WHERE creado_en <= ${REBOTE_VIGENTE}`),
    ]);
  } catch (e) {
    console.error('correo: no se pudo anotar el rebote en la base', e);
  }
}

/** ¿Esta dirección ya rebotó? Entonces no se le vuelve a escribir. */
export async function correoRebotado(env: Pick<Env, 'DB'>, para: string): Promise<boolean> {
  if (!env.DB) return false;
  try {
    const f = await env.DB.prepare(
      `SELECT 1 AS si FROM correos_rebotados WHERE correo = ? AND creado_en > ${REBOTE_VIGENTE}`,
    )
      .bind(para.trim().toLowerCase())
      .first<{ si: number }>();
    return Boolean(f);
  } catch (e) {
    console.error('correo: no se pudo mirar la lista de rebotes', e);
    return false;
  }
}

async function falloDeSistema(env: Env, motivo: string, para: string): Promise<ResultadoCorreo> {
  ultimoErrorCorreo = { cuando: new Date().toISOString(), motivo };
  console.error('correo:', motivo, para);
  await anotarFallo(env, 'sistema', motivo);
  return { ok: false, motivo, rebotado: false };
}

async function falloDeDestinatario(
  env: Env,
  motivo: string,
  para: string,
): Promise<ResultadoCorreo> {
  // No pinta de rojo el canario (es la dirección, no el sistema), pero queda contado y escrito.
  console.error('correo: la dirección no recibe:', motivo);
  await anotarRebote(env, para, motivo);
  return { ok: false, motivo, rebotado: true };
}

export async function enviarCorreo(env: Env, correo: Correo): Promise<ResultadoCorreo> {
  // No es un fallo: esa dirección no existe, así que no se gasta un envío en ella.
  if (omitirDePrueba && esCorreoDePrueba(correo.para))
    return { ok: true, id: 'omitido-de-prueba', rebotado: false };
  if (!env.YAD_TOKEN)
    return falloDeSistema(env, 'Falta YAD_TOKEN: el sitio no puede mandar correos.', correo.para);
  // C-CORREO-HONESTO: a una dirección que ya rebotó no se le escribe otra vez.
  if (await correoRebotado(env, correo.para))
    return {
      ok: false,
      motivo: 'Esa dirección ya rebotó antes: no existe o no recibe correos.',
      rebotado: true,
    };
  const cuerpo = {
    sitio: SITIO,
    token: env.YAD_TOKEN,
    from: remitente(env, correo.de),
    to: [{ address: correo.para }],
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html ?? aHtml(correo.texto, correo.idioma, correo.imagen),
    // C-CORREO-RESPONDER-A y C-CORREO-SIN-RECIBIR-DIVOOX: divoox.com nunca recibe correo (sin MX);
    // las respuestas van al buzón de soporte que sí recibe, salvo que el correo pida otro que reciba.
    reply_to: { address: responderA(correo.responderA) },
  };
  let res: Response;
  try {
    res = await transporte(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      // C-LLAMADAS-CON-LIMITE: si el servicio de correo no contesta, la petición de la persona no
      // se queda colgada (antes podía esperar para siempre y trabar la entrega).
      signal: AbortSignal.timeout(TIEMPO_CORREO_MS),
    });
  } catch (e) {
    return falloDeSistema(
      env,
      `No se pudo hablar con el servicio de correo: ${String(e)}`,
      correo.para,
    );
  }
  const datos = (await res.json().catch(() => null)) as {
    success?: boolean;
    message_id?: string;
    error?: string;
    codigo?: string;
    code?: string;
    rebotados?: string[];
    enviados_hoy?: number;
    incluidos_por_dia?: number;
  } | null;
  if (!res.ok || !datos?.success) {
    const motivo = datos?.error ?? `El servicio de correo respondió ${res.status}.`;
    const codigo = datos?.codigo ?? datos?.code;
    if (datos?.rebotados?.length || esFalloDeDestinatario(motivo, codigo))
      return falloDeDestinatario(env, motivo, correo.para);
    return falloDeSistema(env, motivo, correo.para);
  }
  if (datos.rebotados?.length)
    // Un «enviado» no es un «llegó»: la dirección no existe. Se avisa, no se reintenta.
    return falloDeDestinatario(
      env,
      `Rebote permanente: ${datos.rebotados.join(', ')}`,
      correo.para,
    );
  // C-CORREO-HONESTO: el canario avisa ANTES de que se acabe el cupo diario (una vez por día).
  const hoy = new Date().toISOString().slice(0, 10);
  if (
    datos.enviados_hoy &&
    datos.incluidos_por_dia &&
    datos.enviados_hoy >= datos.incluidos_por_dia * CUPO_ALARMA &&
    cupoAvisadoEl !== hoy
  ) {
    cupoAvisadoEl = hoy;
    await anotarFallo(
      env,
      'cupo',
      `Van ${datos.enviados_hoy} de ${datos.incluidos_por_dia} correos del día.`,
    );
  }
  return { ok: true, id: datos.message_id ?? '', rebotado: false };
}

/**
 * Pieza «correo» del canario, leída de la base (vale en todas las instancias): «error» si hubo un
 * fallo del sistema en las últimas 24 horas o si el día pasó del 80 % del cupo. Los rebotes de
 * direcciones mal escritas no la ponen en rojo: se cuentan aparte.
 */
export async function saludCorreo(db: D1Database): Promise<{
  estado: 'ok' | 'error';
  fallos24h: number;
  ultimoFallo: string | null;
  cupoAlto: boolean;
  rebotes24h: number;
}> {
  const f = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM correo_fallos WHERE tipo = 'sistema' AND creado_en > datetime('now', '-1 day')) AS fallos,
        (SELECT MAX(creado_en) FROM correo_fallos WHERE tipo = 'sistema') AS ultimo,
        (SELECT COUNT(*) FROM correo_fallos WHERE tipo = 'cupo' AND creado_en >= date('now')) AS cupo,
        (SELECT COUNT(*) FROM correos_rebotados WHERE creado_en > datetime('now', '-1 day')) AS rebotes`,
    )
    .first<{ fallos: number; ultimo: string | null; cupo: number; rebotes: number }>();
  const fallos24h = Number(f?.fallos ?? 0);
  const cupoAlto = Number(f?.cupo ?? 0) > 0;
  return {
    estado: fallos24h > 0 || cupoAlto ? 'error' : 'ok',
    fallos24h,
    ultimoFallo: f?.ultimo ?? null,
    cupoAlto,
    rebotes24h: Number(f?.rebotes ?? 0),
  };
}

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Etiqueta del botón según la página a la que lleva el enlace (los correos salen en los dos idiomas). */
function etiquetaBoton(url: string, en: boolean): string {
  const ruta = url.replace(/^https?:\/\/[^/]+/, '');
  if (ruta.includes('/confirm-email')) return en ? 'Confirm my email' : 'Confirmar mi correo';
  if (ruta.includes('/reset-password'))
    return en ? 'Reset my password' : 'Restablecer mi contraseña';
  // C-DOCS-VIDEO: el enlace al video de una guía.
  if (/^\/(es\/)?docs\/[^#]+#video$/.test(ruta)) return en ? 'Watch the video' : 'Ver el video';
  // C-CAMILA-ENLACE-GUIA: el enlace a una guía de Docs lleva el mismo texto que en el chat.
  if (/^\/(es\/)?docs\//.test(ruta))
    return en ? 'See the guide with screenshots' : 'Ver la guía con capturas';
  if (ruta.includes('/team-invite')) return en ? 'Join the team' : 'Unirme al equipo';
  if (ruta.includes('/app/order/')) return en ? 'Follow my order' : 'Seguir mi pedido';
  if (/^\/t\//.test(ruta)) return en ? 'Open the conversation' : 'Ver la conversación';
  if (/\/tickets\//.test(ruta)) return en ? 'Reply in the panel' : 'Responder en el panel';
  if (ruta.includes('/panel')) return en ? 'Open my panel' : 'Abrir mi panel';
  if (ruta.includes('/driver')) return en ? 'Open Divoox Driver' : 'Abrir Divoox Driver';
  return en ? 'Open Divoox' : 'Abrir Divoox';
}

/** Sin idioma explícito: español si el texto tiene acentos, eñes o palabras típicas del español. */
function pareceEspanol(texto: string): boolean {
  return /[áéíóúñ¿¡]|\b(el|los|las|del|tu|tus|que|para|con|una|está|por)\b/i.test(texto);
}

/** Un párrafo de líneas «Etiqueta: valor» (detalle del pedido) se pinta como tabla limpia. */
function esDetalle(lineas: string[]): boolean {
  return lineas.length >= 2 && lineas.every((l) => /^[^:]{1,40}:\s.+$/.test(l));
}

/**
 * Plantilla de todos los correos (27 oct 2026, pedido de Richard: diseño serio). Logo real de la
 * marca, texto limpio, los enlaces como botón con etiqueta (y la dirección completa debajo, por si el
 * botón no se ve), los detalles en tabla y un pie con la empresa y el soporte. Sin franjas gruesas de
 * color ni adornos: borde fino y sombra suave, como en la web.
 */
export function aHtml(
  texto: string,
  idioma?: 'es' | 'en',
  imagen?: { url: string; alt: string },
): string {
  const limpio = texto.trim();
  const en = idioma ? idioma === 'en' : !pareceEspanol(limpio);
  const boton = (crudo: string) => {
    const url = escapar(crudo);
    return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 8px"><tr><td style="background:#F20D20;border-radius:10px"><a href="${url}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;font-family:Arial,Helvetica,sans-serif">${etiquetaBoton(crudo, en)}</a></td></tr></table><p style="margin:0 0 18px;font-size:12px;line-height:1.5;color:#666B73;word-break:break-all">${url}</p>`;
  };
  const parrafo = (lineas: string[]) =>
    lineas.length
      ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#101010">${lineas.map(escapar).join('<br>')}</p>`
      : '';
  const parrafos = limpio.split(/\n{2,}/).map((p) => {
    const lineas = p.trim().split('\n');
    if (esDetalle(lineas))
      return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 18px;border-collapse:collapse;width:100%">${lineas
        .map((l) => {
          const i = l.indexOf(':');
          const k = escapar(l.slice(0, i).trim());
          const v = escapar(l.slice(i + 1).trim());
          const total = /^total$/i.test(k);
          return `<tr><td style="padding:8px 0;border-bottom:1px solid #ECECEC;color:#666B73;font-size:15px${total ? ';font-weight:700;color:#101010' : ''}">${k}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #ECECEC;font-size:15px${total ? ';font-weight:700' : ''}">${v}</td></tr>`;
        })
        .join('')}</table>`;
    // Cada enlace, esté solo en su línea o al final de una frase, se vuelve botón con su nombre;
    // el texto que lo acompaña queda como párrafo encima.
    let html = '';
    let texto: string[] = [];
    for (const linea of lineas) {
      const urls = linea.match(/https?:\/\/\S+/g);
      if (!urls) {
        texto.push(linea);
        continue;
      }
      const resto = linea
        .replace(/https?:\/\/\S+/g, '')
        // La etiqueta del enlace a una guía ya va en su botón: no se repite encima.
        .replace(
          /(Ver la guía con capturas|See the guide with screenshots|Ver el video|Watch the video) →/g,
          '',
        )
        .trim();
      if (resto) texto.push(resto);
      html += parrafo(texto);
      texto = [];
      for (const u of urls) html += boton(u.replace(/[).,;]+$/, ''));
    }
    return html + parrafo(texto);
  });
  if (imagen && parrafos.length)
    parrafos.splice(
      1,
      0,
      `<img src="${escapar(imagen.url)}" alt="${escapar(imagen.alt)}" width="500" style="display:block;width:100%;max-width:500px;height:auto;border:0;border-radius:10px;margin:0 0 18px">`,
    );
  const pie = en
    ? `Need help? <a href="https://${DOMINIO_PUBLICO}/support" style="color:#101010">${DOMINIO_PUBLICO}/support</a>`
    : `¿Necesitas ayuda? <a href="https://${DOMINIO_PUBLICO}/es/support" style="color:#101010">${DOMINIO_PUBLICO}/support</a>`;
  const anio = new Date().getUTCFullYear();
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${MARCA.nombre}</title></head><body style="margin:0;padding:0;background:#F4F4F4;font-family:Arial,Helvetica,sans-serif;color:#101010"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F4F4"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px"><tr><td style="padding:0 0 20px"><img src="https://${DOMINIO_PUBLICO}/marca/divoox-logo-correo.png" width="160" height="39" alt="${MARCA.nombre}" style="display:block;border:0"></td></tr><tr><td style="background:#FFFFFF;border:1px solid #E6E6E6;border-radius:12px;padding:32px 28px">${parrafos.join('')}</td></tr><tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.7;color:#666B73;text-align:center">${pie}<br>© ${anio} ${MARCA.empresa} · <a href="https://${DOMINIO_PUBLICO}" style="color:#666B73">${DOMINIO_PUBLICO}</a></td></tr></table></td></tr></table></body></html>`;
}
