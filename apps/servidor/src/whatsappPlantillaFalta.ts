/**
 * C-WHATSAPP-FALTA (25 nov 2026, encargo urgente de Richard) — la plantilla de WhatsApp de UTILIDAD
 * que le dice al conductor qué le falta para empezar a recibir carreras.
 *
 * Este archivo NO importa nada a propósito: lo leen el servidor y los dos guiones de
 * `scripts/whatsapp/` (Node los corre tal cual, sin compilar), así el texto que se crea en Meta y el
 * que se manda son siempre el mismo.
 *
 * Reglas de Meta para la categoría UTILIDAD que cumple el texto [DOC developers.facebook.com,
 * «Template categorization» y «Template guidelines»]:
 * - Habla de la cuenta de la persona (qué le falta para activarla), sin ofertas, descuentos, «gana
 *   más», ni llamadas a comprar: nada de tono promocional.
 * - Ninguna variable va al principio ni al final del cuerpo, ni dos seguidas, y cada una lleva su
 *   ejemplo al crear la plantilla.
 * - Variables numeradas en orden ({{1}}, {{2}}), formato «positional».
 *
 * Qué NO tocar: el NOMBRE de la plantilla (es la llave en Meta y en la base: cambiarlo obliga a crear
 * otra y a esperar otra aprobación) y la cantidad de variables (el envío manda exactamente dos).
 * Si cambia el texto, se crea una plantilla con otro nombre (por ejemplo, `..._v2`).
 */

/** El nombre fijo de la plantilla en Meta. */
export const PLANTILLA_FALTA_NOMBRE = 'divoox_driver_te_falta';
/** La categoría que se pide. Si Meta la pasa a marketing, el servidor no la usa. */
export const PLANTILLA_FALTA_CATEGORIA = 'UTILITY';

export type DefinicionPlantillaFalta = {
  nombre: string;
  /** El código de idioma tal como lo registra Meta. */
  idioma: string;
  categoria: string;
  /** El cuerpo con {{1}} = primer nombre y {{2}} = lo que le falta, en palabras. */
  cuerpo: string;
  /** Un ejemplo de cada variable, en orden (Meta lo exige para revisar la plantilla). */
  ejemplos: readonly [string, string];
};

/**
 * Una por idioma, con el MISMO nombre en Meta (cada idioma es una traducción de la misma plantilla).
 * C-WHATSAPP-FALTA-IDIOMAS (27 nov 2026, Richard): la de inglés de EE. UU. (`en_US`) se manda a
 * aprobación; mientras Meta no la apruebe, el equipo puede mandar la española a una cuenta en inglés
 * (el panel lo ofrece: nunca un callejón sin salida). Solo el reloj automático espera la de su idioma.
 */
export const PLANTILLAS_FALTA: Readonly<Record<'es' | 'en', DefinicionPlantillaFalta | null>> = {
  es: {
    nombre: PLANTILLA_FALTA_NOMBRE,
    idioma: 'es',
    categoria: PLANTILLA_FALTA_CATEGORIA,
    cuerpo:
      'Hola {{1}} 👋 Para que tu cuenta de Divoox Driver empiece a recibir carreras te falta: {{2}}. Entra a la app y complétalo. Si tienes dudas, responde a este mensaje.',
    ejemplos: ['María', 'enviar tu moto a revisión'],
  },
  en: {
    nombre: PLANTILLA_FALTA_NOMBRE,
    idioma: 'en_US',
    categoria: PLANTILLA_FALTA_CATEGORIA,
    cuerpo:
      'Hi {{1}} 👋 To start receiving trips with your Divoox Driver account, you still need to: {{2}}. Open the app to finish it. If you have any questions, reply to this message.',
    ejemplos: ['Maria', 'send your motorcycle for review'],
  },
};

/** El texto exacto que verá la persona (la vista previa del panel y lo que se guarda en su historial). */
export function textoDePlantilla(def: DefinicionPlantillaFalta, nombre: string, falta: string) {
  return def.cuerpo.replace('{{1}}', nombre).replace('{{2}}', falta);
}

/** Lo que se manda a Meta para CREAR la plantilla (POST /<WABA>/message_templates). */
export function creacionEnMeta(def: DefinicionPlantillaFalta) {
  return {
    name: def.nombre,
    language: def.idioma,
    category: def.categoria,
    parameter_format: 'positional',
    components: [
      {
        type: 'BODY',
        text: def.cuerpo,
        example: { body_text: [[...def.ejemplos]] },
      },
    ],
  };
}

/** Lo que se manda a Meta para ENVIARLA a un número (POST /<PHONE_ID>/messages). */
export function envioEnMeta(
  def: DefinicionPlantillaFalta,
  para: string,
  nombre: string,
  falta: string,
) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: para.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: def.nombre,
      language: { code: def.idioma },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: nombre },
            { type: 'text', text: falta },
          ],
        },
      ],
    },
  };
}
