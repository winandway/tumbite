import { useEffect, useState } from 'react';
import { estadoDelPais, type LugarCuenta, type PaisConCatalogo, sinAcentos } from './lugarCuenta';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026) — Venezuela y Estados Unidos.
 *
 * El catálogo de lugares donde VIVE la gente: archivos fijos del sitio (GeoNames, CC BY 4.0),
 * generados con `node scripts/lugares/generar-catalogo.mjs`. NUNCA es un mapa de cobertura: trae
 * todas las ciudades y pueblos del país, abiertos o no (C-SIN-LISTA-DE-CIUDADES).
 *
 * Se lee perezoso (un estado a la vez, o el índice nacional «principales»), se guarda en memoria y
 * se busca con código, sin IA, desde la primera letra y sin acentos ni mayúsculas.
 */

/** [lugarId, ciudad, municipio, lat, lng, poblacion] (+ estado en «principales»). */
export type FilaCatalogoLugar = [string, string, string, number, number, number, string?];

export type LugarCatalogo = {
  pais: PaisConCatalogo;
  estado: string;
  lugarId: string;
  ciudad: string;
  municipio: string;
  lat: number;
  lng: number;
  poblacion: number;
};

export function rutaCatalogo(pais: PaisConCatalogo, estado: string | 'principales'): string {
  return `/lugares/${pais}/${estado}.json`;
}

export function filaALugar(
  f: FilaCatalogoLugar,
  pais: PaisConCatalogo,
  estado?: string,
): LugarCatalogo | null {
  const est = estado ?? f[6];
  if (!est || !Array.isArray(f) || typeof f[0] !== 'string' || typeof f[1] !== 'string')
    return null;
  return {
    pais,
    estado: est,
    lugarId: f[0],
    ciudad: f[1],
    municipio: f[2] || '',
    lat: Number(f[3]),
    lng: Number(f[4]),
    poblacion: Number(f[5]) || 0,
  };
}

/** Lo que se manda al servidor al elegir (el contrato de lugarCuenta.ts). */
export function aLugarCuenta(l: LugarCatalogo): LugarCuenta {
  return {
    pais: l.pais,
    estado: l.estado,
    municipio: l.municipio || null,
    ciudad: l.ciudad,
    lugarId: l.lugarId,
    lat: l.lat,
    lng: l.lng,
  };
}

type Traer = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Lector del catálogo con caché en memoria. `base` es la misma dirección del servidor que usan las
 * apps (en la web, «» = el mismo sitio). Un fallo no queda guardado: la próxima vez se reintenta.
 */
export function crearCatalogoLugares(op: { base: string; fetch?: Traer }) {
  const traer: Traer = op.fetch ?? ((u) => fetch(u));
  const cache = new Map<string, Promise<LugarCatalogo[]>>();
  function leer(pais: PaisConCatalogo, estado: string | 'principales') {
    const ruta = rutaCatalogo(pais, estado);
    const hay = cache.get(ruta);
    if (hay) return hay;
    const promesa = traer(`${op.base}${ruta}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('catalogo');
        const filas = (await r.json()) as FilaCatalogoLugar[];
        if (!Array.isArray(filas)) throw new Error('catalogo');
        return filas
          .map((f) => filaALugar(f, pais, estado === 'principales' ? undefined : estado))
          .filter((x): x is LugarCatalogo => x !== null);
      })
      .catch((e: unknown) => {
        cache.delete(ruta);
        throw e;
      });
    cache.set(ruta, promesa);
    return promesa;
  }
  return {
    /** Todas las ciudades y pueblos de un estado. */
    estado: (pais: PaisConCatalogo, codigo: string) => leer(pais, codigo.toUpperCase()),
    /** Las más pobladas del país (para buscar sin haber elegido estado). */
    principales: (pais: PaisConCatalogo) => leer(pais, 'principales'),
  };
}
export type CatalogoLugares = ReturnType<typeof crearCatalogoLugares>;

// ——— Buscador ———

export type CoincideEn = 'ciudad' | 'municipio' | 'estado';
export type ResultadoLugar = {
  lugar: LugarCatalogo;
  coincideEn: CoincideEn;
  /** La ciudad partida en tres para resaltar lo que coincidió: [antes, coincide, después]. */
  resaltado: [string, string, string];
};

const normalizados = new WeakMap<LugarCatalogo, { c: string; m: string; e: string }>();
function norma(l: LugarCatalogo) {
  let n = normalizados.get(l);
  if (!n) {
    n = {
      c: sinAcentos(l.ciudad),
      m: sinAcentos(l.municipio),
      e: sinAcentos(estadoDelPais(l.pais, l.estado)?.nombre ?? ''),
    };
    normalizados.set(l, n);
  }
  return n;
}

function puntaje(n: { c: string; m: string; e: string }, q: string, estadoCodigo: string): number {
  if (n.c.startsWith(q)) return 0;
  if (n.c.includes(` ${q}`)) return 1;
  if (n.m.startsWith(q) || n.m.includes(` ${q}`)) return 2;
  if (n.e.startsWith(q) || n.e.includes(` ${q}`) || estadoCodigo.toLowerCase() === q) return 3;
  if (q.length >= 3 && n.c.includes(q)) return 4;
  return -1;
}

/** Una letra sin acento y en minúscula («É» → «e»); «ñ» se queda. */
function plegar(ch: string): string {
  if (ch === 'ñ' || ch === 'Ñ') return 'ñ';
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Parte un texto en [antes, lo que coincide, después], ignorando acentos y mayúsculas. */
export function resaltar(texto: string, consulta: string): [string, string, string] {
  const q = sinAcentos(consulta);
  if (!q) return [texto, '', ''];
  let plegado = '';
  const indice: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const p = /[a-z0-9ñ]/.test(plegar(texto.charAt(i))) ? plegar(texto.charAt(i)) : ' ';
    for (const ch of p) {
      plegado += ch;
      indice.push(i);
    }
  }
  // Preferir el comienzo de una palabra.
  let pos = plegado.startsWith(q) ? 0 : plegado.indexOf(` ${q}`);
  if (pos > 0) pos += 1;
  if (pos < 0) pos = plegado.indexOf(q);
  if (pos < 0) return [texto, '', ''];
  const desde = indice.at(pos) ?? 0;
  const hasta = (indice.at(pos + q.length - 1) ?? texto.length - 1) + 1;
  return [texto.slice(0, desde), texto.slice(desde, hasta), texto.slice(hasta)];
}

/**
 * Busca desde la primera letra por ciudad, municipio (o condado) o estado. Orden: primero lo que
 * empieza igual, después lo más poblado. Sin texto, devuelve las más pobladas.
 */
export function buscarLugares(
  lugares: readonly LugarCatalogo[],
  consulta: string,
  limite = 30,
): ResultadoLugar[] {
  const q = sinAcentos(consulta);
  if (!q)
    return [...lugares]
      .sort((a, b) => b.poblacion - a.poblacion)
      .slice(0, limite)
      .map((lugar) => ({ lugar, coincideEn: 'ciudad', resaltado: [lugar.ciudad, '', ''] }));
  const encontrados: { lugar: LugarCatalogo; p: number }[] = [];
  const vistos = new Set<string>();
  for (const lugar of lugares) {
    if (vistos.has(lugar.lugarId)) continue;
    const p = puntaje(norma(lugar), q, lugar.estado);
    if (p < 0) continue;
    vistos.add(lugar.lugarId);
    encontrados.push({ lugar, p });
  }
  encontrados.sort(
    (a, b) =>
      a.p - b.p ||
      b.lugar.poblacion - a.lugar.poblacion ||
      a.lugar.ciudad.localeCompare(b.lugar.ciudad, 'es'),
  );
  return encontrados.slice(0, limite).map(({ lugar, p }) => ({
    lugar,
    coincideEn: p <= 1 || p === 4 ? 'ciudad' : p === 2 ? 'municipio' : 'estado',
    resaltado: p <= 1 || p === 4 ? resaltar(lugar.ciudad, consulta) : [lugar.ciudad, '', ''],
  }));
}

/**
 * «No encuentro mi pueblo»: los municipios (o condados) del estado, cada uno con su lugar más
 * poblado. Al elegir uno, la cuenta queda en ese municipio con su ciudad principal: nunca se queda
 * sin poder seguir.
 */
export function municipiosDelEstado(lugares: readonly LugarCatalogo[]): LugarCatalogo[] {
  const mejor = new Map<string, LugarCatalogo>();
  for (const l of lugares) {
    if (!l.municipio) continue;
    const previo = mejor.get(l.municipio);
    if (!previo || l.poblacion > previo.poblacion) mejor.set(l.municipio, l);
  }
  return [...mejor.values()].sort((a, b) => a.municipio.localeCompare(b.municipio, 'es'));
}

/** Busca entre los municipios (o condados) del estado. */
export function buscarMunicipios(
  municipios: readonly LugarCatalogo[],
  consulta: string,
): LugarCatalogo[] {
  const q = sinAcentos(consulta);
  if (!q) return [...municipios];
  return municipios.filter((l) => {
    const m = sinAcentos(l.municipio);
    return m.startsWith(q) || m.includes(` ${q}`);
  });
}

/**
 * Lo que pinta el selector: los lugares sobre los que se busca. Con estado elegido, el estado
 * entero; sin estado, el índice nacional. Estado de carga y fallo para decirlo en palabras.
 */
export function useLugaresCatalogo(
  catalogo: CatalogoLugares,
  pais: PaisConCatalogo | null,
  estado: string | null,
): { lugares: LugarCatalogo[]; cargando: boolean; fallo: boolean; reintentar: () => void } {
  const [vuelta, setVuelta] = useState(0);
  const clave = pais ? `${pais}/${estado ?? 'principales'}/${vuelta}` : '';
  const [hecho, setHecho] = useState<{ clave: string; lugares: LugarCatalogo[]; fallo: boolean }>({
    clave: '',
    lugares: [],
    fallo: false,
  });
  useEffect(() => {
    if (!pais) return;
    let vivo = true;
    (estado ? catalogo.estado(pais, estado) : catalogo.principales(pais))
      .then((lugares) => {
        if (vivo) setHecho({ clave, lugares, fallo: false });
      })
      .catch(() => {
        // Sin red o sin archivo: se dice en palabras con «Reintentar» (nunca una lista en blanco).
        if (vivo) setHecho({ clave, lugares: [], fallo: true });
      });
    return () => {
      vivo = false;
    };
  }, [catalogo, pais, estado, clave]);
  const listo = hecho.clave === clave;
  return {
    lugares: listo ? hecho.lugares : [],
    cargando: Boolean(pais) && !listo,
    fallo: listo && hecho.fallo,
    reintentar: () => setVuelta((v) => v + 1),
  };
}
