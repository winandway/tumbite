/**
 * Direcciones públicas de Tumbite. El idioma principal es el inglés (regla de Richard, 13 oct
 * 2026): «/privacy» es la página en inglés y «/es/privacy» la misma en español. Ninguna dirección
 * lleva palabras en español. Las viejas en español (que ya circularon en correos, tiendas y
 * buscadores) se redirigen a las nuevas con 301: aquí está el mapa. Candado C-INGLES-PRINCIPAL.
 */
export const PAGINAS = {
  privacy: '/privacy',
  terms: '/terms',
  restaurantTerms: '/restaurant-terms',
  driverTerms: '/driver-terms',
  deleteAccount: '/delete-account',
  support: '/support',
  howItWorks: '/how-it-works',
  calculator: '/calculator',
  forgotPassword: '/forgot-password',
  confirmEmail: '/confirm-email',
  resetPassword: '/reset-password',
  paymentDone: '/payment/done',
  paymentCancelled: '/payment/cancelled',
  walletReady: '/wallet/ready',
  walletConnect: '/wallet/connect',
} as const;

const PAGINAS_VIEJAS = new Map<string, string>([
  ['/privacidad', PAGINAS.privacy],
  ['/terminos', PAGINAS.terms],
  ['/terminos-restaurantes', PAGINAS.restaurantTerms],
  ['/terminos-repartidores', PAGINAS.driverTerms],
  ['/borrar-cuenta', PAGINAS.deleteAccount],
  ['/soporte', PAGINAS.support],
  ['/como-funciona', PAGINAS.howItWorks],
  ['/olvide', PAGINAS.forgotPassword],
  ['/confirmar', PAGINAS.confirmEmail],
  ['/restablecer', PAGINAS.resetPassword],
  ['/pago/listo', PAGINAS.paymentDone],
  ['/pago/cancelado', PAGINAS.paymentCancelled],
  ['/billetera/lista', PAGINAS.walletReady],
  ['/billetera/conectar', PAGINAS.walletConnect],
]);

/** Partes de dirección que antes iban en español: países, comidas y Docs. */
const PAISES_VIEJOS = new Map([
  ['estados-unidos', 'united-states'],
  ['republica-dominicana', 'dominican-republic'],
  ['brasil', 'brazil'],
  ['surinam', 'suriname'],
  ['espana', 'spain'],
  ['italia', 'italy'],
  ['francia', 'france'],
  ['alemania', 'germany'],
  ['paises-bajos', 'netherlands'],
  ['reino-unido', 'united-kingdom'],
  ['rumania', 'romania'],
  ['guinea-ecuatorial', 'equatorial-guinea'],
]);
const COMIDAS_VIEJAS = new Map([
  ['hamburguesas', 'burgers'],
  ['cubana', 'cuban'],
  ['venezolana', 'venezuelan'],
  ['colombiana', 'colombian'],
  ['mexicana', 'mexican'],
  ['pollo', 'chicken'],
  ['saludable', 'healthy'],
  ['postres', 'desserts'],
  ['cafe', 'coffee'],
  ['mariscos', 'seafood'],
]);
const SECCIONES_VIEJAS = new Map([
  ['comensales', 'ordering'],
  ['restaurantes', 'restaurants'],
  ['repartidores', 'drivers'],
  ['confianza', 'trust'],
  ['cuenta', 'account'],
]);
const GUIAS_VIEJAS = new Map([
  ['ordering/pedir', 'first-order'],
  ['ordering/seguir', 'track-order'],
  ['ordering/cancelar', 'cancel-order'],
  ['ordering/regalos', 'rewards'],
  ['ordering/calificar', 'rate'],
  ['restaurants/empezar', 'get-started'],
  ['restaurants/agotado', 'sold-out'],
  ['restaurants/pedidos', 'orders'],
  ['restaurants/verificar', 'verify'],
  ['restaurants/regalos', 'gifts'],
  ['restaurants/beneficios', 'earnings'],
  ['drivers/empezar', 'get-started'],
  ['drivers/verificar', 'verify'],
  ['drivers/ofertas', 'offers'],
  ['drivers/niveles', 'levels'],
  ['drivers/billetera', 'wallet'],
  ['trust/semaforo', 'traffic-light'],
  ['trust/verificacion', 'verification'],
  ['account/contrasena', 'password'],
  ['account/confirmar-correo', 'confirm-email'],
  ['account/borrar', 'delete'],
  ['account/soporte', 'support'],
]);

/**
 * La dirección nueva (en inglés) de una dirección vieja en español, o null si no es vieja.
 * Recibe la dirección sin prefijo de idioma: «/pais/brasil» → «/country/brazil».
 */
export function direccionNueva(ruta: string): string | null {
  const exacta = PAGINAS_VIEJAS.get(ruta);
  if (exacta) return exacta;
  const lugar = /^\/(pais|ciudad|comida)\/([a-z-]+)$/.exec(ruta);
  if (lugar?.[1] && lugar[2]) {
    const [, tipo, slug] = lugar;
    if (tipo === 'pais') return `/country/${PAISES_VIEJOS.get(slug) ?? slug}`;
    if (tipo === 'ciudad') return `/city/${slug}`;
    return `/food/${COMIDAS_VIEJAS.get(slug) ?? slug}`;
  }
  // Sin expresiones anidadas (lentas con direcciones raras): se parte por «/».
  const partes = ruta.startsWith('/docs/') ? ruta.slice(6).split('/') : [];
  if (partes.length >= 1 && partes.length <= 2 && partes.every((p) => /^[a-z-]+$/.test(p))) {
    const seccion = SECCIONES_VIEJAS.get(partes[0] ?? '');
    const g = partes[1];
    const guia = g && seccion ? (GUIAS_VIEJAS.get(`${seccion}/${g}`) ?? g) : g;
    if (!seccion) return null;
    return guia ? `/docs/${seccion}/${guia}` : `/docs/${seccion}`;
  }
  return null;
}

/** Dirección pública con su idioma: inglés sin prefijo, español bajo /es. */
export const enIdiomaDireccion = (ruta: string, idioma: 'es' | 'en') =>
  idioma === 'es' ? (ruta === '/' ? '/es' : `/es${ruta}`) : ruta;

/** Partes del panel que antes iban en español: «/panel/pedidos» → «/panel/orders». */
const PANEL_VIEJO = new Map([
  ['restaurante', 'restaurant'],
  ['empresa', 'company'],
  ['pedidos', 'orders'],
  ['beneficios', 'earnings'],
  ['regalos', 'gifts'],
  ['configuracion', 'settings'],
  ['franquicias', 'franchises'],
  ['ciudades', 'cities'],
  ['kyc', 'verifications'],
  ['clientes', 'customers'],
  ['restaurantes', 'restaurants'],
  ['dinero', 'money'],
  ['repartidores', 'drivers'],
  ['zonas', 'zones'],
  ['espera', 'waitlist'],
]);

/** La dirección nueva del panel, o null si ya está en inglés. */
export function panelNuevo(ruta: string): string | null {
  if (ruta !== '/panel' && !ruta.startsWith('/panel/')) return null;
  const partes = ruta
    .split('/')
    .map((p, i) =>
      i < 2
        ? p
        : p.startsWith('franquicia-')
          ? p.replace(/^franquicia-/, 'franchise-')
          : (PANEL_VIEJO.get(p) ?? p),
    );
  const nueva = partes.join('/');
  return nueva === ruta ? null : nueva;
}
