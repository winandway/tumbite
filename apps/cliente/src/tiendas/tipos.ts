import type { Plan } from '@tumbite/compartido';
import { urlFoto } from '@tumbite/movil';

/** Lo que el servidor manda de las tiendas (C-TIENDAS-VITRINA). */
export type TiendaCerca = {
  id: string;
  nombre: string;
  direccion: string;
  imagen: string | null;
  tipo: string;
  abierto: boolean;
  productos: number;
  minutos: number;
  distanciaKm: number | null;
};
export type FichaTienda = {
  id: string;
  nombre: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  imagen: string | null;
  tipo: string;
  abierto: boolean;
  plan: Plan;
  moneda: string;
};
export type ProductoTienda = {
  id: string;
  nombre: string;
  nombreEs: string;
  nombreEn: string;
  marca: string | null;
  tamano: string | null;
  unidadTamano: string | null;
  categoria: string | null;
  imagen: string | null;
  vendidoPor: 'each' | 'weight';
  unidadPeso: string | null;
  restriccion: string;
  precio: number;
  precioAntes: number | null;
  precioEstimado: number;
};
export type ResultadoBusqueda = ProductoTienda & {
  tiendaId: string;
  tienda: string;
  abierto: boolean;
  distanciaKm: number | null;
};

/** Foto del producto: la subida a Divoox o la dirección segura que puso la tienda en su planilla. */
export const fotoProducto = (ruta: string | null | undefined) =>
  ruta?.startsWith('https://') ? ruta : urlFoto(ruta);

/** «Brand · 500 mL» para debajo del nombre. */
export const detalleProducto = (p: ProductoTienda) =>
  [p.marca, p.tamano && `${p.tamano}${p.unidadTamano ? ` ${p.unidadTamano}` : ''}`]
    .filter(Boolean)
    .join(' · ');
