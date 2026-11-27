import {
  VERSION_CONSENTIMIENTO_SMS,
  aE164,
  paisDePrefijo,
  type CanalConsentimientoSms,
} from '@tumbite/compartido';
import type { Env } from './env';
import { nuevoId } from './cripto';
import {
  PROVEEDOR_SMSMASIVO,
  anotarErrorSmsMasivo,
  enviarPorSmsMasivo,
  smsMasivoDeHoy,
  topeSmsMasivo,
  vaPorSmsMasivo,
} from './smsMasivo';
import { textoParaSmsVenezuela } from './smsVenezuelaTextos';

/**
 * SMS de respaldo y llamadas con número oculto, por Twilio. Como dicen los estudios: el push no
 * garantiza sonido, así que «en tu puerta» y «no te encuentran» también van por SMS; y el
 * repartidor y el cliente se llaman a través del número de Divoox, sin ver el del otro.
 * Sin las variables de Twilio, todo esto se apaga solo (el canario lo marca «pendiente»).
 */
const TWILIO_REAL = 'https://api.twilio.com';

export let ultimoErrorSms: { cuando: string; motivo: string } | null = null;

/** Quién firma las llamadas a Twilio: la llave de API (SK…) o, si no hay, el Auth Token de la cuenta. */
function credencialTwilio(env: Env): { usuario: string; clave: string } | null {
  if (env.TWILIO_API_KEY && env.TWILIO_API_SECRET)
    return { usuario: env.TWILIO_API_KEY, clave: env.TWILIO_API_SECRET };
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN)
    return { usuario: env.TWILIO_ACCOUNT_SID, clave: env.TWILIO_AUTH_TOKEN };
  return null;
}

export const smsConfigurado = (env: Env) =>
  Boolean(env.TWILIO_ACCOUNT_SID && credencialTwilio(env) && env.TWILIO_FROM);

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

/**
 * Teléfono en formato internacional (+58…, +1…). C-TELEFONO-E164: con el país de la persona se lee con
 * libphonenumber. Sin país, lo de siempre (10 dígitos: Estados Unidos), pero un número que empieza
 * por «0» (el prefijo nacional de Venezuela, Colombia o Perú) NUNCA se convierte en «+0…»: sin su
 * país no se puede saber y vuelve null.
 */
export function telefonoE164(t: string | null | undefined, pais?: string | null): string | null {
  const leido = aE164(t, pais);
  if (leido) return leido;
  const d = String(t ?? '').replace(/[^\d+]/g, '');
  if (!d) return null;
  if (d.startsWith('+')) return d.length >= 8 && !d.startsWith('+0') ? d : null;
  const solo = d.replace(/\D/g, '');
  if (solo.startsWith('0')) return null;
  if (solo.length === 10) return `+1${solo}`;
  if (solo.length === 11 && solo.startsWith('1')) return `+${solo}`;
  return solo.length >= 8 ? `+${solo}` : null;
}

/**
 * C-SMS-PAISES: a qué países salen los SMS y las llamadas. Por defecto solo +1 (EE. UU.); un SMS a
 * Venezuela cuesta unos 0,23 dólares. Se amplía con la variable SMS_PREFIJOS («+1,+57»).
 */
export function destinoPermitido(env: Env, para: string): boolean {
  const prefijos = (env.SMS_PREFIJOS ?? '+1')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.startsWith('+'));
  return prefijos.some((p) => para.startsWith(p));
}

/** C-LLAMADAS-CON-LIMITE: Twilio que no contesta en 10 s cuenta como fallo; nunca cuelga la petición. */
const TIEMPO_TWILIO_MS = 10_000;
let tiempoTwilio = TIEMPO_TWILIO_MS;
/** Solo para pruebas. */
export function usarTiempoTwilio(ms: number | null) {
  tiempoTwilio = ms ?? TIEMPO_TWILIO_MS;
}

export async function twilio(
  env: Env,
  recurso: 'Messages' | 'Calls',
  datos: Record<string, string>,
) {
  const cuerpo = new URLSearchParams(datos).toString();
  const c = credencialTwilio(env);
  const auth = btoa(`${c?.usuario ?? ''}:${c?.clave ?? ''}`);
  const res = await fetch(
    `${baseTwilio(env)}/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/${recurso}.json`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: cuerpo,
      signal: AbortSignal.timeout(tiempoTwilio),
    },
  );
  const r = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
  if (!res.ok || !r?.sid) throw new Error(r?.message ?? `Twilio respondió ${res.status}`);
  return r.sid;
}

/**
 * C-SMS-CONSENTIMIENTO (9 nov 2026, Twilio 30513). Quién puede recibir un SMS:
 * - El titular de la cuenta (avisos del pedido, del viaje, etc.): SOLO si marcó la casilla de SMS
 *   (usuarios.sms_consentido_en). Sin casilla marcada, no se le manda nada.
 * - El código que la persona pide en ese momento (verificar su teléfono): sí, porque lo pide ella
 *   misma para ese único mensaje (CTIA: mensaje único a pedido del usuario).
 * - Terceros a los que el titular comparte algo a propósito (regalo, paquete, viaje compartido,
 *   invitación de una empresa a su conductor o a quien recibe un paquete): mensaje único, iniciado
 *   por quien da el número; no es la cuenta del titular la que recibe.
 * - El equipo de Divoox (avisos internos «equipo_…»): son nuestro personal, no clientes.
 * La baja (STOP/HELP/START) la maneja Twilio en el número gratuito por defecto: no hay webhook de
 * entrada propio; Twilio bloquea el envío a quien respondió STOP (error 21610).
 */
// C-RECUPERAR-WHATSAPP: el código para recuperar la cuenta lo pide la persona; el aviso de «se cambió
// tu contraseña» es un aviso de seguridad de su propia cuenta (transaccional, uno por cambio).
export const SMS_PEDIDOS_POR_LA_PERSONA: ReadonlySet<string> = new Set([
  'codigo_telefono',
  'codigo_recuperar',
  'aviso_clave_cambiada',
]);
export const SMS_A_TERCEROS: ReadonlySet<string> = new Set([
  'regalo_destinatario',
  'envio_destinatario',
  'viaje_compartido',
  'flex_invitacion',
  'flex_invitar_conductor',
]);
export const smsSinConsentimientoDelTitular = (tipo: string) =>
  SMS_PEDIDOS_POR_LA_PERSONA.has(tipo) || SMS_A_TERCEROS.has(tipo) || tipo.startsWith('equipo_');

/** Guarda (o retira) el consentimiento de SMS de una cuenta, con fecha, versión del texto y canal. */
export async function guardarConsentimientoSms(
  db: D1Database,
  usuarioId: string,
  acepta: boolean,
  canal: CanalConsentimientoSms,
) {
  await db
    .prepare(
      acepta
        ? "UPDATE usuarios SET sms_consentido_en = datetime('now'), sms_consentimiento_version = ?, sms_consentimiento_canal = ? WHERE id = ?"
        : 'UPDATE usuarios SET sms_consentido_en = NULL, sms_consentimiento_version = ?, sms_consentimiento_canal = ? WHERE id = ?',
    )
    .bind(VERSION_CONSENTIMIENTO_SMS, canal, usuarioId)
    .run();
}

/** ¿El titular aceptó los SMS? Ante cualquier duda (sin fila, error), no. */
export async function aceptoSms(db: D1Database, usuarioId: string): Promise<boolean> {
  const f = await db
    .prepare('SELECT sms_consentido_en FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ sms_consentido_en: string | null }>()
    .catch((e: unknown) => {
      console.error('sms: no se pudo leer el consentimiento', String(e));
      return null;
    });
  return Boolean(f?.sms_consentido_en);
}

/**
 * C-PANICO-ZONA: el número gratuito (+1 866) solo manda SMS a EE. UU. y Canadá. Fuera de +1 sale
 * del número internacional si está configurado (TWILIO_FROM_INTERNACIONAL).
 */
export const remitente = (env: Env, para: string) =>
  !para.startsWith('+1') && env.TWILIO_FROM_INTERNACIONAL
    ? env.TWILIO_FROM_INTERNACIONAL
    : env.TWILIO_FROM!;

/** Los SMS de pánico salen a cualquier país (zona y líneas); los demás SMS a Venezuela siguen apagados por costo. */
const SMS_DE_PANICO: ReadonlySet<string> = new Set(['equipo_panico', 'equipo_panico_linea']);
/** C-LINEAS-TAXI: como mucho tantos SMS de emergencia de líneas en 24 horas (todos los conductores juntos). */
export const TOPE_SMS_LINEAS_DIA = 60;

/** C-PANICO-ZONA: como mucho tantos SMS de pánico en 24 horas (todos los países juntos). */
export const TOPE_PANICO_DIA = 40;

/**
 * C-SMS-PROVEEDOR (16 nov 2026): el SMS sale por un proveedor intercambiable. Hoy solo Twilio; para
 * Venezuela se evalúa SMSya (docs de Gerencia, SMSYA-API-EVALUACION). Agregar uno = sumar su pieza
 * aquí y elegirlo con SMS_PROVEEDOR, sin tocar a quien llama a enviarSms.
 */
export type ProveedorSms = {
  nombre: string;
  enviar: (env: Env, para: string, texto: string) => Promise<string>;
};
const TWILIO_SMS: ProveedorSms = {
  nombre: 'twilio',
  enviar: (env, para, texto) =>
    twilio(env, 'Messages', { To: para, From: remitente(env, para), Body: texto }),
};
/** El país de un celular en formato internacional (+58… → VE, +1… → US). */
export function paisDeE164(para: string): string | null {
  const d = para.replace(/\D/g, '');
  for (const largo of [1, 2, 3]) {
    const p = paisDePrefijo(d.slice(0, largo));
    if (p) return p;
  }
  return null;
}

/** LabsMobile: la dirección fija del proveedor (solo se cambia a localhost para un simulador). */
function baseLabsmobile(env: Env) {
  const real = 'https://api.labsmobile.com';
  try {
    const o = new URL(env.LABSMOBILE_API_URL ?? real);
    return o.hostname === 'localhost' || o.hostname === '127.0.0.1' ? o.origin : real;
  } catch {
    return real;
  }
}
export const labsmobileConfigurado = (env: Env) =>
  Boolean(env.LABSMOBILE_USUARIO && env.LABSMOBILE_TOKEN);
/**
 * C-SMS-PROVEEDOR-POR-PAIS (23 nov 2026, Gerencia): LabsMobile, API REST con usuario y token. Queda
 * construido y probado con simulación; se enciende poniendo sus credenciales y su país en
 * SMS_PROVEEDORES_POR_PAIS («VE:labsmobile»). Responde «code: 0» cuando lo acepta.
 */
const LABSMOBILE_SMS: ProveedorSms = {
  nombre: 'labsmobile',
  enviar: async (env, para, texto) => {
    const res = await fetch(`${baseLabsmobile(env)}/json/send`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${env.LABSMOBILE_USUARIO ?? ''}:${env.LABSMOBILE_TOKEN ?? ''}`)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: texto,
        tpoa: env.LABSMOBILE_REMITENTE ?? 'Divoox',
        recipient: [{ msisdn: para.replace(/\D/g, '') }],
      }),
      signal: AbortSignal.timeout(tiempoTwilio),
    });
    const r = (await res.json().catch(() => null)) as {
      code?: string | number;
      message?: string;
      subid?: string;
    } | null;
    if (!res.ok || String(r?.code) !== '0')
      throw new Error(`LabsMobile: ${r?.message ?? `respondió ${res.status}`}`);
    return r?.subid ?? 'labsmobile';
  },
};
const PROVEEDORES_SMS = new Map<string, ProveedorSms>([
  ['twilio', TWILIO_SMS],
  ['labsmobile', LABSMOBILE_SMS],
]);
export function proveedorSms(env: Env): ProveedorSms {
  return PROVEEDORES_SMS.get(env.SMS_PROVEEDOR ?? 'twilio') ?? TWILIO_SMS;
}
/** «VE:labsmobile,US:twilio» → el proveedor de ese país (o null si no tiene uno propio). */
function proveedorDelPais(env: Env, pais: string | null): string | null {
  if (!pais) return null;
  for (const par of (env.SMS_PROVEEDORES_POR_PAIS ?? '').split(',')) {
    const [p, nombre] = par.split(':').map((x) => x.trim());
    if (p?.toUpperCase() === pais && nombre) return nombre.toLowerCase();
  }
  return null;
}
/**
 * C-SMS-PROVEEDOR-POR-PAIS: el proveedor de SMS para ESTE número. Un proveedor propio del país que no
 * está configurado no cuenta (se cae a lo de siempre).
 */
export function proveedorSmsPara(env: Env, para: string): ProveedorSms {
  const nombre = proveedorDelPais(env, paisDeE164(para));
  if (nombre === 'labsmobile' && labsmobileConfigurado(env)) return LABSMOBILE_SMS;
  if (nombre === 'twilio') return TWILIO_SMS;
  return proveedorSms(env);
}
/** ¿Este número sale por un proveedor propio de su país (no Twilio)? Entonces no mira SMS_PREFIJOS. */
export const vaPorProveedorDelPais = (env: Env, para: string) =>
  proveedorSmsPara(env, para).nombre !== 'twilio' &&
  proveedorDelPais(env, paisDeE164(para)) !== null;

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
    /** C-SMS-VENEZUELA-TEXTOS: la versión de un solo SMS para el proveedor de Venezuela. */
    textoCorto?: string;
  },
): Promise<boolean> {
  const para = telefonoE164(a.telefono);
  if (!para) return false;
  // C-SMS-VENEZUELA: a +58 sale por el proveedor local SOLO si está encendido; si no, lo de siempre.
  const local = vaPorSmsMasivo(env, para);
  const dePanico = SMS_DE_PANICO.has(a.tipo);
  // C-SMS-PROVEEDOR-POR-PAIS: un proveedor propio del país (LabsMobile) no depende de Twilio.
  const delPais = !local && vaPorProveedorDelPais(env, para);
  if (!local && !delPais) {
    if (!smsConfigurado(env)) return false;
    // C-PANICO-ZONA: el SMS de pánico al responsable de la zona sale a cualquier país (también +58).
    if (!dePanico && !destinoPermitido(env, para)) return false;
  }
  // C-SMS-CONSENTIMIENTO: sin la casilla marcada, al titular no se le manda nada que no pidió.
  if (!smsSinConsentimientoDelTitular(a.tipo) && !(await aceptoSms(db, a.usuarioId))) return false;
  // C-PANICO-ZONA: tope diario del SMS de pánico (cada envío queda en sms_enviados).
  if (a.tipo === 'equipo_panico') {
    const hoy = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM sms_enviados WHERE tipo = 'equipo_panico' AND creado_en >= datetime('now', '-1 day')",
      )
      .first<{ n: number }>()
      .catch(() => ({ n: 0 }));
    if (Number(hoy?.n ?? 0) >= TOPE_PANICO_DIA) {
      console.error(`sms: tope diario de pánico alcanzado (${TOPE_PANICO_DIA})`);
      return false;
    }
  }
  if (a.tipo === 'equipo_panico_linea') {
    const hoy = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM sms_enviados WHERE tipo = 'equipo_panico_linea' AND creado_en >= datetime('now', '-1 day')",
      )
      .first<{ n: number }>()
      .catch(() => ({ n: 0 }));
    if (Number(hoy?.n ?? 0) >= TOPE_SMS_LINEAS_DIA) {
      console.error(`sms: tope diario de emergencias de líneas alcanzado (${TOPE_SMS_LINEAS_DIA})`);
      return false;
    }
  }
  const id = nuevoId();
  // C-SMS-VENEZUELA-TEXTOS: sin montos ni datos de pago, sin acentos y en un solo SMS.
  let bloqueado: string | null = null;
  // Por dónde se intenta, en orden. El pánico a Venezuela tiene respaldo en Twilio si el local falla.
  const caminos: string[] = local
    ? [PROVEEDOR_SMSMASIVO, ...(dePanico && smsConfigurado(env) ? [proveedorSms(env).nombre] : [])]
    : [proveedorSmsPara(env, para).nombre];
  for (const camino of caminos) {
    try {
      let referencia: string;
      if (camino === PROVEEDOR_SMSMASIVO) {
        // C-SMS-VENEZUELA: tope de gasto del día. Si no se puede contar, no se manda.
        const hoy = await smsMasivoDeHoy(db);
        const tope = topeSmsMasivo(env);
        if (hoy >= tope) {
          anotarErrorSmsMasivo(`tope diario alcanzado (${tope})`);
          throw new Error(`tope diario de SMS a Venezuela alcanzado (${tope})`);
        }
        const listo = textoParaSmsVenezuela(a.textoCorto ?? a.texto);
        if (listo.bloqueado) {
          bloqueado = listo.bloqueado;
          throw new Error(
            `el SMS «${a.tipo}» no sale por el proveedor de Venezuela: ${listo.bloqueado === 'dinero' ? 'lleva montos o datos de pago' : 'no cabe en un solo SMS'}`,
          );
        }
        try {
          referencia = await enviarPorSmsMasivo(env, para, listo.texto, id);
        } catch (e) {
          anotarErrorSmsMasivo(String(e));
          throw e;
        }
      } else {
        const prov = PROVEEDORES_SMS.get(camino) ?? proveedorSmsPara(env, para);
        // Fuera de Twilio, el texto también pasa la compuerta de un solo SMS sin acentos ni montos.
        const listo =
          prov.nombre === 'twilio' ? null : textoParaSmsVenezuela(a.textoCorto ?? a.texto);
        if (listo?.bloqueado) {
          bloqueado = listo.bloqueado;
          throw new Error(`el SMS «${a.tipo}» no sale por ${prov.nombre}: ${listo.bloqueado}`);
        }
        referencia = await prov.enviar(env, para, listo?.texto ?? a.texto);
      }
      await db
        .prepare(
          "INSERT INTO sms_enviados (id, usuario_id, pedido_id, tipo, estado, proveedor, referencia) VALUES (?, ?, ?, ?, 'enviado', ?, ?)",
        )
        .bind(id, a.usuarioId, a.pedidoId, a.tipo, camino, referencia)
        .run();
      return true;
    } catch (e) {
      const fallo = String(e);
      if (camino !== PROVEEDOR_SMSMASIVO)
        ultimoErrorSms = { cuando: new Date().toISOString(), motivo: fallo };
      console.error('sms:', fallo);
    }
  }
  await db
    .prepare(
      'INSERT INTO sms_enviados (id, usuario_id, pedido_id, tipo, estado, proveedor) VALUES (?, ?, ?, ?, ?, ?)',
    )
    // Un texto frenado por la compuerta no gastó nada: queda «bloqueado» y sin proveedor (no cuenta en el tope).
    .bind(
      id,
      a.usuarioId,
      a.pedidoId,
      a.tipo,
      bloqueado ? 'bloqueado' : 'error',
      bloqueado ? null : (caminos[0] ?? null),
    )
    .run()
    .catch((e: unknown) => console.error('sms: no se pudo anotar el fallo', String(e)));
  return false;
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

/**
 * C-FLEX-YA-LLEGA (LG4/LG5): llamada automática con voz («tu paquete ya llega») para que quien
 * espera en la casa o en un punto de la vía salga a tiempo. Solo con Twilio configurado.
 */
export async function llamarConVoz(
  env: Env,
  telefono: string | null | undefined,
  texto: string,
  idioma: 'es' | 'en',
): Promise<boolean> {
  if (!smsConfigurado(env)) return false;
  const para = telefonoE164(telefono);
  if (!para || !destinoPermitido(env, para)) return false;
  const limpio = texto.replace(/[<>&]/g, ' ');
  const voz = idioma === 'en' ? 'en-US' : 'es-MX';
  try {
    await twilio(env, 'Calls', {
      To: para,
      From: env.TWILIO_FROM!,
      Twiml: `<Response><Say language="${voz}">${limpio}</Say><Pause length="1"/><Say language="${voz}">${limpio}</Say></Response>`,
    });
    return true;
  } catch (e) {
    ultimoErrorSms = { cuando: new Date().toISOString(), motivo: String(e) };
    console.error('llamada:', ultimoErrorSms.motivo);
    return false;
  }
}
