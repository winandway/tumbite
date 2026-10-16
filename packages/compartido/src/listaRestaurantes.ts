import type { Restaurante } from './catalogo';

/**
 * C-CATALOGO-ESTABLE (hito 1 del cliente, docs/PLAN-CATALOGO-Y-RELOJ.md).
 *
 * Una sola fuente para la lista de restaurantes del inicio y de «Comida». Reglas:
 *   - solo se aplica la respuesta de la ÚLTIMA consulta de cada tipo (con o sin ubicación); una
 *     respuesta vieja que llega tarde se descarta;
 *   - una respuesta SIN ubicación nunca reemplaza una lista CON ubicación;
 *   - el mismo punto (redondeado a ~100 m) no se vuelve a pedir en 60 s, y dos cargas iguales a la
 *     vez comparten la misma consulta;
 *   - siempre hay un estado claro: cargando, lista, zona sin restaurantes, fuera de zona o error;
 *   - un error con lista en pantalla deja la lista y marca el error (para «Reintentar»).
 * Antes, la app pedía dos veces y la respuesta vacía de Miami borraba la lista de Novi (16 oct).
 */
type Punto = { lat: number; lng: number };
export type RespuestaRestaurantes = {
  restaurantes: Restaurante[];
  zona?: { id: string } | null;
  fueraDeZona?: boolean;
};
export type EstadoLista = {
  estado: 'cargando' | 'lista' | 'zona_vacia' | 'fuera_de_zona' | 'error';
  restaurantes: Restaurante[];
  zona: string | null;
  conUbicacion: boolean;
  error: string | null;
};

export const RECUERDO_LISTA_MS = 60_000;

const clave = (p: Punto | null) => (p ? `${p.lat.toFixed(3)},${p.lng.toFixed(3)}` : 'sin');

export function crearListaRestaurantes(op: {
  pedir: (p: Punto | null) => Promise<RespuestaRestaurantes>;
  ahora?: () => number;
  recuerdoMs?: number;
}) {
  const ahora = op.ahora ?? Date.now;
  const recuerdo = op.recuerdoMs ?? RECUERDO_LISTA_MS;
  let estado: EstadoLista = {
    estado: 'cargando',
    restaurantes: [],
    zona: null,
    conUbicacion: false,
    error: null,
  };
  const oyentes = new Set<(e: EstadoLista) => void>();
  const recordadas = new Map<string, { r: RespuestaRestaurantes; en: number }>();
  const enCamino = new Map<string, Promise<void>>();
  let ultimaCon = 0;
  let ultimaSin = 0;
  let numero = 0;

  const fijar = (e: EstadoLista) => {
    estado = e;
    for (const o of oyentes) o(estado);
  };
  const aplicar = (r: RespuestaRestaurantes, p: Punto | null) =>
    fijar({
      estado: r.fueraDeZona ? 'fuera_de_zona' : r.restaurantes.length ? 'lista' : 'zona_vacia',
      restaurantes: r.restaurantes,
      zona: r.zona?.id ?? null,
      conUbicacion: Boolean(p),
      error: null,
    });
  // ¿Esta respuesta todavía vale? Solo la última de su tipo, y sin ubicación solo si no hay nada
  // mejor en pantalla.
  const vale = (n: number, p: Punto | null) =>
    p ? n === ultimaCon : n === ultimaSin && !estado.conUbicacion;

  function cargar(p: Punto | null, opciones: { forzar?: boolean } = {}): Promise<void> {
    const k = clave(p);
    const guardada = recordadas.get(k);
    if (!opciones.forzar && guardada && ahora() - guardada.en < recuerdo) {
      if (p || !estado.conUbicacion) aplicar(guardada.r, p);
      return Promise.resolve();
    }
    const igual = enCamino.get(k);
    if (igual) return igual;
    const n = ++numero;
    if (p) ultimaCon = n;
    else ultimaSin = n;
    if (!estado.restaurantes.length && estado.estado !== 'cargando')
      fijar({ ...estado, estado: 'cargando', error: null });
    const promesa = op
      .pedir(p)
      .then((r) => {
        recordadas.set(k, { r, en: ahora() });
        if (vale(n, p)) aplicar(r, p);
      })
      .catch((e: unknown) => {
        if (!vale(n, p)) return;
        const error = String((e as { message?: string })?.message ?? e);
        fijar(
          estado.restaurantes.length ? { ...estado, error } : { ...estado, estado: 'error', error },
        );
      })
      .finally(() => enCamino.delete(k));
    enCamino.set(k, promesa);
    return promesa;
  }

  return {
    estado: () => estado,
    cargar,
    suscribir(fn: (e: EstadoLista) => void) {
      oyentes.add(fn);
      return () => {
        oyentes.delete(fn);
      };
    },
  };
}
