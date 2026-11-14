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
  /** C-GERENTE-TICKETS: el secreto del gerente de correo (variable del panel, nunca en el código). */
  GERENTE_SECRETO: z.string().min(40).optional(),
  /** C-CASOS-CAPTURAS: llave para firmar los enlaces de las capturas de los casos de ayuda. */
  ARCHIVOS_FIRMA: z.string().min(40).optional(),
  /** Llave publicable de Stripe (pk_…): la usa la app para el pago dentro de la pantalla. */
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  /** Número de WhatsApp de soporte (con prefijo, solo dígitos). Vacío = el botón no se muestra. */
  WHATSAPP_SOPORTE: z
    .string()
    .regex(/^\d{8,15}$/)
    .optional(),
  /** WhatsApp de ventas de franquicias (solo dígitos): sale SOLO después del formulario. */
  WHATSAPP_VENTAS: z
    .string()
    .regex(/^\d{8,15}$/)
    .optional(),
  /**
   * C-AVISOS-WEB: llaves VAPID de los avisos de las apps instaladas desde el navegador. La pública
   * (variable del sitio, la misma que EXPO_PUBLIC_VAPID_PUBLIC_KEY de la compilación) y la privada
   * (secreto del sitio). Sin las dos, los avisos web quedan apagados.
   */
  VAPID_PUBLIC_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{86,88}$/)
    .optional(),
  VAPID_PRIVATE_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{42,44}$/)
    .optional(),
  /** Contacto que va en la firma VAPID («mailto:…»). Por defecto, el buzón de soporte. */
  VAPID_SUBJECT: z.string().startsWith('mailto:').optional(),
  /** Token de acceso de Expo para los avisos al celular (opcional; sube el límite). */
  EXPO_ACCESS_TOKEN: z.string().min(10).optional(),
  /**
   * Flex · Fase 3: llave con la que se CIFRAN los secretos de los destinos de integración (avisos
   * firmados a los sistemas de las empresas). Sin ella se deriva una del secreto del reloj (provisional).
   */
  FLEX_LLAVE_WEBHOOKS: z.string().min(32).optional(),
  /**
   * Llave de Google Places (API nueva) para buscar direcciones. Vive SOLO en el servidor; sin ella la
   * búsqueda se apaga y se usa el pin en el mapa (C-FLEX-UBICACION).
   */
  GOOGLE_PLACES_KEY: z.string().min(20).optional(),
  /**
   * C-RUTA-POR-CALLES: llave de Google Routes API para la distancia por calles del precio de un
   * viaje. Si falta, se usa GOOGLE_PLACES_KEY (la misma llave del servidor con Routes habilitada).
   */
  GOOGLE_ROUTES_KEY: z.string().min(20).optional(),
  /** C-RUTA-POR-CALLES: tope propio de consultas a Google Routes por día (por defecto 320). */
  TOPE_RUTAS_CALLES_DIA: z
    .string()
    .regex(/^\d{1,6}$/)
    .optional(),
  /** Secreto del reloj externo (GitHub Actions llama a /datos/reloj con él cada 5 min). */
  RELOJ_SECRETO: z.string().min(24).optional(),
  // Cuentas de prueba para los revisores de Apple y Google (correos separados por coma): prueban
  // desde otra ciudad, así que no se les exige estar a 200 m. La foto sí se les pide igual.
  CORREOS_REVISOR: z.string().optional(),
  /** Dirección pública del sitio, para las vueltas desde Stripe. */
  SITIO_URL: z.url().optional(),
  /** C-FLOTA-PROPIA: «1» enciende la flota propia fuera del sitio de pruebas (decisión de Richard). */
  FLOTA_PROPIA: z.string().optional(),
  /** Twilio (SMS de respaldo y llamadas con número oculto). Sin esto, se apagan solos. */
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().min(16).optional(),
  /**
   * Llave de API de Twilio (SK…) en vez del Auth Token: con ella se manda y se llama (la usuaria es la
   * llave y la clave su secreto). El Auth Token sigue haciendo falta solo para firmar los enlaces de
   * las llamadas con número oculto.
   */
  TWILIO_API_KEY: z.string().startsWith('SK').optional(),
  TWILIO_API_SECRET: z.string().min(16).optional(),
  /** El número de Divoox en Twilio, en formato internacional (+1…). */
  TWILIO_FROM: z
    .string()
    .regex(/^\+\d{8,15}$/)
    .optional(),
  /** Solo para el recorrido: Twilio simulado en localhost (en producción se ignora). */
  TWILIO_API_URL: z.string().optional(),
  /** Prefijos a los que salen SMS y llamadas (C-SMS-PAISES). Sin valor: solo «+1». */
  SMS_PREFIJOS: z.string().optional(),
  /**
   * C-CLIENTE-AUSENTE: minutos que el repartidor espera en la puerta, después de avisar que el
   * cliente no aparece, antes de poder dejarlo en lugar seguro o cerrar como «cliente no apareció».
   * Sin valor: 5 (DoorDash). Uber Eats usa 8. Entre 2 y 15.
   */
  ESPERA_CLIENTE_AUSENTE_MIN: z
    .string()
    .regex(/^\d{1,2}$/)
    .optional(),
  /** Checkr (antecedentes de repartidores). Sin la llave, el botón dice que se activa pronto. */
  CHECKR_API_KEY: z.string().min(16).optional(),
  /** Solo para el recorrido: Checkr simulado en localhost (en producción se ignora). */
  CHECKR_API_URL: z.string().optional(),
  /**
   * Motor propio de verificación de identidad (apps/verificador). Con las dos, la verificación del
   * repartidor se decide al instante; sin ellas, la revisa el equipo como siempre. C-KYC-AUTO.
   */
  VERIFICADOR_URL: z.url().optional(),
  VERIFICADOR_CLAVE: z.string().min(32).optional(),
  /** «1» = apagar los retiros de inmediato, sin tocar la base (emergencia). Manda sobre la bandera. */
  RETIROS_APAGADOS: z.enum(['0', '1']).optional(),
  /**
   * C-CONNECT-APAGADO: «1» cuando Stripe Connect esté activado en la cuenta de Windoce. Sin ella, con
   * la llave real no se crea ninguna cuenta conectada (Stripe lo marcó como sospechoso el 5 nov 2026).
   */
  STRIPE_CONNECT_ACTIVO: z.enum(['0', '1']).optional(),
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
  /** C-TIENDAS-VITRINA: «1» enciende las tiendas en el servidor LOCAL del recorrido (nunca en un sitio publicado). */
  TIENDAS_LOCAL: z.enum(['0', '1']).optional(),
  /** C-SERVICIOS-RECORRIDO-LOCAL: «1» hace que el servidor LOCAL del recorrido declare los mismos
   * servicios en prueba que el sitio de pruebas (nunca cambia nada en un sitio publicado). */
  SERVICIOS_PRUEBA_LOCAL: z.enum(['0', '1']).optional(),
  /** C-ALCOHOL-HORARIO: solo el recorrido local salta la hora legal del alcohol. */
  ALCOHOL_SIN_HORARIO: z.enum(['0', '1']).optional(),
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
