/**
 * C-INICIO-NUEVO (17 nov 2026, borrador aprobado por Richard) — todos los países. La lógica sin
 * pantalla del inicio del cliente: los ocho servicios en cuatro columnas (lo que no funciona en la
 * ciudad no se muestra, C-SOLO-LO-TERMINADO), cada uno abre su pantalla directa (sin pantallas
 * intermedias con «Abrir»), y la portada y las promociones vienen del administrador de banners
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
 * Lo que se pinta: Comida siempre (es la puerta de entrada), los demás solo si abren en la ciudad,
 * y «Más servicios» siempre al final (lleva lo secundario: regalos, viajes fijos, paquetes…).
 */
export function serviciosDelInicio(catalogo: ServicioCatalogo[] | null): ServicioCatalogo[] {
  const lista = catalogo ?? [];
  const porId = new Map(lista.map((s) => [s.id, s]));
  return SERVICIOS_INICIO.flatMap((id, i) => {
    if (id === 'mas') return [porId.get('mas') ?? sinEstado('mas', i)];
    if (id === 'comida') return [porId.get('comida') ?? sinEstado('comida', i)];
    const s = porId.get(id);
    return s && s.accion === 'abrir' ? [s] : [];
  });
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
  /** Imagen local del respaldo (heroe-moto, heroe-comida, heroe-mercado). */
  local?: 'heroe-moto' | 'heroe-comida' | 'heroe-mercado' | 'heroe-marca';
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
  return null;
}

/**
 * La portada de respaldo mientras el administrador de banners no tenga nada publicado para la
 * ciudad (o sin red): las tres del borrador. Sin descuentos ni códigos: el respaldo no promete nada
 * que no exista; las promociones salen solo de lo real (banners o cupones destacados).
 */
/**
 * C-BANNER-SIN-CORTES (18 nov 2026): lo más largo que cabe bien en la portada y en el carrusel de
 * promociones de un teléfono de 360 (dos o tres renglones). El superadmin no deja escribir más y
 * muestra el contador; el servidor tampoco lo acepta.
 */
export const TOPES_BANNER = { titulo: 45, texto: 70 } as const;

export const BANNERS_RESPALDO: Record<Idioma, BannerInicio[]> = {
  es: [
    {
      id: 'respaldo-moto',
      titulo: 'Tu carrera, te llevamos a donde quieras',
      texto: '',
      imagen: '',
      local: 'heroe-moto',
      destino: { tipo: 'servicio', valor: 'moto' },
      codigo: null,
    },
    {
      id: 'respaldo-comida',
      titulo: 'Tus pedidos favoritos, más cerca',
      texto: '',
      imagen: '',
      local: 'heroe-comida',
      destino: { tipo: 'servicio', valor: 'comida' },
      codigo: null,
    },
    {
      id: 'respaldo-mercado',
      titulo: 'Tu mercado en casa, en minutos',
      texto: '',
      imagen: '',
      local: 'heroe-mercado',
      destino: { tipo: 'servicio', valor: 'mercado' },
      codigo: null,
    },
  ],
  en: [
    {
      id: 'respaldo-moto',
      titulo: 'Your ride, anywhere you want to go',
      texto: '',
      imagen: '',
      local: 'heroe-moto',
      destino: { tipo: 'servicio', valor: 'moto' },
      codigo: null,
    },
    {
      id: 'respaldo-comida',
      titulo: 'Your favorite orders, closer',
      texto: '',
      imagen: '',
      local: 'heroe-comida',
      destino: { tipo: 'servicio', valor: 'comida' },
      codigo: null,
    },
    {
      id: 'respaldo-mercado',
      titulo: 'Your groceries at home, in minutes',
      texto: '',
      imagen: '',
      local: 'heroe-mercado',
      destino: { tipo: 'servicio', valor: 'mercado' },
      codigo: null,
    },
  ],
};

/**
 * La portada de respaldo que toca: una distinta cada vez que se abre la app (como el borrador), y
 * solo las de servicios que funcionan en la ciudad.
 */
export function portadaRespaldo(
  idioma: Idioma,
  vez: number,
  disponibles: (id: string) => boolean,
): BannerInicio {
  const todos = idioma === 'en' ? BANNERS_RESPALDO.en : BANNERS_RESPALDO.es;
  const lista = todos.filter((b) => !b.destino || disponibles(b.destino.valor));
  // C-PORTADA-SOLO-ABIERTOS: sin ningún servicio abierto (o mientras carga el catálogo), la portada
  // neutra de marca: nunca la de un servicio que la ciudad no tiene.
  if (!lista.length) return PORTADA_MARCA[idioma === 'en' ? 'en' : 'es'];
  return lista.at(((vez % lista.length) + lista.length) % lista.length) ?? lista[0]!;
}

/** C-PORTADA-SOLO-ABIERTOS: la portada de marca, sin destino (no promete ningún servicio). */
export const PORTADA_MARCA: Record<Idioma, BannerInicio> = {
  es: {
    id: 'respaldo-marca',
    titulo: 'Bienvenido a Divoox',
    texto: '',
    imagen: '',
    local: 'heroe-marca',
    destino: null,
    codigo: null,
  },
  en: {
    id: 'respaldo-marca',
    titulo: 'Welcome to Divoox',
    texto: '',
    imagen: '',
    local: 'heroe-marca',
    destino: null,
    codigo: null,
  },
};

/**
 * C-PORTADA-SOLO-ABIERTOS (18 nov 2026): los servicios que de verdad se pueden abrir en la ciudad,
 * leídos del catálogo (sin el relleno de la grilla, que pone Comida aunque la ciudad no la tenga).
 * Sin catálogo todavía: ninguno.
 */
export function serviciosAbiertos(catalogo: ServicioCatalogo[] | null): Set<string> {
  return new Set((catalogo ?? []).filter((s) => s.accion === 'abrir').map((s) => s.id));
}
