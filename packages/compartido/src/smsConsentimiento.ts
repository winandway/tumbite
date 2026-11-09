import { type Idioma, enIdioma } from './idiomas';

/**
 * C-SMS-CONSENTIMIENTO (9 nov 2026): Twilio rechazó la verificación del número gratuito (error
 * 30513) porque no había prueba del consentimiento para SMS. Como piden CTIA y Twilio: una casilla
 * PROPIA (separada de los términos), SIN marcar, que dice «text messages», qué mensajes, frecuencia,
 * tarifas, STOP/HELP y que no es condición de compra. El servidor guarda fecha, versión y canal.
 *
 * Si cambia el texto, cambia la versión (y la página pública /sms-consent).
 */
export const VERSION_CONSENTIMIENTO_SMS = 'sms-2026-11-09';

export const CANALES_CONSENTIMIENTO_SMS = ['web', 'app'] as const;
export type CanalConsentimientoSms = (typeof CANALES_CONSENTIMIENTO_SMS)[number];

/**
 * El texto de la casilla, en partes para poner los enlaces a Privacidad y Términos. Se lee de
 * corrido: `${antes} ${privacidad} ${y} ${terminos}.`
 */
export const TEXTO_CONSENTIMIENTO_SMS: Record<
  Idioma,
  { antes: string; privacidad: string; y: string; terminos: string; titulo: string }
> = {
  en: {
    titulo: 'Text messages (SMS)',
    antes:
      'I agree to receive text messages from Divoox about my account and orders (verification codes, order status and delivery updates). Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase. See our',
    privacidad: 'Privacy Policy',
    y: 'and',
    terminos: 'Terms',
  },
  es: {
    titulo: 'Mensajes de texto (SMS)',
    antes:
      'Acepto recibir mensajes de texto de Divoox sobre mi cuenta y mis pedidos (códigos de verificación, estado del pedido y avisos de la entrega). La cantidad de mensajes varía. Pueden aplicar tarifas de mensajes y datos. Responde STOP para dejar de recibirlos y HELP para pedir ayuda. Aceptar no es una condición para comprar. Consulta nuestra',
    privacidad: 'Política de privacidad',
    y: 'y los',
    terminos: 'Términos',
  },
};

/** El texto completo de la casilla, de corrido (lectores de pantalla, pruebas, página pública). */
export const textoConsentimientoSms = (idioma: Idioma) => {
  const t = enIdioma(TEXTO_CONSENTIMIENTO_SMS, idioma);
  return `${t.antes} ${t.privacidad} ${t.y} ${t.terminos}.`;
};
