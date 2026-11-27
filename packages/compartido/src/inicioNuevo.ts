/**
 * C-INICIO-NUEVO (17 nov 2026, borrador aprobado por Richard) — todos los países. La lógica sin
 * pantalla del inicio del cliente: los ocho servicios en cuatro columnas, SIEMPRE los ocho
 * (C-OCHO-ICONOS-SIEMPRE, 18 nov 2026: lo cerrado en la ciudad abre la hoja «aún no hay»), cada uno
 * abierto va a su pantalla directa (sin pantallas intermedias con «Abrir»), y la portada y las promociones vienen del administrador de banners
 * (GET /datos/banners), con un respaldo local que no promete descuentos.
 * Borrador: progreso/borrador-inicio/index.html; capturas en docs/disenos/borrador-inicio/.
 */
import type { Idioma } from './idiomas';
import type { ServicioCatalogo } from './servicios';

/** El orden del borrador (cuatro columnas, dos filas). */
export const SERVICIOS_INICIO = [
  'comida',
  'mercado',
  'farmacia',
  'licores',
  'carro',
  'moto',
  'envios',
  'mas',
] as const;
export type ServicioInicio = (typeof SERVICIOS_INICIO)[number];

const sinEstado = (id: ServicioInicio, orden: number): ServicioCatalogo => ({
  id,
  nombre: id,
  descripcion: '',
  icono: `servicio-${id}`,
  orden,
  estado: 'disponible',
  accion: 'abrir',
});

/**
 * C-OCHO-ICONOS-SIEMPRE (18 nov 2026, orden de Richard sobre el borrador aprobado): se pintan SIEMPRE
 * los ocho, en el orden del borrador, en cualquier ciudad y país, con o sin cuenta y aunque el
 * catálogo no haya llegado. Lo que está cerrado en la zona no se esconde: al tocarlo abre la hoja
 * «En esta zona aún no hay…» (`accionDeServicio`). «Más servicios» lleva lo secundario.
 */
export function serviciosDelInicio(catalogo: ServicioCatalogo[] | null): ServicioCatalogo[] {
  const porId = new Map((catalogo ?? []).map((s) => [s.id, s]));
  return SERVICIOS_INICIO.map((id, i) => porId.get(id) ?? sinEstado(id, i));
}

/**
 * C-PORTADA-SOLO-ABIERTOS: los servicios que de verdad se pueden abrir en la ciudad, leídos del
 * catálogo (nunca del relleno de la cuadrícula). Sin catálogo todavía: ninguno.
 */
export function serviciosAbiertos(catalogo: ServicioCatalogo[] | null): Set<string> {
  return new Set((catalogo ?? []).filter((s) => s.accion === 'abrir').map((s) => s.id));
}

/** Qué pasa al tocar un servicio de la cuadrícula. */
export type AccionInicio =
  | { tipo: 'navegar'; ruta: RutaApp }
  | { tipo: 'mas' }
  | { tipo: 'aun_no_hay'; servicio: ServicioInicio };

/**
 * C-OCHO-ICONOS-SIEMPRE: abierto en la zona → su pantalla, como antes; cerrado → la hoja «aún no hay»
 * (nunca una pantalla en blanco ni un error). Sin catálogo (sin red) no se afirma que no hay: se
 * navega y esa pantalla vuelve a preguntar.
 */
export function accionDeServicio(id: string, catalogo: ServicioCatalogo[] | null): AccionInicio {
  const ruta = rutaDeServicio(id);
  if (!ruta) return { tipo: 'mas' };
  if (catalogo && !serviciosAbiertos(catalogo).has(id))
    return { tipo: 'aun_no_hay', servicio: id as ServicioInicio };
  return { tipo: 'navegar', ruta };
}

/** A dónde va cada servicio: su pantalla directa (expo-router). «Más» abre su hoja (null). */
export type RutaApp = { pathname: string; params?: Record<string, string> };
export function rutaDeServicio(id: string): RutaApp | null {
  if (id === 'comida') return { pathname: '/restaurants' };
  if (id === 'moto' || id === 'carro' || id === 'envios')
    return { pathname: '/ride', params: { servicio: id } };
  if (id === 'mercado' || id === 'farmacia' || id === 'licores')
    return { pathname: '/stores', params: { servicio: id } };
  return null;
}

/** Desde cuántos usos se reordena por lo que más usa la persona (pantalla 2 del borrador). */
export const USOS_PARA_ORDENAR = 3;
export function ordenarPorUso(
  lista: ServicioCatalogo[],
  usos: Record<string, number>,
): { lista: ServicioCatalogo[]; ordenado: boolean } {
  const uso = new Map(Object.entries(usos));
  const total = [...uso.values()].reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
  if (total < USOS_PARA_ORDENAR) return { lista, ordenado: false };
  const mas = lista.filter((s) => s.id === 'mas');
  const resto = lista
    .filter((s) => s.id !== 'mas')
    .map((s, i) => ({ s, i, n: uso.get(s.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.s);
  return { lista: [...resto, ...mas], ordenado: true };
}

// ───────────────────────────── Banners ─────────────────────────────

export type LugarBanner = 'cabecera' | 'promociones';
export type DestinoBanner = { tipo: string; valor: string };
export type BannerInicio = {
  id: string;
  titulo: string;
  texto: string;
  /** Dirección de la imagen del servidor, o vacía (el respaldo usa su imagen local por `local`). */
  imagen: string;
  /** Imagen local de las cabeceras de marca (assets/inicio-nuevo/heroe-*). */
  local?: ImagenCabecera;
  destino: DestinoBanner | null;
  codigo: string | null;
};

export function rutaBanners(
  lugar: LugarBanner,
  op: { ciudad?: string | null; idioma: Idioma; excluir?: string | null },
): string {
  const p = new URLSearchParams({ lugar, idioma: op.idioma });
  if (op.ciudad) p.set('ciudad', op.ciudad);
  if (op.excluir) p.set('excluir', op.excluir);
  return `/datos/banners?${p.toString()}`;
}

const texto = (x: unknown) => (typeof x === 'string' ? x : '');
/** Lee un banner del servidor con cuidado: lo que viene roto se descarta, nunca rompe el inicio. */
export function leerBanner(x: unknown): BannerInicio | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const id = texto(o.id);
  const titulo = texto(o.titulo).trim();
  if (!id || !titulo) return null;
  const d = o.destino as Record<string, unknown> | null | undefined;
  const destino =
    d && typeof d === 'object' && texto(d.tipo) && texto(d.valor)
      ? { tipo: texto(d.tipo), valor: texto(d.valor) }
      : null;
  return {
    id,
    titulo,
    texto: texto(o.texto),
    imagen: texto(o.imagen),
    destino,
    codigo: texto(o.codigo) || null,
  };
}

export function destinoDeBanner(b: BannerInicio): RutaApp | null {
  const d = b.destino;
  if (!d) return null;
  if (d.tipo === 'servicio') return rutaDeServicio(d.valor);
  if (d.tipo === 'restaurante') return { pathname: `/restaurant/${d.valor}` };
  if (d.tipo === 'tienda') return { pathname: `/store/${d.valor}` };
  if (d.tipo === 'cupon') return { pathname: '/notifications', params: { tab: 'regalos' } };
  // C-CABECERAS-MARCA: pantallas que no son un servicio (el saldo y las ferreterías, en «Más»).
  if (d.tipo === 'pantalla' && d.valor === 'billetera') return { pathname: '/gift-cards' };
  if (d.tipo === 'pantalla' && d.valor === 'ferreteria')
    return { pathname: '/stores', params: { servicio: 'mas' } };
  return null;
}

/**
 * C-BANNER-SIN-CORTES (18 nov 2026): lo más largo que cabe bien en la portada y en el carrusel de
 * promociones de un teléfono de 360 (dos o tres renglones). El superadmin no deja escribir más y
 * muestra el contador; el servidor tampoco lo acepta.
 */
export const TOPES_BANNER = { titulo: 45, texto: 70 } as const;

/**
 * C-CABECERAS-MARCA (27 nov 2026, orden de Richard vía Gerencia) — todos los países. Las diez
 * cabeceras de marca: todo lo que hace Divoox, cada una con su imagen (assets/inicio-nuevo/heroe-*,
 * fuentes y licencia en docs/disenos/cabeceras-27nov/FUENTES.md). Salen cuando el administrador de
 * banners no tiene una cabecera nueva para mostrar, y rotan: cada apertura, una distinta a la última.
 * `requiere`: los servicios que tienen que estar abiertos en la ciudad para que salga (basta uno);
 * vacío = no promete ningún servicio y sale en todas partes. Sin descuentos ni códigos: no prometen
 * nada que no exista (C-CABECERA-SOLO-ABIERTOS).
 */
export type CabeceraMarca = BannerInicio & { local: ImagenCabecera; requiere: readonly string[] };
export type ImagenCabecera =
  | 'heroe-moto'
  | 'heroe-carro'
  | 'heroe-comida'
  | 'heroe-mercado'
  | 'heroe-farmacia'
  | 'heroe-licores'
  | 'heroe-ferreteria'
  | 'heroe-envios'
  | 'heroe-billetera'
  | 'heroe-aliados';

/** Todo lo que se puede pedir: el saldo sirve para pagar cualquiera de ellos. */
const CUALQUIER_SERVICIO = [
  'comida',
  'mercado',
  'farmacia',
  'licores',
  'carro',
  'moto',
  'envios',
  'mas',
] as const;

const MARCA: {
  id: string;
  local: ImagenCabecera;
  requiere: readonly string[];
  destino: DestinoBanner | null;
  es: string;
  en: string;
}[] = [
  {
    id: 'marca-moto',
    local: 'heroe-moto',
    requiere: ['moto'],
    destino: { tipo: 'servicio', valor: 'moto' },
    es: 'Tu mototaxi llega en minutos',
    en: 'Your motorcycle ride, in minutes',
  },
  {
    id: 'marca-comida',
    local: 'heroe-comida',
    requiere: ['comida'],
    destino: { tipo: 'servicio', valor: 'comida' },
    es: 'Tus pedidos favoritos, más cerca',
    en: 'Your favorite orders, closer',
  },
  {
    id: 'marca-carro',
    local: 'heroe-carro',
    requiere: ['carro'],
    destino: { tipo: 'servicio', valor: 'carro' },
    es: 'Viaja cómodo en carro, a donde quieras',
    en: 'Ride in comfort, wherever you go',
  },
  {
    id: 'marca-mercado',
    local: 'heroe-mercado',
    requiere: ['mercado'],
    destino: { tipo: 'servicio', valor: 'mercado' },
    es: 'Tu mercado en casa, en minutos',
    en: 'Your groceries at home, in minutes',
  },
  {
    id: 'marca-envios',
    local: 'heroe-envios',
    requiere: ['envios'],
    destino: { tipo: 'servicio', valor: 'envios' },
    es: 'Envía lo que necesites, hoy mismo',
    en: 'Send what you need, today',
  },
  {
    id: 'marca-farmacia',
    local: 'heroe-farmacia',
    requiere: ['farmacia'],
    destino: { tipo: 'servicio', valor: 'farmacia' },
    es: 'Lo de la farmacia, directo a tu puerta',
    en: 'Pharmacy essentials, right to your door',
  },
  {
    id: 'marca-billetera',
    local: 'heroe-billetera',
    requiere: CUALQUIER_SERVICIO,
    destino: { tipo: 'pantalla', valor: 'billetera' },
    es: 'Paga con tu saldo Divoox en un toque',
    en: 'Pay with your Divoox balance in one tap',
  },
  {
    id: 'marca-ferreteria',
    local: 'heroe-ferreteria',
    requiere: ['mas'],
    destino: { tipo: 'pantalla', valor: 'ferreteria' },
    es: 'Herramientas y materiales para tu obra',
    en: 'Tools and supplies for every project',
  },
  {
    id: 'marca-licores',
    local: 'heroe-licores',
    requiere: ['licores'],
    destino: { tipo: 'servicio', valor: 'licores' },
    es: 'Tus bebidas para la ocasión, a domicilio',
    en: 'Drinks for every occasion, delivered',
  },
  {
    id: 'marca-aliados',
    local: 'heroe-aliados',
    requiere: [],
    destino: null,
    es: 'Comercios aliados que crecen con Divoox',
    en: 'Local businesses growing with Divoox',
  },
];

export const CABECERAS_MARCA: Record<Idioma, CabeceraMarca[]> = {
  es: MARCA.map((m) => ({
    id: m.id,
    titulo: m.es,
    texto: '',
    imagen: '',
    local: m.local,
    destino: m.destino,
    codigo: null,
    requiere: m.requiere,
  })),
  en: MARCA.map((m) => ({
    id: m.id,
    titulo: m.en,
    texto: '',
    imagen: '',
    local: m.local,
    destino: m.destino,
    codigo: null,
    requiere: m.requiere,
  })),
};

/**
 * C-CABECERA-SOLO-ABIERTOS: ¿esta cabecera se puede mostrar en la ciudad? Solo si alguno de los
 * servicios que anuncia está abierto ahí (también Comida: donde no hay restaurantes, no se promete).
 */
export const cabeceraAbierta = (c: { requiere: readonly string[] }, abiertos: Set<string>) =>
  c.requiere.length === 0 || c.requiere.some((s) => abiertos.has(s));

/**
 * C-CABECERA-ROTA: la cabecera de marca que toca al abrir la app. Recorre la lista en orden, desde la
 * que se vio la última vez (guardada en el teléfono, nada en la base): sale la SIGUIENTE que esté
 * abierta en la ciudad, así dos aperturas seguidas nunca repiten y todas tienen su turno. Si solo
 * queda una posible, sale esa.
 */
export function cabeceraDeMarca(
  idioma: Idioma,
  ultima: string | null,
  abiertos: Set<string>,
): CabeceraMarca {
  const todas = idioma === 'en' ? CABECERAS_MARCA.en : CABECERAS_MARCA.es;
  const desde = todas.findIndex((c) => c.id === ultima);
  for (let paso = 1; paso <= todas.length; paso++) {
    const c = todas.at((desde + paso) % todas.length);
    if (c && c.id !== ultima && cabeceraAbierta(c, abiertos)) return c;
  }
  // Ninguna otra abierta: la última otra vez si se puede, y si no, la que no promete nada.
  return (
    todas.find((c) => c.id === ultima && cabeceraAbierta(c, abiertos)) ??
    todas.find((c) => c.requiere.length === 0) ??
    todas[0]!
  );
}
