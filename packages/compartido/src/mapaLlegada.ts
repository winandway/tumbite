import { RADIO_LLEGADA_M, metrosEntre, type Punto } from './llegada';

/**
 * C-MAPA-ABRE-DONDE-ESTAS y C-MAPA-LLEGADA (14 nov 2026, Richard) — todos los países. Dos reglas del
 * mapa que comparten la web y las apps (cliente, conductor y ruta Flex), en una sola pieza:
 *
 * 1. El mapa de elegir un punto abre donde está la persona, nunca en una ciudad fija.
 * 2. Cuando el repartidor o conductor está a menos de 200 metros del destino, el mapa se acerca solo
 *    y deja el punto de la casa centrado, con el número o la dirección a la vista (como Uber y
 *    DoorDash). Usa las coordenadas que ya guardamos de la dirección elegida: no llama a Google.
 *    Ficha con las fuentes: `docs/investigaciones-rea/2026-11-14-mapa-llegada-y-precision.md`.
 */
export type VistaMapa = {
  centro: Punto;
  zoom: number;
  /**
   * Solo en la vista de llegada: cambia cuando hay que mover la cámara (otro destino u otro nivel de
   * zoom), no en cada lectura de GPS.
   */
  clave?: string;
};

const valido = (p: Punto | null | undefined): p is Punto =>
  p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/**
 * Dónde abre el mapa de elegir punto, en este orden: el punto ya marcado; el GPS de la persona (si
 * dio permiso); la dirección de entrega que eligió; la última ubicación guardada en su teléfono; la
 * zona de lo que está pidiendo (`cerca`: el local del carrito o el punto de recogida). Sin ningún
 * dato devuelve `null`: la pantalla pide la ubicación o la dirección en vez de mostrar otra ciudad.
 */
export function centroParaElegir(d: {
  punto: Punto | null;
  gps?: Punto | null;
  direccion?: Punto | null;
  guardado?: Punto | null;
  cerca?: Punto | null;
}): VistaMapa | null {
  if (valido(d.punto)) return { centro: d.punto, zoom: 16 };
  if (valido(d.gps)) return { centro: d.gps, zoom: 16 };
  if (valido(d.direccion)) return { centro: d.direccion, zoom: 15 };
  if (valido(d.guardado)) return { centro: d.guardado, zoom: 15 };
  if (valido(d.cerca)) return { centro: d.cerca, zoom: 13 };
  return null;
}

/** A esta distancia del destino el mapa se acerca (la misma del «llegué»: C-GPS-SERIO). */
export const METROS_LLEGADA = RADIO_LLEGADA_M;
/** Nivel de calle: se distingue cada casa. Es el tope del acercamiento. */
export const ZOOM_LLEGADA = 18;
/** Lo más abierto que queda el mapa al llegar (a 200 m caben los dos con este nivel). */
const ZOOM_LLEGADA_MINIMO = 15;
/** Lado útil del mapa en pantalla, en píxeles, descontando el margen para que nada quede al borde. */
const LADO_UTIL_PX = 160;
/** Metros por píxel del mapa en el ecuador con zoom 0 (proyección de Mercator, mosaicos de 256). */
const METROS_PX_ZOOM_0 = 156_543.03392;

/**
 * La vista de llegada si el móvil está cerca del destino; si no, `null` (el mapa sigue como iba).
 * Se ven la casa y el repartidor JUNTOS: el centro es el punto medio entre los dos y el zoom es el
 * más cercano en el que caben, con el nivel de calle (18) como tope. El zoom baja por escalones
 * enteros (16, 17, 18) y `clave` solo cambia con el escalón o con el destino: la cámara se mueve
 * dos o tres veces durante la llegada, no en cada lectura de GPS.
 */
export function vistaDeLlegada(
  movil: Punto | null | undefined,
  destino: Punto | null | undefined,
  metros = METROS_LLEGADA,
): VistaMapa | null {
  if (!valido(movil) || !valido(destino)) return null;
  const separacion = metrosEntre(movil, destino);
  if (separacion > metros) return null;
  const metrosPorPixel = Math.max(separacion, 1) / LADO_UTIL_PX;
  const cabe = Math.floor(
    Math.log2((METROS_PX_ZOOM_0 * Math.cos((destino.lat * Math.PI) / 180)) / metrosPorPixel),
  );
  const zoom = Math.min(ZOOM_LLEGADA, Math.max(ZOOM_LLEGADA_MINIMO, cabe));
  return {
    centro: { lat: (movil.lat + destino.lat) / 2, lng: (movil.lng + destino.lng) / 2 },
    zoom,
    clave: `${destino.lat},${destino.lng},${zoom}`,
  };
}

const LARGO_ROTULO = 22;

/**
 * Lo que se escribe sobre el punto de la casa al acercarse: el número de la casa si la dirección lo
 * trae («41000», «12-34», «casa 27» → «27»); si no, el primer tramo de la dirección, corto. El número
 * con que empieza la calle manda sobre el del apartamento («41000 W Ten Mile Rd #4B» → «41000»).
 */
export function rotuloDestino(direccion: string | null | undefined): string {
  const calle = (direccion ?? '').split(',')[0]?.trim() ?? '';
  if (!calle && !(direccion ?? '').trim()) return '';
  const todo = (direccion ?? '').trim();
  const alInicio = /^(\d[\dA-Za-z-]*)\s/.exec(calle);
  if (alInicio?.[1]) return alInicio[1];
  const numeral = /#\s*([\dA-Za-z-]+)/.exec(todo);
  if (numeral?.[1]) return numeral[1];
  const casa = /\b(?:casa|house|apt|apto|n[°ºo]\.?|nro\.?|no\.)\s*(\d+[A-Za-z]?)\b/i.exec(todo);
  if (casa?.[1]) return casa[1];
  if (calle.length <= LARGO_ROTULO) return calle;
  const corte = calle.slice(0, LARGO_ROTULO + 1);
  const hasta = corte.lastIndexOf(' ');
  return `${corte.slice(0, hasta > 8 ? hasta : LARGO_ROTULO).trim()}…`;
}
