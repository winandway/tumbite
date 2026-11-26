/* eslint-disable security/detect-object-injection -- las claves son pasos, idiomas y zonas de listas propias, validadas con zod */
import { momentoEn } from '@tumbite/compartido';
import { z } from 'zod';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { zonaRealSql } from './cuentaPais';
import { type ClavePaso, barraActivacion } from './activacion';
import { notificar } from './notificaciones';
import { aceptoSms, destinoPermitido, enviarSms, smsConfigurado, telefonoE164 } from './sms';
import { estadoEnSmsMasivo, vaPorSmsMasivo } from './smsMasivo';
import { enviarPorCanal } from './camila/canales';
import { humanoActivo, personaDeUsuario, sentenciaMensaje } from './camila/memoria';
import { vueltaWhatsappFalta } from './whatsappFalta';
import { limpiarEntrantes } from './whatsappEntrante';

/**
 * C-REZAGADOS (22 nov 2026, orden de Richard por Gerencia) — todos los países, encendido por zona.
 *
 * Camila le escribe sola a quien se quedó a medio registro. Una tarea del reloj (cada media hora)
 * mira, con el rastro del registro (`embudo_cuenta`, C-RASTRO), en qué paso exacto se quedó cada
 * cuenta nueva y, si lleva quieta el plazo que toca, le manda la plantilla de ESE paso: primero correo
 * y aviso en la app, después un SMS corto, y un último correo. Luego se detiene.
 *
 * - Sin IA en el envío: plantillas fijas, firmadas por Camila. La IA solo entra si la persona contesta.
 * - Por zona: `apagado` (de fábrica), `previa` (el panel muestra a quién le escribiría; no envía ni
 *   escribe nada) o `encendido`.
 * - Topes: uno por persona por día, tantos por paso, tantos por persona, tantos correos y SMS al día en
 *   total, y solo dentro del horario local de la zona de la persona.
 * - Se detiene en cuanto el paso aparece en el rastro. Las cuentas de prueba no reciben nada. Se
 *   respeta la baja (enlace del correo) y el consentimiento de SMS.
 * - Regla de la nube: la vuelta solo escribe una fila por mensaje que de verdad sale.
 */

export const PASOS_REZAGADO = [
  'clave',
  'fotos',
  'repetir',
  // C-DOCUMENTO-VENCIDO-CLARO: el equipo vio su documento vencido y le pidió el vigente.
  'documento_vigente',
  'vehiculo',
  // C-VEHICULO-SIN-ENVIAR: registró su vehículo y no lo ha enviado a revisión.
  'vehiculo_enviar',
  'saldo',
  // C-PAPELES-POR-PAIS: le faltan papeles de su país que «solo se piden» (solo con la lista encendida).
  'papeles',
  'servicio',
  'linea',
  'correo',
] as const;
export type PasoRezagado = (typeof PASOS_REZAGADO)[number];
export type CanalRezagado = 'correo' | 'sms' | 'aviso';
export type ModoZona = 'apagado' | 'previa' | 'encendido';
type Idioma = 'es' | 'en';

export type Plantilla = { asunto: string; texto: string; sms: string };
type PlantillasPaso = Record<Idioma, Plantilla>;

/**
 * `{nombre}` = el primer nombre de la persona; `{enlace}` = la dirección que la lleva a seguir;
 * `{enlace_corto}` = la dirección corta del SMS; `{plazo}` = una frase SOLO para quien tiene su plazo de
 * papeles corriendo (ya puede trabajar y hasta qué día tiene); para los demás queda vacía.
 */
export const PLANTILLAS_DE_FABRICA: Record<PasoRezagado, PlantillasPaso> = {
  fotos: {
    es: {
      asunto: 'Te falta un paso para empezar a ganar con Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. ¡Ya casi terminas tu registro para ganar con Divoox! Solo faltan tus fotos: tu cara, tu documento y tu licencia. Se toman desde la app en pocos minutos.{plazo}\n\nContinúa aquí:\n{enlace}\n\nSi algo no te deja avanzar, respóndeme este correo y te ayudo.',
      sms: 'Divoox: {nombre}, te faltan tus fotos para empezar a recibir viajes. Son pocos minutos. Continua aqui: {enlace_corto} Camila',
    },
    en: {
      asunto: 'One step left to start earning with Divoox',
      texto:
        'Hi {nombre}, this is Camila from Divoox. You are almost ready to earn with Divoox! Only your photos are missing: your face, your ID and your license. They take a few minutes in the app.{plazo}\n\nContinue here:\n{enlace}\n\nIf something is stopping you, reply to this email and I will help.',
      sms: 'Divoox: {nombre}, your photos are missing to start getting trips. It takes a few minutes. Continue here: {enlace_corto} Camila',
    },
  },
  // C-VIGILANTE-REGISTROS: varios intentos de entrar con la contraseña equivocada en una cuenta que existe.
  clave: {
    es: {
      asunto: '¿Te cuesta entrar a tu cuenta de Divoox?',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Vimos que intentaste entrar a tu cuenta varias veces y la contraseña no coincidía. Tu cuenta está bien: puedes crear una contraseña nueva en un minuto.\n\nCrea tu contraseña nueva aquí:\n{enlace}\n\nSi no fuiste tú, o sigues sin poder entrar, respóndeme este correo y te ayudo.',
      sms: 'Divoox: {nombre}, vimos que te cuesta entrar a tu cuenta. Crea una contrasena nueva en la app con Olvide mi contrasena: {enlace_corto} Camila',
    },
    en: {
      asunto: 'Having trouble signing in to Divoox?',
      texto:
        'Hi {nombre}, this is Camila from Divoox. We saw you tried to sign in to your account several times and the password did not match. Your account is fine: you can create a new password in a minute.\n\nCreate your new password here:\n{enlace}\n\nIf it was not you, or you still cannot sign in, reply to this email and I will help.',
      sms: 'Divoox: {nombre}, we saw you are having trouble signing in. Create a new password in the app with Forgot my password: {enlace_corto} Camila',
    },
  },
  // C-VIGILANTE-REGISTROS: el equipo pidió repetir una foto o un papel (borrosa, oscura, rechazada).
  repetir: {
    es: {
      asunto: 'Te pedimos repetir una foto de tu registro',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Revisamos tu registro de conductor y necesitamos que repitas una foto o un papel: no se veía bien o no se pudo aprobar. Abre Divoox Driver: arriba verás cuál es y por qué, con el botón para tomarla otra vez.{plazo}\n\nContinúa aquí:\n{enlace}\n\nSi no sabes qué foto es, respóndeme este correo y te ayudo.',
      sms: 'Divoox: {nombre}, necesitamos que repitas una foto de tu registro de conductor. Abre Divoox Driver y mira arriba cual es: {enlace_corto} Camila',
    },
    en: {
      asunto: 'Please retake a photo from your sign-up',
      texto:
        'Hi {nombre}, this is Camila from Divoox. We reviewed your driver sign-up and need you to retake a photo or a document: it was not clear or could not be approved. Open Divoox Driver: at the top you will see which one and why, with the button to take it again.{plazo}\n\nContinue here:\n{enlace}\n\nIf you are not sure which photo it is, reply to this email and I will help.',
      sms: 'Divoox: {nombre}, please retake a photo from your driver sign-up. Open Divoox Driver and check the top of the screen: {enlace_corto} Camila',
    },
  },
  documento_vigente: {
    es: {
      asunto: 'Necesitamos tu documento vigente',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Revisamos tu registro de conductor y tu documento aparece vencido. Para seguir recibiendo viajes necesitamos la foto de tu documento vigente. Abre Divoox Driver: arriba verás cuál es, con el botón para tomarla.\n\nContinúa aquí:\n{enlace}\n\nSi ya lo renovaste y tienes dudas, respóndeme este correo y te ayudo.',
      sms: 'Divoox: {nombre}, tu documento aparece vencido. Abre Divoox Driver y toma la foto de tu documento vigente: {enlace_corto} Camila',
    },
    en: {
      asunto: 'We need your current document',
      texto:
        'Hi {nombre}, this is Camila from Divoox. We reviewed your driver sign-up and your document shows as expired. To keep getting trips we need a photo of your current document. Open Divoox Driver: at the top you will see which one, with the button to take it.\n\nContinue here:\n{enlace}\n\nIf you already renewed it and have questions, reply to this email and I will help.',
      sms: 'Divoox: {nombre}, your document shows as expired. Open Divoox Driver and take a photo of your current one: {enlace_corto} Camila',
    },
  },
  vehiculo_enviar: {
    es: {
      asunto: 'Envía tu vehículo a revisión en Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Ya registraste tu vehículo, pero todavía no lo has enviado a revisión: mientras no lo envíes, nuestro equipo no puede aprobarlo. Abre Divoox Driver, entra en «Tu vehículo», completa sus fotos y papeles y toca «Enviar a revisión».{plazo}\n\nContinúa aquí:\n{enlace}\n\nSi algo no te deja enviarlo, respóndeme este correo y te ayudo.',
      sms: 'Divoox: {nombre}, registraste tu vehiculo pero falta enviarlo a revision. Abre Divoox Driver, entra en Tu vehiculo y envialo: {enlace_corto} Camila',
    },
    en: {
      asunto: 'Send your vehicle for review on Divoox',
      texto:
        'Hi {nombre}, this is Camila from Divoox. You registered your vehicle, but you have not sent it for review yet: until you do, our team cannot approve it. Open Divoox Driver, go to “Your vehicle”, complete its photos and documents and tap “Send for review”.{plazo}\n\nContinue here:\n{enlace}\n\nIf something is stopping you, reply to this email and I will help.',
      sms: 'Divoox: {nombre}, you registered your vehicle but did not send it for review. Open Divoox Driver, go to Your vehicle and send it: {enlace_corto} Camila',
    },
  },
  vehiculo: {
    es: {
      asunto: 'Falta registrar tu vehículo en Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. ¡Vas muy bien! Solo falta registrar tu vehículo para que podamos enviarte viajes: marca, modelo y placa. Toma pocos minutos.{plazo}\n\nContinúa aquí:\n{enlace}\n\nSi tienes una duda con algún dato, respóndeme este correo y lo vemos.',
      sms: 'Divoox: {nombre}, solo falta registrar tu vehiculo para recibir viajes. Son pocos minutos. Continua aqui: {enlace_corto} Camila',
    },
    en: {
      asunto: 'Your vehicle is not registered yet',
      texto:
        'Hi {nombre}, this is Camila from Divoox. You are doing great! Just register your vehicle so we can send you trips: make, model and plate. It takes a few minutes.{plazo}\n\nContinue here:\n{enlace}\n\nIf you are unsure about any detail, reply to this email and we will sort it out.',
      sms: 'Divoox: {nombre}, just register your vehicle to get trips. It takes a few minutes. Continue here: {enlace_corto} Camila',
    },
  },
  // C-VIGILANTE-REGISTROS: aprobado, pero donde rige el prepago no tiene saldo para la comisión.
  // Nunca lleva montos: la app le dice cuánto y cómo recargar.
  saldo: {
    es: {
      asunto: 'Recarga tu saldo para recibir viajes',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Tu cuenta de conductor ya puede trabajar, pero todavía no te llegan viajes porque te falta saldo en tu billetera. Abre Divoox Driver y entra en «Billetera»: ahí ves cuánto necesitas y cómo recargar.\n\nContinúa aquí:\n{enlace}\n\nSi tienes dudas para recargar, respóndeme este correo y te ayudo.',
      sms: 'Divoox: {nombre}, ya puedes trabajar pero te falta saldo para recibir viajes. Abre Divoox Driver y entra en Billetera: {enlace_corto} Camila',
    },
    en: {
      asunto: 'Top up your balance to get trips',
      texto:
        'Hi {nombre}, this is Camila from Divoox. Your driver account can already work, but you are not getting trips yet because your wallet balance is too low. Open Divoox Driver and go to “Wallet”: you will see how much you need and how to top up.\n\nContinue here:\n{enlace}\n\nIf you have questions about topping up, reply to this email and I will help.',
      sms: 'Divoox: {nombre}, you can work now but you need balance to get trips. Open Divoox Driver and go to Wallet: {enlace_corto} Camila',
    },
  },
  // C-PAPELES-POR-PAIS: los papeles de su país que «solo se piden» (por ejemplo, el certificado médico).
  // No frenan sus viajes: se le recuerdan para completar su registro.
  papeles: {
    es: {
      asunto: 'Te falta subir unos papeles en Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Tu registro de conductor va bien, pero todavía te faltan unos papeles que pedimos en tu país. Abre Divoox Driver y entra en «Tu vehículo» o en «Tus papeles»: ahí ves cuáles son y los subes con una foto.{plazo}\n\nContinúa aquí:\n{enlace}\n\nSi no sabes cuál te falta, respóndeme este correo y te ayudo.',
      sms: 'Divoox: {nombre}, te faltan unos papeles de tu registro de conductor. Abre Divoox Driver y subelos con una foto: {enlace_corto} Camila',
    },
    en: {
      asunto: 'A few documents are still missing on Divoox',
      texto:
        'Hi {nombre}, this is Camila from Divoox. Your driver sign-up is going well, but a few documents we ask for in your country are still missing. Open Divoox Driver and go to “Your vehicle” or “Your documents”: you will see which ones and can upload them with a photo.{plazo}\n\nContinue here:\n{enlace}\n\nIf you are not sure which one is missing, reply to this email and I will help.',
      sms: 'Divoox: {nombre}, a few documents from your driver sign-up are missing. Open Divoox Driver and upload them with a photo: {enlace_corto} Camila',
    },
  },
  servicio: {
    es: {
      asunto: 'Tu cuenta de Divoox ya está aprobada',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Tu cuenta ya está aprobada y lista para trabajar. Solo falta que te conectes para empezar a recibir viajes.\n\nAbre Divoox Driver y toca «Conectarme»:\n{enlace}\n\nSi la app te muestra algún aviso al conectarte, respóndeme y te digo qué hacer.',
      sms: 'Divoox: {nombre}, tu cuenta ya esta aprobada. Abre Divoox Driver y toca Conectarme para recibir viajes: {enlace_corto} Camila',
    },
    en: {
      asunto: 'Your Divoox account is approved',
      texto:
        'Hi {nombre}, this is Camila from Divoox. Your account is approved and ready to work. All that is left is going online to start getting trips.\n\nOpen Divoox Driver and tap “Go online”:\n{enlace}\n\nIf the app shows you a notice when you go online, reply to me and I will tell you what to do.',
      sms: 'Divoox: {nombre}, your account is approved. Open Divoox Driver and tap Go online to get trips: {enlace_corto} Camila',
    },
  },
  linea: {
    es: {
      asunto: 'Únete a tu línea en Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. En tu ciudad los conductores trabajan por línea y tu cuenta todavía no está en ninguna.\n\nPídele a tu líder su código o su enlace, abre Divoox Driver y entra en «Tu línea» para unirte:\n{enlace}\n\nSi no sabes cuál es tu línea, respóndeme con el nombre de tu líder y te ayudo.',
      sms: 'Divoox: {nombre}, tu cuenta aun no esta en una linea. Pide el codigo a tu lider y entra en Tu linea: {enlace_corto} Camila',
    },
    en: {
      asunto: 'Join your line on Divoox',
      texto:
        'Hi {nombre}, this is Camila from Divoox. In your city drivers work in lines and your account is not in one yet.\n\nAsk your leader for the code or link, open Divoox Driver and go to “Your line” to join:\n{enlace}\n\nIf you do not know which line is yours, reply with your leader’s name and I will help.',
      sms: 'Divoox: {nombre}, your account is not in a line yet. Ask your leader for the code and open Your line: {enlace_corto} Camila',
    },
  },
  correo: {
    es: {
      asunto: 'Confirma tu correo de Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Tu cuenta está creada, pero tu correo sigue sin confirmar. Busca en tu bandeja, y también en la carpeta de correo no deseado, el mensaje de Divoox con el botón «Confirmar mi correo».\n\nSi no lo encuentras, respóndeme a este correo y te lo envío otra vez.',
      sms: 'Divoox: {nombre}, falta confirmar tu correo. Busca el mensaje de Divoox en tu bandeja o en correo no deseado. Camila',
    },
    en: {
      asunto: 'Confirm your Divoox email',
      texto:
        'Hi {nombre}, this is Camila from Divoox. Your account is created, but your email is still not confirmed. Look in your inbox, and in your spam folder too, for the Divoox message with the “Confirm my email” button.\n\nIf you cannot find it, reply to this email and I will send it again.',
      sms: 'Divoox: {nombre}, your email is not confirmed yet. Look for the Divoox message in your inbox or spam folder. Camila',
    },
  },
};

const AVISO: Record<PasoRezagado, Record<Idioma, { titulo: string; cuerpo: string }>> = {
  clave: {
    es: {
      titulo: '¿Te cuesta entrar?',
      cuerpo: 'Toca «Olvidé mi contraseña» y crea una nueva.',
    },
    en: { titulo: 'Trouble signing in?', cuerpo: 'Tap “Forgot my password” and create a new one.' },
  },
  repetir: {
    es: {
      titulo: 'Repite una foto de tu registro',
      cuerpo: 'Abre la app: arriba verás cuál es y por qué.',
    },
    en: {
      titulo: 'Retake a photo from your sign-up',
      cuerpo: 'Open the app: the top of the screen shows which one and why.',
    },
  },
  documento_vigente: {
    es: {
      titulo: 'Tu documento aparece vencido',
      cuerpo: 'Abre la app y toma la foto de tu documento vigente.',
    },
    en: {
      titulo: 'Your document shows as expired',
      cuerpo: 'Open the app and take a photo of your current document.',
    },
  },
  vehiculo_enviar: {
    es: {
      titulo: 'Envía tu vehículo a revisión',
      cuerpo: 'Entra en «Tu vehículo» y toca «Enviar a revisión».',
    },
    en: {
      titulo: 'Send your vehicle for review',
      cuerpo: 'Go to “Your vehicle” and tap “Send for review”.',
    },
  },
  saldo: {
    es: {
      titulo: 'Te falta saldo para recibir viajes',
      cuerpo: 'Entra en «Billetera» y recarga para empezar.',
    },
    en: { titulo: 'Add balance to get trips', cuerpo: 'Go to “Wallet” and top up to start.' },
  },
  fotos: {
    es: {
      titulo: 'Te faltan tus fotos',
      cuerpo: 'Toca «Tus papeles» y termínalas para recibir viajes.',
    },
    en: {
      titulo: 'Your photos are missing',
      cuerpo: 'Tap “Your documents” and finish them to get trips.',
    },
  },
  vehiculo: {
    es: {
      titulo: 'Falta registrar tu vehículo',
      cuerpo: 'Entra en «Tu vehículo» y escribe sus datos.',
    },
    en: { titulo: 'Register your vehicle', cuerpo: 'Go to “Your vehicle” and enter its details.' },
  },
  papeles: {
    es: {
      titulo: 'Te faltan unos papeles',
      cuerpo: 'Abre la app: verás cuáles son y los subes con una foto.',
    },
    en: {
      titulo: 'A few documents are missing',
      cuerpo: 'Open the app: you will see which ones and can upload them with a photo.',
    },
  },
  servicio: {
    es: {
      titulo: 'Tu cuenta ya está aprobada',
      cuerpo: 'Toca «Conectarme» para empezar a recibir viajes.',
    },
    en: { titulo: 'Your account is approved', cuerpo: 'Tap “Go online” to start getting trips.' },
  },
  linea: {
    es: { titulo: 'Únete a tu línea', cuerpo: 'Pide el código a tu líder y entra en «Tu línea».' },
    en: { titulo: 'Join your line', cuerpo: 'Ask your leader for the code and go to “Your line”.' },
  },
  correo: {
    es: {
      titulo: 'Confirma tu correo',
      cuerpo: 'Busca el mensaje de Divoox en tu bandeja de correo.',
    },
    en: { titulo: 'Confirm your email', cuerpo: 'Look for the Divoox message in your inbox.' },
  },
};

// ───────────────────────── Ajustes ─────────────────────────

const plantilla = z.object({
  asunto: z.string().trim().min(3).max(120),
  texto: z.string().trim().min(20).max(1500),
  sms: z.string().trim().min(10).max(160),
});
const plantillasPaso = z.object({ es: plantilla, en: plantilla });
const porPaso = z.object({
  clave: plantillasPaso.optional(),
  fotos: plantillasPaso.optional(),
  repetir: plantillasPaso.optional(),
  documento_vigente: plantillasPaso.optional(),
  vehiculo: plantillasPaso.optional(),
  vehiculo_enviar: plantillasPaso.optional(),
  saldo: plantillasPaso.optional(),
  papeles: plantillasPaso.optional(),
  servicio: plantillasPaso.optional(),
  linea: plantillasPaso.optional(),
  correo: plantillasPaso.optional(),
});

export const LIMITES_REZAGADOS = { topeDiarioMaximo: 200, ventanaDiasMaxima: 60 } as const;

export const esquemaAjustesRezagados = z.object({
  /** Horas quieto en el paso antes del 1.º, 2.º y 3.º recordatorio. */
  plazosHoras: z.tuple([
    z.number().int().min(1).max(72),
    z.number().int().min(2).max(240),
    z.number().int().min(3).max(720),
  ]),
  topePorPaso: z.number().int().min(1).max(3),
  topePorPersona: z.number().int().min(1).max(12),
  /** Correos y SMS automáticos al día, entre todas las zonas (cuida la reputación del correo). */
  topeDiario: z.number().int().min(0).max(LIMITES_REZAGADOS.topeDiarioMaximo),
  horaDesde: z.number().int().min(0).max(23),
  horaHasta: z.number().int().min(1).max(24),
  ventanaDias: z.number().int().min(1).max(LIMITES_REZAGADOS.ventanaDiasMaxima),
  zonas: z.record(z.string().min(1).max(60), z.enum(['apagado', 'previa', 'encendido'])),
  /** Cuentas a las que sí se les escribe aunque su zona siga en vista previa (lista confirmada por Gerencia). */
  autorizados: z.array(z.string().min(8).max(64)).max(200),
  /** La dirección corta que va en el SMS (cada letra cuenta dentro de los 160). */
  enlaceCorto: z.string().trim().min(4).max(60),
  /** Lo que el equipo cambió de las plantillas generales. */
  plantillas: porPaso,
  /** Plantillas propias de una zona (mandan sobre las generales). */
  plantillasZona: z.record(z.string().min(1).max(60), porPaso),
});
export type AjustesRezagados = z.infer<typeof esquemaAjustesRezagados>;

export const AJUSTES_REZAGADOS_DE_FABRICA: AjustesRezagados = {
  plazosHoras: [3, 24, 72],
  topePorPaso: 3,
  topePorPersona: 6,
  topeDiario: 40,
  horaDesde: 8,
  horaHasta: 20,
  // C-VIGILANTE-REGISTROS: se miran las altas de los últimos 30 días.
  ventanaDias: 30,
  zonas: {},
  autorizados: [],
  enlaceCorto: 'divoox.com/go',
  plantillas: {},
  plantillasZona: {},
};

export async function leerAjustesRezagados(db: D1Database): Promise<AjustesRezagados> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'rezagados'")
    .first<{ valor: string }>();
  if (!f) return AJUSTES_REZAGADOS_DE_FABRICA;
  try {
    const r = esquemaAjustesRezagados.safeParse({
      ...AJUSTES_REZAGADOS_DE_FABRICA,
      ...(JSON.parse(f.valor) as object),
    });
    if (r.success) return r.data;
    console.error(
      'rezagados: ajustes inválidos, van los de fábrica (todo apagado)',
      r.error.message,
    );
  } catch (e) {
    console.error('rezagados: ajustes ilegibles, van los de fábrica (todo apagado)', e);
  }
  return AJUSTES_REZAGADOS_DE_FABRICA;
}

export async function guardarAjustesRezagados(db: D1Database, a: AjustesRezagados) {
  await db
    .prepare(
      `INSERT INTO config (clave, valor) VALUES ('rezagados', ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    )
    .bind(JSON.stringify(a))
    .run();
}

export const modoDeZona = (a: AjustesRezagados, zona: string | null): ModoZona =>
  (zona && a.zonas[zona]) || 'apagado';

export function plantillaDe(
  a: AjustesRezagados,
  paso: PasoRezagado,
  idioma: Idioma,
  zona: string | null,
): Plantilla {
  return (
    (zona ? a.plantillasZona[zona]?.[paso]?.[idioma] : undefined) ??
    a.plantillas[paso]?.[idioma] ??
    PLANTILLAS_DE_FABRICA[paso][idioma]
  );
}

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || nombre.trim();
export const llenar = (
  t: string,
  d: { nombre: string; enlace: string; enlaceCorto?: string; plazo?: string },
) =>
  t
    .replaceAll('{plazo}', d.plazo ?? '')
    .replaceAll('{nombre}', primerNombre(d.nombre))
    .replaceAll('{enlace_corto}', d.enlaceCorto ?? d.enlace)
    .replaceAll('{enlace}', d.enlace);

const MESES = {
  es: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
} as const;
/** La frase del plazo de papeles (C-PLAZO-PAPELES), solo si lo tiene corriendo. Nunca promete a quien no lo tiene. */
export function frasePlazo(venceEn: string | null, idioma: Idioma): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(venceEn ?? '');
  if (!m) return '';
  const dia = Number(m[3]);
  const mes = MESES[idioma][Number(m[2]) - 1] ?? '';
  return idioma === 'en'
    ? ` Remember: you can already go online and take trips, and you have until ${mes} ${dia} to finish your documents.`
    : ` Recuerda: ya puedes conectarte y recibir viajes, y tienes hasta el ${dia} de ${mes} para terminar tus papeles.`;
}

const sitio = (env: Pick<Env, 'SITIO_URL'>) =>
  (env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
export const enlaceDelPaso = (env: Pick<Env, 'SITIO_URL'>, rol: string, paso?: string) =>
  paso === 'clave'
    ? `${sitio(env)}/forgot-password`
    : rol === 'repartidor'
      ? `${sitio(env)}/driver`
      : `${sitio(env)}/app`;
export const RUTA_BAJA = '/datos/reminders/off';
export const enlaceDeBaja = (env: Pick<Env, 'SITIO_URL'>, mensajeId: string) =>
  `${sitio(env)}${RUTA_BAJA}?m=${mensajeId}`;
const PIE_BAJA: Record<Idioma, string> = {
  es: 'Si no quieres recibir más recordatorios de tu registro:',
  en: 'If you do not want more reminders about your sign-up:',
};

// ───────────────────────── En qué paso se quedó ─────────────────────────

const FOTOS = ['foto_cara', 'foto_documento', 'foto_licencia', 'enviado'];

/**
 * El paso que se le recuerda a una cuenta, o null si no le falta nada que dependa de ella. Pieza pura.
 * Conductor, en orden: fotos → vehículo → conectarse (ya aprobado) → su línea → confirmar el correo.
 * Pasajero: confirmar el correo. Lo que depende del equipo (la aprobación) no genera recordatorio.
 */
export function pasoPendiente(d: {
  rol: string;
  pasos: ReadonlySet<string>;
  correoConfirmado: boolean;
  zonaConLineas: boolean;
  enLinea: boolean;
  /** C-VIGILANTE-REGISTROS: el equipo le pidió repetir una foto o un papel (o rechazó su verificación). */
  repetir?: boolean;
  /** C-VIGILANTE-REGISTROS: falló varias veces la contraseña y no ha vuelto a entrar desde entonces. */
  clave?: boolean;
  /** C-DOCUMENTO-VENCIDO-CLARO: lo pedido de nuevo es su documento, porque venció. */
  documentoVencido?: boolean;
}): PasoRezagado | null {
  // Quien no puede entrar no puede dar ningún otro paso: esto va primero, para pasajeros y conductores.
  if (d.clave) return 'clave';
  const correo = d.correoConfirmado || d.pasos.has('correo') ? null : 'correo';
  if (d.rol !== 'repartidor') return correo;
  const aprobado = d.pasos.has('aprobado');
  // Una foto o un papel pedido de nuevo frena aunque ya estuviera aprobado (licencia vencida, foto oscura).
  if (d.repetir) return d.documentoVencido ? 'documento_vigente' : 'repetir';
  if (!aprobado && FOTOS.some((p) => !d.pasos.has(p))) return 'fotos';
  if (!d.pasos.has('vehiculo')) return 'vehiculo';
  if (aprobado && !d.pasos.has('conectado')) return 'servicio';
  if (d.zonaConLineas && !d.enLinea) return 'linea';
  return correo;
}

/**
 * C-VIGILANTE-REGISTROS (24 nov 2026, orden de Richard por Gerencia): lo que le toca al EQUIPO y no al
 * conductor. Nunca se le manda al conductor: sale en la campana del panel y en Verificaciones.
 * `zona_ajena` = se registró desde otro país que el de la ciudad donde quedó su cuenta.
 */
export const RAREZAS_EQUIPO = [
  'identidad',
  'vehiculo_aprobado',
  'servicio',
  'zona',
  'requisitos',
  'zona_ajena',
  // C-DOCUMENTO-VENCIDO-CLARO: aprobado, pero la fecha leída en su documento ya pasó.
  'documento_vencido',
] as const;
export type RarezaEquipo = (typeof RAREZAS_EQUIPO)[number];
const ES_RAREZA_EQUIPO = new Set<string>(RAREZAS_EQUIPO);

/**
 * Lo que dice la barra de activación (la MISMA del panel y del reparto) cuando el rastro del registro
 * ya no le pide nada al conductor: qué le falta a él (vehículo sin placa o sin enviar, saldo, una foto
 * rechazada) o qué le toca al equipo. Pieza pura.
 */
export function lecturaDeBarra(b: {
  listo: boolean;
  siguiente: { clave: ClavePaso; quien: string; estado: string } | null;
  pasos?: readonly { clave: ClavePaso; quien: string; estado: string; falta?: string }[];
}): { paso: PasoRezagado | null; equipo: RarezaEquipo | null } {
  const s = b.siguiente;
  // C-VEHICULO-SIN-ENVIAR: registró su vehículo y no lo ha mandado a revisión. Se le recuerda aunque
  // ya trabaje con él en su plazo, y aunque al equipo le toque otra cosa (son cosas distintas).
  const sinEnviar = b.pasos?.some((p) => p.falta === 'vehiculo_sin_enviar' && p.estado !== 'hecho');
  if (sinEnviar)
    return {
      paso: 'vehiculo_enviar',
      equipo:
        !b.listo && s?.quien === 'equipo'
          ? ES_RAREZA_EQUIPO.has(s.clave)
            ? (s.clave as RarezaEquipo)
            : 'requisitos'
          : null,
    };
  // C-PAPELES-POR-PAIS: lo de su país que «solo se pide» y no subió. No lo frena (va después de todo
  // lo que sí lo frena); si ya lo subió, lo revisa el equipo en Verificaciones (sin aviso aparte).
  const papeles = b.pasos?.some(
    (p) => p.clave === 'papeles_pais' && p.estado === 'pendiente' && p.quien === 'conductor',
  )
    ? { paso: 'papeles' as const, equipo: null }
    : { paso: null, equipo: null };
  if (b.listo || !s) return papeles;
  if (s.quien === 'equipo')
    return {
      paso: null,
      equipo: ES_RAREZA_EQUIPO.has(s.clave) ? (s.clave as RarezaEquipo) : 'requisitos',
    };
  if (s.quien !== 'conductor') return { paso: null, equipo: null };
  if (s.clave === 'vehiculo') return { paso: 'vehiculo', equipo: null };
  if (s.clave === 'saldo') return { paso: 'saldo', equipo: null };
  if ((s.clave === 'identidad' || s.clave === 'vehiculo_aprobado') && s.estado === 'problema')
    return { paso: 'repetir', equipo: null };
  return papeles;
}

/**
 * C-DOCUMENTO-VENCIDO-CLARO: ¿la fecha que se leyó en el documento ya pasó? Lee «2025-03-14»,
 * «14/03/2025» y «03/14/2025». Si el día y el mes se pueden confundir, solo cuenta como vencido si
 * las dos lecturas ya pasaron (nunca se le pide un documento por un error de formato). Pieza pura.
 */
export function vencidoDeVerdad(texto: string | null | undefined, ahora = new Date()): boolean {
  const limpio = (texto ?? '').trim();
  if (!limpio) return false;
  const hoy = ahora.toISOString().slice(0, 10);
  const fecha = (a: number, m: number, d: number) =>
    m >= 1 && m <= 12 && d >= 1 && d <= 31 && a >= 1950 && a <= 2100
      ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      : null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(limpio);
  if (iso) {
    const f = fecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return f !== null && f < hoy;
  }
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(limpio);
  if (!dmy) return false;
  const [x, y, a] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  const lecturas = [fecha(a, y, x), fecha(a, x, y)].filter((f): f is string => f !== null);
  return lecturas.length > 0 && lecturas.every((f) => f < hoy);
}

/** Cuántas barras de activación mira una vuelta como mucho (cada una son unas pocas lecturas). */
export const LOTE_BARRAS = 40;

export type Candidato = {
  id: string;
  rol: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  idioma: Idioma;
  zona: string;
  zonaNombre: string;
  zonaHoraria: string;
  /** C-WHATSAPP-FALTA: el país de su zona (el interruptor de WhatsApp es por país). */
  pais: string | null;
  creadoEn: string;
  /** El paso que le toca a la persona, o null si lo que falta es del equipo. */
  paso: PasoRezagado | null;
  /** Lo que le toca al equipo (va a la campana, nunca al conductor). */
  equipo: RarezaEquipo | null;
  /** El equipo ya tiene ese aviso en la campana (no se repite). */
  equipoAvisado: boolean;
  /** Desde cuándo está quieto en ese paso (su último avance, o el alta). */
  quietoDesde: string;
  horasQuieto: number;
  /** Recordatorios automáticos ya enviados por este paso y a la persona en total. */
  delPaso: number;
  enTotal: number;
  ultimoEn: string | null;
  aceptaSms: boolean;
  /** Hasta cuándo corre su plazo de papeles, si lo tiene. */
  plazoVence: string | null;
  baja: boolean;
  /** El recordatorio que le toca ahora (1, 2 o 3), o null si todavía no o ya no. */
  toca: number | null;
  /** Por qué no le toca nada ahora. */
  motivo: string | null;
  /** Por dónde saldría. */
  canales: CanalRezagado[];
};

const sqlFecha = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
const horasEntre = (desde: string, ahora: Date) =>
  (ahora.getTime() - new Date(`${desde.replace(' ', 'T')}Z`).getTime()) / 3_600_000;

/** Cuántas cuentas mira una vuelta como mucho, por rol. */
export const LOTE_REZAGADOS = 200;

const SQL_CANDIDATOS = (zonas: string[]) => `
  SELECT u.id, u.rol, u.nombre, u.correo, u.telefono, u.idioma, u.creado_en, u.correo_confirmado_en,
         u.sms_consentido_en, z.id AS zona, z.nombre AS zona_nombre, z.zona_horaria,
         (SELECT group_concat(e.paso) FROM embudo_cuenta e WHERE e.usuario_id = u.id) AS pasos,
         (SELECT MAX(e.creado_en) FROM embudo_cuenta e WHERE e.usuario_id = u.id) AS ultimo_paso,
         -- Está en una línea quien es miembro o quien la lidera (al líder no se le pide «únete a tu línea»).
         (EXISTS (SELECT 1 FROM miembros_equipo m WHERE m.usuario_id = u.id)
           OR EXISTS (SELECT 1 FROM equipos ql WHERE ql.lider_id = u.id)) AS en_linea,
         EXISTS (SELECT 1 FROM equipos q JOIN lineas l ON l.equipo_id = q.id
                  WHERE q.zona_id = z.id AND q.activo = 1) AS zona_con_lineas,
         (SELECT pp.vence_en FROM plazo_papeles pp WHERE pp.conductor_id = u.id AND pp.estado = 'en_plazo') AS plazo_vence,
         EXISTS (SELECT 1 FROM rezagados_bajas b WHERE b.usuario_id = u.id) AS baja,
         -- C-VIGILANTE-REGISTROS: una foto o un papel pedido de nuevo, o la verificación rechazada.
         (EXISTS (SELECT 1 FROM verificacion_fotos vf WHERE vf.conductor_id = u.id AND vf.estado = 'repetir')
           OR EXISTS (SELECT 1 FROM kyc k WHERE k.usuario_id = u.id AND k.estado = 'rechazado')) AS repetir,
         (SELECT rc.pais_red FROM rastro_cuenta rc WHERE rc.usuario_id = u.id AND rc.tipo = 'alta' LIMIT 1) AS pais_alta,
         -- C-DOCUMENTO-VENCIDO-CLARO: lo pedido de nuevo es un documento que se leyó vencido, y la
         -- fecha leída de un documento vigente ya aprobado que parece vencido.
         EXISTS (SELECT 1 FROM verificacion_fotos vv WHERE vv.conductor_id = u.id AND vv.estado = 'repetir'
                  AND vv.paso IN ('doc_frente', 'licencia_frente')
                  AND json_extract(vv.ia_json, '$.vencido') = 'si') AS doc_vencido_pedido,
         (SELECT json_extract(vd.ia_json, '$.vence') FROM verificacion_fotos vd
           WHERE vd.conductor_id = u.id AND vd.estado = 'vigente' AND vd.paso IN ('doc_frente', 'licencia_frente')
             AND json_extract(vd.ia_json, '$.vencido') = 'si'
             AND EXISTS (SELECT 1 FROM kyc ka WHERE ka.usuario_id = u.id AND ka.estado = 'aprobado')
           LIMIT 1) AS doc_vence,
         z.pais AS zona_pais,
         (SELECT MAX(rc.creado_en) FROM rastro_cuenta rc WHERE rc.usuario_id = u.id AND rc.tipo = 'entrada') AS ultima_entrada
    FROM usuarios u
    LEFT JOIN repartidores r ON r.usuario_id = u.id
    JOIN zonas z ON z.id = ${zonaRealSql()}
   WHERE u.rol = ?1 AND u.creado_en >= ?2 AND u.es_prueba = 0 AND u.activo = 1
     AND z.id IN (${zonas.map((_, i) => `?${i + 4}`).join(',')})
   ORDER BY u.creado_en DESC LIMIT ?3`;

type FilaCandidato = {
  id: string;
  rol: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  idioma: string;
  creado_en: string;
  correo_confirmado_en: string | null;
  sms_consentido_en: string | null;
  zona: string;
  zona_nombre: string;
  zona_horaria: string;
  pasos: string | null;
  ultimo_paso: string | null;
  en_linea: number;
  zona_con_lineas: number;
  plazo_vence: string | null;
  baja: number;
  repetir: number;
  pais_alta: string | null;
  doc_vencido_pedido: number;
  doc_vence: string | null;
  zona_pais: string | null;
  ultima_entrada: string | null;
};

/** C-VIGILANTE-REGISTROS: fallos de contraseña en 7 días que cuentan como «le cuesta entrar». */
export const FALLOS_PARA_CLAVE = 3;
const CODIGOS_FALLO_CLAVE = ['clave_incorrecta', 'cuenta_bloqueada'];

/**
 * Los correos con varios fallos de contraseña recientes (`intentos_acceso`, C-INTENTOS-ACCESO). Esos
 * códigos solo se anotan cuando la cuenta EXISTE (un correo sin cuenta da otro código), y además solo
 * se cruzan con las cuentas que ya están en la lista. Una lectura por el índice de fecha, con tope.
 */
async function fallosDeClave(db: D1Database, ahora: Date) {
  const { results } = await db
    .prepare(
      `SELECT correo, COUNT(*) AS n, MAX(creado_en) AS ultima FROM intentos_acceso
        WHERE creado_en >= ? AND accion = 'entrar' AND correo IS NOT NULL
          AND codigo IN (${CODIGOS_FALLO_CLAVE.map(() => '?').join(',')})
        GROUP BY correo HAVING COUNT(*) >= ? LIMIT 500`,
    )
    .bind(
      sqlFecha(new Date(ahora.getTime() - 7 * 86_400_000)),
      ...CODIGOS_FALLO_CLAVE,
      FALLOS_PARA_CLAVE,
    )
    .all<{ correo: string; n: number; ultima: string }>()
    .catch((e: unknown) => {
      console.error('rezagados: no se pudieron leer los intentos de entrar', String(e));
      return { results: [] as { correo: string; n: number; ultima: string }[] };
    });
  return new Map(results.map((r) => [r.correo.toLowerCase(), r.ultima]));
}

/** ¿Puede salir un SMS a ese teléfono hoy? (proveedor encendido para su país). Solo mira la configuración. */
/** El SMS de los recordatorios tiene su propia llave: apagado hasta que Gerencia ponga REZAGADOS_SMS=si. */
export const smsDeRegistroEncendido = (env: Env) => env.REZAGADOS_SMS === 'si';

export function smsDisponible(env: Env, telefono: string | null): boolean {
  if (!smsDeRegistroEncendido(env)) return false;
  const para = telefonoE164(telefono);
  if (!para) return false;
  return vaPorSmsMasivo(env, para) || (smsConfigurado(env) && destinoPermitido(env, para));
}

/**
 * A quiénes les falta un paso en las zonas dadas, con lo que les toca AHORA. Solo lee: una consulta
 * por rol (por índice `usuarios_rol_creado`, con tope) y una de los recordatorios ya enviados.
 */
export async function candidatos(
  env: Env,
  db: D1Database,
  a: AjustesRezagados,
  zonas: string[],
  ahora = new Date(),
): Promise<Candidato[]> {
  return (await revisarCuentas(env, db, a, zonas, ahora)).lista;
}

/**
 * C-VIGILANTE-REGISTROS: qué se evaluó DE VERDAD en esta vuelta, por conductor. `barra` = se leyó su
 * barra de activación (hay tope por vuelta: a los demás no se les puede decir que ya no los frena);
 * `zona` = se miró su país de alta; `motivos` = lo que hoy sí le toca al equipo. Solo con esto se
 * cierra un aviso del equipo: nunca el de una cuenta que no se miró.
 */
export type Evaluacion = { id: string; barra: boolean; zona: boolean; motivos: RarezaEquipo[] };

async function revisarCuentas(
  env: Env,
  db: D1Database,
  a: AjustesRezagados,
  zonas: string[],
  ahora: Date,
): Promise<{ lista: Candidato[]; evaluados: Evaluacion[] }> {
  const evaluados: Evaluacion[] = [];
  if (!zonas.length) return { lista: [], evaluados };
  const desde = sqlFecha(new Date(ahora.getTime() - a.ventanaDias * 86_400_000));
  const filas = (
    await db.batch<FilaCandidato>(
      ['repartidor', 'cliente'].map((rol) =>
        db.prepare(SQL_CANDIDATOS(zonas)).bind(rol, desde, LOTE_REZAGADOS, ...zonas),
      ),
    )
  ).flatMap((r) => r.results);
  const pendientes: {
    f: FilaCandidato;
    paso: PasoRezagado | null;
    equipo: RarezaEquipo | null;
    quieto?: string;
  }[] = [];
  let barras = 0;
  const fallos = filas.length ? await fallosDeClave(db, ahora) : new Map<string, string>();
  for (const f of filas) {
    // Le cuesta entrar: varios fallos y no volvió a entrar bien después del último.
    const ultimoFallo = fallos.get(f.correo.toLowerCase());
    const clave = Boolean(ultimoFallo && (!f.ultima_entrada || f.ultima_entrada < ultimoFallo));
    let paso = pasoPendiente({
      rol: f.rol,
      pasos: new Set((f.pasos ?? '').split(',').filter(Boolean)),
      correoConfirmado: Boolean(f.correo_confirmado_en),
      zonaConLineas: Boolean(f.zona_con_lineas),
      enLinea: Boolean(f.en_linea),
      repetir: Boolean(f.repetir),
      clave,
      documentoVencido: Boolean(f.doc_vencido_pedido),
    });
    let equipo: RarezaEquipo | null = null;
    let barraLeida = false;
    // C-VIGILANTE-REGISTROS: cuando el rastro ya no le pide nada importante (nada, «conéctate», «tu
    // línea» o el correo, que no frena), se pregunta a la barra de activación qué lo frena de verdad y
    // de quién depende. Sin `env`: mirar no escribe.
    if (
      f.rol === 'repartidor' &&
      (paso === null || paso === 'servicio' || paso === 'linea' || paso === 'correo') &&
      barras < LOTE_BARRAS
    ) {
      barras++;
      barraLeida = true;
      const l = lecturaDeBarra(await barraActivacion(db, f.id));
      // C-PAPELES-POR-PAIS: los papeles que solo se piden no tapan «conéctate» ni «tu línea».
      if (l.paso === 'papeles') {
        if (paso === null || paso === 'correo') paso = 'papeles';
      } else if (l.paso) {
        paso = l.paso;
        // C-VEHICULO-SIN-ENVIAR: lo suyo y lo del equipo pueden ir a la vez.
        if (l.equipo) equipo = l.equipo;
      } else if (l.equipo) {
        equipo = l.equipo;
        if (paso === 'servicio') paso = null;
      }
    }
    const zonaAjena = Boolean(
      f.rol === 'repartidor' && f.pais_alta && f.zona_pais && f.pais_alta !== f.zona_pais,
    );
    // C-DOCUMENTO-VENCIDO-CLARO: la fecha leída ya pasó y nadie le pidió el vigente todavía. Lo decide
    // una persona (en la campana y en la ficha, con «Pedir el documento vigente»): la lectura puede fallar.
    const docVencido =
      f.rol === 'repartidor' && !f.doc_vencido_pedido && vencidoDeVerdad(f.doc_vence, ahora);
    if (f.rol === 'repartidor')
      evaluados.push({
        id: f.id,
        barra: barraLeida,
        zona: true,
        motivos: [
          ...(equipo ? [equipo] : []),
          ...(zonaAjena ? ['zona_ajena' as const] : []),
          ...(docVencido ? ['documento_vencido' as const] : []),
        ],
      });
    if (!equipo && docVencido) equipo = 'documento_vencido';
    if (!equipo && zonaAjena) equipo = 'zona_ajena';
    if (paso || equipo)
      pendientes.push({
        f,
        paso,
        equipo,
        ...(clave && ultimoFallo ? { quieto: ultimoFallo } : {}),
      });
  }
  if (!pendientes.length) return { lista: [], evaluados };
  // Lo ya enviado a esas personas (solo lo automático cuenta para los topes).
  const ids = pendientes.map((p) => p.f.id);
  const enviados = new Map<
    string,
    { paso: string; canal: string; abiertos: number; creado_en: string; numero: number }[]
  >();
  for (let i = 0; i < ids.length; i += 80) {
    const lote = ids.slice(i, i + 80);
    const { results } = await db
      .prepare(
        `SELECT usuario_id, paso, numero, canal = 'equipo' AS equipo, SUM(estado <> 'resuelto') AS abiertos,
                MAX(creado_en) AS creado_en FROM rezagados_mensajes
          WHERE origen = 'auto' AND canal <> 'whatsapp' AND usuario_id IN (${lote.map(() => '?').join(',')})
          GROUP BY usuario_id, paso, numero, canal = 'equipo'`,
      )
      .bind(...lote)
      .all<{
        usuario_id: string;
        paso: string;
        numero: number;
        equipo: number;
        abiertos: number;
        creado_en: string;
      }>();
    for (const r of results)
      enviados.set(r.usuario_id, [
        ...(enviados.get(r.usuario_id) ?? []),
        { ...r, canal: Number(r.equipo) ? 'equipo' : 'persona' },
      ]);
  }
  const lista = pendientes.map(({ f, paso, equipo, quieto }) => {
    const todos = enviados.get(f.id) ?? [];
    // Los avisos al equipo no cuentan para los topes de la persona.
    const suyos = todos.filter((s) => s.canal !== 'equipo');
    const equipoAvisado = Boolean(
      equipo &&
      todos.some((s) => s.canal === 'equipo' && s.paso === equipo && Number(s.abiertos) > 0),
    );
    const delPaso = suyos.filter((s) => s.paso === paso).length;
    const ultimoEn =
      suyos
        .map((s) => s.creado_en)
        .sort()
        .at(-1) ?? null;
    // Para «le cuesta entrar», el plazo corre desde su último fallo.
    const quietoDesde =
      quieto ?? (f.ultimo_paso && f.ultimo_paso > f.creado_en ? f.ultimo_paso : f.creado_en);
    const horasQuieto = horasEntre(quietoDesde, ahora);
    const { minutos } = momentoEn(f.zona_horaria, ahora);
    const aceptaSms = Boolean(f.sms_consentido_en);
    const siguiente = delPaso + 1;
    let motivo: string | null = null;
    if (!paso) motivo = 'del_equipo';
    else if (f.baja) motivo = 'baja';
    else if (delPaso >= a.topePorPaso) motivo = 'tope_paso';
    else if (suyos.length >= a.topePorPersona) motivo = 'tope_persona';
    else if (horasQuieto < (a.plazosHoras[siguiente - 1] ?? Infinity)) motivo = 'aun_no';
    // C-VIGILANTE-REGISTROS: como mucho un recordatorio cada 24 horas por persona.
    else if (ultimoEn && horasEntre(ultimoEn, ahora) < 24) motivo = 'ya_hoy';
    else if (minutos < a.horaDesde * 60 || minutos >= a.horaHasta * 60) motivo = 'fuera_de_horario';
    // 2.º recordatorio: SMS si se puede (proveedor encendido y casilla marcada); si no, correo.
    const conSms = siguiente === 2 && aceptaSms && smsDisponible(env, f.telefono);
    // C-VIGILANTE-REGISTROS: a un correo sin confirmar no se le escribe (riesgo de spam): solo el aviso
    // en la app, que llega a su propio aparato.
    const correoOk = Boolean(f.correo_confirmado_en);
    return {
      id: f.id,
      rol: f.rol,
      nombre: f.nombre,
      correo: f.correo,
      telefono: f.telefono,
      idioma: f.idioma === 'en' ? 'en' : 'es',
      zona: f.zona,
      zonaNombre: f.zona_nombre,
      zonaHoraria: f.zona_horaria,
      pais: f.zona_pais,
      creadoEn: f.creado_en,
      paso,
      equipo,
      equipoAvisado,
      quietoDesde,
      horasQuieto: Math.floor(horasQuieto),
      delPaso,
      enTotal: suyos.length,
      ultimoEn,
      aceptaSms,
      plazoVence: f.plazo_vence && f.plazo_vence > sqlFecha(ahora) ? f.plazo_vence : null,
      baja: Boolean(f.baja),
      toca: motivo ? null : siguiente,
      motivo,
      canales: conSms ? ['sms'] : correoOk ? ['correo', 'aviso'] : ['aviso'],
    } satisfies Candidato;
  });
  return { lista, evaluados };
}

// ───────────────────────── Enviar ─────────────────────────

export type EstadoMensaje = 'enviado' | 'entregado' | 'rebotado' | 'fallido' | 'sin_destino';

type Envio = {
  usuarioId: string;
  rol: string;
  nombre: string;
  telefono: string | null;
  idioma: Idioma;
  paso: PasoRezagado | 'libre';
  canales: CanalRezagado[];
  origen: 'auto' | 'manual';
  numero: number;
  asunto: string;
  texto: string;
  sms: string;
  /** El aviso de la app, en el idioma de cada aparato. */
  aviso: (i: Idioma) => { titulo: string; cuerpo: string };
  actorId?: string | null;
};

/**
 * Manda un mensaje por los canales dados y deja UNA fila por canal con su estado, pase lo que pase.
 * El correo sale por el hilo de Camila (la respuesta de la persona le vuelve a ella) y lleva al pie
 * el enlace de baja. Un canal que no puede salir queda escrito con su motivo; nunca en silencio.
 */
export async function enviarMensajeRegistro(env: Env, db: D1Database, e: Envio) {
  const resultados: { canal: CanalRezagado; estado: EstadoMensaje; detalle: string }[] = [];
  for (const canal of e.canales) {
    const id = nuevoId();
    let estado: EstadoMensaje = 'enviado';
    let detalle = '';
    let referencia: string | null = null;
    if (canal === 'correo') {
      // El idioma es el de la cuenta HOY (la ficha de soporte pudo nacer con otro): el botón, la
      // firma y el pie del correo salen en el mismo idioma que la plantilla.
      const persona = { ...(await personaDeUsuario(db, e.usuarioId)), idioma: e.idioma };
      await sentenciaMensaje(db, {
        personaId: persona.id,
        canal: 'correo',
        autor: 'camila',
        texto: e.texto,
        herramienta: `registro:${e.paso}`,
      }).run();
      const r = await enviarPorCanal(env, db, persona, 'correo', e.texto, {
        asunto: e.asunto,
        pie: `${PIE_BAJA[e.idioma]} ${enlaceDeBaja(env, id)}`,
      });
      if (!r.enviado) {
        estado = /rebot|bounce|fren|suppress|no existe/i.test(r.motivo ?? '')
          ? 'rebotado'
          : 'fallido';
        detalle = r.motivo ?? '';
        if (r.motivo === 'sin_correo') estado = 'sin_destino';
      }
    } else if (canal === 'sms') {
      if (!smsDisponible(env, e.telefono)) {
        estado = 'sin_destino';
        detalle = 'sms_no_disponible';
      } else if (!(await aceptoSms(db, e.usuarioId))) {
        estado = 'sin_destino';
        detalle = 'sin_consentimiento';
      } else {
        const ok = await enviarSms(env, db, {
          usuarioId: e.usuarioId,
          pedidoId: null,
          tipo: 'registro_recordatorio',
          telefono: e.telefono,
          texto: e.sms,
        });
        if (!ok) {
          estado = 'fallido';
          detalle = 'el_proveedor_no_lo_acepto';
        } else {
          const s = await db
            .prepare(
              "SELECT proveedor, referencia FROM sms_enviados WHERE usuario_id = ? AND tipo = 'registro_recordatorio' ORDER BY creado_en DESC LIMIT 1",
            )
            .bind(e.usuarioId)
            .first<{ proveedor: string | null; referencia: string | null }>();
          referencia = s?.referencia ?? null;
          detalle = s?.proveedor ?? '';
        }
      }
    } else {
      const r = await notificar(env, db, e.usuarioId, (i) => ({
        ...e.aviso(i),
        datos: { tipo: 'registro', paso: e.paso },
      }));
      if (!r.enviados) {
        estado = 'sin_destino';
        detalle = 'sin_aparato';
      }
    }
    await db
      .prepare(
        `INSERT INTO rezagados_mensajes (id, usuario_id, paso, canal, origen, numero, estado, detalle, referencia, texto, actor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        e.usuarioId,
        e.paso,
        canal,
        e.origen,
        e.numero,
        estado,
        detalle.slice(0, 200),
        referencia,
        (canal === 'sms' ? e.sms : canal === 'aviso' ? e.aviso(e.idioma).cuerpo : e.texto).slice(
          0,
          1500,
        ),
        e.actorId ?? null,
      )
      .run();
    resultados.push({ canal, estado, detalle });
  }
  return resultados;
}

/** Arma el envío de la plantilla de un paso para una persona. */
export function envioDePlantilla(
  env: Env,
  a: AjustesRezagados,
  p: Pick<Candidato, 'id' | 'rol' | 'nombre' | 'telefono' | 'idioma' | 'zona'> & {
    plazoVence?: string | null;
  },
  paso: PasoRezagado,
): Pick<
  Envio,
  | 'usuarioId'
  | 'rol'
  | 'nombre'
  | 'telefono'
  | 'idioma'
  | 'paso'
  | 'asunto'
  | 'texto'
  | 'sms'
  | 'aviso'
> {
  const pl = plantillaDe(a, paso, p.idioma, p.zona);
  const d = {
    nombre: p.nombre,
    enlace: enlaceDelPaso(env, p.rol, paso),
    plazo: frasePlazo(p.plazoVence ?? null, p.idioma),
  };
  return {
    usuarioId: p.id,
    rol: p.rol,
    nombre: p.nombre,
    telefono: p.telefono,
    idioma: p.idioma,
    paso,
    asunto: llenar(pl.asunto, d),
    texto: llenar(pl.texto, d),
    // En el SMS el nombre va corto: cada letra cuenta dentro de los 160.
    sms: llenar(pl.sms, {
      ...d,
      nombre: primerNombre(p.nombre).slice(0, 14),
      enlaceCorto: a.enlaceCorto,
    }),
    aviso: (i) => AVISO[paso][i],
  };
}

// ───────────────────────── La tarea del reloj ─────────────────────────

const esDeCobro = (c: CanalRezagado) => c === 'correo' || c === 'sms';

/**
 * La vuelta de cada media hora. Con todas las zonas apagadas o en vista previa no lee más que los ajustes
 * y no escribe nada. Escribe una fila por canal de cada recordatorio que sale.
 */
export async function correrRezagados(env: Env, db: D1Database, ahora = new Date()) {
  // C-WHATSAPP-ENTRANTE: lo de más de 7 días de los mensajes entrantes se borra aquí, con tope (sin
  // nada viejo, no escribe nada).
  await limpiarEntrantes(db).catch((e: unknown) =>
    console.error('rezagados: no se pudo limpiar los entrantes de WhatsApp', String(e)),
  );
  const a = await leerAjustesRezagados(db);
  const encendidas = new Set(
    Object.entries(a.zonas)
      .filter(([, m]) => m === 'encendido')
      .map(([z]) => z),
  );
  // Las cuentas autorizadas una por una reciben aunque su zona siga en vista previa (nunca en una apagada).
  const autorizados = new Set(a.autorizados);
  const zonas = Object.entries(a.zonas)
    .filter(([z, m]) => encendidas.has(z) || (m === 'previa' && autorizados.size > 0))
    .map(([z]) => z);
  const cuenta = {
    zonas: zonas.length,
    vistos: 0,
    enviados: 0,
    tope: false,
    entregados: 0,
    alEquipo: 0,
    resueltos: 0,
    whatsapp: 0,
  };
  if (!zonas.length) return cuenta;
  const { lista: todos, evaluados } = await revisarCuentas(env, db, a, zonas, ahora);
  const lista = todos.filter(
    (c) => c.toca !== null && c.paso && (encendidas.has(c.zona) || autorizados.has(c.id)),
  );
  // C-VIGILANTE-REGISTROS: lo que le toca al equipo va a su campana, UNA vez por cuenta y motivo.
  const equipo = await avisarAlEquipo(db, todos, evaluados, encendidas);
  cuenta.alEquipo = equipo.nuevos;
  cuenta.resueltos = equipo.resueltos;
  cuenta.vistos = lista.length;
  if (lista.length) {
    const hoy = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM rezagados_mensajes WHERE origen = 'auto' AND canal IN ('correo', 'sms') AND creado_en >= ?",
      )
      .bind(sqlFecha(new Date(ahora.getTime() - 86_400_000)))
      .first<{ n: number }>();
    let quedan = a.topeDiario - Number(hoy?.n ?? 0);
    // Primero quien lleva más tiempo esperando.
    for (const c of lista.sort((x, y) => x.quietoDesde.localeCompare(y.quietoDesde))) {
      if (quedan <= 0) {
        cuenta.tope = true;
        break;
      }
      // Una persona del equipo está atendiendo su conversación: Camila no se mete.
      const persona = await personaDeUsuario(db, c.id);
      if (humanoActivo(persona, ahora)) continue;
      if (!c.paso) continue;
      const r = await enviarMensajeRegistro(env, db, {
        ...envioDePlantilla(env, a, c, c.paso),
        canales: c.canales,
        origen: 'auto',
        numero: c.toca ?? 1,
      });
      quedan -= c.canales.filter(esDeCobro).length;
      if (r.some((x) => x.estado === 'enviado')) cuenta.enviados++;
    }
  }
  // C-WHATSAPP-FALTA: lo que le falta, solo por WhatsApp, con sus propios topes y su plantilla
  // aprobada. Sin canal listo no lee más que sus ajustes y no escribe nada.
  cuenta.whatsapp = (
    await vueltaWhatsappFalta(
      env,
      db,
      todos.filter((c) => encendidas.has(c.zona) || autorizados.has(c.id)),
      a,
      ahora,
    ).catch((e: unknown) => {
      console.error('rezagados: la vuelta de WhatsApp falló', String(e));
      return { enviados: 0 };
    })
  ).enviados;
  cuenta.entregados = await refrescarEntregas(env, db, ahora);
  return cuenta;
}

/** Cuántos avisos nuevos al equipo deja una vuelta como mucho (y cuántos cierra). */
export const LOTE_EQUIPO = 30;

/**
 * C-VIGILANTE-REGISTROS: lo que frena a un conductor y depende del EQUIPO (aprobar su verificación o
 * su vehículo, su servicio, su ciudad) nunca se le manda a él: queda UNA fila `canal = 'equipo'` por
 * cuenta y motivo, que la campana del panel muestra y lleva a Verificaciones. Cuando ya no lo frena, se
 * marca resuelta (una escritura). Una vuelta sin cambios no escribe nada.
 */
async function avisarAlEquipo(
  db: D1Database,
  lista: Candidato[],
  evaluados: Evaluacion[],
  encendidas: ReadonlySet<string>,
) {
  let nuevos = 0;
  for (const c of lista) {
    if (nuevos >= LOTE_EQUIPO) break;
    if (!c.equipo || c.equipoAvisado || !encendidas.has(c.zona)) continue;
    await db
      .prepare(
        `INSERT INTO rezagados_mensajes (id, usuario_id, paso, canal, origen, numero, estado, detalle)
         VALUES (?, ?, ?, 'equipo', 'auto', 1, 'enviado', ?)`,
      )
      .bind(nuevoId(), c.id, c.equipo, `horas_quieto:${c.horasQuieto}`)
      .run();
    nuevos++;
  }
  // Se cierra un aviso abierto SOLO si su cuenta se evaluó en esta vuelta (la barra para lo de la
  // barra, el país de alta para «zona_ajena») y ese motivo ya no la frena. Lo que sigue vigente queda
  // fuera de la consulta (no tapa a los que hay que cerrar) y van primero los más viejos.
  const mirados = evaluados.filter((e) => e.barra || e.zona);
  if (!mirados.length) return { nuevos, resueltos: 0 };
  const { results } = await db
    .prepare(
      `WITH ev AS MATERIALIZED (
         SELECT json_extract(e.value, '$.id') AS id, json_extract(e.value, '$.barra') AS barra,
                json_extract(e.value, '$.zona') AS zona, json_extract(e.value, '$.motivos') AS motivos
           FROM json_each(?) e)
       SELECT m.id FROM ev JOIN rezagados_mensajes m ON m.usuario_id = ev.id
        WHERE m.canal = 'equipo' AND m.estado = 'enviado'
          AND m.paso NOT IN (SELECT value FROM json_each(ev.motivos))
          AND ((m.paso IN ('zona_ajena', 'documento_vencido') AND ev.zona)
            OR (m.paso NOT IN ('zona_ajena', 'documento_vencido') AND ev.barra))
        ORDER BY m.creado_en LIMIT ${LOTE_EQUIPO}`,
    )
    .bind(JSON.stringify(mirados))
    .all<{ id: string }>();
  let resueltos = 0;
  for (const r of results) {
    await db
      .prepare(
        "UPDATE rezagados_mensajes SET estado = 'resuelto' WHERE id = ? AND estado = 'enviado'",
      )
      .bind(r.id)
      .run();
    resueltos++;
  }
  return { nuevos, resueltos };
}

/** Pregunta al proveedor por los SMS recientes todavía «enviado» y escribe solo los que cambiaron. */
async function refrescarEntregas(env: Env, db: D1Database, ahora: Date) {
  const { results } = await db
    .prepare(
      `SELECT id, referencia FROM rezagados_mensajes
        WHERE canal = 'sms' AND estado = 'enviado' AND referencia IS NOT NULL AND detalle = 'smsmasivo' AND creado_en >= ?
        LIMIT 20`,
    )
    .bind(sqlFecha(new Date(ahora.getTime() - 2 * 86_400_000)))
    .all<{ id: string; referencia: string }>();
  let n = 0;
  for (const m of results) {
    const e = await estadoEnSmsMasivo(env, m.referencia).catch((x: unknown) => {
      console.error('rezagados: no se pudo leer el estado del SMS', x);
      return null;
    });
    const estado = !e
      ? null
      : /ENTREG|DELIVER/i.test(e.estado)
        ? 'entregado'
        : /FALL|FAIL|RECHAZ|REJECT/i.test(e.estado)
          ? 'fallido'
          : null;
    if (!estado) continue;
    await db
      .prepare('UPDATE rezagados_mensajes SET estado = ? WHERE id = ?')
      .bind(estado, m.id)
      .run();
    n++;
  }
  return n;
}

// ───────────────────────── La baja ─────────────────────────

/** La persona pidió no recibir más recordatorios (enlace del correo). Devuelve si el enlace era válido. */
export async function darDeBaja(db: D1Database, mensajeId: string): Promise<boolean> {
  const m = await db
    .prepare('SELECT usuario_id FROM rezagados_mensajes WHERE id = ?')
    .bind(mensajeId)
    .first<{ usuario_id: string }>();
  if (!m) return false;
  await db
    .prepare('INSERT OR IGNORE INTO rezagados_bajas (usuario_id, canal) VALUES (?, ?)')
    .bind(m.usuario_id, 'correo')
    .run();
  return true;
}

/** Los mensajes de registro enviados a una cuenta, para su línea de tiempo. */
export const sqlMensajesDeCuenta = (limite: number) =>
  `SELECT m.creado_en AS fecha, m.canal, m.paso, m.origen, m.estado, m.detalle, e.nombre AS quien
     FROM rezagados_mensajes m LEFT JOIN usuarios e ON e.id = m.actor_id
    WHERE m.usuario_id = ? ORDER BY m.creado_en DESC LIMIT ${limite}`;
