/**
 * C-LUGARES-GUARDADOS y C-DESTINO-RECIENTES (17 nov 2026) — todos los países. Reglas escritas de
 * Richard: docs/disenos/borrador-inicio/LUGARES-GUARDADOS.md y BUSQUEDA-DESTINO.md.
 *
 * - Una sola lista de lugares para todos los servicios (la tabla de «Tus direcciones» de Comida),
 *   con nombre e ícono. La fila de atajos: Casa y Trabajo siempre, luego los propios, y «+».
 * - «¿A dónde vas?» con la casilla vacía: Recientes ordenados por lo que la persona suele pedir a esa
 *   hora y ese día (código, sin IA). Con texto: Resultados del mapa por cercanía.
 */
import type { Idioma } from './idiomas';

export const ICONOS_LUGAR = [
  'casa',
  'trabajo',
  'escuela',
  'gimnasio',
  'corazon',
  'estrella',
  'tienda',
  'hospital',
] as const;
export type IconoLugar = (typeof ICONOS_LUGAR)[number];

/** Lo mínimo de una dirección guardada (GET /datos/mis-direcciones). */
export type LugarGuardado = {
  id: string;
  etiqueta: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  referencia: string;
  apto: string;
  icono?: string;
};

const sinAcentos = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const CASA = new Set(['casa', 'home', 'mi casa', 'hogar']);
const TRABAJO = new Set(['trabajo', 'work', 'oficina', 'office', 'mi trabajo']);
export const esCasa = (l: { etiqueta: string }) => CASA.has(sinAcentos(l.etiqueta));
export const esTrabajo = (l: { etiqueta: string }) => TRABAJO.has(sinAcentos(l.etiqueta));

export function iconoDeLugar(l: { etiqueta: string; icono?: string }): IconoLugar {
  if ((ICONOS_LUGAR as readonly string[]).includes(l.icono ?? '')) return l.icono as IconoLugar;
  if (esCasa(l)) return 'casa';
  if (esTrabajo(l)) return 'trabajo';
  return 'estrella';
}

/** Una pastilla de la fila de lugares. */
export type FilaLugar = {
  clave: string;
  nombre: string;
  icono: IconoLugar;
  /** El lugar guardado (null: Casa o Trabajo todavía sin dirección). */
  lugar: LugarGuardado | null;
  conDireccion: boolean;
};

const conPunto = (l: LugarGuardado) =>
  Boolean(l.direccion.trim()) && l.lat != null && l.lng != null;

export function filaLugares(lista: LugarGuardado[], idioma: Idioma): FilaLugar[] {
  const casa = lista.find(esCasa) ?? null;
  const trabajo = lista.find(esTrabajo) ?? null;
  const fija = (clave: 'casa' | 'trabajo', l: LugarGuardado | null): FilaLugar => ({
    clave,
    nombre:
      clave === 'casa' ? (idioma === 'en' ? 'Home' : 'Casa') : idioma === 'en' ? 'Work' : 'Trabajo',
    icono: clave,
    lugar: l,
    conDireccion: l ? conPunto(l) : false,
  });
  const propios = lista
    .filter((l) => l.etiqueta.trim() && !esCasa(l) && !esTrabajo(l))
    .map((l): FilaLugar => ({
      clave: l.id,
      nombre: l.etiqueta.trim(),
      icono: iconoDeLugar(l),
      lugar: l,
      conDireccion: conPunto(l),
    }));
  return [fija('casa', casa), fija('trabajo', trabajo), ...propios];
}

export function puedeGuardarLugar(x: {
  nombre: string;
  direccion: string;
  lat: number | null;
}): boolean {
  return x.nombre.trim().length > 0 && x.direccion.trim().length > 0 && x.lat != null;
}

/** Lugares guardados que coinciden con lo escrito (por nombre o por dirección), desde 2 letras. */
export function lugaresQueCoinciden<T extends LugarGuardado>(texto: string, lista: T[]): T[] {
  const q = sinAcentos(texto);
  if (q.length < 2) return [];
  return lista.filter(
    (l) =>
      Boolean(l.etiqueta.trim()) &&
      (sinAcentos(l.etiqueta).includes(q) || sinAcentos(l.direccion).includes(q)),
  );
}

// ───────────────────────────── Recientes por hora y día ─────────────────────────────

/** Un viaje ya hecho: su destino y cuándo se pidió (ISO). */
export type ViajeHecho = { direccion: string; lat: number; lng: number; en: string };

export type DestinoReciente = {
  clave: string;
  titulo: string;
  detalle: string;
  direccion: string;
  lat: number;
  lng: number;
  /** Por qué va arriba («Lunes a esta hora», «Entre semana»…), o vacío. */
  motivo: string;
};

const DIAS = {
  es: ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'],
  en: ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'],
};
const finDeSemana = (d: number) => d === 0 || d === 6;
/** La distancia entre dos horas del día en un reloj de 24 (las 23 y la 1 están a 2 horas). */
const entreHoras = (a: number, b: number) => {
  const x = Math.abs(a - b) % 24;
  return Math.min(x, 24 - x);
};
/** Unos 100 metros: el mismo sitio aunque el pin quedó un poco movido. */
const claveSitio = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;
const cerca = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.abs(a.lat - b.lat) < 0.0012 && Math.abs(a.lng - b.lng) < 0.0012;

export function partirDireccion(direccion: string): { titulo: string; detalle: string } {
  const i = direccion.indexOf(',');
  if (i < 0) return { titulo: direccion.trim(), detalle: '' };
  return { titulo: direccion.slice(0, i).trim(), detalle: direccion.slice(i + 1).trim() };
}

/**
 * Regla de orden (BUSQUEDA-DESTINO.md): viajes a ese destino en la misma franja horaria (±1 hora) y
 * el mismo día de la semana; luego los del mismo tipo de día (entre semana o fin de semana); por
 * último, lo más reciente. Cinco como mucho.
 */
export function ordenarRecientes(
  viajes: ViajeHecho[],
  ahora: Date,
  op: { idioma?: Idioma; lugares?: LugarGuardado[]; maximo?: number } = {},
): DestinoReciente[] {
  const idioma = op.idioma ?? 'es';
  const dia = ahora.getDay();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  const grupos = new Map<string, { v: ViajeHecho; franja: number; tipo: number; ultimo: number }>();
  for (const v of viajes) {
    const t = Date.parse(v.en);
    if (!Number.isFinite(t) || !v.direccion.trim()) continue;
    const d = new Date(t);
    const k = claveSitio(v.lat, v.lng);
    const g = grupos.get(k) ?? { v, franja: 0, tipo: 0, ultimo: 0 };
    const h = d.getHours() + d.getMinutes() / 60;
    if (d.getDay() === dia && entreHoras(h, hora) <= 1) g.franja++;
    if (finDeSemana(d.getDay()) === finDeSemana(dia)) g.tipo++;
    if (t > g.ultimo) {
      g.ultimo = t;
      g.v = v;
    }
    grupos.set(k, g);
  }
  const lista = [...grupos.entries()].sort(
    ([, a], [, b]) => b.franja - a.franja || b.tipo - a.tipo || b.ultimo - a.ultimo,
  );
  return lista.slice(0, op.maximo ?? 5).map(([clave, g]) => {
    const guardado = (op.lugares ?? []).find(
      (l) =>
        l.etiqueta.trim() &&
        l.lat != null &&
        l.lng != null &&
        cerca(g.v, { lat: l.lat, lng: l.lng }),
    );
    const partes = partirDireccion(g.v.direccion);
    const motivo =
      g.franja > 0
        ? `${(idioma === 'en' ? DIAS.en : DIAS.es).at(dia) ?? ''} ${idioma === 'en' ? 'at this time' : 'a esta hora'}`
        : g.tipo > 1
          ? finDeSemana(dia)
            ? idioma === 'en'
              ? 'Weekends'
              : 'Fines de semana'
            : idioma === 'en'
              ? 'Weekdays'
              : 'Entre semana'
          : '';
    return {
      clave,
      titulo: guardado ? guardado.etiqueta.trim() : partes.titulo,
      detalle: guardado ? partes.titulo : partes.detalle,
      direccion: g.v.direccion,
      lat: g.v.lat,
      lng: g.v.lng,
      motivo,
    };
  });
}

// ───────────────────────────── Resultados del mapa ─────────────────────────────

export function ordenarResultados<T extends { distanciaM?: number | null }>(lista: T[]): T[] {
  return lista
    .map((x, i) => ({ x, i }))
    .sort(
      (a, b) =>
        (a.x.distanciaM ?? Number.POSITIVE_INFINITY) -
          (b.x.distanciaM ?? Number.POSITIVE_INFINITY) || a.i - b.i,
    )
    .map((a) => a.x);
}

/** «0,6 km» en español; «1.0 mi» en inglés (EE. UU.). Más de 10, sin decimales. */
export function textoDistanciaLugar(metros: number, idioma: Idioma): string {
  const n = idioma === 'en' ? metros / 1609.344 : metros / 1000;
  const txt = n >= 10 ? String(Math.round(n)) : n.toFixed(1);
  return `${idioma === 'en' ? txt : txt.replace('.', ',')} ${idioma === 'en' ? 'mi' : 'km'}`;
}
