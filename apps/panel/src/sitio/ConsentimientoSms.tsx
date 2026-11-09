import {
  type Idioma,
  VERSION_CONSENTIMIENTO_SMS,
  enIdioma,
  enIdiomaDireccion,
  textoConsentimientoSms,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { CONTACTO } from './textos';

/**
 * C-SMS-CONSENTIMIENTO: la página pública /sms-consent (Twilio 30513). Explica quién manda los SMS,
 * cuáles, con qué frecuencia, tarifas, STOP/HELP y cómo se da el consentimiento, con la captura
 * REAL de la casilla. La imagen vive en /sms-consent/opt-in.png (Twilio pide una imagen directa).
 */
export const IMAGEN_CONSENTIMIENTO_SMS = '/sms-consent/opt-in.png';

const T = {
  en: {
    volver: '← Back to Divoox',
    titulo: 'Text message (SMS) consent',
    actualizado: 'Last updated: November 9, 2026',
    intro:
      'This page explains how Divoox collects consent to send text messages, which messages we send, and how to stop them at any time.',
    secciones: [
      {
        titulo: 'Who sends the messages',
        parrafos: [
          'Text messages come from Divoox, a delivery service operated by Windoce, LLC, a Delaware company with offices in Novi, Michigan, United States. Messages are sent from our toll-free number and always start with “Divoox”.',
        ],
      },
      {
        titulo: 'How you opt in',
        parrafos: [
          'When you create an account in the Divoox apps or on divoox.com, and in your account settings, there is a separate checkbox for text messages. It is unchecked by default and it is separate from accepting our Terms and Privacy Policy. You only receive text messages if you check it yourself.',
          'Checking it is optional: you can create an account and place orders without agreeing to receive text messages. Consent is not a condition of purchase.',
          'When you check the box we store the date and time, the version of the consent text, and whether you used the app or the website.',
        ],
      },
      {
        titulo: 'What we send',
        parrafos: [
          'Account and order messages only: verification codes, order status (confirmed, on the way, arriving, delivered), and delivery updates such as “your driver is at your door”. We do not send marketing by text message.',
          'A verification code you request in the app is sent once, at that moment, because you asked for it.',
        ],
      },
      {
        titulo: 'Frequency and rates',
        parrafos: [
          'Message frequency varies with your account activity and orders. Message and data rates may apply, according to your mobile carrier plan.',
        ],
      },
      {
        titulo: 'How to stop or get help',
        parrafos: [
          'Reply STOP to any message to opt out; you will get one confirmation and no further messages. Reply START to opt back in. Reply HELP for help. You can also uncheck the text message box in your account at any time.',
          `For support, email ${CONTACTO}. Carriers are not liable for delayed or undelivered messages.`,
        ],
      },
      {
        titulo: 'Privacy',
        parrafos: [
          'We do not sell your mobile number. We do not share your mobile number or SMS consent with third parties or affiliates for their marketing purposes. It is shared only with the provider that delivers the message on our behalf.',
        ],
      },
    ],
    captura: 'The text message checkbox at sign-up (unchecked by default):',
    alt: 'Divoox sign-up screen with a separate, unchecked text message (SMS) consent checkbox',
    textoCasilla: 'Exact text next to the checkbox:',
    version: 'Consent text version',
    enlaces: 'Read our',
    privacidad: 'Privacy Policy',
    y: 'and',
    terminos: 'Terms of Service',
  },
  es: {
    volver: '← Volver a Divoox',
    titulo: 'Consentimiento para mensajes de texto (SMS)',
    actualizado: 'Actualizado: 9 de noviembre de 2026',
    intro:
      'Esta página explica cómo Divoox pide tu consentimiento para enviarte mensajes de texto, qué mensajes enviamos y cómo dejar de recibirlos cuando quieras.',
    secciones: [
      {
        titulo: 'Quién envía los mensajes',
        parrafos: [
          'Los mensajes los envía Divoox, un servicio de reparto de Windoce, LLC, una empresa de Delaware con oficinas en Novi, Michigan, Estados Unidos. Salen de nuestro número gratuito y siempre empiezan con «Divoox».',
        ],
      },
      {
        titulo: 'Cómo das tu consentimiento',
        parrafos: [
          'Al crear tu cuenta en las apps de Divoox o en divoox.com, y en la configuración de tu cuenta, hay una casilla propia para los mensajes de texto. Viene sin marcar y va aparte de la aceptación de los Términos y la Política de privacidad. Solo recibes mensajes de texto si la marcas tú.',
          'Marcarla es opcional: puedes crear tu cuenta y hacer pedidos sin aceptar los mensajes de texto. Aceptar no es una condición para comprar.',
          'Cuando la marcas guardamos la fecha y la hora, la versión del texto que aceptaste y si lo hiciste en la app o en el sitio web.',
        ],
      },
      {
        titulo: 'Qué enviamos',
        parrafos: [
          'Solo mensajes de tu cuenta y tus pedidos: códigos de verificación, el estado del pedido (confirmado, en camino, por llegar, entregado) y avisos de la entrega, como «tu repartidor está en tu puerta». No enviamos publicidad por mensaje de texto.',
          'El código de verificación que pides en la app se envía una sola vez, en ese momento, porque lo pediste tú.',
        ],
      },
      {
        titulo: 'Frecuencia y tarifas',
        parrafos: [
          'La cantidad de mensajes varía según la actividad de tu cuenta y tus pedidos. Pueden aplicar tarifas de mensajes y datos según el plan de tu operador.',
        ],
      },
      {
        titulo: 'Cómo dejar de recibirlos o pedir ayuda',
        parrafos: [
          'Responde STOP a cualquier mensaje para darte de baja: recibirás una confirmación y ningún mensaje más. Responde START para volver a recibirlos y HELP para pedir ayuda. También puedes desmarcar la casilla de mensajes de texto en tu cuenta cuando quieras.',
          `Para ayuda, escríbenos a ${CONTACTO}. Los operadores no son responsables de mensajes demorados o no entregados.`,
        ],
      },
      {
        titulo: 'Privacidad',
        parrafos: [
          'No vendemos tu número de celular. No compartimos tu número ni tu consentimiento para SMS con terceros ni con afiliados para sus fines de publicidad. Solo lo recibe el proveedor que entrega el mensaje por nosotros.',
        ],
      },
    ],
    captura: 'La casilla de mensajes de texto al crear la cuenta (sin marcar por defecto):',
    alt: 'Pantalla de registro de Divoox con la casilla de consentimiento para mensajes de texto (SMS), aparte y sin marcar',
    textoCasilla: 'Texto exacto junto a la casilla:',
    version: 'Versión del texto de consentimiento',
    enlaces: 'Lee nuestra',
    privacidad: 'Política de privacidad',
    y: 'y los',
    terminos: 'Términos de uso',
  },
};

export function ConsentimientoSms({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  return (
    <main className="legal consentimiento-sms">
      <Enlace a="/">{t.volver}</Enlace>
      <h1>{t.titulo}</h1>
      <p className="fecha">{t.actualizado}</p>
      <p className="legal-intro">{t.intro}</p>
      {t.secciones.map((s) => (
        <section key={s.titulo}>
          <h2>{s.titulo}</h2>
          {s.parrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
      <section id="opt-in">
        <h2>{t.captura}</h2>
        <picture>
          <source srcSet="/sms-consent/opt-in.webp" type="image/webp" />
          <img
            src={IMAGEN_CONSENTIMIENTO_SMS}
            alt={t.alt}
            width={430}
            loading="lazy"
            style={{
              maxWidth: '100%',
              height: 'auto',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
            }}
          />
        </picture>
        <p>{t.textoCasilla}</p>
        <blockquote data-testid="texto-casilla-sms">{textoConsentimientoSms(idioma)}</blockquote>
        <p className="fecha">
          {t.version}: {VERSION_CONSENTIMIENTO_SMS}
        </p>
      </section>
      <p>
        {t.enlaces} <a href={enIdiomaDireccion('/privacy', idioma)}>{t.privacidad}</a> {t.y}{' '}
        <a href={enIdiomaDireccion('/terms', idioma)}>{t.terminos}</a>.
      </p>
    </main>
  );
}
