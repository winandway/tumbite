/**
 * C-ENTRAR-APP-EQUIVOCADA (23 nov 2026, conductor real de Venezuela). Qué tipo de cuenta usa cada
 * app de celular. Una sola pieza: el servidor la usa para no abrir (ni cerrar) sesiones de una cuenta
 * en la app que no le corresponde, y las pruebas comprueban que cada app acepta exactamente este rol.
 *
 * Solo cuentan las tres apps que se identifican con la cabecera `x-tumbite-app`. El panel web, el
 * superadmin, Flex y el agente no la mandan y siguen como siempre.
 */
export const APPS_DE_CELULAR = ['cliente', 'repartidor', 'restaurante'] as const;
export type AppDeCelular = (typeof APPS_DE_CELULAR)[number];

/** El rol de cuenta que acepta cada app (el mismo que `rolesPermitidos` de cada `_layout`). */
export const ROL_DE_APP: ReadonlyMap<AppDeCelular, AppDeCelular> = new Map([
  ['cliente', 'cliente'],
  ['repartidor', 'repartidor'],
  ['restaurante', 'restaurante'],
]);

export const esAppDeCelular = (s: string | null | undefined): s is AppDeCelular =>
  (APPS_DE_CELULAR as readonly string[]).includes(s ?? '');

/** Código estable de la respuesta, para que una app nueva lo reconozca sin leer el texto. */
export const CODIGO_CUENTA_DE_OTRA_APP = 'cuenta_de_otra_app';

const NOMBRE_APP = new Map<AppDeCelular, string>([
  ['cliente', 'la app de Divoox'],
  ['repartidor', 'Divoox Driver'],
  ['restaurante', 'Divoox Restaurants'],
]);
const CUENTA = new Map<AppDeCelular, string>([
  ['cliente', 'una cuenta de cliente'],
  ['repartidor', 'una cuenta de conductor'],
  ['restaurante', 'una cuenta de restaurante'],
]);
const SIGUE = new Map<AppDeCelular, string>([
  ['cliente', 'Tu cuenta de cliente sigue igual en la app de Divoox.'],
  ['repartidor', 'Tu cuenta de conductor sigue igual en Divoox Driver.'],
  ['restaurante', 'Tu restaurante sigue igual en Divoox Restaurants.'],
]);
const QUE_HACER = new Map<AppDeCelular, string>([
  [
    'cliente',
    'Para pedir, crea una cuenta de cliente con otro correo; puedes usar el mismo celular.',
  ],
  [
    'repartidor',
    'Para trabajar como conductor, crea una cuenta de conductor con otro correo; puedes usar el mismo celular.',
  ],
  ['restaurante', 'Para entrar aquí, usa el correo de la cuenta de tu restaurante.'],
]);

/**
 * Lo que se le dice a quien entra (o se registra) con el correo de una cuenta de otro tipo. En
 * español: el inglés sale de la tabla de mensajes del servidor, como los demás.
 */
export function mensajeCuentaDeOtraApp(cuenta: AppDeCelular, app: AppDeCelular): string {
  const donde = app === 'cliente' ? 'esta app' : NOMBRE_APP.get(app);
  return `Este correo ya es de ${CUENTA.get(cuenta)} de Divoox y no sirve en ${donde}. ${QUE_HACER.get(app)} ${SIGUE.get(cuenta)}`;
}

/**
 * C-CUENTA-UNICA (24 nov 2026, Richard; todos los países). Una persona, una cuenta, varios papeles:
 * el mismo correo y la misma contraseña sirven en la app de clientes y en Divoox Driver. Entrar con una
 * cuenta de otro papel ya no la rechaza (en las apps nuevas): ofrece activar el papel que falta con la
 * aceptación de sus propios términos. Las apps publicadas antes de esto no mandan `cuentaUnica` y
 * siguen viendo el aviso de C-ENTRAR-APP-EQUIVOCADA, que para ellas es lo correcto. Divoox
 * Restaurants no cambia (caso abierto con Apple): su app sigue aceptando solo cuentas de restaurante.
 */
export const PAPELES_DE_PERSONA = ['cliente', 'repartidor'] as const;
export type PapelDePersona = (typeof PAPELES_DE_PERSONA)[number];
export const esPapelDePersona = (s: string | null | undefined): s is PapelDePersona =>
  (PAPELES_DE_PERSONA as readonly string[]).includes(s ?? '');

/** La app pide activar un papel que la cuenta todavía no tiene (respuesta 409 de «Entrar»). */
export const CODIGO_PAPEL_POR_ACTIVAR = 'papel_por_activar';
/** El papel de esta app está suspendido (por ejemplo, papeles vencidos del conductor). */
export const CODIGO_PAPEL_SUSPENDIDO = 'papel_suspendido';

/** Las apps que pueden activar un papel nuevo con la misma cuenta. Restaurants no. */
export const APPS_CUENTA_UNICA: readonly AppDeCelular[] = ['cliente', 'repartidor'];

export type TextosActivarPapel = {
  titulo: string;
  cuerpo: string;
  casilla: string;
  boton: string;
  otraCuenta: string;
};

/** Lo que ve la persona en la app que le ofrece el papel que falta (C-CUENTA-UNICA). */
export function textosActivarPapel(papel: PapelDePersona, idioma: 'es' | 'en'): TextosActivarPapel {
  if (papel === 'cliente')
    return idioma === 'en'
      ? {
          titulo: 'Activate my customer account',
          cuerpo:
            'You already have a Divoox account with this email. Use it to order too: same email and password. Your driver account stays the same in Divoox Driver, and your earnings stay separate.',
          casilla: 'I accept the customer Terms of Service and the Privacy Policy.',
          boton: 'Activate my customer account',
          otraCuenta: 'Use a different email',
        }
      : {
          titulo: 'Activar mi cuenta de cliente',
          cuerpo:
            'Ya tienes una cuenta de Divoox con este correo. Úsala también para pedir: mismo correo y misma contraseña. Tu cuenta de conductor sigue igual en Divoox Driver y tus ganancias quedan aparte.',
          casilla: 'Acepto los Términos del servicio para clientes y la Política de privacidad.',
          boton: 'Activar mi cuenta de cliente',
          otraCuenta: 'Usar otro correo',
        };
  return idioma === 'en'
    ? {
        titulo: 'Start my driver sign-up',
        cuerpo:
          'You already have a Divoox account with this email. Use it to drive too: same email and password. We will only ask for what drivers need (documents and vehicle). Your customer account and your orders stay the same.',
        casilla: 'I accept the driver Terms of Service and the Privacy Policy.',
        boton: 'Start my driver sign-up',
        otraCuenta: 'Use a different email',
      }
    : {
        titulo: 'Empezar mi registro de conductor',
        cuerpo:
          'Ya tienes una cuenta de Divoox con este correo. Úsala también para conducir: mismo correo y misma contraseña. Solo te pediremos lo que necesita un conductor (documentos y vehículo). Tu cuenta de cliente y tus pedidos siguen igual.',
        casilla: 'Acepto los Términos del servicio para conductores y la Política de privacidad.',
        boton: 'Empezar mi registro de conductor',
        otraCuenta: 'Usar otro correo',
      };
}

/** El mensaje de la respuesta (en español; el servidor lo pasa a inglés como los demás). */
export const MENSAJE_PAPEL_POR_ACTIVAR = new Map<PapelDePersona, string>([
  [
    'cliente',
    'Ya tienes una cuenta de Divoox con este correo. Activa tu cuenta de cliente para pedir con el mismo correo y la misma contraseña.',
  ],
  [
    'repartidor',
    'Ya tienes una cuenta de Divoox con este correo. Empieza tu registro de conductor con el mismo correo y la misma contraseña.',
  ],
]);
