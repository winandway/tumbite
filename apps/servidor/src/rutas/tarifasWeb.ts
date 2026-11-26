import { type Entorno, NOCHE_DESDE_H, NOCHE_HASTA_H } from '@tumbite/compartido';
import { servicioFinancieroViaje } from '../finanzas/conductor';
import { politicaVigente } from '../finanzas/politicas';
import { quienPagaViaje } from '../finanzas/quienPaga';
import { TOPE_RUTAS_POR_ZONA, repartoDePrecio } from '../precioZona';
import { filaATarifa, tarifaActiva } from './viajesPasajero';
import { abiertosParaLaWeb, claveCiudadPublica } from './servicios';
import { sinZonasDePrueba } from './zonas';

/**
 * C-TARIFAS-PUBLICAS (25 nov 2026, encargo de Richard: que Google y los buscadores de IA digan que
 * Divoox ya está en Venezuela y cuánto cuesta) — Venezuela y cualquier ciudad con precios fijos.
 *
 * Los precios fijos de una ciudad pública salen de los MISMOS datos que cobra el sistema: las rutas
 * activas de `rutas_precio_zona` de su zona y la tarifa vigente (`tarifas_viaje`, con el recargo y
 * las horas de la noche). Nunca un texto fijo.
 *
 * - **Lo que se muestra es lo que paga el pasajero:** el precio de la ruta más la tarifa de servicio
 *   si en esa ciudad la paga él (`repartoDePrecio`, la misma pieza de la cotización); de noche, con el
 *   mismo recargo (`recargoNocheDe`). Ni comisiones, ni umbrales, ni lo que gana el conductor.
 * - **Es lo más que se paga por ese trayecto:** al pedir, la app cobra el menor entre el precio fijo y
 *   el calculado por distancia. Por eso NO salen las rutas apagadas ni las marcadas «revisar» (su
 *   punto en el mapa es aproximado: un viaje que no cae en él podría no llevar ese precio). Cuando el
 *   equipo corrige el punto en el panel, la ruta aparece sola.
 * - **Solo si el servicio está abierto al público en esa ciudad** (la regla del catálogo sin sesión,
 *   `abiertosParaLaWeb`): no se publican precios de algo que hoy no se puede pedir.
 * - Sin ids internos (ni de zona, ni de ruta, ni de quién la escribió). Solo lee; la ruta va con caché.
 */
export type PrecioPublico = { dia: number; noche: number | null };
export type LugarPublico = {
  lugar: string;
  /** Desde el centro de la ciudad hasta el lugar. */
  ida: PrecioPublico | null;
  /** Del lugar de vuelta al centro. */
  regreso: PrecioPublico | null;
  /** Ida y vuelta con espera en el destino (si la ruta lo tiene). */
  idaVuelta: PrecioPublico | null;
};
export type GrupoPublico = { grupo: string | null; lugares: LugarPublico[] };
export type TarifasPublicas = {
  ciudad: string;
  servicio: string;
  moneda: string;
  /** El punto de partida de casi todas las rutas (el centro de la ciudad). */
  centro: string | null;
  grupos: GrupoPublico[];
  /** Trayectos que no salen ni llegan al centro. */
  otros: { desde: string; hasta: string; precio: PrecioPublico }[];
  /** Lo menos que cuesta un viaje que no está en la lista (el mínimo de la tarifa). */
  minimo: PrecioPublico | null;
  noche: { recargoPb: number; desdeH: number; hastaH: number; zonaHoraria: string } | null;
  /** Fecha (AAAA-MM-DD) del último cambio de un precio publicado. */
  actualizado: string | null;
};

type FilaRuta = {
  desde_nombre: string | null;
  hasta_nombre: string;
  precio: number;
  precio_ida_vuelta: number | null;
  grupo: string | null;
  actualizada_en: string;
};

/** Lugar «sin nombre de ciudad» para comparar nombres («El Vigía (casco urbano)» = «el vigia»). */
const llano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Los servicios con página de precios públicos (hoy, solo Moto). */
export const SERVICIOS_TARIFAS_PUBLICAS = ['moto'] as const;
export type ServicioTarifasPublicas = (typeof SERVICIOS_TARIFAS_PUBLICAS)[number];

type ZonaPublica = {
  id: string;
  nombre: string;
  pais: string;
  moneda: string;
  zona_horaria: string;
};

/**
 * Caché en la memoria del aislado (regla de la nube: mirar no escribe y lee lo menos posible). Cada
 * ciudad y la lista de zonas públicas duran 5 minutos: una visita repetida, un robot o una ciudad que
 * no existe no vuelven a leer la base. Lo mismo que promete la cabecera de la ruta.
 */
export const CACHE_TARIFAS_MS = 5 * 60_000;
const cache = new Map<string, { hasta: number; valor: unknown }>();
async function enCache<T>(llave: string, ahora: number, leer: () => Promise<T>): Promise<T> {
  const g = cache.get(llave);
  if (g && g.hasta > ahora) return g.valor as T;
  const valor = await leer();
  // Tope para que un robot que prueba claves al azar no llene la memoria.
  if (cache.size > 500) cache.clear();
  cache.set(llave, { hasta: ahora + CACHE_TARIFAS_MS, valor });
  return valor;
}
/** Solo para las pruebas: olvida lo guardado en memoria. */
export function olvidarCacheTarifas() {
  cache.clear();
}

/** Las tarifas públicas de una ciudad, con caché de 5 minutos por entorno, ciudad y servicio. */
export async function tarifasPublicasConCache(
  db: D1Database,
  clave: string,
  servicio: ServicioTarifasPublicas,
  entorno: Entorno | null,
  ahora = Date.now(),
): Promise<TarifasPublicas | null> {
  const zonas = await enCache(`zonas:${entorno ?? ''}`, ahora, () => zonasPublicas(db));
  // Una ciudad que no existe se contesta con la lista de zonas ya en memoria: sin otra lectura.
  const zona = zonas.find((z) => claveCiudadPublica(z.nombre) === clave);
  if (!zona) return null;
  return enCache(`tarifas:${entorno ?? ''}:${clave}:${servicio}`, ahora, () =>
    tarifasPublicas(db, clave, servicio, entorno, zona),
  );
}

async function zonasPublicas(db: D1Database): Promise<ZonaPublica[]> {
  const { results } = await db
    .prepare(
      `SELECT id, nombre, pais, moneda, zona_horaria FROM zonas
        WHERE activa = 1 AND ${sinZonasDePrueba('nombre')} ORDER BY id LIMIT 500`,
    )
    .all<ZonaPublica>();
  return results;
}

export async function tarifasPublicas(
  db: D1Database,
  clave: string,
  servicio: string,
  entorno: Entorno | null,
  zonaDada?: ZonaPublica,
): Promise<TarifasPublicas | null> {
  // La ciudad pública: una zona activa que no es de pruebas, con ese nombre.
  const zona =
    zonaDada ?? (await zonasPublicas(db)).find((z) => claveCiudadPublica(z.nombre) === clave);
  if (!zona) return null;
  const abiertos = await abiertosParaLaWeb(db, entorno);
  const delPais = new Map(Object.entries(abiertos.ciudades)).get(zona.pais) ?? {};
  const abiertosAqui = new Map(Object.entries(delPais)).get(clave) ?? [];
  if (!abiertosAqui.some((s) => s.id === servicio)) return null;

  const fila = await tarifaActiva(db, servicio, zona.id);
  const tarifa = fila ? filaATarifa(fila) : null;
  const moneda = fila?.moneda ?? zona.moneda;
  const [{ results: rutas }, pol, quienPaga] = await Promise.all([
    db
      .prepare(
        `SELECT desde_nombre, hasta_nombre, precio, precio_ida_vuelta, grupo, actualizada_en
           FROM rutas_precio_zona
          WHERE zona_id = ? AND servicio_id = ? AND activa = 1 AND revisar = 0 AND moneda = ?
          ORDER BY grupo, precio, hasta_nombre LIMIT ${TOPE_RUTAS_POR_ZONA}`,
      )
      .bind(zona.id, servicio, moneda)
      .all<FilaRuta>(),
    politicaVigente(db, {
      servicio: servicioFinancieroViaje(servicio),
      tipoCuenta: 'conductor',
      pais: zona.pais,
      ciudad: zona.id,
      moneda,
    }),
    // Envíos va siempre con «conductor» (como la cotización).
    servicio === 'envios'
      ? Promise.resolve('conductor' as const)
      : quienPagaViaje(db, zona.pais, zona.id, servicio),
  ]);
  const ctx = {
    quienPaga,
    regla: pol && pol.modalidad === 'prepago' ? pol.regla : null,
    descuentoPb: pol?.descuentoPb ?? 0,
    tarifa,
  };
  const precio = (p: number): PrecioPublico => {
    const r = repartoDePrecio(p, ctx);
    return { dia: r.pasajero, noche: r.noche?.pasajero ?? null };
  };

  // El centro: el lugar que más se repite en las puntas de las rutas.
  const cuenta = new Map<string, number>();
  for (const r of rutas)
    for (const n of [r.desde_nombre, r.hasta_nombre])
      if (n) cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
  const centro = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const grupos = new Map<string, GrupoPublico>();
  const lugares = new Map<string, LugarPublico>();
  const otros: TarifasPublicas['otros'] = [];
  for (const r of rutas) {
    const desdeCentro = r.desde_nombre == null || r.desde_nombre === centro;
    const lugar = desdeCentro ? r.hasta_nombre : r.hasta_nombre === centro ? r.desde_nombre : null;
    if (!lugar || lugar === centro) {
      otros.push({ desde: r.desde_nombre ?? '', hasta: r.hasta_nombre, precio: precio(r.precio) });
      continue;
    }
    const g = r.grupo?.trim() || null;
    const llave = `${g ?? ''}\u0000${llano(lugar)}`;
    let l = lugares.get(llave);
    if (!l) {
      l = { lugar, ida: null, regreso: null, idaVuelta: null };
      lugares.set(llave, l);
      const grupo = grupos.get(g ?? '') ?? { grupo: g, lugares: [] };
      grupo.lugares.push(l);
      grupos.set(g ?? '', grupo);
    }
    // Si hay dos rutas al mismo lugar, vale la más barata (la que ganaría al cotizar).
    const menor = (a: PrecioPublico | null, b: PrecioPublico) => (a && a.dia <= b.dia ? a : b);
    if (desdeCentro) {
      l.ida = menor(l.ida, precio(r.precio));
      if (r.precio_ida_vuelta) l.idaVuelta = menor(l.idaVuelta, precio(r.precio_ida_vuelta));
    } else l.regreso = menor(l.regreso, precio(r.precio));
  }
  // Por grupo (sin grupo al final) y, dentro, del más barato al más caro.
  const lista = [...grupos.values()].sort((a, b) =>
    a.grupo == null ? 1 : b.grupo == null ? -1 : a.grupo.localeCompare(b.grupo, 'es'),
  );
  const base = (l: LugarPublico) => (l.ida ?? l.regreso)?.dia ?? 0;
  for (const g of lista)
    g.lugares.sort((a, b) => base(a) - base(b) || a.lugar.localeCompare(b.lugar, 'es'));

  const recargoPb = tarifa?.recargoNochePb ?? 0;
  return {
    ciudad: clave,
    servicio,
    moneda: moneda.toUpperCase(),
    centro,
    grupos: lista,
    otros,
    minimo: tarifa && tarifa.minimo > 0 ? precio(tarifa.minimo) : null,
    noche:
      recargoPb > 0
        ? {
            recargoPb,
            desdeH: tarifa?.nocheDesdeH ?? NOCHE_DESDE_H,
            hastaH: tarifa?.nocheHastaH ?? NOCHE_HASTA_H,
            zonaHoraria: zona.zona_horaria,
          }
        : null,
    actualizado:
      rutas
        .map((r) => r.actualizada_en.slice(0, 10))
        .sort()
        .at(-1) ?? null,
  };
}
