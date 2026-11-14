import { useSyncExternalStore } from 'react';

import type { Almacen } from './borrador';
import type { TemaMapa } from './estiloMapaDivoox';

/**
 * C-MAPA-DIA-NOCHE (14 nov 2026, decisión de Richard) — todos los países. Cuándo el mapa va de día
 * («Día · azul Divoox») y cuándo de noche («Noche · oscuro con azul»), en una sola pieza para la web
 * y las apps (cliente, conductor y ruta Flex).
 *
 * Tres posiciones, guardadas en el teléfono o en el navegador de cada persona:
 * - automático (de fábrica): de noche según el sol del lugar del mapa (como el modo «Automático»
 *   de la navegación de Google Maps y de Waze, que cambian al anochecer), y también cuando el
 *   teléfono está en modo oscuro (como `FOLLOW_SYSTEM` de Google Maps y los mapas de Apple);
 * - claro: siempre de día;
 * - oscuro: siempre de noche.
 *
 * Ficha con las fuentes: docs/investigaciones-rea/2026-11-14-mapa-dia-noche-e-isotipo.md
 */
export type AjusteTemaMapa = 'auto' | 'claro' | 'oscuro';
export type { TemaMapa };

export const AJUSTES_TEMA_MAPA: AjusteTemaMapa[] = ['auto', 'claro', 'oscuro'];
export const LLAVE_AJUSTE_TEMA_MAPA = 'divoox.mapa.tema';

export const TEXTOS_TEMA_MAPA = {
  es: {
    titulo: 'Colores del mapa',
    ayuda: 'En automático, el mapa se oscurece solo cuando anochece.',
    auto: 'Automático',
    claro: 'Claro',
    oscuro: 'Oscuro',
  },
  en: {
    titulo: 'Map colors',
    ayuda: 'On automatic, the map turns dark on its own after sunset.',
    auto: 'Automatic',
    claro: 'Light',
    oscuro: 'Dark',
  },
};

/** El nombre de cada posición del ajuste, en el idioma de la persona. */
export function nombreAjusteTemaMapa(idioma: 'es' | 'en', ajuste: AjusteTemaMapa): string {
  const t = TEXTOS_TEMA_MAPA[idioma === 'es' ? 'es' : 'en'];
  if (ajuste === 'claro') return t.claro;
  if (ajuste === 'oscuro') return t.oscuro;
  return t.auto;
}

type Punto = { lat: number; lng: number };

const RAD = Math.PI / 180;

/**
 * ¿Es de noche en ese lugar a esa hora? Con el punto del mapa, por la altura del sol (fórmula
 * astronómica corta: declinación y ecuación del tiempo; acierta la salida y la puesta con pocos
 * minutos de error, de sobra para cambiar un color). Sin punto, por la hora del teléfono: noche de
 * las 7 de la tarde a las 6 de la mañana.
 */
export function esDeNoche(ahora: Date, punto?: Punto | null): boolean {
  if (!punto || !Number.isFinite(punto.lat) || !Number.isFinite(punto.lng)) {
    const h = ahora.getHours();
    return h < 6 || h >= 19;
  }
  const inicio = Date.UTC(ahora.getUTCFullYear(), 0, 0);
  const dia = Math.floor((ahora.getTime() - inicio) / 86_400_000);
  const horas = ahora.getUTCHours() + ahora.getUTCMinutes() / 60 + ahora.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dia - 1 + (horas - 12) / 24);
  const declinacion =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const ecuacionMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const minutosSolares = horas * 60 + ecuacionMin + 4 * punto.lng;
  const angulo = (minutosSolares / 4 - 180) * RAD;
  const lat = punto.lat * RAD;
  const altura = Math.asin(
    Math.sin(lat) * Math.sin(declinacion) +
      Math.cos(lat) * Math.cos(declinacion) * Math.cos(angulo),
  );
  // El sol «se pone» cuando su centro baja 0,833° del horizonte (refracción y tamaño del disco).
  return altura < -0.833 * RAD;
}

/** La regla de las tres posiciones (pura). */
export function temaMapa(d: {
  ajuste: AjusteTemaMapa;
  ahora: Date;
  punto?: Punto | null;
  /** El teléfono o el navegador están en modo oscuro (si se sabe). */
  sistemaOscuro?: boolean | null;
}): TemaMapa {
  if (d.ajuste === 'claro') return 'dia';
  if (d.ajuste === 'oscuro') return 'noche';
  if (d.sistemaOscuro) return 'noche';
  return esDeNoche(d.ahora, d.punto) ? 'noche' : 'dia';
}

const esAjuste = (v: unknown): v is AjusteTemaMapa =>
  v === 'auto' || v === 'claro' || v === 'oscuro';

// El ajuste vive en memoria (para avisar a los mapas abiertos) y en el almacén de cada plataforma.
let actual: AjusteTemaMapa | null = null;
const escuchas = new Set<() => void>();

function almacenNavegador(): Almacen | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls || typeof ls.getItem !== 'function') return null;
    return {
      leer: (k) => ls.getItem(k),
      guardar: (k, v) => ls.setItem(k, v),
      borrar: (k) => ls.removeItem(k),
    };
  } catch {
    // Navegador con el almacenamiento bloqueado: el ajuste vale solo mientras la página esté abierta.
    return null;
  }
}

/** El ajuste de ahora. En el navegador se lee del almacenamiento la primera vez (es inmediato). */
export function ajusteTemaMapa(): AjusteTemaMapa {
  if (actual) return actual;
  try {
    const v = almacenNavegador()?.leer(LLAVE_AJUSTE_TEMA_MAPA);
    if (esAjuste(v)) actual = v;
  } catch {
    // Sin almacenamiento: automático.
  }
  return actual ?? 'auto';
}

/** En el celular el almacén no es inmediato: se carga una vez al abrir la app. */
export async function cargarAjusteTemaMapa(almacen: Almacen): Promise<AjusteTemaMapa> {
  try {
    const v = await almacen.leer(LLAVE_AJUSTE_TEMA_MAPA);
    const nuevo = esAjuste(v) ? v : 'auto';
    if (nuevo !== actual) {
      actual = nuevo;
      for (const f of escuchas) f();
    }
  } catch (e) {
    console.warn('mapa: no se pudo leer el ajuste de colores', e);
  }
  return ajusteTemaMapa();
}

/** Cambia el ajuste, avisa a los mapas abiertos y lo guarda (en `almacen` o en el navegador). */
export async function cambiarAjusteTemaMapa(
  ajuste: AjusteTemaMapa,
  almacen?: Almacen | null,
): Promise<void> {
  actual = ajuste;
  for (const f of escuchas) f();
  try {
    await (almacen ?? almacenNavegador())?.guardar(LLAVE_AJUSTE_TEMA_MAPA, ajuste);
  } catch (e) {
    console.warn('mapa: no se pudo guardar el ajuste de colores', e);
  }
}

export function alCambiarAjusteTemaMapa(f: () => void): () => void {
  escuchas.add(f);
  return () => escuchas.delete(f);
}

/** Para las pruebas: olvida el ajuste en memoria. */
export function olvidarAjusteTemaMapa() {
  actual = null;
}

function sistemaOscuroNavegador(): boolean | null {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  if (typeof mm !== 'function') return null;
  try {
    return mm('(prefers-color-scheme: dark)').matches;
  } catch {
    return null;
  }
}

/** Cada cuánto se vuelve a mirar si ya anocheció (o amaneció) con el mapa abierto. */
const REVISAR_CADA_MS = 60_000;

/** Avisa cuando puede haber cambiado el tema: la persona tocó el ajuste o pasó un minuto. */
function alPoderCambiarTema(f: () => void): () => void {
  const dejar = alCambiarAjusteTemaMapa(f);
  const reloj = setInterval(f, REVISAR_CADA_MS);
  return () => {
    dejar();
    clearInterval(reloj);
  };
}

/** El ajuste de ahora, vivo: cambia cuando la persona lo cambia en cualquier pantalla. */
export function useAjusteTemaMapa(): AjusteTemaMapa {
  return useSyncExternalStore(alCambiarAjusteTemaMapa, ajusteTemaMapa, () => 'auto' as const);
}

/**
 * El tema del mapa, vivo: cambia solo al anochecer y al amanecer, cuando la persona cambia el
 * ajuste, y cuando el teléfono pasa a modo oscuro. `sistemaOscuro` lo pasan las apps (con
 * `useColorScheme`); en el navegador se lee de `prefers-color-scheme`.
 */
export function useTemaMapa(punto?: Punto | null, sistemaOscuro?: boolean | null): TemaMapa {
  const lat = punto?.lat;
  const lng = punto?.lng;
  return useSyncExternalStore(
    alPoderCambiarTema,
    () =>
      temaMapa({
        ajuste: ajusteTemaMapa(),
        ahora: new Date(),
        punto: lat != null && lng != null ? { lat, lng } : null,
        sistemaOscuro: sistemaOscuro === undefined ? sistemaOscuroNavegador() : sistemaOscuro,
      }),
    () => 'dia' as const,
  );
}

/** Filtro que oscurece los mosaicos de OpenStreetMap (Leaflet no tiene estilo de noche propio). */
export const FILTRO_LEAFLET_NOCHE =
  'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6)';

/**
 * El mapa de respaldo (Leaflet, sin llave de Google) sigue el mismo ajuste lo mejor que puede: de
 * noche se oscurecen los mosaicos. Devuelve cómo dejar de escuchar.
 */
export function seguirTemaEnLeaflet(
  mapa: { getPane?: (nombre: string) => HTMLElement | undefined },
  punto?: Punto | null,
): () => void {
  const aplicar = () => {
    const capa = mapa.getPane?.('tilePane');
    if (!capa) return;
    const tema = temaMapa({
      ajuste: ajusteTemaMapa(),
      ahora: new Date(),
      punto,
      sistemaOscuro: sistemaOscuroNavegador(),
    });
    capa.style.filter = tema === 'noche' ? FILTRO_LEAFLET_NOCHE : '';
  };
  aplicar();
  return alPoderCambiarTema(aplicar);
}
