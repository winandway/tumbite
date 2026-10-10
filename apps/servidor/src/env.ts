import { z } from 'zod';

/**
 * Variables de entorno validadas. Si falta algo obligatorio, la ruta de salud lo
 * dice en rojo en vez de fallar en silencio. Los secretos de Stripe se vuelven
 * obligatorios en el paso de cobros.
 */
export const esquemaEnv = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
  /** Correos (separados por coma) que PUEDEN volverse administradores con la semilla. */
  ADMIN_CORREOS: z.string().optional(),
  /** Secreto largo para /datos/cuentas/hacer-admin. Va solo en el panel de YaDominios. */
  ADMIN_SEMILLA: z.string().min(24).optional(),
});

export type Variables = z.infer<typeof esquemaEnv>;

export interface Env extends Variables {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
}

export function revisarEnv(env: Record<string, unknown>) {
  const r = esquemaEnv.safeParse(env);
  return r.success
    ? { ok: true as const }
    : { ok: false as const, faltan: r.error.issues.map((i) => i.path.join('.')) };
}
