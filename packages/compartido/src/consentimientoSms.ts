import type { Idioma } from './idiomas';

/**
 * C-SMS-CONSENTIMIENTO (9 nov 2026, EE. UU.): Twilio rechazó la verificación del número gratuito
 * (error 30513) porque el consentimiento para los SMS salía de dar el número. Ahora la persona marca
 * su propia casilla, separada de los términos, sin marcar de inicio y opcional. Sin esa casilla
 * marcada no le sale ningún SMS. Este texto es el que se muestra y el que se guarda (con su versión):
 * si cambia una palabra, se sube la versión.
 * Fuente: twilio.com/docs/api/errors/30513 y el artículo de Twilio sobre rechazos de verificación.
 */
export const VERSION_CONSENTIMIENTO_SMS = 'sms-2026-11-09';

export const TEXTO_CONSENTIMIENTO_SMS: Record<Idioma, string> = {
  es: 'Quiero recibir por mensaje de texto los avisos de mis pedidos y entregas de Divoox (por ejemplo, «tu repartidor está en tu puerta»). Normalmente 1 o 2 mensajes por pedido. Pueden aplicar tarifas de mensajes y datos. Responde HELP para pedir ayuda y STOP para dejar de recibirlos. No es obligatorio para pedir.',
  en: 'Text me order and delivery updates from Divoox (for example, “your driver is at your door”). Usually 1–2 messages per order. Msg & data rates may apply. Reply HELP for help, STOP to opt out. Not required to order.',
};

/**
 * SMS que no necesitan la casilla: el código que la propia persona pide para confirmar su celular
 * (lo pide ella en ese momento) y los avisos urgentes al equipo de Divoox (administradores).
 */
export const SMS_SIN_CASILLA = ['codigo_telefono'] as const;
export const smsSinCasilla = (tipo: string) =>
  (SMS_SIN_CASILLA as readonly string[]).includes(tipo) || tipo.startsWith('equipo_');
