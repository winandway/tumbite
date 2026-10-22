import { z } from 'zod';

/**
 * Variables de entorno validadas. Si falta algo obligatorio, la ruta de salud lo
 * dice en rojo en vez de fallar en silencio. Los secretos de Stripe se vuelven
 * obligatorios en el paso de cobros.
 */
export const esquemaEnv = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  /** Secreto del SEGUNDO endpoint de Stripe, el de «cuentas conectadas» (account.updated, payout.failed). */
  STRIPE_WEBHOOK_SECRET_CONECTADAS: z.string().startsWith('whsec_').optional(),
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
  /** Versión mínima de las apps: «cliente=0.2.0,repartidor=0.1.5» o «0.2.0» para todas. Vacío = nada. */
  APP_VERSION_MINIMA: z.string().optional(),
  /** Clave PÚBLICA del escudo (la pintan la web y las apps). Va junto con la secreta o nada. */
  TURNSTILE_SITE_KEY: z.string().min(10).optional(),
  /** Correos (separados por coma) que PUEDEN volverse administradores con la semilla. */
  ADMIN_CORREOS: z.string().optional(),
  /** Secreto largo para /datos/cuentas/hacer-admin. Va solo en el panel de YaDominios. */
  ADMIN_SEMILLA: z.string().min(24).optional(),
  /** «1» = sin KYC aprobado, el repartidor no se conecta y el restaurante no se aprueba. Lo decide Richard. */
  KYC_OBLIGATORIO: z.enum(['0', '1']).optional(),
  /** Token del sitio en YaDominios Cloud: manda correos desde tumbite.com. Solo en el panel. */
  YAD_TOKEN: z.string().min(32).optional(),
  /** Llave publicable de Stripe (pk_…): la usa la app para el pago dentro de la pantalla. */
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  /** Número de WhatsApp de soporte (con prefijo, solo dígitos). Vacío = el botón no se muestra. */
  WHATSAPP_SOPORTE: z
    .string()
    .regex(/^\d{8,15}$/)
    .optional(),
  /** Token de acceso de Expo para los avisos al celular (opcional; sube el límite). */
  EXPO_ACCESS_TOKEN: z.string().min(10).optional(),
  /** Secreto del reloj externo (GitHub Actions llama a /datos/reloj con él cada 5 min). */
  RELOJ_SECRETO: z.string().min(24).optional(),
  // Cuentas de prueba para los revisores de Apple y Google (correos separados por coma): prueban
  // desde otra ciudad, así que no se les exige estar a 200 m. La foto sí se les pide igual.
  CORREOS_REVISOR: z.string().optional(),
  /** Dirección pública del sitio, para las vueltas desde Stripe. */
  SITIO_URL: z.url().optional(),
  /** Twilio (SMS de respaldo y llamadas con número oculto). Sin esto, se apagan solos. */
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().min(16).optional(),
  /** El número de Divoox en Twilio, en formato internacional (+1…). */
  TWILIO_FROM: z
    .string()
    .regex(/^\+\d{8,15}$/)
    .optional(),
  /** Solo para el recorrido: Twilio simulado en localhost (en producción se ignora). */
  TWILIO_API_URL: z.string().optional(),
  /** Checkr (antecedentes de repartidores). Sin la llave, el botón dice que se activa pronto. */
  CHECKR_API_KEY: z.string().min(16).optional(),
  /** Solo para el recorrido: Checkr simulado en localhost (en producción se ignora). */
  CHECKR_API_URL: z.string().optional(),
  /** «1» = apagar los retiros de inmediato, sin tocar la base (emergencia). Manda sobre la bandera. */
  RETIROS_APAGADOS: z.enum(['0', '1']).optional(),
  // Fase 2 · Tiempo real (docs/FASE-2-TIEMPO-REAL.md). Sin estas variables todo sigue como hoy:
  // las apps consultan al servidor y mandan la ubicación por la ruta actual.
  /** Llave con la que los Workers externos firman lo que mandan aquí (actual y anterior). */
  INTERNO_LLAVE_ID: z.string().min(1).max(32).optional(),
  INTERNO_SECRETO_ACTUAL: z.string().min(32).optional(),
  INTERNO_LLAVE_ID_ANTERIOR: z.string().min(1).max(32).optional(),
  INTERNO_SECRETO_ANTERIOR: z.string().min(32).optional(),
  /** Llave con la que este servidor firma lo que le manda al Worker de tiempo real. */
  AVISOS_LLAVE_ID: z.string().min(1).max(32).optional(),
  AVISOS_SECRETO: z.string().min(32).optional(),
  /** Llave de los pases cortos (15 min) para el WebSocket (actual y anterior). */
  PASE_LLAVE_ID: z.string().min(1).max(32).optional(),
  PASE_SECRETO_ACTUAL: z.string().min(32).optional(),
  PASE_LLAVE_ID_ANTERIOR: z.string().min(1).max(32).optional(),
  PASE_SECRETO_ANTERIOR: z.string().min(32).optional(),
  /** Dirección del Worker de tiempo real (https://…). Vacía = tiempo real apagado. */
  TIEMPO_REAL_URL: z.url().optional(),
  /** «1» = la selfie de control se pide en cada conexión (pruebas y recorrido). */
  SELFIE_CONTROL_SIEMPRE: z.enum(['0', '1']).optional(),
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
