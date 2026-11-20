import { correoCanonico } from '@tumbite/compartido';
import { MAX_ADJUNTO_BYTES, tipoAdjunto } from '../adjuntosTicket';
import { nuevoId } from '../cripto';
import type { Env } from '../env';
import { guardarFoto } from '../fotoLimpia';
import { type AdjuntoDeMensaje, recibirMensaje } from './cerebro';
import { claveDeHilo } from './correoHilo';
import { claveDeAdjunto } from './fallos';
import { type Persona, personaDeCorreo } from './memoria';
import { TOPE_CAPTURAS_DIA, contarDelDia, hoy } from './modelo';

/**
 * C-CAMILA-CORREO-HILO (20 nov 2026, pedido de Richard: «que le escriban un correo y le llegue como
 * si fuese el chat») — todos los países. La entrada de correo de Camila.
 *
 * Camino: quien responde a un correo de Divoox, o escribe a las direcciones «support» o «soporte» de divoox.com, llega por
 * Cloudflare Email Routing al Worker «divoox-correo» (apps/tiempo-real/src/correoEntrante.ts), que lee
 * el correo y lo trae a POST /datos/gerente/camila/correo con el secreto del gerente. Aquí:
 *
 * 1. Lo que NO es una persona escribiendo se deja pasar de largo SIN gastar modelo ni responder:
 *    respuestas automáticas, rebotes, listas, correo masivo, basura, remitentes sin autenticar y
 *    nuestros propios dominios (un correo nuestro nunca se contesta a sí mismo).
 * 2. Un mismo correo (su Message-ID) se atiende una sola vez.
 * 3. Topes del día, dentro del tope de gasto de Camila: global y por persona, y un freno de ráfaga.
 *    Pasado un tope, el correo no se pierde: el Worker lo desvía al buzón del equipo.
 * 4. La persona se encuentra por su remitente; el identificador de conversación de la dirección de
 *    respuesta solo CONFIRMA el hilo, nunca da acceso a la conversación de otra persona.
 * 5. Los datos de una cuenta solo se le dan al correo CONFIRMADO de esa cuenta; lo demás se atiende
 *    como visitante.
 * 6. El texto del correo es dato, nunca una orden (lo trata el cerebro, igual que el chat).
 */
/**
 * Presupuesto de filas ESCRITAS por correo (C-PRESUPUESTO-FILAS). Atendido: la cabecera del hilo, el
 * mensaje y la respuesta (cada uno con su índice), la ficha, el gasto de IA y la cuenta del día. Lo
 * que se ignora escribe UNA fila: la cuenta del día. La prueba lo mide.
 */
export const PRESUPUESTO_CORREO = { atendido: 14, ignorado: 1 } as const;
export const CORREOS_CAMILA_DIA = 150;
export const CORREOS_POR_PERSONA_DIA = 12;
/** Freno de ráfaga: dos sistemas que se contestan solos no pasan de aquí. */
export const CORREOS_POR_PERSONA_10_MIN = 4;

export type CorreoQueEntra = {
  de: string;
  nombre: string;
  asunto: string;
  texto: string;
  /** A qué dirección nuestra escribieron (trae el identificador de conversación). */
  para?: string;
  messageId?: string;
  referencias?: string;
  /** El Worker comprobó SPF, DKIM y DMARC de quien escribe. Sin el dato (gerente de correo): sí. */
  autenticado?: boolean;
  /** Las cabeceras que delatan un correo automático. */
  cabeceras?: Record<string, string>;
  adjuntos?: { nombre?: string; tipo?: string; base64: string }[];
};

export type ResultadoCorreoEntrante = {
  ok: true;
  /** Falso = Camila no lo tomó; el Worker lo desvía al buzón del equipo. */
  atendido: boolean;
  motivo?: string;
  persona?: string;
  respondio?: boolean;
  modo?: string;
};

const AUTOMATICO_EN_ASUNTO =
  /^(auto(matic)?[ -]?(reply|response)|out of (the )?office|respuesta autom[aá]tica|fuera de (la )?oficina|undeliverable|undelivered mail|delivery status notification|mail delivery (failed|subsystem)|failure notice|returned mail|no se pudo entregar|no se ha podido entregar|notificaci[oó]n de estado de entrega)/i;
const REMITENTE_DE_MAQUINA =
  /^(mailer-daemon|postmaster|no-?reply|noreply|do-?not-?reply|donotreply|bounces?|notifications?|newsletter|news|marketing|info-noreply)([+\-._]|$)/i;
const NUESTROS = ['divoox.com', 'tumbite.com'];

/**
 * ¿Por qué NO se atiende este correo? null = es una persona escribiendo. Solo mira cabeceras y
 * direcciones: no lee el cuerpo, no llama al modelo y no escribe nada.
 */
export function motivoDeIgnorar(d: CorreoQueEntra): string | null {
  const cab = new Map(
    Object.entries(d.cabeceras ?? {}).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()]),
  );
  const [local = '', dominio = ''] = d.de.trim().toLowerCase().split('@');
  if (NUESTROS.some((n) => dominio === n || dominio.endsWith(`.${n}`))) return 'propio';
  if (d.autenticado === false) return 'sin_autenticar';
  if (REMITENTE_DE_MAQUINA.test(local)) return 'maquina';
  const auto = cab.get('auto-submitted');
  if (auto && auto !== 'no') return 'automatico';
  if (cab.has('x-autoreply') || cab.has('x-autorespond') || cab.has('x-auto-response-suppress'))
    return 'automatico';
  if (/multipart\/report|delivery-status/.test(cab.get('content-type') ?? '')) return 'rebote';
  if (cab.get('return-path') === '<>') return 'rebote';
  if (cab.has('list-id') || cab.has('list-unsubscribe')) return 'lista';
  if (/^(bulk|junk|list)$/.test(cab.get('precedence') ?? '')) return 'masivo';
  if (/^yes/.test(cab.get('x-spam-flag') ?? '')) return 'basura';
  if (AUTOMATICO_EN_ASUNTO.test(d.asunto.trim())) return 'automatico';
  return null;
}

const CORTES = [
  /^>/,
  /^El .{5,120} escribi[oó]:?\s*$/i,
  /^On .{5,120} wrote:?\s*$/i,
  /^-{2,} ?(Original Message|Mensaje original|Forwarded message|Mensaje reenviado)/i,
  /^(De|From): .+/i,
  /^_{10,}\s*$/,
  /^-- ?$/,
  /^(Enviado desde mi|Sent from my|Enviado desde Outlook|Get Outlook for) /i,
];

/** Solo lo nuevo: se corta la cita del correo anterior, la firma del aparato y lo reenviado. */
export function textoNuevo(texto: string) {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  // «El lun, 17 nov… <correo>\nescribió:» puede venir partido en dos renglones (Gmail).
  const corte = lineas.findIndex(
    (l, i) =>
      CORTES.some((r) => r.test(l.trim())) ||
      (/^(El|On) .{5,120}$/i.test(l.trim()) &&
        /(escribi[oó]|wrote):?\s*$/i.test((lineas[i + 1] ?? '').trim())),
  );
  return (corte < 0 ? lineas : lineas.slice(0, corte)).join('\n').trim();
}

/** El idioma de un correo de alguien que escribe por primera vez (sin pantalla que lo diga). */
export function idiomaDelTexto(texto: string): 'es' | 'en' {
  const t = ` ${texto.toLowerCase()} `;
  if (/[áéíóúñ¿¡]/.test(t)) return 'es';
  const cuenta = (palabras: string[]) => palabras.filter((p) => t.includes(` ${p} `)).length;
  const es = cuenta(['hola', 'que', 'como', 'para', 'por', 'una', 'los', 'las', 'con', 'mi']);
  const en = cuenta(['the', 'and', 'how', 'my', 'is', 'you', 'what', 'hello', 'hi', 'please']);
  return en > es ? 'en' : 'es';
}

const idDeCorreo = (crudo: string | undefined) => {
  const m = /<[^<>\s]{3,300}>/.exec(crudo ?? '');
  return m ? m[0] : null;
};

async function anotarDia(db: D1Database, campo: 'ignorados' | 'atendidos') {
  await db
    .prepare(
      campo === 'ignorados'
        ? `INSERT INTO camila_correo_dia (dia, recibidos, ignorados) VALUES (?, 1, 1)
           ON CONFLICT(dia) DO UPDATE SET recibidos = recibidos + 1, ignorados = ignorados + 1`
        : `INSERT INTO camila_correo_dia (dia, recibidos, atendidos) VALUES (?, 1, 1)
           ON CONFLICT(dia) DO UPDATE SET recibidos = recibidos + 1, atendidos = atendidos + 1`,
    )
    .bind(hoy())
    .run();
}

/** La primera imagen del correo que de verdad es una imagen (por sus bytes), como la captura del chat. */
async function guardarImagen(
  env: Env,
  db: D1Database,
  p: Persona,
  adjuntos: CorreoQueEntra['adjuntos'],
): Promise<AdjuntoDeMensaje | null> {
  if (!env.BUCKET) return null;
  for (const a of (adjuntos ?? []).slice(0, 5)) {
    // base64: cuatro letras son tres bytes. Se mide ANTES de decodificar.
    if (!a.base64 || a.base64.length > (MAX_ADJUNTO_BYTES * 4) / 3 + 8) continue;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(a.base64), (ch) => ch.charCodeAt(0));
    } catch {
      continue;
    }
    const tipo = tipoAdjunto(bytes);
    if (!tipo) continue;
    if (!(await contarDelDia(db, 'capturas', TOPE_CAPTURAS_DIA))) return null;
    const id = nuevoId();
    const clave = claveDeAdjunto(id);
    await guardarFoto(env.BUCKET, clave, bytes, tipo, { cacheControl: 'private, no-store' });
    await db
      .prepare('INSERT INTO camila_adjuntos (id, persona_id, clave, tipo) VALUES (?, ?, ?, ?)')
      .bind(id, p.id, clave, tipo)
      .run();
    return { id, clave, tipo };
  }
  return null;
}

/**
 * ¿Quien escribe es el dueño CONFIRMADO de la cuenta de esta ficha? Solo entonces Camila puede mirar
 * la cuenta. Falso también si respondió a la conversación de otra persona (identificador ajeno).
 */
async function esLaCuentaConfirmada(env: Env, db: D1Database, p: Persona, d: CorreoQueEntra) {
  if (!p.usuario_id) return false;
  const marca = /\+c([0-9a-f]{20})@/i.exec(d.para ?? '');
  if (marca && marca[1]?.toLowerCase() !== (await claveDeHilo(env, p.id))) return false;
  const u = await db
    .prepare('SELECT correo, correo_confirmado_en FROM usuarios WHERE id = ?')
    .bind(p.usuario_id)
    .first<{ correo: string; correo_confirmado_en: string | null }>();
  return Boolean(
    u?.correo_confirmado_en && correoCanonico(u.correo) === correoCanonico(d.de) && d.autenticado,
  );
}

export async function recibirCorreo(
  env: Env,
  db: D1Database,
  crudo: CorreoQueEntra,
): Promise<ResultadoCorreoEntrante> {
  // Sin el dato (lo trae el gerente de correo desde un buzón que ya lo aceptó): autenticado.
  const d = { ...crudo, autenticado: crudo.autenticado !== false };
  const ignorar = motivoDeIgnorar(d);
  if (ignorar) {
    await anotarDia(db, 'ignorados');
    return { ok: true, atendido: false, motivo: ignorar };
  }
  const limpio = textoNuevo(d.texto);
  if (!limpio && !d.adjuntos?.length) {
    await anotarDia(db, 'ignorados');
    return { ok: true, atendido: false, motivo: 'vacio' };
  }
  const messageId = idDeCorreo(d.messageId) ?? `<sin-id-${nuevoId()}@divoox>`;
  const cuenta = await db
    .prepare(
      `SELECT (SELECT 1 FROM camila_correos WHERE message_id = ?1) AS repetido,
              (SELECT atendidos FROM camila_correo_dia WHERE dia = ?2) AS atendidos`,
    )
    .bind(messageId, hoy())
    .first<{ repetido: number | null; atendidos: number | null }>();
  // Ya se atendió (Cloudflare reintenta una entrega): ni se responde otra vez ni se desvía.
  if (cuenta?.repetido) return { ok: true, atendido: true, motivo: 'repetido' };
  if (Number(cuenta?.atendidos ?? 0) >= CORREOS_CAMILA_DIA) {
    await anotarDia(db, 'ignorados');
    return { ok: true, atendido: false, motivo: 'tope_dia' };
  }
  let persona = await personaDeCorreo(db, d.de, d.nombre);
  const suyos = await db
    .prepare(
      `SELECT COUNT(*) AS hoy, SUM(creado_en > datetime('now', '-10 minutes')) AS rafaga
         FROM camila_correos WHERE persona_id = ? AND creado_en >= date('now')`,
    )
    .bind(persona.id)
    .first<{ hoy: number; rafaga: number | null }>();
  if (
    Number(suyos?.hoy ?? 0) >= CORREOS_POR_PERSONA_DIA ||
    Number(suyos?.rafaga ?? 0) >= CORREOS_POR_PERSONA_10_MIN
  ) {
    await anotarDia(db, 'ignorados');
    return { ok: true, atendido: false, motivo: 'tope_persona', persona: persona.id };
  }
  // Quien escribe por primera vez: el idioma sale de su correo (no hay pantalla que lo diga).
  if (persona.mensajes === 0 && !persona.usuario_id) {
    const idioma = idiomaDelTexto(`${d.asunto} ${limpio}`);
    if (idioma !== persona.idioma) {
      await db
        .prepare('UPDATE camila_personas SET idioma = ? WHERE id = ?')
        .bind(idioma, persona.id)
        .run();
      persona = { ...persona, idioma };
    }
  }
  const asunto = d.asunto.replace(/\s+/g, ' ').trim().slice(0, 200);
  const referencias = `${d.referencias ?? ''} ${messageId}`
    .split(/\s+/)
    .filter((r) => /^<[^<>\s]{3,300}>$/.test(r))
    .slice(-12)
    .join(' ');
  const guardado = await db
    .prepare(
      'INSERT OR IGNORE INTO camila_correos (id, persona_id, message_id, de, asunto, referencias) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(nuevoId(), persona.id, messageId, d.de.trim().slice(0, 160), asunto, referencias)
    .run();
  // Dos entregas del mismo correo a la vez: gana una sola.
  if (!guardado.meta.changes) return { ok: true, atendido: true, motivo: 'repetido' };
  let r: Awaited<ReturnType<typeof recibirMensaje>>;
  try {
    const adjunto = await guardarImagen(env, db, persona, d.adjuntos);
    r = await recibirMensaje(env, db, persona, 'correo', limpio, {
      ...(adjunto ? { adjunto } : {}),
      sinCuenta: !(await esLaCuentaConfirmada(env, db, persona, d)),
    });
  } catch (e) {
    // Falló a medias: se suelta la marca de «ya atendido» para que el reintento (o el desvío al
    // equipo) no lo dé por contestado.
    await db
      .prepare('DELETE FROM camila_correos WHERE message_id = ?')
      .bind(messageId)
      .run()
      .catch(() => undefined);
    throw e;
  }
  await anotarDia(db, 'atendidos');
  return {
    ok: true,
    atendido: true,
    persona: persona.id,
    respondio: Boolean(r.respuesta),
    modo: r.modo,
  };
}

/**
 * Pieza «correoEntrante» del canario: «atrasado» si la entrada de correo (o una respuesta de Camila
 * por correo) falló en las últimas 24 horas (no tumba el sitio: ese correo se desvió al buzón del
 * equipo, pero alguien tiene que mirar por qué); «tope» si hoy llegó al tope de correos (los demás
 * van al buzón del equipo; no es un fallo); «ok» en lo demás. Con las cuentas del día. Solo lee.
 */
export async function saludCorreoEntrante(db: D1Database) {
  // Como mucho dos filas (hoy y ayer): el canario lee poco (C-LECTURAS-SALUD).
  const { results } = await db
    .prepare(
      `SELECT dia, recibidos, atendidos, ignorados,
              (error_en > datetime('now', '-1 day')) AS fallo, error_en
         FROM camila_correo_dia WHERE dia >= date('now', '-1 day') ORDER BY dia DESC LIMIT 2`,
    )
    .all<{
      dia: string;
      recibidos: number;
      atendidos: number;
      ignorados: number;
      fallo: number | null;
      error_en: string | null;
    }>();
  const deHoy = results.find((f) => f.dia === hoy());
  const ultimoFallo = results.find((f) => Number(f.fallo ?? 0) === 1)?.error_en ?? null;
  const atendidos = Number(deHoy?.atendidos ?? 0);
  const estado: 'ok' | 'atrasado' | 'tope' = ultimoFallo
    ? 'atrasado'
    : atendidos >= CORREOS_CAMILA_DIA
      ? 'tope'
      : 'ok';
  return {
    estado,
    recibidosHoy: Number(deHoy?.recibidos ?? 0),
    atendidosHoy: atendidos,
    ignoradosHoy: Number(deHoy?.ignorados ?? 0),
    tope: CORREOS_CAMILA_DIA,
    ultimoFallo,
  };
}
