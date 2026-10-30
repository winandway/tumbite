import type { Activacion } from './activacion';
import { z } from 'zod';

/** Restaurantes y platos. Los textos que ve el público van en español e inglés. */

export const PLANES = ['inicial', 'crece', 'elite'] as const;
export type Plan = (typeof PLANES)[number];
export const ESTADOS_RESTAURANTE = ['pendiente', 'aprobado', 'pausado', 'rechazado'] as const;
export type EstadoRestaurante = (typeof ESTADOS_RESTAURANTE)[number];

const texto = (max: number) => z.string().trim().max(max);

/** Solo fotos subidas a nuestro almacén: nada de enlaces a sitios ajenos. */
export const RUTA_FOTO = /^\/media\/fotos\/[a-z0-9-]{1,64}\/[a-z0-9-]{1,64}\.(webp|jpg|png)$/;
const foto = z
  .string()
  .regex(RUTA_FOTO, { error: 'Esa foto no es válida. Vuelve a subirla.' })
  .nullable()
  .default(null);

export const esquemaMiRestaurante = z.object({
  nombre: z.string().trim().min(2, { error: 'Escribe el nombre del restaurante.' }).max(80),
  descripcionEs: texto(400).default(''),
  descripcionEn: texto(400).default(''),
  categoria: texto(40).default(''),
  telefono: texto(30).default(''),
  direccion: z.string().trim().min(5, { error: 'Escribe la dirección del restaurante.' }).max(200),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  tiempoPrepMin: z.number().int().min(5).max(120).default(20),
  imagen: foto,
});
export type DatosMiRestaurante = z.input<typeof esquemaMiRestaurante>;

const texto40 = z.string().trim().max(40);
export const esquemaGrupos = z.object({
  grupos: z
    .array(
      z.object({
        nombreEs: z.string().trim().min(1, { error: 'Escribe el nombre del grupo.' }).max(40),
        nombreEn: texto40.default(''),
        minimo: z.number().int().min(0).max(20).default(0),
        maximo: z.number().int().min(1).max(20).default(1),
        opciones: z
          .array(
            z.object({
              nombreEs: z
                .string()
                .trim()
                .min(1, { error: 'Escribe el nombre de la opción.' })
                .max(60),
              nombreEn: z.string().trim().max(60).default(''),
              // El tope real depende del país del restaurante (C-TOPES-PAIS; EE. UU.: 100 dólares).
              precioCentavos: z.number().int().min(0).max(100_000_00).default(0),
              disponible: z.boolean().default(true),
            }),
          )
          .min(1, { error: 'Cada grupo necesita al menos una opción.' })
          .max(30),
      }),
    )
    .max(10),
});
export type DatosGrupos = z.input<typeof esquemaGrupos>;

export const esquemaHorarios = z.object({
  turnos: z
    .array(
      z.object({
        dia: z.number().int().min(0).max(6),
        abre: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Hora como 09:30.' }),
        cierra: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Hora como 22:00.' }),
      }),
    )
    .max(21),
});

/**
 * C-FILTROS-DIETA (29 oct 2026, como DoorDash y Uber Eats): marcas cerradas de cada plato. El
 * restaurante las elige; el cliente las ve en el menú y filtra el buscador por ellas.
 */
export const ETIQUETAS_DIETA = ['vegetariano', 'vegano', 'sin_gluten', 'halal', 'picante'] as const;
export type EtiquetaDieta = (typeof ETIQUETAS_DIETA)[number];
const NOMBRES_DIETA = new Map<EtiquetaDieta, { es: string; en: string }>([
  ['vegetariano', { es: 'Vegetariano', en: 'Vegetarian' }],
  ['vegano', { es: 'Vegano', en: 'Vegan' }],
  ['sin_gluten', { es: 'Sin gluten', en: 'Gluten-free' }],
  ['halal', { es: 'Halal', en: 'Halal' }],
  ['picante', { es: 'Picante', en: 'Spicy' }],
]);
/** El nombre visible de una marca en el idioma pedido. */
export function nombreEtiquetaDieta(e: EtiquetaDieta, idioma: 'es' | 'en'): string {
  const n = NOMBRES_DIETA.get(e);
  return n ? (idioma === 'en' ? n.en : n.es) : e;
}
/** Las marcas válidas de un texto guardado («vegano,halal»), sin repetir y en el orden fijo. */
export function leerEtiquetasDieta(valor: unknown): EtiquetaDieta[] {
  const dadas = new Set(String(valor ?? '').split(','));
  return ETIQUETAS_DIETA.filter((e) => dadas.has(e));
}

export const esquemaPlato = z.object({
  nombreEs: z.string().trim().min(2, { error: 'Escribe el nombre del plato.' }).max(80),
  nombreEn: texto(80).default(''),
  descripcionEs: texto(300).default(''),
  descripcionEn: texto(300).default(''),
  categoria: texto(40).default(''),
  categoriaEn: texto(40).default(''),
  precioCentavos: z.number().int({ error: 'El precio va en centavos.' }).min(0).max(100_000_00),
  disponible: z.boolean().default(true),
  imagen: foto,
  /** Solo para mayores de 21 (alcohol): se entrega en mano con documento revisado. */
  requiereEdad: z.boolean().default(false),
  /** C-FILTROS-DIETA: sin repetir y en el orden fijo de la lista. */
  etiquetas: z
    .array(z.enum(ETIQUETAS_DIETA))
    .max(ETIQUETAS_DIETA.length * 2)
    .default([])
    .transform((l) => leerEtiquetasDieta(l.join(','))),
});
export type DatosPlato = z.input<typeof esquemaPlato>;

export type Restaurante = {
  id: string;
  nombre: string;
  /** Horarios por día; sin turnos, manda solo el botón de abrir/pausar. */
  horarios?: { dia: number; abre: string; cierra: string }[];
  zonaHoraria?: string;
  /** Abierto de verdad: el botón encendido Y dentro del horario. */
  abiertoAhora?: boolean;
  descripcionEs: string;
  descripcionEn: string;
  categoria: string;
  telefono: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  imagen: string | null;
  plan: Plan;
  estado: EstadoRestaurante;
  abierto: boolean;
  tiempoPrepMin: number;
  /** C-ACEPTAR-SOLO: los pedidos se aceptan solos al pagarse. */
  aceptarSolo?: boolean;
  regalosPb: number;
  distanciaKm?: number;
  /** C-MONEDA-RECORRIDO: moneda de su zona (USD, COP…). Los precios van en su unidad menor. */
  moneda?: string;
  /**
   * C-CALIFICACION-PUBLICA: promedio de 1 a 5 y número de opiniones de pedidos verificados. Llega
   * solo con 10 opiniones o más (como DoorDash y Uber Eats); antes, null y la app dice «Nuevo».
   */
  calificacion?: { promedio: number; total: number } | null;
  /** Solo para el dueño: la lista de activación (qué falta antes de abrir). */
  activacion?: Activacion;
};

/** Una opción dentro de un grupo (Grande +$4, Extra queso +$1.50, Sin cebolla). */
export type Opcion = {
  id: string;
  nombreEs: string;
  nombreEn: string;
  precioCentavos: number;
  disponible: boolean;
};
/** Un grupo de opciones de un plato (Tamaño: elige 1; Extras: hasta 3; Sin…: hasta 5). */
export type GrupoOpciones = {
  id: string;
  nombreEs: string;
  nombreEn: string;
  minimo: number;
  maximo: number;
  opciones: Opcion[];
};
/** Lo elegido en una línea del pedido (nombre y precio congelados al pedir). */
export type OpcionElegida = {
  id: string;
  nombreEs: string;
  nombreEn: string;
  precioCentavos: number;
};

/** C-NOTA-PLATO: tope de la nota de un plato («sin cebolla», «bien cocido»). */
export const NOTA_PLATO_MAX = 140;

/** La nota de un plato en una sola línea, sin espacios de más y con su tope. */
export function limpiarNotaPlato(nota: string | null | undefined): string {
  return (nota ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTA_PLATO_MAX);
}

/** La nota limpia para guardarla en la línea, o nada si viene vacía (la línea no lleva el campo). */
export function conNotaPlato(nota: string | null | undefined): { nota?: string } {
  const n = limpiarNotaPlato(nota);
  return n ? { nota: n } : {};
}

/** «Pizza margarita (Grande, Extra queso) · Nota: sin cebolla». */
export function textoLinea(
  l: {
    nombreEs: string;
    nombreEn: string;
    opciones?: OpcionElegida[] | null;
    nota?: string | null;
  },
  idioma: 'es' | 'en',
): string {
  const base = nombrePlato(l, idioma);
  const extras = (l.opciones ?? []).map((o) => nombrePlato(o, idioma)).filter(Boolean);
  const conExtras = extras.length ? `${base} (${extras.join(', ')})` : base;
  const nota = limpiarNotaPlato(l.nota);
  return nota ? `${conExtras} · ${idioma === 'en' ? 'Note' : 'Nota'}: ${nota}` : conExtras;
}

export type Plato = {
  id: string;
  restauranteId: string;
  nombreEs: string;
  nombreEn: string;
  descripcionEs: string;
  descripcionEn: string;
  categoria: string;
  categoriaEn: string;
  precioCentavos: number;
  imagen: string | null;
  disponible: boolean;
  requiereEdad?: boolean;
  etiquetas?: EtiquetaDieta[];
  grupos?: GrupoOpciones[];
};

/** Categoría del plato en el idioma pedido; si falta el inglés, cae al español. */
export function categoriaPlato(
  p: Pick<Plato, 'categoria' | 'categoriaEn'>,
  idioma: 'es' | 'en',
): string {
  return idioma === 'en' && p.categoriaEn ? p.categoriaEn : p.categoria;
}

/** Nombre del plato en el idioma pedido; si falta el inglés, cae al español. */
export function nombrePlato(p: Pick<Plato, 'nombreEs' | 'nombreEn'>, idioma: 'es' | 'en'): string {
  return idioma === 'en' && p.nombreEn ? p.nombreEn : p.nombreEs;
}

export function descripcion(
  p: { descripcionEs: string; descripcionEn: string },
  idioma: 'es' | 'en',
): string {
  return idioma === 'en' && p.descripcionEn ? p.descripcionEn : p.descripcionEs;
}

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
