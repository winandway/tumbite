import type { Idioma } from './idiomas';

/**
 * C-AVISOS-WEB (13 nov 2026) — todos los países, urgente para Venezuela. La parte del navegador de
 * los avisos de las apps instaladas desde la web (/app, /driver, /restaurant y el panel): saber si se
 * pueden pedir, pedir el permiso (solo tras un toque de la persona), suscribirse con el trabajador de
 * avisos de la app y darse de baja al cerrar sesión. La usan las tres apps (packages/movil) y el panel.
 * No se exporta desde el índice: el servidor no la necesita. Se importa con
 * `@tumbite/compartido/src/avisosWeb`.
 *
 * Presupuesto: mirar no escribe. El servidor solo recibe la suscripción cuando es nueva o cambió (se
 * recuerda en el navegador cuál se mandó por última vez para esa cuenta).
 */

export type EstadoAvisosWeb =
  /** No es un navegador (app nativa) o no hay servicio de avisos web en este sitio. */
  | 'no-aplica'
  /** El navegador no tiene avisos web. */
  | 'sin-soporte'
  /** iPhone o iPad en Safari sin agregar a la pantalla de inicio: ahí no existe el permiso. */
  | 'iphone-sin-inicio'
  | 'pedir'
  | 'permitido'
  | 'bloqueado';

/** Lo que mira la detección (inyectable para las pruebas). */
export type EntornoNavegador = {
  userAgent: string;
  maxTouchPoints: number;
  /** navigator.standalone (Safari) o display-mode: standalone. */
  instalada: boolean;
  tieneServiceWorker: boolean;
  tienePush: boolean;
  /** Notification.permission, o null si no existe Notification. */
  permiso: 'default' | 'granted' | 'denied' | null;
};

export function esIphone(e: Pick<EntornoNavegador, 'userAgent' | 'maxTouchPoints'>): boolean {
  // El iPad moderno se presenta como Mac: se reconoce por la pantalla táctil.
  return (
    /iPhone|iPad|iPod/.test(e.userAgent) || (/Macintosh/.test(e.userAgent) && e.maxTouchPoints > 1)
  );
}

export function estadoAvisosWeb(e: EntornoNavegador | null): EstadoAvisosWeb {
  if (!e) return 'no-aplica';
  // En iPhone (iOS 16.4 o superior) los avisos existen solo con la app agregada a inicio.
  if (esIphone(e) && !e.instalada) return 'iphone-sin-inicio';
  if (!e.tieneServiceWorker || !e.tienePush || e.permiso === null) return 'sin-soporte';
  if (e.permiso === 'granted') return 'permitido';
  if (e.permiso === 'denied') return 'bloqueado';
  return 'pedir';
}

export type AppWeb = 'cliente' | 'repartidor' | 'restaurante' | 'panel';
const BASES: readonly (readonly [string, AppWeb])[] = [
  ['/app', 'cliente'],
  ['/driver', 'repartidor'],
  ['/restaurant', 'restaurante'],
  ['/panel', 'panel'],
];

/** La carpeta de la app que está abierta («/app», «/driver», «/restaurant», «/panel») y su nombre. */
export function appDeRuta(ruta: string): { base: string; app: AppWeb } | null {
  for (const [base, app] of BASES)
    if (ruta === base || ruta.startsWith(`${base}/`)) return { base, app };
  return null;
}

export function bytesDeB64url(texto: string): Uint8Array<ArrayBuffer> {
  const s = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** La marca de «ya se mandó esta suscripción para esta cuenta» (evita escribir en cada visita). */
export const marcaSuscripcion = (usuarioId: string, endpoint: string) => `${usuarioId}|${endpoint}`;
export const LLAVE_MARCA = 'divoox.avisosWeb.enviada';
export const llaveDescartada = (usuarioId: string, app: AppWeb) =>
  `divoox.avisosWeb.ahoraNo.${app}.${usuarioId}`;

/** Lo mínimo de la API de la app que hace falta aquí. */
type ApiAvisos = {
  pedir: <T>(metodo: 'GET' | 'POST' | 'DELETE', ruta: string, cuerpo?: unknown) => Promise<T>;
};

type Almacen = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};
function almacen(): Almacen | null {
  try {
    return (globalThis as { localStorage?: Almacen }).localStorage ?? null;
  } catch {
    return null;
  }
}
export function leerLocal(k: string): string | null {
  try {
    return almacen()?.getItem(k) ?? null;
  } catch {
    return null;
  }
}
export function guardarLocal(k: string, v: string | null) {
  try {
    if (v === null) almacen()?.removeItem(k);
    else almacen()?.setItem(k, v);
  } catch {
    // Navegador privado o almacenamiento bloqueado: solo se pierde el recuerdo, nada más.
  }
}

/** El entorno real del navegador, o null fuera de un navegador. */
export function entornoActual(): EntornoNavegador | null {
  const g = globalThis as unknown as {
    navigator?: Navigator & { standalone?: boolean };
    window?: Window;
    Notification?: { permission: 'default' | 'granted' | 'denied' };
    PushManager?: unknown;
    matchMedia?: (q: string) => { matches: boolean };
  };
  if (!g.navigator || !g.window) return null;
  return {
    userAgent: g.navigator.userAgent ?? '',
    maxTouchPoints: g.navigator.maxTouchPoints ?? 0,
    instalada:
      g.navigator.standalone === true ||
      Boolean(g.matchMedia?.('(display-mode: standalone)').matches),
    tieneServiceWorker: 'serviceWorker' in g.navigator,
    tienePush: Boolean(g.PushManager),
    permiso: g.Notification ? g.Notification.permission : null,
  };
}

/** La llave pública VAPID: la compilada en la app o, si no vino, la que dice el servidor. */
async function llavePublica(api: ApiAvisos, compilada?: string): Promise<string | null> {
  if (compilada) return compilada;
  try {
    return (await api.pedir<{ llave: string | null }>('GET', '/datos/avisos-web/llave')).llave;
  } catch {
    return null;
  }
}

function rutaActual(): string {
  return (globalThis as { location?: { pathname: string } }).location?.pathname ?? '';
}

/**
 * Registra el trabajador de avisos de ESTA app (alcance en su carpeta), se suscribe y manda la
 * suscripción al servidor solo si es nueva para esta cuenta. Nunca pide permiso: eso lo hace
 * `activarAvisosWeb`, tras un toque.
 */
export async function suscribirAvisosWeb(
  api: ApiAvisos,
  usuarioId: string,
  llaveCompilada?: string,
): Promise<boolean> {
  const donde = appDeRuta(rutaActual());
  if (!donde || estadoAvisosWeb(entornoActual()) !== 'permitido') return false;
  const llave = await llavePublica(api, llaveCompilada);
  if (!llave) return false;
  const sw = (globalThis as unknown as { navigator: Navigator }).navigator.serviceWorker;
  const reg = await sw.register(`${donde.base}/avisos-sw.js`, { scope: `${donde.base}/` });
  const clave = bytesDeB64url(llave);
  let sub = await reg.pushManager.getSubscription();
  // Si la llave del sitio cambió, la suscripción vieja ya no sirve: se rehace.
  const anterior = sub?.options.applicationServerKey;
  if (sub && anterior && !iguales(new Uint8Array(anterior), clave)) {
    await sub.unsubscribe().catch(() => false);
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return false;
  const marca = marcaSuscripcion(usuarioId, j.endpoint);
  if (leerLocal(LLAVE_MARCA) === marca) return true;
  await api.pedir('POST', '/datos/avisos-web/suscripcion', {
    endpoint: j.endpoint,
    keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
    app: donde.app,
  });
  guardarLocal(LLAVE_MARCA, marca);
  return true;
}

function iguales(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((x, i) => x === b.at(i));
}

/**
 * Pide el permiso y suscribe. Llamarla SOLO dentro del toque de la persona (Safari exige que la
 * ventana del permiso salga de un gesto): por eso el permiso se pide primero, antes de cualquier
 * espera de red.
 */
export async function activarAvisosWeb(
  api: ApiAvisos,
  usuarioId: string,
  llaveCompilada?: string,
): Promise<EstadoAvisosWeb | 'error'> {
  const N = (globalThis as { Notification?: { requestPermission(): Promise<string> } })
    .Notification;
  if (!N) return 'sin-soporte';
  const permiso = await N.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'pedir';
  try {
    return (await suscribirAvisosWeb(api, usuarioId, llaveCompilada)) ? 'permitido' : 'error';
  } catch (e) {
    console.warn('avisos web: no se pudo suscribir', e);
    return 'error';
  }
}

/** Al cerrar sesión: este navegador deja de recibir los avisos de esa cuenta. Nunca lanza. */
export async function darDeBajaAvisosWeb(api: ApiAvisos): Promise<void> {
  try {
    const donde = appDeRuta(rutaActual());
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (!donde || !nav?.serviceWorker) return;
    const reg = await nav.serviceWorker.getRegistration(`${donde.base}/`);
    const sub = await reg?.pushManager.getSubscription();
    guardarLocal(LLAVE_MARCA, null);
    if (!sub) return;
    await api
      .pedir('DELETE', '/datos/avisos-web/suscripcion', { endpoint: sub.endpoint })
      .catch(() => undefined);
    await sub.unsubscribe().catch(() => false);
  } catch (e) {
    console.warn('avisos web: no se pudo dar de baja', e);
  }
}

/**
 * Al tocar un aviso: el trabajador abre la app con `?aviso=<datos>` o, si ya estaba abierta, le
 * manda un mensaje. Devuelve la función para dejar de escuchar.
 */
export function escucharToqueAvisoWeb(alTocar: (datos: Record<string, unknown>) => void) {
  const g = globalThis as unknown as {
    location?: Location;
    history?: History;
    navigator?: Navigator;
  };
  if (!g.location || !g.navigator) return () => undefined;
  try {
    const url = new URL(g.location.href);
    const crudo = url.searchParams.get('aviso');
    if (crudo) {
      url.searchParams.delete('aviso');
      g.history?.replaceState(null, '', url.pathname + url.search + url.hash);
      const datos = JSON.parse(crudo) as unknown;
      if (datos && typeof datos === 'object') alTocar(datos as Record<string, unknown>);
    }
  } catch {
    // Un enlace mal formado no rompe la app.
  }
  const sw = g.navigator.serviceWorker;
  if (!sw) return () => undefined;
  const oir = (ev: MessageEvent) => {
    const d = ev.data as { tipo?: string; datos?: Record<string, unknown> } | null;
    if (d?.tipo === 'aviso-tocado') alTocar(d.datos ?? {});
  };
  sw.addEventListener('message', oir);
  return () => sw.removeEventListener('message', oir);
}

const ES = {
  titulo: {
    restaurante: 'Entérate de cada pedido aunque la app esté cerrada',
    repartidor: 'Recibe las entregas nuevas aunque la app esté cerrada',
    cliente: 'Sigue tu pedido aunque cierres la app',
    panel: 'Entérate de cada pedido aunque el panel esté cerrado',
  },
  cuerpo: {
    restaurante:
      'Te avisamos en el celular o la computadora cuando entra un pedido pagado, para que lo aceptes a tiempo.',
    repartidor:
      'Te avisamos cuando hay una entrega para ti y cuando el pedido está listo para recoger.',
    cliente:
      'Te avisamos cuando el restaurante acepta tu pedido, cuando va en camino y cuando llega.',
    panel: 'Te avisamos cuando entra un pedido pagado, aunque estés en otra pestaña o programa.',
  },
  activar: 'Activar avisos',
  ahoraNo: 'Ahora no',
  iphone:
    'En iPhone, los avisos funcionan con Divoox agregada a tu pantalla de inicio: toca Compartir, luego «Agregar a inicio», y abre Divoox desde ese ícono.',
  bloqueado:
    'Los avisos están bloqueados en este navegador. Actívalos en la configuración del sitio (el candado junto a la dirección) y vuelve a abrir la app.',
  listo: 'Avisos activados.',
  fallo: 'No pudimos activar los avisos. Inténtalo otra vez en un momento.',
};
const EN: typeof ES = {
  titulo: {
    restaurante: 'Know about every order, even with the app closed',
    repartidor: 'Get new deliveries, even with the app closed',
    cliente: 'Follow your order, even if you close the app',
    panel: 'Know about every order, even with the panel closed',
  },
  cuerpo: {
    restaurante:
      'We’ll notify your phone or computer when a paid order comes in, so you can accept it on time.',
    repartidor: 'We’ll let you know when there’s a delivery for you and when an order is ready.',
    cliente:
      'We’ll let you know when the restaurant accepts your order, when it’s on the way, and when it arrives.',
    panel: 'We’ll notify you when a paid order comes in, even if you’re in another tab or program.',
  },
  activar: 'Turn on notifications',
  ahoraNo: 'Not now',
  iphone:
    'On iPhone, notifications work once Divoox is on your Home Screen: tap Share, then “Add to Home Screen,” and open Divoox from that icon.',
  bloqueado:
    'Notifications are blocked in this browser. Turn them on in the site settings (the lock next to the address) and reopen the app.',
  listo: 'Notifications are on.',
  fallo: 'We couldn’t turn on notifications. Try again in a moment.',
};
export const textosAvisosWeb = (i: Idioma) => (i === 'en' ? EN : ES);

/** El título y la explicación de la tarjeta para cada app (sin índices dinámicos). */
export function textoTarjetaAvisosWeb(i: Idioma, app: AppWeb): { titulo: string; cuerpo: string } {
  const t = textosAvisosWeb(i);
  const titulo = new Map(Object.entries(t.titulo)).get(app) ?? t.titulo.cliente;
  const cuerpo = new Map(Object.entries(t.cuerpo)).get(app) ?? t.cuerpo.cliente;
  return { titulo, cuerpo };
}
