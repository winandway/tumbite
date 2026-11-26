import { useEffect, useState } from 'react';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import FOTO from './tarifasCiudades.json';

/**
 * C-TARIFAS-PUBLICAS (25 nov 2026, encargo de Richard: que Google y los buscadores de IA digan cuánto
 * cuesta un mototaxi de Divoox en El Vigía) — Venezuela.
 *
 * Los precios salen de los MISMOS datos que cobra el sistema (`GET /datos/web/tarifas/<ciudad>`: las
 * rutas activas de precio fijo de la zona y la tarifa vigente con su recargo de noche). Nunca un texto
 * fijo: al publicar, `scripts/estado-paises.mjs` guarda en `tarifasCiudades.json` lo que dice
 * producción (así el HTML prearmado y sus datos estructurados ya salen con los precios reales) y en el
 * navegador se vuelve a preguntar una vez por visita: manda lo que responda el servidor.
 *
 * Lo que se muestra es lo que paga el pasajero, y es lo MÁS que paga por ese trayecto: al pedir, la
 * app cobra el menor entre el precio fijo y el calculado por distancia.
 */
export type PrecioPublico = { dia: number; noche: number | null };
export type LugarPublico = {
  lugar: string;
  ida: PrecioPublico | null;
  regreso: PrecioPublico | null;
  idaVuelta: PrecioPublico | null;
};
export type GrupoPublico = { grupo: string | null; lugares: LugarPublico[] };
export type TarifasPublicas = {
  ciudad: string;
  servicio: string;
  moneda: string;
  centro: string | null;
  grupos: GrupoPublico[];
  otros: { desde: string; hasta: string; precio: PrecioPublico }[];
  minimo: PrecioPublico | null;
  noche: { recargoPb: number; desdeH: number; hastaH: number; zonaHoraria: string } | null;
  actualizado: string | null;
};
type Mapa = Record<string, TarifasPublicas>;

export const TARIFAS_PUBLICADAS: Mapa = (FOTO as unknown as { tarifas: Mapa }).tarifas;

/** Las ciudades que tienen página de precios (las que tenían precios al publicar). */
export const CIUDADES_CON_TARIFAS = Object.keys(TARIFAS_PUBLICADAS).sort();

const vivas = new Map<string, Promise<TarifasPublicas | null | undefined>>();
/** undefined = el servidor no respondió (manda lo publicado); null = sin precios publicados hoy. */
function pedir(ciudad: string) {
  let p = vivas.get(ciudad);
  if (!p) {
    p = fetch(`/datos/web/tarifas/${ciudad}`)
      .then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) return undefined;
        const d = (await r.json()) as TarifasPublicas;
        return d && Array.isArray(d.grupos) && Array.isArray(d.otros) ? d : undefined;
      })
      .catch((e: unknown) => {
        console.warn('tarifas: sin respuesta del servidor, quedan las publicadas', e);
        return undefined;
      });
    vivas.set(ciudad, p);
  }
  return p;
}

/** Los precios de una ciudad: los publicados y, en cuanto responde, los del servidor. */
export function useTarifas(ciudad: string): TarifasPublicas | null {
  const [vivo, setVivo] = useState<TarifasPublicas | null | undefined>(undefined);
  useEffect(() => {
    // Sin ciudad (una que no está abierta): no se pregunta nada.
    if (!ciudad) return;
    let vigente = true;
    void pedir(ciudad).then((t) => {
      if (vigente && t !== undefined) setVivo(t);
    });
    return () => {
      vigente = false;
    };
  }, [ciudad]);
  return vivo === undefined
    ? (new Map(Object.entries(TARIFAS_PUBLICADAS)).get(ciudad) ?? null)
    : vivo;
}

/** Solo para las pruebas: olvida lo consultado. */
export function olvidarTarifas() {
  vivas.clear();
}

export const monto = (t: Pick<TarifasPublicas, 'moneda'>, centavos: number, idioma: Idioma) =>
  formatearMonto(centavos, t.moneda, idioma);

/** «+30 %» / «+30%». */
export const porcentaje = (pb: number, idioma: Idioma) => {
  const n = new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-US', {
    maximumFractionDigits: 1,
  }).format(pb / 100);
  return idioma === 'en' ? `${n}%` : `${n} %`;
};

/** «9:00 p. m.» / «9:00 PM» (la hora local de la ciudad). */
export const hora = (h: number, idioma: Idioma) =>
  new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2026, 0, 1, h, 0)));

/** El nombre de una vía en inglés: «Vía Mérida» → «Mérida road». Los lugares no se traducen. */
export function nombreGrupo(grupo: string | null, idioma: Idioma): string {
  if (!grupo) return idioma === 'en' ? 'Other trips' : 'Otros trayectos';
  if (idioma === 'es') return grupo;
  if (/^carreras cortas$/i.test(grupo)) return 'Short rides in town';
  if (/^v[ií]a panamericana$/i.test(grupo)) return 'Pan-American Highway';
  const via = /^v[ií]a\s+(.+)$/i.exec(grupo);
  return via ? `${via[1]} road` : grupo;
}

/** El centro dicho en el idioma: «El Vigía (casco urbano)» → «downtown El Vigía». */
export function nombreCentro(centro: string, idioma: Idioma): string {
  const m = /^(.+?)\s*\((casco urbano|centro)\)$/i.exec(centro.trim());
  if (!m) return centro;
  return idioma === 'en' ? `downtown ${m[1]}` : `el centro de ${m[1]}`;
}

/** Todos los lugares de la tabla, en orden. */
export const lugaresDe = (t: TarifasPublicas) => t.grupos.flatMap((g) => g.lugares);

/** El precio de día más bajo y más alto publicado (para el resumen y las preguntas). */
export function rangoDe(t: TarifasPublicas): { menor: number; mayor: number } | null {
  const xs = [
    ...lugaresDe(t).flatMap((l) => [l.ida?.dia, l.regreso?.dia]),
    ...t.otros.map((o) => o.precio.dia),
  ].filter((x): x is number => typeof x === 'number');
  return xs.length ? { menor: Math.min(...xs), mayor: Math.max(...xs) } : null;
}
