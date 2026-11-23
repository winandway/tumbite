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
