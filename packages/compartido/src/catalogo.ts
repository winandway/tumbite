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
});
export type DatosPlato = z.input<typeof esquemaPlato>;

export type Restaurante = {
  id: string;
  nombre: string;
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
  regalosPb: number;
  distanciaKm?: number;
};

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
