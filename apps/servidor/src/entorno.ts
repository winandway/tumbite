import { type Entorno, entornoDeHost } from '@tumbite/compartido';
import type { Env } from './env';

/**
 * C-ENTORNOS-SEPARADOS del lado del servidor (15 oct 2026). Cada sitio se reconoce por su dominio
 * y sus variables tienen que ser de SU entorno:
 *   - pruebas: Stripe solo en modo prueba (sk_test_/pk_test_); su dirección propia.
 *   - producción: Stripe en modo real (sk_live_/pk_live_); su dirección propia.
 * Si el sitio de pruebas recibe llaves reales de Stripe, se IGNORAN (no puede cobrar dinero real)
 * y la salud dice «entorno: error», lo que frena el semáforo.
 */
export function problemasDeEntorno(host: string, env: Env): string[] {
  const entorno: Entorno | null = entornoDeHost(host);
  if (entorno !== 'pruebas' && entorno !== 'produccion') return [];
  const p: string[] = [];
  const sk = env.STRIPE_SECRET_KEY ?? '';
  const pk = env.STRIPE_PUBLISHABLE_KEY ?? '';
  if (entorno === 'pruebas') {
    if (sk.startsWith('sk_live_') || sk.startsWith('rk_live_'))
      p.push('llave secreta REAL de Stripe en pruebas');
    if (pk.startsWith('pk_live_')) p.push('llave publicable REAL de Stripe en pruebas');
  } else {
    if (sk.startsWith('sk_test_')) p.push('llave secreta de PRUEBA de Stripe en producción');
    if (pk.startsWith('pk_test_')) p.push('llave publicable de PRUEBA de Stripe en producción');
  }
  for (const [nombre, valor] of [['SITIO_URL', env.SITIO_URL]] as const) {
    if (!valor) continue;
    try {
      const otro = entornoDeHost(new URL(valor).host);
      if (otro && otro !== entorno) p.push(`${nombre} apunta a ${otro}`);
    } catch {
      p.push(`${nombre} no es una dirección`);
    }
  }
  return p;
}

/** En pruebas, una llave real de Stripe no se usa nunca: se quita del entorno de esta petición. */
export function blindarStripeEnPruebas(host: string, env: Env): void {
  if (entornoDeHost(host) !== 'pruebas') return;
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.error('entorno: llave real de Stripe en el sitio de pruebas; se ignora');
    env.STRIPE_SECRET_KEY = undefined;
  }
  if (env.STRIPE_PUBLISHABLE_KEY && !env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_'))
    env.STRIPE_PUBLISHABLE_KEY = undefined;
}
