import { APPS_DE_CELULAR, type AppDeCelular, mensajeCuentaDeOtraApp } from '@tumbite/compartido';

/** C-ENTRAR-APP-EQUIVOCADA: el mismo aviso en inglés, para cada cuenta en cada app que no es la suya. */
const APP_EN = new Map<AppDeCelular, string>([
  ['cliente', 'this app'],
  ['repartidor', 'Divoox Driver'],
  ['restaurante', 'Divoox Restaurants'],
]);
const CUENTA_EN = new Map<AppDeCelular, string>([
  ['cliente', 'a Divoox customer account'],
  ['repartidor', 'a Divoox driver account'],
  ['restaurante', 'a Divoox restaurant account'],
]);
const SIGUE_EN = new Map<AppDeCelular, string>([
  ['cliente', 'Your customer account stays the same in the Divoox app.'],
  ['repartidor', 'Your driver account stays the same in Divoox Driver.'],
  ['restaurante', 'Your restaurant stays the same in Divoox Restaurants.'],
]);
const QUE_HACER_EN = new Map<AppDeCelular, string>([
  [
    'cliente',
    'To order, create a customer account with a different email; you can use the same phone number.',
  ],
  [
    'repartidor',
    'To drive, create a driver account with a different email; you can use the same phone number.',
  ],
  ['restaurante', 'To sign in here, use the email of your restaurant’s account.'],
]);
export const MENSAJES_EN_OTRA_APP: [string, string][] = APPS_DE_CELULAR.flatMap((cuenta) =>
  APPS_DE_CELULAR.filter((app) => app !== cuenta).map((app): [string, string] => [
    mensajeCuentaDeOtraApp(cuenta, app),
    `This email already belongs to ${CUENTA_EN.get(cuenta)} and doesn’t work in ${APP_EN.get(app)}. ${QUE_HACER_EN.get(app)} ${SIGUE_EN.get(cuenta)}`,
  ]),
);

/**
 * C-PLAZO-PAPELES y C-VERIFICACION-ASISTENTE (19 nov 2026): los mensajes del plazo de papeles y del
 * asistente de verificación en inglés. Se suman a MENSAJES_EN (candado C-INGLES-PRINCIPAL).
 */
export const MENSAJES_EN_PAPELES: [string, string][] = [
  [
    'Para seguir como conductor, marca la casilla y toca «Aceptar y continuar».',
    'To continue as a driver, check the box and tap “Accept and continue.”',
  ],
  [
    'Tómate la foto de tu cara antes de conectarte. Así te reconoce el pasajero.',
    'Take the photo of your face before going online. It is how riders recognize you.',
  ],
  ...MENSAJES_EN_OTRA_APP,
  ['Esa foto no corresponde.', 'That photo doesn’t belong here.'],
  [
    'Esa foto no se pide en el país de esta persona.',
    'That photo isn’t required in this person’s country.',
  ],
  [
    'La foto de tu cara se toma en vivo, con la cámara. No se puede elegir de tus archivos.',
    'The photo of your face is taken live, with the camera. You can’t pick it from your files.',
  ],
  [
    'Ese papel ya está aprobado. No hace falta cambiarlo.',
    'That document is already approved. There’s no need to change it.',
  ],
  [
    'Antes de la foto de tu cara, acepta que la usemos para comprobar que el documento es tuyo.',
    'Before the photo of your face, agree to let us use it to check that the document is yours.',
  ],
  ['No encontramos esa foto.', 'We couldn’t find that photo.'],
  ['Faltan fotos por tomar antes de enviar.', 'Some photos are still missing before you can send.'],
  [
    'El país de esta persona no tiene plazo de papeles.',
    'This person’s country has no document deadline.',
  ],
];
