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
export type VistaMapa = { centro: Punto; zoom: number };

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
/** Nivel de calle: se distingue cada casa. */
export const ZOOM_LLEGADA = 18;

/** La vista de llegada si el móvil está cerca del destino; si no, `null` (el mapa sigue como iba). */
export function vistaDeLlegada(
  movil: Punto | null | undefined,
  destino: Punto | null | undefined,
  metros = METROS_LLEGADA,
): VistaMapa | null {
  if (!valido(movil) || !valido(destino)) return null;
  return metrosEntre(movil, destino) <= metros ? { centro: destino, zoom: ZOOM_LLEGADA } : null;
}

const LARGO_ROTULO = 22;

/**
 * Lo que se escribe sobre el punto de la casa al acercarse: el número de la casa si la dirección lo
 * trae («41000», «12-34», «casa 27» → «27»); si no, el primer tramo de la dirección, corto.
 */
export function rotuloDestino(direccion: string | null | undefined): string {
  const calle = (direccion ?? '').split(',')[0]?.trim() ?? '';
  if (!calle && !(direccion ?? '').trim()) return '';
  const todo = (direccion ?? '').trim();
  const numeral = /#\s*([\dA-Za-z-]+)/.exec(todo);
  if (numeral?.[1]) return numeral[1];
  const alInicio = /^(\d[\dA-Za-z-]*)\s/.exec(calle);
  if (alInicio?.[1]) return alInicio[1];
  const casa = /\b(?:casa|house|apt|apto|n[°ºo]\.?|nro\.?|no\.)\s*(\d+[A-Za-z]?)\b/i.exec(todo);
  if (casa?.[1]) return casa[1];
  if (calle.length <= LARGO_ROTULO) return calle;
  const corte = calle.slice(0, LARGO_ROTULO + 1);
  const hasta = corte.lastIndexOf(' ');
  return `${corte.slice(0, hasta > 8 ? hasta : LARGO_ROTULO).trim()}…`;
}
