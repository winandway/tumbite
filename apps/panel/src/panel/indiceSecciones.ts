import { type Idioma, textoPlano } from '@tumbite/compartido';
import type { GrupoMenu } from './armazon/menus';

/**
 * C-BUSCADOR-SECCIONES (19 nov 2026, Richard escribió «kyc» en el buscador de arriba y le salió «No
 * encontramos "kyc"»: quería llegar a la verificación de un conductor). Todos los países.
 *
 * El índice LOCAL de las secciones y acciones del superadmin: cada sección del menú con las palabras
 * que la gente usa para nombrarla, en español Y en inglés (se buscan las dos sin importar el idioma
 * de la pantalla), sin mirar acentos ni mayúsculas. No pide nada al servidor: sugiere desde la
 * primera letra, mientras se escribe. Solo devuelve secciones que estén en el menú que recibe, y ese
 * menú ya viene filtrado por los permisos de la cuenta (C-PERMISOS-FINOS): nadie ve aquí una sección
 * que no podría abrir.
 *
 * Candado: `buscadorSecciones.test.tsx` falla si una sección del menú se queda sin sinónimos o si
 * alguna no se encuentra por su nombre o por sus sinónimos.
 */

type Palabras = { es: readonly string[]; en: readonly string[] };

/**
 * Las palabras con que se nombra cada sección (además de su nombre en el menú, que siempre cuenta).
 * La clave es la del menú (`gruposAdmin` en armazon/menus.ts). Sin repetir el nombre del menú.
 */
export const SINONIMOS_SECCIONES: Readonly<Record<string, Palabras>> = {
  inicio: {
    es: ['inicio', 'tablero', 'resumen del día', 'portada'],
    en: ['home', 'dashboard', 'summary'],
  },
  orders: {
    es: ['pedidos', 'órdenes', 'monitoreo', 'en vivo', 'semáforo', 'atascados', 'comida'],
    en: ['orders', 'live', 'monitor', 'tracking', 'stuck'],
  },
  tickets: {
    es: ['soporte', 'quejas', 'reclamos', 'casos', 'ayuda al cliente', 'mensajes'],
    en: ['support', 'complaints', 'cases', 'help desk', 'inbox'],
  },
  camila: {
    es: ['asistente', 'chat de soporte', 'buzón', 'conversaciones'],
    en: ['assistant', 'support chat', 'conversations'],
  },
  moderation: {
    es: ['moderación', 'denuncias', 'reportados', 'contenido reportado', 'bloquear'],
    en: ['moderation', 'reports', 'reported', 'flagged', 'block'],
  },
  approvals: {
    es: [
      'aprobar',
      'aprobaciones',
      'pendientes de aprobar',
      'kyc',
      'verificación',
      'verificar',
      'documentos',
      'papeles',
      'identidad',
      'cédula',
      'licencia',
      'reembolsos',
      'solicitudes',
    ],
    en: [
      'approve',
      'pending approval',
      'kyc',
      'verification',
      'verify',
      'documents',
      'papers',
      'identity',
      'id card',
      'license',
      'refunds',
      'requests',
    ],
  },
  verifications: {
    es: [
      'kyc',
      'verificación',
      'verificar',
      'documentos',
      'papeles',
      'identidad',
      'cédula',
      'licencia',
      'selfie',
      'antecedentes',
      'conductores nuevos',
      'registro de conductores',
    ],
    en: [
      'kyc',
      'verification',
      'verify',
      'documents',
      'papers',
      'identity',
      'id card',
      'license',
      'selfie',
      'background check',
      'new drivers',
      'driver signup',
    ],
  },
  customers: {
    es: ['clientes', 'usuarios', 'compradores', 'pasajeros', 'cuentas'],
    en: ['customers', 'users', 'buyers', 'riders', 'accounts'],
  },
  restaurants: {
    es: ['restaurantes', 'comercios', 'tiendas', 'locales', 'negocios', 'aliados'],
    en: ['restaurants', 'stores', 'merchants', 'shops', 'businesses', 'partners'],
  },
  drivers: {
    es: ['repartidores', 'conductores', 'choferes', 'motorizados', 'flota', 'mensajeros'],
    en: ['drivers', 'couriers', 'dashers', 'fleet', 'riders'],
  },
  lines: {
    es: ['líneas', 'taxi', 'mototaxi', 'cooperativas', 'paradas'],
    en: ['lines', 'taxi', 'mototaxi', 'cooperatives', 'stands'],
  },
  money: {
    es: [
      'dinero',
      'pagos',
      'cobros',
      'comisiones',
      'liquidaciones',
      'conciliación',
      'tarifas de comida',
      'cupones',
      'disputas',
      'libro',
    ],
    en: [
      'money',
      'payments',
      'payouts',
      'commissions',
      'settlements',
      'reconciliation',
      'coupons',
      'disputes',
      'ledger',
    ],
  },
  cash: {
    es: ['efectivo', 'cobro en mano', 'pago móvil', 'evidencias de pago', 'comprobantes'],
    en: ['cash', 'paid in person', 'mobile payment', 'payment proof', 'receipts'],
  },
  signups: {
    es: [
      'embudo',
      'registro',
      'registros',
      'altas',
      'abandono',
      'dónde se quedan',
      'cuentas nuevas',
    ],
    en: ['funnel', 'sign-ups', 'signups', 'drop-off', 'new accounts', 'onboarding'],
  },
  'driver-balance': {
    es: ['saldo', 'recargas', 'recargar', 'billetera', 'ganancias de conductores', 'prepago'],
    en: ['balance', 'top-ups', 'top up', 'wallet', 'driver earnings', 'prepaid'],
  },
  agents: {
    es: ['agentes', 'puntos de venta', 'vender saldo', 'pagar en efectivo', 'tasa del día'],
    en: ['agents', 'sales points', 'sell balance', 'cash payouts', 'exchange rate'],
  },
  referrals: {
    es: ['referidos', 'invitaciones', 'equipos', 'líderes', 'códigos de invitación'],
    en: ['referrals', 'invites', 'teams', 'leaders', 'invite codes'],
  },
  'gift-codes': {
    es: ['regalos', 'cupones', 'códigos de regalo', 'promociones', 'descuentos', 'bonos'],
    en: ['gifts', 'coupons', 'gift codes', 'promotions', 'discounts', 'bonuses'],
  },
  flexfinance: {
    es: ['flex', 'empresas', 'logística', 'envíos de empresas', 'recargas de empresas'],
    en: ['flex', 'businesses', 'logistics', 'business shipments', 'business top-ups'],
  },
  reports: {
    es: ['informes', 'reportes', 'estadísticas', 'métricas', 'embudo', 'ventas'],
    en: ['reports', 'statistics', 'metrics', 'funnel', 'sales', 'analytics'],
  },
  rides: {
    es: ['viajes', 'carro', 'taxi', 'emergencias', 'tarifas', 'precios', 'pánico', 'viajes fijos'],
    en: ['rides', 'car', 'taxi', 'emergencies', 'fares', 'prices', 'panic', 'fixed rides'],
  },
  moto: {
    es: [
      'moto',
      'mototaxi',
      'tasa',
      'tasa del bolívar',
      'bolívares',
      'abrir moto',
      'aprobar motos',
    ],
    en: ['moto', 'motorbike', 'exchange rate', 'bolivar rate', 'bolivars', 'launch moto'],
  },
  rewards: {
    es: ['premios', 'recompensas', 'puntos', 'niveles', 'fidelidad'],
    en: ['rewards', 'points', 'tiers', 'loyalty', 'prizes'],
  },
  pilot: {
    es: ['piloto', 'prueba', 'participantes', 'topes'],
    en: ['pilot', 'trial', 'participants', 'caps'],
  },
  'test-city': {
    es: ['ciudad de pruebas', 'pruebas', 'demo', 'datos de prueba'],
    en: ['test city', 'testing', 'demo', 'sample data'],
  },
  banners: {
    es: ['banners', 'anuncios', 'portada de la app', 'imágenes', 'publicidad'],
    en: ['banners', 'ads', 'app home', 'images', 'advertising'],
  },
  franchises: {
    es: ['franquicias', 'franquiciados', 'socios', 'territorios vendidos'],
    en: ['franchises', 'franchisees', 'partners', 'territories'],
  },
  cities: {
    es: ['ciudades', 'países', 'abrir ciudad', 'lanzamiento', 'cobertura', 'moneda'],
    en: ['cities', 'countries', 'launch city', 'coverage', 'currency'],
  },
  zones: {
    es: ['zonas', 'áreas', 'mapa', 'polígonos', 'territorio', 'cobertura'],
    en: ['zones', 'areas', 'map', 'polygons', 'territory', 'coverage'],
  },
  waitlist: {
    es: ['lista de espera', 'espera', 'interesados', 'prospectos'],
    en: ['waitlist', 'waiting list', 'leads', 'prospects'],
  },
  configuration: {
    es: ['configuración', 'ajustes', 'horario', 'zona horaria', 'interruptores', 'opciones'],
    en: ['configuration', 'settings', 'schedule', 'time zone', 'switches', 'options'],
  },
  team: {
    es: ['equipo', 'empleados', 'personal', 'permisos', 'roles', 'accesos', 'soporte interno'],
    en: ['team', 'employees', 'staff', 'permissions', 'roles', 'access'],
  },
  settings: {
    es: ['mi cuenta', 'contraseña', 'idioma', 'perfil', 'segundo factor', 'seguridad'],
    en: ['my account', 'password', 'language', 'profile', 'two-factor', 'security'],
  },
};

/**
 * Acciones: lo que la gente quiere HACER, con el nombre de lo que hace. Cada una lleva a la sección
 * donde se hace (y desaparece si esa sección no está en su menú).
 */
export const ACCIONES_SECCIONES: readonly {
  id: string;
  seccion: string;
  texto: { es: string; en: string };
  palabras: Palabras;
}[] = [
  {
    id: 'aprobar-conductor',
    seccion: 'verifications',
    texto: { es: 'Revisar los papeles de un conductor', en: 'Review a driver’s documents' },
    palabras: {
      es: ['aprobar conductor', 'revisar papeles', 'ver papeles'],
      en: ['approve driver', 'review documents', 'see documents'],
    },
  },
  {
    id: 'recargar-saldo',
    seccion: 'driver-balance',
    texto: { es: 'Cargar saldo a un conductor', en: 'Add balance to a driver' },
    palabras: {
      es: ['cargar saldo', 'recargar saldo', 'dar saldo'],
      en: ['add balance', 'top up driver'],
    },
  },
  {
    id: 'cambiar-tasa',
    seccion: 'moto',
    texto: { es: 'Cambiar la tasa del bolívar', en: 'Change the bolívar rate' },
    palabras: { es: ['cambiar tasa', 'actualizar tasa'], en: ['change rate', 'update rate'] },
  },
  {
    id: 'cambiar-tarifas',
    seccion: 'rides',
    texto: { es: 'Cambiar las tarifas de los viajes', en: 'Change ride fares' },
    palabras: { es: ['cambiar tarifas', 'precio del viaje'], en: ['change fares', 'ride price'] },
  },
  {
    id: 'crear-cupon',
    seccion: 'gift-codes',
    texto: { es: 'Crear un cupón o código de regalo', en: 'Create a coupon or gift code' },
    palabras: {
      es: ['crear cupón', 'nuevo cupón', 'dar un regalo'],
      en: ['create coupon', 'new coupon', 'give a gift'],
    },
  },
  {
    id: 'agregar-empleado',
    seccion: 'team',
    texto: { es: 'Agregar a alguien al equipo', en: 'Add someone to the team' },
    palabras: {
      es: ['agregar empleado', 'invitar al equipo', 'dar permisos'],
      en: ['add employee', 'invite to team', 'grant permissions'],
    },
  },
  {
    id: 'abrir-ciudad',
    seccion: 'cities',
    texto: { es: 'Abrir una ciudad nueva', en: 'Launch a new city' },
    palabras: { es: ['abrir ciudad', 'nueva ciudad'], en: ['launch city', 'new city'] },
  },
  {
    id: 'dibujar-zona',
    seccion: 'zones',
    texto: { es: 'Dibujar o cambiar una zona', en: 'Draw or change a zone' },
    palabras: { es: ['dibujar zona', 'cambiar zona'], en: ['draw zone', 'change zone'] },
  },
  {
    id: 'responder-ticket',
    seccion: 'tickets',
    texto: { es: 'Responder un ticket de soporte', en: 'Answer a support ticket' },
    palabras: {
      es: ['responder ticket', 'contestar cliente'],
      en: ['answer ticket', 'reply to customer'],
    },
  },
];

/** La ayuda interna («?»): está para todo el equipo, aunque no esté en el menú. */
export const CLAVE_AYUDA = 'help';
const AYUDA: { texto: { es: string; en: string }; palabras: Palabras } = {
  texto: { es: 'Ayuda del equipo', en: 'Team help' },
  palabras: {
    es: ['ayuda', 'guías', 'cómo funciona', 'manual', 'tutorial'],
    en: ['help', 'guides', 'how it works', 'manual', 'tutorial'],
  },
};

export type SeccionEncontrada = {
  /** Única entre las encontradas (la clave del menú o «accion-<id>»). */
  clave: string;
  /** La clave del menú (para el ícono). */
  icono: string;
  texto: string;
  /** El grupo del menú donde vive («Operación», «Dinero»…). */
  grupo: string;
  a: string;
  /** La palabra que coincidió cuando no es el nombre («kyc» → Verificaciones). */
  porque: string | null;
};

type Candidata = Omit<SeccionEncontrada, 'porque'> & {
  orden: number;
  nombre: string;
  palabras: string[];
};

const palabrasDe = (frase: string) =>
  textoPlano(frase)
    .split(/[^a-z0-9ñ]+/)
    .filter(Boolean);

/** Cuánto se parece `q` (ya plano) a una frase: 0 si nada. */
function puntaje(frase: string, q: string): number {
  const f = textoPlano(frase);
  if (f === q) return 100;
  if (f.startsWith(q)) return 80;
  const ws = palabrasDe(f);
  const qs = palabrasDe(q);
  if (qs.length && qs.every((x) => ws.some((w) => w.startsWith(x)))) return 60;
  if (q.length >= 3 && f.includes(q)) return 40;
  return 0;
}

/** Todas las secciones del menú que recibe (ya con sus permisos), más sus acciones y la ayuda. */
function candidatas(grupos: GrupoMenu[], idioma: Idioma, base: string): Candidata[] {
  const lista: Candidata[] = [];
  const mapa = new Map(Object.entries(SINONIMOS_SECCIONES));
  const enMenu = new Map<string, { a: string; grupo: string; texto: string }>();
  let orden = 0;
  for (const g of grupos)
    for (const i of g.items) {
      enMenu.set(i.clave, { a: i.a, grupo: g.titulo, texto: i.texto });
      const s = mapa.get(i.clave);
      lista.push({
        clave: i.clave,
        icono: i.clave,
        texto: i.texto,
        grupo: g.titulo,
        a: i.a,
        orden: orden++,
        nombre: i.texto,
        palabras: s ? [...s.es, ...s.en] : [],
      });
    }
  for (const x of ACCIONES_SECCIONES) {
    const donde = enMenu.get(x.seccion);
    if (!donde) continue;
    lista.push({
      clave: `accion-${x.id}`,
      icono: x.seccion,
      texto: idioma === 'en' ? x.texto.en : x.texto.es,
      grupo: donde.texto,
      a: donde.a,
      orden: orden++,
      nombre: idioma === 'en' ? x.texto.en : x.texto.es,
      palabras: [x.texto.es, x.texto.en, ...x.palabras.es, ...x.palabras.en],
    });
  }
  if (base && base !== '/panel')
    lista.push({
      clave: CLAVE_AYUDA,
      icono: 'inicio',
      texto: idioma === 'en' ? AYUDA.texto.en : AYUDA.texto.es,
      grupo: '',
      a: `${base}/help`,
      orden,
      nombre: idioma === 'en' ? AYUDA.texto.en : AYUDA.texto.es,
      palabras: [AYUDA.texto.es, AYUDA.texto.en, ...AYUDA.palabras.es, ...AYUDA.palabras.en],
    });
  return lista;
}

/** Cuántas secciones se muestran como mucho en «Ir a…». */
export const SECCIONES_A_MOSTRAR = 6;

/**
 * Las secciones y acciones que coinciden con lo escrito, la mejor primero. Coincide el nombre del
 * menú (cuenta un poco más) o cualquiera de sus palabras, en los dos idiomas; desde la primera letra.
 */
export function buscarSecciones(
  grupos: GrupoMenu[],
  q: string,
  idioma: Idioma,
  base = '',
  tope = SECCIONES_A_MOSTRAR,
): SeccionEncontrada[] {
  const plano = textoPlano(q.trim().replace(/\s+/g, ' '));
  if (!plano) return [];
  return candidatas(grupos, idioma, base)
    .map((c) => {
      const delNombre = puntaje(c.nombre, plano);
      let mejor = delNombre ? delNombre + 5 : 0;
      let porque: string | null = null;
      // A igual coincidencia, gana la sección donde esa palabra va más arriba en su lista («kyc» es
      // lo primero de Verificaciones y lo cuarto de Para aprobar).
      for (const [i, p] of c.palabras.entries()) {
        const bruto = puntaje(p, plano);
        const n = bruto ? bruto - i / 100 : 0;
        if (n > mejor) {
          mejor = n;
          porque = p;
        }
      }
      return { c, mejor, porque };
    })
    .filter((x) => x.mejor > 0)
    .sort((x, y) => y.mejor - x.mejor || x.c.orden - y.c.orden)
    .slice(0, tope)
    .map(({ c, porque }) => ({
      clave: c.clave,
      icono: c.icono,
      texto: c.texto,
      grupo: c.grupo,
      a: c.a,
      porque,
    }));
}

/** Distancia de edición (para «quizás buscabas…» con una letra cambiada, de más o de menos). */
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++)
      fila.push(
        Math.min(
          (previa.at(j) ?? 0) + 1,
          (fila.at(j - 1) ?? 0) + 1,
          (previa.at(j - 1) ?? 0) + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1),
        ),
      );
    previa = fila;
  }
  return previa.at(b.length) ?? 99;
}

/** Las secciones que se muestran siempre que no hay nada mejor (las de cada día). */
const DE_CADA_DIA = ['orders', 'verifications', 'drivers', 'customers', 'tickets'];

/**
 * C-BUSCADOR-SECCIONES: cuando de verdad no hay resultados, nunca un callejón sin salida. Primero
 * las secciones con una palabra parecida (una o dos letras distintas: «verifcacion», «recarags»);
 * si no hay ninguna, las de cada día que esa cuenta puede abrir.
 */
export function seccionesParecidas(
  grupos: GrupoMenu[],
  q: string,
  idioma: Idioma,
  base = '',
  tope = 4,
): SeccionEncontrada[] {
  const plano = textoPlano(q.trim());
  const todas = candidatas(grupos, idioma, base);
  const parecidas =
    plano.length >= 3
      ? todas
          .map((c) => {
            const margen = plano.length >= 7 ? 2 : 1;
            let mejor = 99;
            let porque: string | null = null;
            for (const p of [c.nombre, ...c.palabras]) {
              const candidatasPalabra = [textoPlano(p), ...palabrasDe(p)];
              for (const w of candidatasPalabra) {
                const d = distancia(plano, w);
                if (d < mejor) {
                  mejor = d;
                  porque = p === c.nombre ? null : p;
                }
              }
            }
            return { c, mejor: mejor <= margen ? mejor : 99, porque };
          })
          .filter((x) => x.mejor < 99)
          .sort((x, y) => x.mejor - y.mejor || x.c.orden - y.c.orden)
      : [];
  const elegidas = parecidas.length
    ? parecidas.map(({ c, porque }) => ({ c, porque }))
    : DE_CADA_DIA.flatMap((k) => {
        const c = todas.find((x) => x.clave === k);
        return c ? [{ c, porque: null }] : [];
      });
  return elegidas.slice(0, tope).map(({ c, porque }) => ({
    clave: c.clave,
    icono: c.icono,
    texto: c.texto,
    grupo: c.grupo,
    a: c.a,
    porque,
  }));
}
