// C-VISTA-PREVIA-RAMA (26 nov 2026) — reglas fijas de las vistas previas por rama.
// Lo usan el guion (vista-previa.mjs) y su prueba (scripts/vista-previa/reglas.test.ts).

/** Cuenta de Cloudflare de Divoox (windoce1). Nunca otra. */
export const CUENTA = '4d9e131f2c18bc10ac4700d689d5556c';
/** Worker conocido de Divoox en esa cuenta: si no aparece, la sesión está en otra cuenta. */
export const WORKER_CONOCIDO = 'tumbite-reloj';
export const SUBDOMINIO = 'windoce1.workers.dev';
export const PREFIJO = 'divoox-preview-';
/** Un solo almacén de archivos para todas las vistas previas (las llaves son al azar; se vacía solo). */
export const ALMACEN = 'divoox-preview-archivos';

/**
 * Bases que una vista previa JAMÁS puede usar, ni crear con su nombre, ni borrar:
 * producción (site-tumbite-db) y el sitio de pruebas compartido (site-tumbite-pruebas-db).
 */
export const BASES_PROHIBIDAS = [
  { nombre: 'site-tumbite-db', id: '6f8a4025-29cb-4624-a382-6c742f41fb52' },
  { nombre: 'site-tumbite-pruebas-db', id: 'b19e69cb-ba02-4d12-a37c-4486275dfc3c' },
];

/** Igual que nombreVistaPrevia de packages/compartido/src/entornos.ts (la prueba exige que coincidan). */
export function nombreVistaPrevia(rama) {
  const limpio = String(rama)
    .toLowerCase()
    .replace(/^refs\/heads\//, '')
    .replace(/^fase-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (!limpio) throw new Error(`La rama «${rama}» no da un nombre de vista previa`);
  return `${PREFIJO}${limpio}`;
}

export function urlVistaPrevia(nombre) {
  return `https://${nombre}.${SUBDOMINIO}`;
}

/**
 * El candado del lado del guion: lanza un error si la base no es una base de vista previa o si es
 * (por nombre o por id) la de producción o la del sitio compartido.
 */
export function validarBaseVistaPrevia({ nombre, id }) {
  if (typeof nombre !== 'string' || !nombre.startsWith(PREFIJO))
    throw new Error(
      `«${nombre}» no es una base de vista previa (tiene que empezar por ${PREFIJO})`,
    );
  for (const p of BASES_PROHIBIDAS)
    if (p.nombre === nombre || (id && p.id === String(id).toLowerCase()))
      throw new Error(
        `PROHIBIDO: «${nombre}» es la base de ${p.nombre}; una vista previa nunca la toca`,
      );
  if (/tumbite-db|tumbite-pruebas|^site-/.test(nombre))
    throw new Error(`PROHIBIDO: «${nombre}» parece una base de un sitio publicado`);
  return true;
}

/** La configuración del worker de la vista previa (wrangler.json). Sin variables de producción. */
export function configWorker({ nombre, idBase, paquete, commit }) {
  validarBaseVistaPrevia({ nombre, id: idBase });
  return {
    name: nombre,
    main: `${paquete}/_worker.js`,
    compatibility_date: '2026-09-01',
    compatibility_flags: ['nodejs_compat'],
    account_id: CUENTA,
    workers_dev: true,
    preview_urls: false,
    assets: { directory: paquete, binding: 'ASSETS', run_worker_first: true },
    d1_databases: [{ binding: 'DB', database_name: nombre, database_id: idBase }],
    r2_buckets: [{ binding: 'BUCKET', bucket_name: ALMACEN }],
    observability: { enabled: true },
    vars: {
      SITIO_URL: urlVistaPrevia(nombre),
      VISTA_PREVIA_BASE: nombre,
      VISTA_PREVIA_COMMIT: commit,
      // Sin envíos reales: los guiones usan números y correos ficticios.
      WHATSAPP_PRESUPUESTO_DIA_USD: '0',
      RETIROS_APAGADOS: '1',
    },
  };
}

/**
 * Los eventos del aviso de Stripe de cada vista previa: los mismos del aviso PRINCIPAL del servidor
 * (EVENTOS_PRINCIPAL de apps/servidor/src/rutas/stripeAvisos.ts; la prueba exige que coincidan).
 */
export const EVENTOS_STRIPE = [
  'checkout.session.completed',
  'payment_intent.amount_capturable_updated',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'transfer.created',
  'transfer.reversed',
  'invoice.paid',
  'customer.subscription.deleted',
];

export function urlAvisoStripe(nombre) {
  return `${urlVistaPrevia(nombre)}/datos/stripe/aviso`;
}
