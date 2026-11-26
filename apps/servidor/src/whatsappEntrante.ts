/* eslint-disable security/detect-object-injection -- claves de idioma (es/en) y tipos de Meta contra listas propias */
import type { Env } from './env';
import { guardarError } from './errores';
import { whatsappConfigurado } from './whatsapp';
import { telefonoE164 } from './sms';
import { enviarPorCanal } from './camila/canales';
import { recibirMensaje } from './camila/cerebro';
import { type Persona, personaDeTelefono, sentenciaMensaje } from './camila/memoria';

/**
 * C-WHATSAPP-ENTRANTE (25 nov 2026, encargo de Richard por el coordinador) — todos los países.
 *
 * La plantilla «te falta» dice «responde a este mensaje»: las respuestas ahora llegan. El aviso de
 * Meta (el mismo webhook, con su firma ya comprobada en la ruta) trae los mensajes ENTRANTES; cada
 * uno entra a la bandeja de soporte de siempre (el hilo de Camila de esa persona, canal «WhatsApp»):
 * - La cuenta se busca por el celular canónico (personaDeTelefono). Un número desconocido deja una
 *   ficha SIN cuenta y se atiende como visitante (sin datos de cuenta).
 * - Camila responde con sus reglas de siempre (cerebro.ts): sin el permiso de IA de la persona, nada
 *   va al modelo y queda para una persona del equipo (con un aviso fijo, sin datos); con permiso, su
 *   tope de gasto. Su respuesta sale por WhatsApp como mensaje de sesión, solo dentro de la ventana de
 *   24 horas (camila/canales.ts). El equipo responde desde el panel, con la misma ventana.
 * - Foto, audio, video o documento: se anota «mandó una foto», etc. NO se descarga nada.
 * - «BAJA», «STOP», «no más»: baja de los avisos de registro (rezagados_bajas, la misma baja del
 *   correo; el WhatsApp «te falta» la respeta). Se le confirma por el mismo canal, sin IA.
 * - Idempotente por el id del mensaje de Meta (whatsapp_entrantes): un reintento no duplica nada.
 *   Si algo falla a medias queda «fallido» y el reintento de Meta lo vuelve a intentar, como mucho
 *   MAX_INTENTOS_ENTRANTE veces; después queda en errores_servidor.
 * - Tope por número: ENTRANTES_POR_NUMERO_DIA intentos al día (los fallidos cuentan); lo de más se
 *   marca y no se procesa (un robot no convierte esto en una factura de IA).
 * - La huella del número es un HMAC con WHATSAPP_HUELLA_SECRETO; sin él no se guarda huella, rige un
 *   tope general y el canario lo dice. La tabla se limpia sola a los 7 días (limpiarEntrantes).
 * Nunca se guarda el número en claro fuera de la ficha de Camila.
 */
export const ENTRANTES_POR_NUMERO_DIA = 30;

/** Palabras de baja (el mensaje entero, sin importar mayúsculas, acentos ni signos). */
const BAJA =
  /^(baja|darme de baja|stop|parar|para|no mas|no quiero mas|cancelar|unsubscribe|unsuscribe)$/;
export const esBaja = (texto: string) =>
  BAJA.test(
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const CONFIRMA_BAJA = {
  es: 'Listo, no te enviaremos más avisos de tu registro por WhatsApp. Si necesitas ayuda, escríbenos aquí.',
  en: 'Done, we will not send you more sign-up notices on WhatsApp. If you need help, write to us here.',
};

const MEDIO: Record<string, { es: string; en: string }> = {
  image: { es: '(mandó una foto)', en: '(sent a photo)' },
  audio: { es: '(mandó un audio)', en: '(sent an audio message)' },
  voice: { es: '(mandó un audio)', en: '(sent an audio message)' },
  video: { es: '(mandó un video)', en: '(sent a video)' },
  document: { es: '(mandó un documento)', en: '(sent a document)' },
  sticker: { es: '(mandó un sticker)', en: '(sent a sticker)' },
  location: { es: '(mandó una ubicación)', en: '(sent a location)' },
};
const OTRO = {
  es: '(mandó algo que no se puede leer aquí)',
  en: '(sent something we cannot read here)',
};

type MensajeMeta = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};
export type AvisoEntrante = {
  entry?: { changes?: { field?: string; value?: { messages?: MensajeMeta[] } }[] }[];
};

/** El texto que queda en el hilo: lo escrito, o qué mandó (nunca el archivo). */
function textoDe(m: MensajeMeta, idioma: 'es' | 'en'): string {
  if (m.type === 'text') return (m.text?.body ?? '').trim();
  if (m.type === 'button') return (m.button?.text ?? '').trim();
  if (m.type === 'interactive')
    return (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '').trim();
  const medio = Object.hasOwn(MEDIO, m.type ?? '') ? MEDIO[m.type ?? ''] : undefined;
  return (medio ?? OTRO)[idioma];
}

export type ResultadoEntrante = {
  wamid: string;
  resultado: 'atendido' | 'repetido' | 'baja' | 'tope' | 'invalido' | 'agotado';
  persona?: string;
};

/** Procesa los mensajes entrantes de un aviso de Meta (ya con la firma comprobada). */
export async function recibirWhatsappEntrantes(
  env: Env,
  db: D1Database,
  aviso: AvisoEntrante,
): Promise<ResultadoEntrante[]> {
  const r: ResultadoEntrante[] = [];
  for (const entrada of aviso.entry ?? [])
    for (const cambio of entrada.changes ?? []) {
      if (cambio.field && cambio.field !== 'messages') continue;
      for (const m of cambio.value?.messages ?? []) r.push(await uno(env, db, m));
    }
  return r;
}

/** Cuántas veces se intenta procesar un mismo mensaje (los reintentos de Meta) antes de dejarlo. */
export const MAX_INTENTOS_ENTRANTE = 3;
/** Sin secreto para la huella no hay tope por número: rige este tope general del día. */
export const ENTRANTES_SIN_HUELLA_DIA = 200;
/** Lo de más de 7 días se borra, de a LOTE_LIMPIEZA por vuelta del vigilante. */
export const DIAS_ENTRANTES = 7;
export const LOTE_LIMPIEZA = 200;

/** El secreto de la huella, solo si es válido (32 caracteres o más). */
export const secretoHuella = (env: Env) => {
  const s = env.WHATSAPP_HUELLA_SECRETO ?? '';
  return s.length >= 32 ? s : null;
};

/** HMAC-SHA256 del número con el secreto del servidor (nunca sha256 a secas: se podría adivinar). */
export async function huellaNumero(secreto: string, para: string): Promise<string> {
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = new Uint8Array(
    await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`whatsapp:${para}`)),
  );
  return [...firma].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * La marca del mensaje. Primera vez: se crea. Reintento de Meta de un mensaje que FALLÓ: se vuelve a
 * intentar (sumando el intento) hasta MAX_INTENTOS_ENTRANTE. Lo demás es un repetido.
 */
async function marcar(db: D1Database, wamid: string, huella: string | null, tipo: string) {
  const nueva = await db
    .prepare('INSERT OR IGNORE INTO whatsapp_entrantes (wamid, numero_hash, tipo) VALUES (?, ?, ?)')
    .bind(wamid, huella, tipo)
    .run();
  if (nueva.meta.changes) return true;
  const otra = await db
    .prepare(
      "UPDATE whatsapp_entrantes SET estado = 'ok', intentos = intentos + 1 WHERE wamid = ? AND estado = 'fallido' AND intentos < ?",
    )
    .bind(wamid, MAX_INTENTOS_ENTRANTE)
    .run();
  return Boolean(otra.meta.changes);
}

/** ¿Pasó el tope del día? Con huella, por número; sin huella, el general. Los intentos cuentan. */
async function pasoElTope(db: D1Database, huella: string | null) {
  const f = huella
    ? await db
        .prepare(
          "SELECT COALESCE(SUM(intentos), 0) AS n FROM whatsapp_entrantes WHERE numero_hash = ? AND creado_en >= datetime('now', '-1 day')",
        )
        .bind(huella)
        .first<{ n: number }>()
    : await db
        .prepare(
          "SELECT COALESCE(SUM(intentos), 0) AS n FROM whatsapp_entrantes WHERE creado_en >= datetime('now', '-1 day') AND numero_hash IS NULL",
        )
        .first<{ n: number }>();
  return Number(f?.n ?? 0) > (huella ? ENTRANTES_POR_NUMERO_DIA : ENTRANTES_SIN_HUELLA_DIA);
}

async function uno(env: Env, db: D1Database, m: MensajeMeta): Promise<ResultadoEntrante> {
  const wamid = String(m.id ?? '').slice(0, 200);
  const para = telefonoE164(`+${String(m.from ?? '').replace(/\D/g, '')}`);
  if (!wamid || !para) return { wamid, resultado: 'invalido' };
  const secreto = secretoHuella(env);
  const huella = secreto ? await huellaNumero(secreto, para) : null;
  if (!huella) console.error('whatsapp: sin WHATSAPP_HUELLA_SECRETO; rige el tope general');
  // La marca va primero: un reintento de Meta (o dos entregas a la vez) no hace nada dos veces.
  if (!(await marcar(db, wamid, huella, String(m.type ?? 'otro').slice(0, 20))))
    return { wamid, resultado: 'repetido' };
  if (await pasoElTope(db, huella)) {
    console.error('whatsapp: se pasó el tope de mensajes del día; no se procesa');
    return { wamid, resultado: 'tope' };
  }
  try {
    const persona: Persona = await personaDeTelefono(db, para);
    const idioma = persona.idioma === 'en' ? 'en' : 'es';
    const texto = textoDe(m, idioma) || OTRO[idioma];
    if (m.type === 'text' && esBaja(texto)) {
      if (persona.usuario_id)
        await db
          .prepare(
            "INSERT OR IGNORE INTO rezagados_bajas (usuario_id, canal) VALUES (?, 'whatsapp')",
          )
          .bind(persona.usuario_id)
          .run();
      const confirma = CONFIRMA_BAJA[idioma];
      await db.batch([
        sentenciaMensaje(db, {
          personaId: persona.id,
          canal: 'whatsapp',
          autor: 'persona',
          texto,
        }),
        sentenciaMensaje(db, {
          personaId: persona.id,
          canal: 'whatsapp',
          autor: 'camila',
          texto: confirma,
          herramienta: 'baja_whatsapp',
        }),
      ]);
      await enviarPorCanal(env, db, persona, 'whatsapp', confirma);
      return { wamid, resultado: 'baja', persona: persona.id };
    }
    await recibirMensaje(env, db, persona, 'whatsapp', texto, {
      // Un número sin cuenta se atiende como visitante: sin herramientas ni datos de cuenta.
      sinCuenta: !persona.usuario_id,
    });
    return { wamid, resultado: 'atendido', persona: persona.id };
  } catch (e) {
    // Queda «fallido» con su intento contado: Meta reintenta, pero como mucho MAX_INTENTOS_ENTRANTE
    // veces (un mensaje que siempre falla no repite el gasto de IA sin fin).
    const f = await db
      .prepare(
        "UPDATE whatsapp_entrantes SET estado = 'fallido' WHERE wamid = ? RETURNING intentos",
      )
      .bind(wamid)
      .first<{ intentos: number }>()
      .catch(() => null);
    if (Number(f?.intentos ?? 0) >= MAX_INTENTOS_ENTRANTE) {
      await guardarError(db, 'WHATSAPP', 'whatsapp/entrante', e).catch(() => undefined);
      return { wamid, resultado: 'agotado' };
    }
    throw e;
  }
}

/**
 * Borra lo de más de DIAS_ENTRANTES días, de a LOTE_LIMPIEZA por vuelta del vigilante (por el índice
 * de fecha). Sin nada viejo, no escribe nada.
 */
export async function limpiarEntrantes(db: D1Database): Promise<number> {
  const r = await db
    .prepare(
      `DELETE FROM whatsapp_entrantes WHERE wamid IN (
         SELECT wamid FROM whatsapp_entrantes WHERE creado_en < datetime('now', '-${DIAS_ENTRANTES} days') LIMIT ${LOTE_LIMPIEZA})`,
    )
    .run();
  return Number(r.meta.changes ?? 0);
}

/**
 * La pieza `whatsappEntrante` del canario, sin leer la base: «pendiente» sin WhatsApp; «atrasado» si
 * falta el secreto de la huella (rige solo el tope general por día); «ok» con todo.
 */
export function saludWhatsappEntrante(env: Env): 'ok' | 'pendiente' | 'atrasado' {
  if (!whatsappConfigurado(env) || !env.META_APP_SECRET) return 'pendiente';
  return secretoHuella(env) ? 'ok' : 'atrasado';
}
