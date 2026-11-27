import { MENSAJE_PAPEL_POR_ACTIVAR } from '@tumbite/compartido';
import { mensajeYaTienesCuenta } from './mensajesYaTienesCuenta';

/** C-CUENTA-UNICA (24 nov 2026): los mensajes de la cuenta única en inglés (C-INGLES-PRINCIPAL). */
const PARA_EN = new Map<string, string>([
  ['repartidor', 'to sign up as a driver'],
  ['cliente', 'to order with it'],
  ['', 'to use it here too'],
]);
/** C-CUENTA-UNICA (27 nov 2026): «Ya tienes una cuenta de Divoox…» en inglés, por dato y por app. */
const YA_TIENES_EN: [string, string][] = (['correo', 'telefono'] as const).flatMap((con) =>
  (['repartidor', 'cliente', null] as const).map((papel): [string, string] => [
    mensajeYaTienesCuenta(con, papel),
    `You already have a Divoox account with this ${con === 'correo' ? 'email' : 'phone number'}. Sign in with it ${PARA_EN.get(papel ?? '')}: you don’t need another one. ${con === 'correo' ? 'Tap “Sign in” and use the same password.' : 'Tap “Sign in” and use that account’s email and password.'} Don’t remember it? Tap “Forgot your password?” and we’ll send you a code by WhatsApp or SMS.`,
  ]),
);

export const MENSAJES_EN_CUENTA_UNICA: [string, string][] = [
  ...YA_TIENES_EN,
  [
    MENSAJE_PAPEL_POR_ACTIVAR.get('cliente') ?? '',
    'You already have a Divoox account with this email. Activate your customer account to order with the same email and password.',
  ],
  [
    MENSAJE_PAPEL_POR_ACTIVAR.get('repartidor') ?? '',
    'You already have a Divoox account with this email. Start your driver sign-up with the same email and password.',
  ],
  [
    'Ya tienes una cuenta de Divoox con este correo. Entra con tu misma contraseña: ahí te ofrecemos usarla también aquí.',
    'You already have a Divoox account with this email. Sign in with the same password and we will offer to use it here too.',
  ],
  [
    'Tu cuenta de conductor está suspendida. Puedes seguir pidiendo en la app de Divoox; para saber qué falta, escríbenos a soporte.',
    'Your driver account is suspended. You can keep ordering in the Divoox app; to find out what is missing, contact support.',
  ],
  ['Para seguir, marca la casilla de los términos.', 'To continue, check the terms box.'],
  [
    'Esta cuenta no puede registrar un restaurante. Entra con tu cuenta personal de Divoox.',
    'This account can’t register a restaurant. Sign in with your personal Divoox account.',
  ],
  ['Escribe el nombre de tu restaurante.', 'Enter your restaurant’s name.'],
  ['Ese restaurante no es tuyo.', 'That restaurant isn’t yours.'],
  [
    'Llegaste al máximo de restaurantes en una cuenta. Escríbenos a soporte.',
    'You reached the maximum number of restaurants for one account. Contact support.',
  ],
  [
    'Eres dueño de un restaurante en Divoox. Escríbenos a soporte para cerrarlo o traspasarlo antes de borrar tu cuenta.',
    'You own a restaurant on Divoox. Contact support to close or transfer it before deleting your account.',
  ],
  ['Solo un conductor se suspende por papeles.', 'Only a driver can be suspended for documents.'],
  ['Escribe por qué se unen.', 'Write why they are being merged.'],
  ['Confirma que es la misma persona.', 'Confirm it is the same person.'],
];
