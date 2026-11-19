import type { Env } from './env';
import { ErrorStripe, type Stripe } from './stripe';
import { ErrorDatos } from './validar';

/**
 * C-CONNECT-PAIS (17 nov 2026): cada país es su propio sistema también para cobrar. La cuenta de
 * Stripe Connect de un restaurante o repartidor nace con el país de su zona y con el acuerdo que
 * Stripe permite ahí (panel de Windoce, 16 nov):
 *  - EE. UU.: Express con acuerdo completo («full»), solo transferencias (Divoox cobra al cliente).
 *  - Colombia: Express con acuerdo «recipient»: solo recibe transferencias, en pesos, a su banco.
 * Un país que no está aquí NO llama a Stripe (Venezuela, Brasil y los que aún no se probaron).
 */
export const PERFILES_CONNECT = {
  US: { acuerdo: 'full' },
  CO: { acuerdo: 'recipient' },
} as const satisfies Record<string, { acuerdo: 'full' | 'recipient' }>;

export type PaisConnect = keyof typeof PERFILES_CONNECT;

export const esPaisConnect = (p: string): p is PaisConnect => Object.hasOwn(PERFILES_CONNECT, p);

/** Lo que se le manda a Stripe para crear la cuenta, según el país. */
export function datosCuentaConnect(
  pais: PaisConnect,
  u: { id: string; correo: string; rol: string },
) {
  const perfil = new Map<string, { acuerdo: string }>(Object.entries(PERFILES_CONNECT)).get(pais);
  return {
    type: 'express',
    country: pais,
    email: u.correo,
    capabilities: { transfers: { requested: true } },
    business_type: u.rol === 'repartidor' ? 'individual' : undefined,
    ...(perfil?.acuerdo === 'recipient'
      ? { tos_acceptance: { service_agreement: 'recipient' } }
      : {}),
    metadata: { usuario_id: u.id, rol: u.rol, pais },
  };
}

/** El país de la zona del restaurante o del repartidor. Sin zona, EE. UU. (como hasta hoy). */
export async function paisDeCobros(db: D1Database, u: { id: string; rol: string }) {
  const fila =
    u.rol === 'restaurante'
      ? await db
          .prepare(
            'SELECT z.pais FROM restaurantes r JOIN zonas z ON z.id = r.zona_id WHERE r.dueno_id = ? ORDER BY r.creado_en LIMIT 1',
          )
          .bind(u.id)
          .first<{ pais: string }>()
      : await db
          .prepare(
            'SELECT z.pais FROM repartidores r JOIN zonas z ON z.id = r.zona_id WHERE r.usuario_id = ?',
          )
          .bind(u.id)
          .first<{ pais: string }>();
  return (fila?.pais ?? 'US').toUpperCase();
}

/**
 * C-CONNECT-UN-INTENTO (17 nov 2026): el 5 nov Stripe pausó la creación de cuentas por 17 intentos
 * fallidos seguidos. Ahora, el PRIMER rechazo de Stripe al crear una cuenta deja el freno puesto
 * (config `connect_frenado`) y nadie más vuelve a intentarlo hasta que un administrador lo quite a
 * mano después de revisar el motivo. Nunca un bucle contra Stripe.
 */
export async function connectFrenado(db: D1Database): Promise<string | null> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'connect_frenado'")
    .first<{ valor: string }>();
  return f?.valor ?? null;
}

export async function crearCuentaConnect(
  db: D1Database,
  stripe: Stripe,
  u: { id: string; correo: string; rol: string },
  pais: string,
): Promise<string> {
  if (!esPaisConnect(pais))
    throw new ErrorDatos(
      'Los cobros a tu cuenta bancaria todavía no están disponibles en tu país. Tu saldo está a salvo.',
      undefined,
      409,
    );
  if (await connectFrenado(db))
    throw new ErrorDatos(
      'Los cobros a tu cuenta bancaria están en pausa por revisión. Tu saldo está a salvo.',
      undefined,
      409,
    );
  try {
    const cuenta = await stripe.post<{ id: string }>(
      '/accounts',
      datosCuentaConnect(pais, u),
      `cuenta-${u.id}-${pais}`,
    );
    return cuenta.id;
  } catch (e) {
    // Solo un rechazo de Stripe frena (no un corte de red, que se puede repetir con la misma clave).
    if (e instanceof ErrorStripe && e.estado >= 400 && e.estado < 500) {
      const valor = JSON.stringify({
        cuando: new Date().toISOString(),
        estado: e.estado,
        mensaje: e.message,
        codigo: e.codigo ?? null,
        solicitud: e.solicitud ?? null,
        usuario: u.id,
        pais,
      });
      await db
        .prepare(
          "INSERT INTO config (clave, valor) VALUES ('connect_frenado', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
        )
        .bind(valor)
        .run();
      console.error('connect: Stripe rechazó la cuenta; freno puesto', valor);
    }
    throw e;
  }
}

/**
 * Para la salud. Con el freno puesto y Connect apagado para el público, «atrasado»: se ve, pero no
 * tumba la salud ni frena las publicaciones (17 nov 2026, el 503 frenó todo). Con Connect encendido,
 * el freno sí deja a restaurantes y repartidores sin poder cobrar: «error».
 */
export async function saludConnect(
  env: Env,
  db: D1Database,
): Promise<'ok' | 'error' | 'pendiente' | 'atrasado'> {
  const llave = env.STRIPE_SECRET_KEY ?? '';
  const activo = env.STRIPE_CONNECT_ACTIVO === '1' || llave.startsWith('sk_test_');
  if (await connectFrenado(db)) return activo ? 'error' : 'atrasado';
  return activo ? 'ok' : 'pendiente';
}
