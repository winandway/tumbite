import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-TELEFONO-AL-REGISTRARSE (22 nov 2026) — Venezuela y Estados Unidos (donde el SMS está activo). La
 * guía pública «Confirma tu celular» (sección «Tu cuenta»), en español e inglés, para clientes y
 * conductores.
 *
 * Las capturas REALES las toma `scripts/recorrido/capturas-verificar-celular.mjs` con la app web del
 * cliente contra el servidor local del recorrido (español con un celular de Venezuela, inglés con uno de
 * Estados Unidos, C-CAPTURAS-POR-IDIOMA) y las deja en
 * `apps/panel/public/docs/recorrido-celular-<nombre>-<es|en>.webp`. Ninguna guía sin capturas: entra en
 * Docs solo cuando `VERIFICAR_CELULAR_PUBLICADA` es true, y su prueba se pone en rojo si faltan.
 */
export const VERIFICAR_CELULAR_PUBLICADA = true;

export const CAPTURAS_VERIFICAR_CELULAR = ['codigo', 'cambiar', 'listo', 'franja'] as const;
type NombreCaptura = (typeof CAPTURAS_VERIFICAR_CELULAR)[number];

const foto = (nombre: NombreCaptura, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-celular-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIA_VERIFICAR_CELULAR: Record<Idioma, Guia> = {
  es: {
    id: 'verify-your-phone',
    titulo: 'Confirma tu celular',
    resumen:
      'Al crear tu cuenta en la app de Divoox o en Divoox Driver te mandamos un código de 6 números por SMS. Lo escribes (o tu teléfono lo pega solo) y listo: tu cuenta queda protegida.',
    explicacion: [
      'Confirmar el celular protege tu cuenta: así sabemos que el número es tuyo, podemos avisarte de tus pedidos y viajes, y nadie puede crear cuentas a tu nombre.',
      'Apenas creas tu cuenta, la app te muestra «Confirma tu celular» y te manda el código al número que escribiste. En la mayoría de los teléfonos el código aparece solo encima del teclado: lo tocas y se confirma.',
      'El código vale 10 minutos. Si no te llega, espera unos segundos y toca «Mandar otro código»: la app te dice cuánto falta para poder pedir otro. Si escribiste mal el número, toca «¿Número equivocado? Cámbialo», corrígelo y te mandamos el código al número nuevo.',
      'Si después de varios intentos sigue sin llegar, en la misma pantalla tienes cómo escribirnos. Nunca te quedas sin salida.',
      'Si ya tenías tu cuenta de antes, no tienes que hacer nada para seguir usándola. Puedes confirmar tu celular cuando quieras desde el aviso de arriba de la app.',
      'Nunca te vamos a pedir ese código por teléfono, por chat ni por correo. No se lo des a nadie.',
    ],
    capturas: [
      foto(
        'codigo',
        'es',
        'La pantalla Confirma tu celular con el aviso de que el código se mandó al número que termina en 0142, la casilla para el código de 6 números y los botones Confirmar y Mandar otro código.',
        'Te mandamos el código por SMS: escríbelo o tócalo encima del teclado.',
      ),
      foto(
        'cambiar',
        'es',
        'La misma pantalla con el formulario para cambiar el número: el país del celular, la casilla del número y el botón Guardar y mandar el código.',
        '¿Número equivocado? Lo cambias ahí mismo.',
      ),
      foto(
        'listo',
        'es',
        'La pantalla Tu celular quedó confirmado con una marca verde y el botón Continuar.',
        'Listo: tu celular quedó confirmado.',
      ),
      foto(
        'franja',
        'es',
        'La app con una franja arriba que dice Confirma tu celular para proteger tu cuenta, con el botón Confirmar y una equis para cerrarla.',
        'Si tu cuenta es de antes, solo ves este aviso, y lo puedes cerrar.',
      ),
    ],
    preguntas: [
      '¿Por qué me piden un código por SMS al crear mi cuenta?',
      '¿Qué hago si no me llega el código?',
      '¿Cómo cambio el número si lo escribí mal?',
      '¿Tengo que confirmar mi celular si ya tenía cuenta?',
    ],
    pasos: [
      'Crea tu cuenta en la app de Divoox o en Divoox Driver con tu número de celular.',
      'En «Confirma tu celular», espera el SMS de Divoox con tu código de 6 números.',
      'Toca el código encima del teclado o escríbelo. Se confirma solo al completar los 6 números.',
      'Si no llega, toca «Mandar otro código» cuando la app te lo permita, o cambia el número si estaba mal.',
      'Cuando veas «Tu celular quedó confirmado», toca «Continuar» y sigue usando la app.',
    ],
    nota: 'Divoox nunca te pide el código por teléfono ni por chat. Si alguien te lo pide, no se lo des.',
  },
  en: {
    id: 'verify-your-phone',
    titulo: 'Confirm your cell phone',
    resumen:
      'When you create your account in the Divoox app or in Divoox Driver, we text you a 6-digit code. Enter it (or let your phone fill it in) and you’re set: your account is protected.',
    explicacion: [
      'Confirming your cell phone protects your account: it tells us the number is yours, lets us update you about your orders and rides, and keeps anyone from opening accounts in your name.',
      'Right after you create your account, the app shows “Confirm your cell phone” and texts the code to the number you entered. On most phones the code shows up above the keyboard: tap it and it’s confirmed.',
      'The code is good for 10 minutes. If it doesn’t arrive, wait a few seconds and tap “Send another code”: the app tells you how long until you can request another one. If you mistyped your number, tap “Wrong number? Change it,” fix it, and we’ll text the code to the new number.',
      'If it still doesn’t arrive after a few tries, the same screen shows you how to reach us. You’re never stuck.',
      'If you already had an account, you don’t need to do anything to keep using it. You can confirm your cell phone anytime from the notice at the top of the app.',
      'We will never ask you for that code by phone, chat or email. Don’t share it with anyone.',
    ],
    capturas: [
      foto(
        'codigo',
        'en',
        'The Confirm your cell phone screen saying the code was texted to the number ending in 0142, the box for the 6-digit code, and the Confirm and Send another code buttons.',
        'We text you the code: type it or tap it above the keyboard.',
      ),
      foto(
        'cambiar',
        'en',
        'The same screen with the form to change the number: the phone’s country, the number box, and the Save and send the code button.',
        'Wrong number? Change it right there.',
      ),
      foto(
        'listo',
        'en',
        'The Your cell phone is confirmed screen with a green check mark and the Continue button.',
        'Done: your cell phone is confirmed.',
      ),
      foto(
        'franja',
        'en',
        'The app with a strip at the top that says Confirm your cell phone to protect your account, with a Confirm button and an X to close it.',
        'If your account is older, you only see this notice, and you can close it.',
      ),
    ],
    preguntas: [
      'Why do I get a text code when I create my account?',
      'What do I do if the code doesn’t arrive?',
      'How do I change the number if I typed it wrong?',
      'Do I have to confirm my cell phone if I already had an account?',
    ],
    pasos: [
      'Create your account in the Divoox app or in Divoox Driver with your cell phone number.',
      'On “Confirm your cell phone,” wait for the Divoox text with your 6-digit code.',
      'Tap the code above the keyboard or type it. It confirms on its own once all 6 digits are in.',
      'If it doesn’t arrive, tap “Send another code” when the app lets you, or change the number if it was wrong.',
      'When you see “Your cell phone is confirmed,” tap “Continue” and keep using the app.',
    ],
    nota: 'Divoox never asks for the code by phone or chat. If someone asks you for it, don’t give it to them.',
  },
};
