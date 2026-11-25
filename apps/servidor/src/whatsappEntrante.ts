/* eslint-disable security/detect-object-injection -- claves de idioma (es/en) y tipos de Meta contra listas propias */
import type { Env } from './env';
import { sha256 } from './cripto';
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
 *   Si algo falla a medias, se suelta la marca para que el reintento de Meta lo procese.
 * - Tope por número: ENTRANTES_POR_NUMERO_DIA al día; lo de más se marca y no se procesa (un robot
 *   no convierte esto en una factura de IA).
 * Nunca se guarda el número en claro fuera de la ficha de Camila (aquí, solo su huella).
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
  resultado: 'atendido' | 'repetido' | 'baja' | 'tope' | 'invalido';
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

async function uno(env: Env, db: D1Database, m: MensajeMeta): Promise<ResultadoEntrante> {
  const wamid = String(m.id ?? '').slice(0, 200);
  const para = telefonoE164(`+${String(m.from ?? '').replace(/\D/g, '')}`);
  if (!wamid || !para) return { wamid, resultado: 'invalido' };
  const huella = await sha256(`whatsapp:${para}`);
  // La marca va primero: un reintento de Meta (o dos entregas a la vez) no hace nada dos veces.
  const marca = await db
    .prepare(`INSERT OR IGNORE INTO whatsapp_entrantes (wamid, numero_hash, tipo) VALUES (?, ?, ?)`)
    .bind(wamid, huella, String(m.type ?? 'otro').slice(0, 20))
    .run();
  if (!marca.meta.changes) return { wamid, resultado: 'repetido' };
  const hoy = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM whatsapp_entrantes WHERE numero_hash = ? AND creado_en >= datetime('now', '-1 day')",
    )
    .bind(huella)
    .first<{ n: number }>();
  if (Number(hoy?.n ?? 0) > ENTRANTES_POR_NUMERO_DIA) {
    console.error('whatsapp: un número pasó el tope de mensajes del día; no se procesa');
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
    await db
      .prepare('DELETE FROM whatsapp_entrantes WHERE wamid = ?')
      .bind(wamid)
      .run()
      .catch(() => undefined);
    throw e;
  }
}
