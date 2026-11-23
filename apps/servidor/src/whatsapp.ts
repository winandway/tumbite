import type { Env } from './env';
import { nuevoId } from './cripto';
import { smsConfigurado, twilio } from './sms';

/**
 * C-CODIGO-WHATSAPP (23 nov 2026, decisión de Richard por Gerencia): el código de verificación sale
 * PRIMERO por WhatsApp; el SMS queda de respaldo. Dos adaptadores intercambiables, elegidos con
 * WHATSAPP_PROVEEDOR:
 *  - «meta» (de fábrica): la API de la nube de WhatsApp de Meta, directo, sin intermediario. Plantilla
 *    de AUTENTICACIÓN (META_WHATSAPP_PLANTILLA, de fábrica «divoox_codigo», en «es» y «en») con el botón
 *    «Copiar código»: el código va en el cuerpo y en el botón.
 *  - «twilio»: WhatsApp por Twilio (plantilla aprobada en Twilio, una por idioma), por si Meta directo
 *    se traba.
 * Nace APAGADO (WHATSAPP_ENCENDIDO=si y las credenciales del proveedor). Cada envío queda en
 * sms_enviados con proveedor «whatsapp_meta» o «whatsapp_twilio» (tipo del mensaje, estado y referencia),
 * así el gasto y los topes se cuentan igual que los SMS. El token nunca se escribe en el código.
 *
 * Qué NO tocar: el presupuesto del canal, la dirección fija de Meta (solo localhost para el simulador)
 * y que un fallo de WhatsApp pase al SMS de respaldo en vez de dejar a la persona sin código.
 */
const META_REAL = 'https://graph.facebook.com';
const VERSION_META = 'v25.0';
const TIEMPO_MS = 10_000;
/** C-CODIGO-CANALES: lo que cuesta un código por WhatsApp (autenticación, el país más caro que usamos). */
export const COSTO_WHATSAPP_USD = 0.018;
/** Presupuesto diario del canal WhatsApp (se cambia con WHATSAPP_PRESUPUESTO_DIA_USD). */
export const PRESUPUESTO_WHATSAPP_DIA_USD = 10;
export const PROVEEDORES_WHATSAPP = ['whatsapp_meta', 'whatsapp_twilio'] as const;

export let ultimoErrorWhatsapp: { cuando: string; motivo: string } | null = null;
/** Solo para pruebas. */
export function olvidarErrorWhatsapp() {
  ultimoErrorWhatsapp = null;
}

export const proveedorWhatsapp = (env: Env): 'meta' | 'twilio' =>
  env.WHATSAPP_PROVEEDOR === 'twilio' ? 'twilio' : 'meta';

/** Configurado: las credenciales del proveedor elegido. */
export function whatsappConfigurado(env: Env): boolean {
  if (proveedorWhatsapp(env) === 'twilio')
    return Boolean(
      smsConfigurado(env) &&
      env.TWILIO_WHATSAPP_FROM &&
      env.TWILIO_WHATSAPP_PLANTILLA_ES &&
      env.TWILIO_WHATSAPP_PLANTILLA_EN,
    );
  return Boolean(env.META_WHATSAPP_TOKEN && env.META_WHATSAPP_PHONE_ID);
}
/** Encendido de verdad: el interruptor y las credenciales. Uno solo no basta. */
export const whatsappEncendido = (env: Env) =>
  env.WHATSAPP_ENCENDIDO === 'si' && whatsappConfigurado(env);

/** A qué países sale el código por WhatsApp (de fábrica Estados Unidos y Venezuela). */
export function whatsappDestinoPermitido(env: Env, para: string): boolean {
  return (env.WHATSAPP_PREFIJOS ?? '+1,+58')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.startsWith('+'))
    .some((p) => para.startsWith(p));
}

export function presupuestoWhatsappDia(env: Env): number {
  const n = Number(env.WHATSAPP_PRESUPUESTO_DIA_USD);
  return env.WHATSAPP_PRESUPUESTO_DIA_USD && Number.isFinite(n) && n >= 0 && n <= 100_000
    ? n
    : PRESUPUESTO_WHATSAPP_DIA_USD;
}

function baseMeta(env: Env) {
  try {
    const o = new URL(env.META_WHATSAPP_API_URL ?? META_REAL);
    return o.hostname === 'localhost' || o.hostname === '127.0.0.1' ? o.origin : META_REAL;
  } catch {
    return META_REAL;
  }
}

/** El mensaje de Meta: plantilla de autenticación con el código en el cuerpo y en «Copiar código». */
export function cuerpoMeta(env: Env, para: string, codigo: string, idioma: 'es' | 'en') {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: para.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: env.META_WHATSAPP_PLANTILLA ?? 'divoox_codigo',
      language: { code: idioma },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: codigo }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: codigo }],
        },
      ],
    },
  };
}

async function enviarPorMeta(env: Env, para: string, codigo: string, idioma: 'es' | 'en') {
  const version = /^v\d+\.\d+$/.test(env.META_WHATSAPP_VERSION ?? '')
    ? env.META_WHATSAPP_VERSION!
    : VERSION_META;
  const res = await fetch(
    `${baseMeta(env)}/${version}/${encodeURIComponent(env.META_WHATSAPP_PHONE_ID ?? '')}/messages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.META_WHATSAPP_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(cuerpoMeta(env, para, codigo, idioma)),
      signal: AbortSignal.timeout(TIEMPO_MS),
    },
  );
  const r = (await res.json().catch(() => null)) as {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number };
  } | null;
  const id = r?.messages?.[0]?.id;
  if (!res.ok || !id)
    throw new Error(
      `Meta WhatsApp: ${r?.error?.code ?? res.status} ${r?.error?.message ?? 'sin identificador'}`,
    );
  return id;
}

function enviarPorTwilio(env: Env, para: string, codigo: string, idioma: 'es' | 'en') {
  return twilio(env, 'Messages', {
    To: `whatsapp:${para}`,
    From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
    ContentSid: (idioma === 'en'
      ? env.TWILIO_WHATSAPP_PLANTILLA_EN
      : env.TWILIO_WHATSAPP_PLANTILLA_ES)!,
    ContentVariables: JSON.stringify({ '1': codigo }),
  });
}

/**
 * Manda el código por WhatsApp. Devuelve true si el proveedor lo aceptó. Nunca lanza: un fallo queda
 * anotado (sms_enviados y el canario) y quien llama pasa al SMS de respaldo.
 */
export async function enviarCodigoWhatsapp(
  env: Env,
  db: D1Database,
  a: { usuarioId: string; para: string; codigo: string; idioma: 'es' | 'en' },
): Promise<boolean> {
  const proveedor = proveedorWhatsapp(env);
  const nombre = proveedor === 'twilio' ? 'whatsapp_twilio' : 'whatsapp_meta';
  const id = nuevoId();
  try {
    const referencia =
      proveedor === 'twilio'
        ? await enviarPorTwilio(env, a.para, a.codigo, a.idioma)
        : await enviarPorMeta(env, a.para, a.codigo, a.idioma);
    await db
      .prepare(
        "INSERT INTO sms_enviados (id, usuario_id, pedido_id, tipo, estado, proveedor, referencia) VALUES (?, ?, NULL, 'codigo_telefono', 'enviado', ?, ?)",
      )
      .bind(id, a.usuarioId, nombre, referencia)
      .run();
    ultimoErrorWhatsapp = null;
    return true;
  } catch (e) {
    const motivo = String(e);
    ultimoErrorWhatsapp = { cuando: new Date().toISOString(), motivo };
    console.error('whatsapp:', motivo);
    await db
      .prepare(
        "INSERT INTO sms_enviados (id, usuario_id, pedido_id, tipo, estado, proveedor) VALUES (?, ?, NULL, 'codigo_telefono', 'error', ?)",
      )
      .bind(id, a.usuarioId, nombre)
      .run()
      .catch((x: unknown) => console.error('whatsapp: no se pudo anotar el fallo', String(x)));
    return false;
  }
}

/** ¿El último código por WhatsApp (en la última media hora) falló? Entonces se usa el SMS directo. */
export async function whatsappConAveria(db: D1Database): Promise<boolean> {
  const f = await db
    .prepare(
      "SELECT estado FROM sms_enviados WHERE proveedor IN ('whatsapp_meta','whatsapp_twilio') AND creado_en >= datetime('now', '-30 minutes') ORDER BY creado_en DESC, rowid DESC LIMIT 1",
    )
    .first<{ estado: string }>()
    .catch(() => null);
  return f?.estado === 'error';
}

/**
 * C-CODIGO-WHATSAPP: el canario comprueba el propio número en Meta
 * (`GET /<version>/<META_WHATSAPP_PHONE_ID>?fields=verified_name,code_verification_status`), porque con
 * este token la consulta de plantillas da error de permisos. Recuerda el resultado cinco minutos para no
 * llamar a Meta en cada vuelta del canario. Con Twilio no hay nada que mirar: vale el último envío.
 */
const MEMORIA_NUMERO_MS = 5 * 60_000;
let numeroComprobado: { cuando: number; ok: boolean; motivo: string } | null = null;
/** Solo para pruebas. */
export function olvidarNumeroComprobado() {
  numeroComprobado = null;
}
export async function numeroWhatsappVivo(
  env: Env,
  ahora = Date.now(),
): Promise<{ ok: boolean; motivo: string }> {
  if (proveedorWhatsapp(env) !== 'meta') return { ok: true, motivo: 'twilio' };
  if (numeroComprobado && ahora - numeroComprobado.cuando < MEMORIA_NUMERO_MS)
    return numeroComprobado;
  const version = /^v\d+\.\d+$/.test(env.META_WHATSAPP_VERSION ?? '')
    ? env.META_WHATSAPP_VERSION!
    : VERSION_META;
  let r: { ok: boolean; motivo: string };
  try {
    const res = await fetch(
      `${baseMeta(env)}/${version}/${encodeURIComponent(env.META_WHATSAPP_PHONE_ID ?? '')}?fields=verified_name,code_verification_status`,
      {
        headers: { authorization: `Bearer ${env.META_WHATSAPP_TOKEN}` },
        signal: AbortSignal.timeout(5_000),
      },
    );
    const d = (await res.json().catch(() => null)) as {
      verified_name?: string;
      error?: { message?: string; code?: number };
    } | null;
    r =
      res.ok && d?.verified_name
        ? { ok: true, motivo: d.verified_name }
        : { ok: false, motivo: `Meta ${d?.error?.code ?? res.status} ${d?.error?.message ?? ''}` };
  } catch (e) {
    r = { ok: false, motivo: String(e) };
  }
  if (!r.ok) console.error('whatsapp: el número no responde en Meta', r.motivo);
  numeroComprobado = { cuando: ahora, ...r };
  return r;
}
