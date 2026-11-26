import { useEffect, useState } from 'react';
import type { Idioma } from '@tumbite/compartido';
import type { Estado, Lugar } from './cobertura';
import FOTO from './paisesAbiertos.json';

/**
 * C-PAIS-ABIERTO-SIN-PRONTO (25 nov 2026, Venezuela y todos los países): un país con al menos un
 * servicio abierto al público se muestra «Ya estamos en …», nunca «muy pronto». El estado sale del
 * servidor (`GET /datos/web/paises`, la misma regla del catálogo del cliente), no de un texto fijo:
 *
 * - Al publicar, `scripts/estado-paises.mjs` copia en `paisesAbiertos.json` lo que dice producción,
 *   así las páginas prearmadas (título, descripción, tarjeta social) ya salen con el estado real.
 * - En el navegador se vuelve a preguntar una vez por visita y manda lo que responda el servidor.
 *
 * Un país que el código ya marca «activo» (Estados Unidos) no cambia: conserva sus textos.
 */
export type ServicioAbierto = { id: string; es: string; en: string };
export type EstadoPais = { estado: Estado; abierto: boolean; servicios: ServicioAbierto[] };
type Mapa = Record<string, ServicioAbierto[]>;

export const PAISES_ABIERTOS_PUBLICADOS: Mapa = (FOTO as { paises: Mapa }).paises;

/** El estado de un país con la lista que se le pase (la publicada o la del servidor). */
export function estadoDePais(p: Pick<Lugar, 'estado' | 'codigo'>, abiertos: Mapa): EstadoPais {
  if (p.estado === 'activo') return { estado: 'activo', abierto: false, servicios: [] };
  const servicios = (p.codigo && abiertos[p.codigo]) || [];
  return servicios.length
    ? { estado: 'activo', abierto: true, servicios }
    : { estado: p.estado, abierto: false, servicios: [] };
}

let enCurso: Promise<Mapa | null> | null = null;
function pedir() {
  enCurso ??= fetch('/datos/web/paises')
    .then((r) => (r.ok ? (r.json() as Promise<{ paises?: Mapa }>) : null))
    .then((d) => (d?.paises && typeof d.paises === 'object' ? d.paises : null))
    .catch((e: unknown) => {
      // Sin respuesta manda lo publicado (nunca se inventa un país abierto ni cerrado).
      console.warn('paises abiertos: sin respuesta del servidor, queda lo publicado', e);
      return null;
    });
  return enCurso;
}

export function usePaisesAbiertos() {
  const [vivos, setVivos] = useState<Mapa | null>(null);
  useEffect(() => {
    let vigente = true;
    void pedir().then((m) => {
      if (vigente && m) setVivos(m);
    });
    return () => {
      vigente = false;
    };
  }, []);
  return (p: Pick<Lugar, 'estado' | 'codigo'>) =>
    estadoDePais(p, vivos ?? PAISES_ABIERTOS_PUBLICADOS);
}

/** Solo para las pruebas: olvida lo consultado. */
export function olvidarPaisesAbiertos() {
  enCurso = null;
}

/** Cómo se nombra cada servicio dentro de una frase («viajes en moto»). */
const FRASE = new Map<string, Record<Idioma, string>>(
  Object.entries({
    moto: { es: 'viajes en moto', en: 'motorbike rides' },
    carro: { es: 'viajes en carro', en: 'car rides' },
    envios: { es: 'envíos de paquetes', en: 'package delivery' },
    comida: { es: 'comida a domicilio', en: 'food delivery' },
    mercado: { es: 'mercado a domicilio', en: 'grocery delivery' },
    farmacia: { es: 'farmacia a domicilio', en: 'pharmacy delivery' },
    licores: { es: 'licores a domicilio', en: 'liquor delivery' },
  }),
);
export const fraseServicio = (s: ServicioAbierto, idioma: Idioma) =>
  (idioma === 'en' ? FRASE.get(s.id)?.en : FRASE.get(s.id)?.es) ??
  (idioma === 'en' ? s.en : s.es).toLowerCase();

/** Lo abierto dicho en una frase: «viajes en moto y en carro» / «motorbike and car rides». */
export function fraseServicios(lista: ServicioAbierto[], idioma: Idioma): string {
  const ids = new Set(lista.map((s) => s.id));
  const frases = lista.flatMap((s) => {
    if (ids.has('moto') && ids.has('carro')) {
      if (s.id === 'carro') return [];
      if (s.id === 'moto')
        return [idioma === 'en' ? 'motorbike and car rides' : 'viajes en moto y en carro'];
    }
    return [fraseServicio(s, idioma)];
  });
  return listaHumana(frases, idioma);
}

/** «A, B y C» / «A, B, and C». */
export function listaHumana(xs: string[], idioma: Idioma): string {
  if (xs.length < 2) return xs.join('');
  const y = idioma === 'en' ? (xs.length > 2 ? ', and ' : ' and ') : ' y ';
  return `${xs.slice(0, -1).join(', ')}${y}${xs.at(-1) ?? ''}`;
}
