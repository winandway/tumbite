import { distanciaKm, estimarRuta, type TarifaViaje } from '@tumbite/compartido';
import type { Env } from './env';

/**
 * C-RUTA-POR-CALLES (13 nov 2026, todos los países): distancia y tiempo REALES por calles para el
 * precio de un viaje (Moto, Carro, Envíos), con Google Routes API «Compute Routes» básico.
 *
 * Es MUNDIAL: sirve para cualquier origen y destino del planeta y no lleva lista de ciudades. Abrir
 * una ciudad nueva (panel: «Abrir un servicio de viajes en una ciudad») no pide nada aquí. La usan
 * todos los servicios que cotizan por `/datos/viajes/cotizar` (Moto, Carro, Envíos) y comparten el
 * mismo tope diario.
 *
 * Reglas que NO se tocan (docs/investigaciones/2026-11-13-mapas-y-distancia-por-calles.md):
 * - Se pide SIN tráfico: `routingPreference: TRAFFIC_UNAWARE` y nunca `departureTime` ni otra
 *   preferencia de tráfico. Con tráfico Google lo factura como «Pro», mucho más caro.
 * - La máscara pide SOLO `routes.distanceMeters,routes.duration` (más campos también suben de precio).
 * - Solo sirve para el PRECIO. La ruta de Google nunca se dibuja sobre un mapa que no sea de Google
 *   (lo prohíben sus términos) y no se guarda en una tabla de caché: lo que queda es la distancia
 *   cobrada, dentro de la cotización del viaje.
 * - Tope propio de consultas por día y por sitio, además del de Google Cloud. Un solo contador por
 *   día en la tabla `contadores` (una fila que sube), nunca una fila por consulta.
 * - Si no hay llave, Google falla (403 API no habilitada, 429 cuota, tiempo agotado) o se llegó al
 *   tope, se usa la fórmula de siempre (`estimarRuta`) SIN error para el pasajero, y queda anotado
 *   el motivo en el registro.
 */

/** Consultas a Google por día y por sitio (se puede cambiar con TOPE_RUTAS_CALLES_DIA). */
export const TOPE_RUTAS_CALLES_DIA = 320;
/** Tiempo máximo de espera a Google: la cotización no puede quedarse colgada. */
export const TIEMPO_RUTA_MS = 3_000;
/** La misma ruta del mismo pasajero se reutiliza durante estos minutos (recotizaciones). */
export const REUSO_RUTA_MINUTOS = 10;
/** Qué tan cerca deben estar origen y destino para contar como «la misma ruta». */
export const REUSO_RUTA_RADIO_M = 50;

/**
 * Cota de cordura (revisión del 13 nov 2026): si Google devuelve una distancia de más de 3 veces la
 * línea recta (y la recta pasa de 1 km, para no castigar trayectos cortos con vueltas) o una
 * velocidad media imposible, se cobra con la fórmula y queda el motivo `ruta_absurda`.
 */
export const FACTOR_MAXIMO_SOBRE_RECTA = 3;
export const RECTA_MINIMA_PARA_FACTOR_M = 1_000;
export const VELOCIDAD_MINIMA_KMH = 3;
export const VELOCIDAD_MAXIMA_KMH = 130;
/** Consultas a Google por usuario y día; pasado eso, ese usuario cotiza con la fórmula. */
export const TOPE_RUTAS_USUARIO_DIA = 20;

/** ¿La ruta de Google es creíble para cobrar? */
export function rutaCreible(origen: Punto, destino: Punto, distanciaM: number, duracionS: number) {
  const rectaM = distanciaKm(origen, destino) * 1000;
  if (rectaM > RECTA_MINIMA_PARA_FACTOR_M && distanciaM > FACTOR_MAXIMO_SOBRE_RECTA * rectaM)
    return false;
  const kmh = distanciaM / 1000 / (duracionS / 3600);
  return kmh >= VELOCIDAD_MINIMA_KMH && kmh <= VELOCIDAD_MAXIMA_KMH;
}

/**
 * Consultas a Google de este usuario hoy (UTC): sus cotizaciones por calles del día, con el índice
 * `cotizaciones_viaje_cliente` (lee solo sus filas de hoy, ninguna escritura). Cuenta también las
 * recotizaciones reutilizadas: el tope queda del lado prudente.
 */
async function consultasDelUsuarioHoy(db: D1Database, clienteId: string): Promise<number> {
  const f = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM cotizaciones_viaje
        WHERE cliente_id = ? AND creado_en >= date('now') AND fuente_distancia = 'calles'`,
    )
    .bind(clienteId)
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

export const URL_RUTAS = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const MASCARA = 'routes.distanceMeters,routes.duration';

export type FuenteDistancia = 'calles' | 'estimada';
type Punto = { lat: number; lng: number };
export type RutaCotizada = {
  distanciaM: number;
  duracionS: number;
  fuente: FuenteDistancia;
  /** Por qué se usó la fórmula (vacío si salió de Google). */
  motivo: string;
  /** Salió de una cotización anterior del mismo pasajero (no se le preguntó otra vez a Google). */
  reutilizada: boolean;
};

/** Último estado visto en este servidor (para el canario; no se escribe en la base por mirar). */
let ultimoEstado: 'ok' | 'estimada' | 'error' | null = null;

export function topeRutasDia(env: Env): number {
  const n = Number(env.TOPE_RUTAS_CALLES_DIA ?? TOPE_RUTAS_CALLES_DIA);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : TOPE_RUTAS_CALLES_DIA;
}

export function llaveRutas(env: Env): string | null {
  return env.GOOGLE_ROUTES_KEY || env.GOOGLE_PLACES_KEY || null;
}

/** Clave del contador del día (UTC) en la tabla `contadores`. */
export function claveContadorRutas(fecha = new Date()): string {
  return `rutas-calles:${fecha.toISOString().slice(0, 10)}`;
}

/**
 * Aparta una consulta del tope del día en UNA sola sentencia (sube el contador solo si no llegó al
 * tope). Devuelve false si ya no quedan. Una fila por día, nunca una por consulta.
 */
async function apartarConsulta(db: D1Database, tope: number): Promise<boolean> {
  if (tope <= 0) return false;
  const r = await db
    .prepare(
      `INSERT INTO contadores (clave, n) VALUES (?1, 1)
       ON CONFLICT(clave) DO UPDATE SET n = n + 1 WHERE n < ?2`,
    )
    .bind(claveContadorRutas(), tope)
    .run();
  return Number(r.meta?.changes ?? 0) > 0;
}

/** Consultas a Google hechas hoy en este sitio (una lectura). */
export async function consultasRutasHoy(db: D1Database): Promise<number> {
  const f = await db
    .prepare('SELECT n FROM contadores WHERE clave = ?')
    .bind(claveContadorRutas())
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

/** El cuerpo exacto que se manda a Google (exportado para que la prueba lo vigile). */
export function cuerpoRutas(origen: Punto, destino: Punto) {
  return {
    origin: { location: { latLng: { latitude: origen.lat, longitude: origen.lng } } },
    destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
  };
}

type Respuesta =
  { ok: true; distanciaM: number; duracionS: number } | { ok: false; motivo: string };

/** Una consulta a Google (sin contador ni reuso). */
export async function consultarGoogle(
  llave: string,
  origen: Punto,
  destino: Punto,
): Promise<Respuesta> {
  let r: Response;
  try {
    r = await fetch(URL_RUTAS, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': llave,
        'X-Goog-FieldMask': MASCARA,
      },
      body: JSON.stringify(cuerpoRutas(origen, destino)),
      signal: AbortSignal.timeout(TIEMPO_RUTA_MS),
    });
  } catch (e) {
    const nombre = e instanceof Error ? e.name : '';
    ultimoEstado = 'estimada';
    return {
      ok: false,
      motivo: nombre === 'TimeoutError' || nombre === 'AbortError' ? 'tiempo_agotado' : 'sin_red',
    };
  }
  if (!r.ok) {
    // 403: la llave no tiene Routes API habilitada. 429: se acabó la cuota de Google. Las dos son
    // normales mientras el dueño no la habilita: se usa la fórmula. 400 = mandamos algo mal: roto.
    ultimoEstado = r.status === 400 ? 'error' : 'estimada';
    return {
      ok: false,
      motivo:
        r.status === 403
          ? 'api_no_habilitada'
          : r.status === 429
            ? 'cuota_google'
            : `google_${r.status}`,
    };
  }
  const d = (await r.json().catch(() => null)) as {
    routes?: { distanceMeters?: number; duration?: string }[];
  } | null;
  if (!d) {
    ultimoEstado = 'error';
    return { ok: false, motivo: 'respuesta_ilegible' };
  }
  const ruta = d.routes?.[0];
  // Google manda la duración como texto «1260s».
  const texto = ruta?.duration ?? '';
  const segundos = texto.endsWith('s') && texto.length > 1 ? Number(texto.slice(0, -1)) : NaN;
  const metros = Number(ruta?.distanceMeters ?? NaN);
  if (!Number.isFinite(metros) || !Number.isFinite(segundos) || metros <= 0) {
    // Sin ruta por calles entre esos puntos (una isla, un punto en el agua): Google responde bien.
    ultimoEstado = 'ok';
    return { ok: false, motivo: 'sin_ruta' };
  }
  ultimoEstado = 'ok';
  return {
    ok: true,
    distanciaM: Math.round(metros),
    duracionS: Math.max(60, Math.round(segundos)),
  };
}

/** ¿Hay una cotización reciente del mismo pasajero por calles para la misma ruta? */
async function rutaReciente(
  db: D1Database,
  clienteId: string,
  origen: Punto,
  destino: Punto,
): Promise<{ distanciaM: number; duracionS: number } | null> {
  const r = await db
    .prepare(
      `SELECT origen_lat, origen_lng, destino_lat, destino_lng, distancia_m, duracion_s
         FROM cotizaciones_viaje
        WHERE cliente_id = ? AND creado_en >= datetime('now', ?) AND fuente_distancia = 'calles'
        ORDER BY creado_en DESC LIMIT 10`,
    )
    .bind(clienteId, `-${REUSO_RUTA_MINUTOS} minutes`)
    .all<{
      origen_lat: number;
      origen_lng: number;
      destino_lat: number;
      destino_lng: number;
      distancia_m: number;
      duracion_s: number;
    }>();
  const cerca = (a: Punto, b: Punto) => distanciaKm(a, b) * 1000 <= REUSO_RUTA_RADIO_M;
  const f = r.results.find(
    (x) =>
      cerca({ lat: x.origen_lat, lng: x.origen_lng }, origen) &&
      cerca({ lat: x.destino_lat, lng: x.destino_lng }, destino),
  );
  return f ? { distanciaM: f.distancia_m, duracionS: f.duracion_s } : null;
}

/**
 * La distancia y el tiempo que se cobran en una cotización. Nunca lanza por culpa de Google:
 * si algo falla, devuelve la fórmula (`estimarRuta`) con su motivo.
 */
export async function rutaParaCotizar(
  env: Env,
  db: D1Database,
  clienteId: string,
  tarifa: Pick<TarifaViaje, 'factorCallePb' | 'velocidadKmh'>,
  origen: Punto,
  destino: Punto,
): Promise<RutaCotizada> {
  const estimada = (motivo: string): RutaCotizada => {
    console.warn(`rutas: se usa la distancia estimada (${motivo})`);
    return {
      ...estimarRuta(tarifa, origen, destino),
      fuente: 'estimada',
      motivo,
      reutilizada: false,
    };
  };
  const llave = llaveRutas(env);
  if (!llave) {
    ultimoEstado = 'estimada';
    return estimada('sin_llave');
  }
  try {
    const previa = await rutaReciente(db, clienteId, origen, destino);
    if (previa) return { ...previa, fuente: 'calles', motivo: '', reutilizada: true };
    if ((await consultasDelUsuarioHoy(db, clienteId)) >= TOPE_RUTAS_USUARIO_DIA)
      return estimada('tope_usuario');
    if (!(await apartarConsulta(db, topeRutasDia(env)))) {
      ultimoEstado = 'estimada';
      return estimada('tope_del_dia');
    }
  } catch (e) {
    console.error('rutas: no se pudo leer el contador o la cotización anterior', e);
    return estimada('base');
  }
  const g = await consultarGoogle(llave, origen, destino);
  if (!g.ok) return estimada(g.motivo);
  if (!rutaCreible(origen, destino, g.distanciaM, g.duracionS)) return estimada('ruta_absurda');
  return {
    distanciaM: g.distanciaM,
    duracionS: g.duracionS,
    fuente: 'calles',
    motivo: '',
    reutilizada: false,
  };
}

/** Canario: ok (Google responde), estimada (sin llave o sin la API: fórmula) o error (roto). */
export async function saludRutas(
  env: Env,
  db: D1Database | undefined,
): Promise<{ estado: 'ok' | 'estimada' | 'error'; consultasHoy: number; tope: number }> {
  const tope = topeRutasDia(env);
  const consultasHoy = db ? await consultasRutasHoy(db).catch(() => 0) : 0;
  const estado = !llaveRutas(env) ? 'estimada' : (ultimoEstado ?? 'ok');
  return { estado, consultasHoy, tope };
}

/** Solo para las pruebas: olvidar el último estado visto. */
export function reiniciarEstadoRutas(): void {
  ultimoEstado = null;
}
