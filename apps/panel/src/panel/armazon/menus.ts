import {
  Flag,
  BadgePercent,
  Bike,
  BookOpen,
  Building,
  Building2,
  ChartColumn,
  Filter,
  ClipboardCheck,
  FileUp,
  FlaskConical,
  Gift,
  GalleryHorizontal,
  HandCoins,
  Handshake,
  Hourglass,
  IdCard,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  MessagesSquare,
  Map as IconoMapa,
  MapPinned,
  Megaphone,
  Navigation,
  Package,
  PiggyBank,
  UserPlus,
  Plug,
  Route,
  Send,
  Settings,
  SlidersHorizontal,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Star,
  Store,
  Tag,
  TriangleAlert,
  Trophy,
  Truck,
  Undo2,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { createElement } from 'react';
import type { Idioma } from '@tumbite/compartido';
import type { TEXTOS_PANEL } from '../textos';

/**
 * C-PANEL-ARMAZON: el ícono de cada sección de cualquier panel web. Un ítem de menú sin ícono no
 * existe: la clave que no está aquí cae en el ícono general y la prueba del candado lo delata.
 */
export const ICONOS_MENU = {
  // Comunes
  inicio: LayoutDashboard,
  home: LayoutDashboard,
  settings: Settings,
  flex: Truck,
  app: Smartphone,
  franchise: Building2,
  // Superadmin
  tickets: LifeBuoy,
  moderation: Flag,
  orders: ShoppingBag,
  franchises: Building2,
  cities: MapPinned,
  verifications: ShieldCheck,
  cash: HandCoins,
  customers: Users,
  restaurants: UtensilsCrossed,
  money: Wallet,
  flexfinance: Landmark,
  // C-CUPON-DIVOOX: los regalos que paga Divoox.
  'gift-codes': Gift,
  // C-SALDO-CONDUCTOR: el saldo de los conductores por ciudad.
  'driver-balance': PiggyBank,
  // C-AGENTE-DIVOOX: los agentes que pagan en efectivo y venden saldo.
  agents: Handshake,
  // C-REFERIDOS-EQUIPOS: referidos y equipos.
  referrals: UserPlus,
  // C-LINEAS-TAXI: las líneas de taxi y mototaxi.
  lines: Route,
  // C-CAMILA-BUZON: el buzón de Camila, la asistente de soporte.
  camila: MessagesSquare,
  approvals: ClipboardCheck,
  rides: Navigation,
  moto: Bike,
  drivers: IdCard,
  zones: IconoMapa,
  waitlist: Hourglass,
  reports: ChartColumn,
  // C-RASTRO: el embudo del registro.
  signups: Filter,
  team: UserCog,
  pilot: FlaskConical,
  'test-city': Building,
  rewards: Trophy,
  // C-BANNERS: los banners del inicio de la app.
  banners: GalleryHorizontal,
  configuration: SlidersHorizontal,
  // Restaurante
  restaurant: Store,
  company: Building2,
  menu: BookOpen,
  products: Package,
  earnings: Wallet,
  gifts: Gift,
  reviews: Star,
  ads: Megaphone,
  promotions: BadgePercent,
  fleet: Bike,
  // Divoox Flex
  shipments: Send,
  operativas: Route,
  labels: Tag,
  returns: Undo2,
  incidents: TriangleAlert,
  hubs: Warehouse,
  vehicles: Truck,
  profile: Building2,
  packages: Package,
  import: FileUp,
  operations: ChartColumn,
  integrations: Plug,
  wallet: Wallet,
  keys: KeyRound,
  // Franquicia
  territory: MapPinned,
  complaints: LifeBuoy,
} satisfies Record<string, LucideIcon>;

export type ClaveIcono = keyof typeof ICONOS_MENU;

export function iconoDe(clave: string): LucideIcon {
  return new Map<string, LucideIcon>(Object.entries(ICONOS_MENU)).get(clave) ?? LayoutDashboard;
}

/** El ícono de una sección, por su clave (un solo lugar para todos los menús y tarjetas). */
export function IconoDe({
  clave,
  tamano = 20,
  grosor = 1.9,
}: {
  clave: string;
  tamano?: number;
  grosor?: number;
}) {
  return createElement(iconoDe(clave), { size: tamano, strokeWidth: grosor, 'aria-hidden': true });
}

/**
 * C-AVISOS-MENU: lo que espera en esa sección (el número) y el tono del punto que palpita:
 * `trabajo` verde, `urgente` rojo. Sin pendientes, no se dibuja nada.
 */
export type PendienteItem = {
  cantidad: number;
  tono: 'trabajo' | 'urgente';
  /** Cuántas pasaron su límite (por qué el punto está rojo). */
  urgentes?: number;
};
export type ItemMenu = {
  clave: string;
  texto: string;
  a: string;
  activo?: boolean;
  pendiente?: PendienteItem;
};

/** Pone a cada ítem lo que espera en su sección (por su clave). */
export function conPendientes(
  grupos: GrupoMenu[],
  menu: ({ clave: string } & PendienteItem)[],
): GrupoMenu[] {
  if (!menu.length) return grupos;
  const por = new Map(menu.map((m) => [m.clave, m]));
  return grupos.map((g) => ({
    ...g,
    items: g.items.map((i) => {
      const m = por.get(i.clave);
      return m && m.cantidad > 0
        ? { ...i, pendiente: { cantidad: m.cantidad, tono: m.tono, urgentes: m.urgentes } }
        : i;
    }),
  }));
}
export type GrupoMenu = { titulo: string; items: ItemMenu[] };

type Textos = (typeof TEXTOS_PANEL)['es'];

const TITULOS = {
  es: {
    operacion: 'Operación',
    personas: 'Personas',
    dinero: 'Dinero',
    servicios: 'Servicios',
    territorio: 'Territorio',
    sistema: 'Sistema',
    negocio: 'Mi negocio',
    crecer: 'Ventas y marketing',
    ajustes: 'Ajustes',
    cuenta: 'Mi cuenta',
  },
  en: {
    operacion: 'Operations',
    personas: 'People',
    dinero: 'Money',
    servicios: 'Services',
    territorio: 'Territory',
    sistema: 'System',
    negocio: 'My business',
    crecer: 'Sales and marketing',
    ajustes: 'Settings',
    cuenta: 'My account',
  },
};
export const titulosGrupo = (idioma: Idioma) => (idioma === 'en' ? TITULOS.en : TITULOS.es);

/** Activo también en las fichas de detalle (/tickets/<id> deja resaltado «Tickets»). */
const activoEn = (ruta: string, destino: string, esInicio: boolean) =>
  ruta === destino || (!esInicio && ruta.startsWith(`${destino}/`));

function armar(
  orden: [string, string[]][],
  textos: Record<string, string>,
  raiz: string,
  ruta: string,
  oculto: (clave: string) => boolean,
): GrupoMenu[] {
  const mapa = new Map(Object.entries(textos));
  return orden
    .map(([titulo, claves]) => ({
      titulo,
      items: claves
        .filter((clave) => mapa.has(clave) && !oculto(clave))
        .map((clave) => {
          const a = clave === 'inicio' ? raiz : `${raiz}/${clave}`;
          return {
            clave,
            texto: mapa.get(clave) ?? clave,
            a,
            activo: activoEn(ruta, a, clave === 'inicio'),
          };
        }),
    }))
    .filter((g) => g.items.length > 0);
}

const ajustes = (t: Textos, idioma: Idioma, ruta: string): GrupoMenu => ({
  titulo: titulosGrupo(idioma).ajustes,
  items: [
    {
      clave: 'settings',
      texto: t.configuracion,
      a: '/panel/settings',
      activo: ruta === '/panel/settings',
    },
  ],
});

/** Menú del superadmin: lo de cada día arriba, las personas, el dinero, los servicios y el territorio. */
export function gruposAdmin(
  t: Textos,
  idioma: Idioma,
  raiz: string,
  ruta: string,
  conCiudadDePruebas: boolean,
): GrupoMenu[] {
  const g = titulosGrupo(idioma);
  return [
    ...armar(
      [
        [
          g.operacion,
          ['inicio', 'orders', 'tickets', 'camila', 'moderation', 'approvals', 'verifications'],
        ],
        [g.personas, ['customers', 'restaurants', 'drivers', 'lines', 'signups']],
        [
          g.dinero,
          [
            'money',
            'cash',
            'driver-balance',
            'agents',
            'referrals',
            'gift-codes',
            'flexfinance',
            'reports',
          ],
        ],
        [g.servicios, ['rides', 'moto', 'rewards', 'pilot', 'test-city']],
        [g.crecer, ['banners']],
        [g.territorio, ['franchises', 'cities', 'zones', 'waitlist']],
        // C-HORARIO-EMPLEADO: Configuración del superadmin (Horario; luego «Equipo interno»).
        // C-PERMISOS-FINOS: «Equipo interno» cuelga de Configuración.
        [g.sistema, ['configuration', 'team']],
      ],
      t.menuAdmin,
      raiz,
      ruta,
      (clave) => clave === 'test-city' && !conCiudadDePruebas,
    ),
    ajustes(t, idioma, ruta),
  ];
}

/** Menú del restaurante: el día a día, su negocio, su dinero y lo que le trae más ventas. */
export function gruposRestaurante(
  t: Textos,
  idioma: Idioma,
  ruta: string,
  conFlota: boolean,
): GrupoMenu[] {
  const g = titulosGrupo(idioma);
  return [
    ...armar(
      [
        [g.operacion, ['inicio', 'orders']],
        [g.negocio, ['restaurant', 'company', 'menu', 'products', 'team', 'fleet']],
        [g.dinero, ['earnings']],
        [g.crecer, ['promotions', 'ads', 'gifts', 'reviews']],
      ],
      t.menuRest,
      '/panel',
      ruta,
      (clave) => clave === 'fleet' && !conFlota,
    ),
    ajustes(t, idioma, ruta),
  ];
}

/** Menú de una cuenta sin panel propio (cliente, repartidor): su cuenta y la puerta a Divoox Flex. */
export function gruposCuenta(
  t: Textos,
  idioma: Idioma,
  ruta: string,
  miFranquicia: string | null,
): GrupoMenu[] {
  const items: ItemMenu[] = [
    { clave: 'inicio', texto: t.menuRest.inicio, a: '/panel', activo: ruta === '/panel' },
  ];
  if (miFranquicia)
    items.push({ clave: 'franchise', texto: t.miFranquicia, a: miFranquicia, activo: false });
  items.push({ clave: 'flex', texto: t.flex, a: '/panel/business', activo: false });
  return [{ titulo: titulosGrupo(idioma).cuenta, items }, ajustes(t, idioma, ruta)];
}
