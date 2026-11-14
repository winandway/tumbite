import { Hono } from 'hono';
import { estimarRuta } from '@tumbite/compartido';
import type { Env } from '../env';
import { sha256 } from '../cripto';
import { URL_RUTAS, claveContadorRutas, llaveRutas, topeRutasDia } from '../rutaPorCalles';
import { type Variables, base } from '../sesion';
import { ErrorDatos } from '../validar';
import { actorDeEmpresa, exigirPermiso } from './autorizacion';
import { rutaPorId } from './rutasComun';

/**
 * Divoox Flex · Fase 7 (C-FLEX-RUTA-CALLES). Todos los países.
 *
 * Kilómetros, duración y hora estimada por parada REALES de una ruta de Flex, sin gastar de más:
 * - La ORDENACIÓN de las paradas sigue con línea recta (`/optimizar`, sin Google).
 * - Al CONFIRMAR el orden (asignar u ofrecer la ruta, o el botón «Calcular tiempos reales») se
 *   pide a Google Routes «Compute Routes» la ruta entera con las paradas como puntos intermedios.
 * - Google cobra a la tarifa básica hasta 10 intermedios por consulta; con más, a una tarifa mayor
 *   (documentación de facturación de Routes API, leída el 13 nov 2026). Por eso la ruta se parte en
 *   tramos de, como mucho, 10 intermedios (12 puntos): N paradas = ceil(N / 11) consultas.
 * - Sin tráfico (`TRAFFIC_UNAWARE`, sin `departureTime`) y con la máscara mínima (distancia y
 *   duración de la ruta y de cada tramo), igual que `rutaPorCalles.ts`.
 * - Las consultas se apartan TODAS JUNTAS del MISMO tope diario de viajes (320 por sitio, la fila
 *   `rutas-calles:<día>` de `contadores`) en una sola sentencia: si no caben, no se pide nada y se
 *   usa la estimación de siempre.
 * - Se guarda con la ruta (`rutas_flex_calles`) con la huella del orden: mirar nunca recalcula y
 *   confirmar otra vez con el mismo orden tampoco.
 * - Si Google falla o no hay llave, la estimación (línea recta × factor de calle), marcada así.
 * - La ruta de Google no se dibuja en ningún mapa: solo se usan sus números.
 */
export const flexRutaCalles = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Tope de consultas a Google por EMPRESA y día (revisión del 13 nov): una sola empresa no puede
 * agotar el tope diario del sitio, que comparten los viajes de todos. Se aparta ANTES del global.
 */
export const TOPE_RUTAS_CALLES_EMPRESA_DIA = 20;
/** Intermedios por consulta que Google cobra a la tarifa básica. */
export const MAX_INTERMEDIOS_BASICO = 10;
/** Minutos que se suman en cada parada para la hora estimada (entregar y volver al vehículo). */
export const SEGUNDOS_POR_PARADA = 180;
/** Estimación de respaldo: los mismos parámetros por defecto de los viajes (calle 1,3× la recta, 30 km/h). */
const ESTIMACION = { factorCallePb: 13_000, velocidadKmh: 30 };
const TIEMPO_MS = 5_000;
const MASCARA =
  'routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration';

type Punto = { lat: number; lng: number };
export type Tramo = { paradaId: string; metros: number; segundos: number };
export type RutaCalles = {
  fuente: 'google' | 'estimada';
  metros: number;
  segundos: number;
  tramos: Tramo[];
  consultas: number;
  calculadoEn: string;
};

/** Parte los puntos [centro, p1…pN] en tramos que comparten extremo, con ≤ 10 intermedios. */
export function partirEnTramos<T>(puntos: T[], maxIntermedios = MAX_INTERMEDIOS_BASICO): T[][] {
  const paso = maxIntermedios + 1;
  const tramos: T[][] = [];
  for (let i = 0; i < puntos.length - 1; i += paso)
    tramos.push(puntos.slice(i, Math.min(i + paso, puntos.length - 1) + 1));
  return tramos;
}

const latLng = (p: Punto) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

/** El cuerpo exacto que se manda a Google (exportado para que la prueba lo vigile). */
export function cuerpoTramo(puntos: Punto[]) {
  return {
    origin: latLng(puntos[0]!),
    destination: latLng(puntos[puntos.length - 1]!),
    intermediates: puntos.slice(1, -1).map(latLng),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
  };
}

const segundosDe = (t: string | undefined) =>
  t && t.endsWith('s') && t.length > 1 ? Number(t.slice(0, -1)) : NaN;

async function pedirTramo(
  llave: string,
  puntos: Punto[],
): Promise<{ metros: number; segundos: number }[] | null> {
  try {
    const r = await fetch(URL_RUTAS, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': llave,
        'X-Goog-FieldMask': MASCARA,
      },
      body: JSON.stringify(cuerpoTramo(puntos)),
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
    if (!r.ok) {
      console.error('flex: Google Routes respondió', r.status, '— se usa la estimación');
      return null;
    }
    const d = (await r.json().catch(() => null)) as {
      routes?: { legs?: { distanceMeters?: number; duration?: string }[] }[];
    } | null;
    const legs = d?.routes?.[0]?.legs ?? [];
    if (legs.length !== puntos.length - 1) return null;
    const salida = legs.map((l) => ({
      metros: Math.round(Number(l.distanceMeters ?? 0)),
      segundos: Math.round(segundosDe(l.duration)),
    }));
    return salida.every((x) => Number.isFinite(x.metros) && Number.isFinite(x.segundos))
      ? salida
      : null;
  } catch (e) {
    console.error('flex: Google Routes no contestó', e instanceof Error ? e.name : e);
    return null;
  }
}

/** Aparta `k` consultas de un contador del día (una fila por clave); todas o ninguna. */
async function apartar(db: D1Database, clave: string, k: number, tope: number): Promise<boolean> {
  if (k <= 0 || k > tope) return false;
  const r = await db
    .prepare(
      `INSERT INTO contadores (clave, n) SELECT ?1, ?3 WHERE ?3 <= ?2
       ON CONFLICT(clave) DO UPDATE SET n = n + ?3 WHERE n + ?3 <= ?2`,
    )
    .bind(clave, tope, k)
    .run();
  return Number(r.meta?.changes ?? 0) > 0;
}

/** Devuelve `k` consultas apartadas (Google falló o no hubo cupo global). */
async function devolver(db: D1Database, clave: string, k: number) {
  await db.prepare('UPDATE contadores SET n = MAX(0, n - ?) WHERE clave = ?').bind(k, clave).run();
}

export function claveContadorEmpresa(empresaId: string, fecha = new Date()): string {
  return `rutas-calles-empresa:${empresaId}:${fecha.toISOString().slice(0, 10)}`;
}

function estimada(puntos: Punto[], ids: string[]): Tramo[] {
  return ids.map((paradaId, i) => {
    const e = estimarRuta(ESTIMACION, puntos.at(i)!, puntos.at(i + 1)!);
    return { paradaId, metros: e.distanciaM, segundos: e.duracionS };
  });
}

async function puntosDeRuta(db: D1Database, ruta: { id: string; centro_id: string | null }) {
  const { results } = await db
    .prepare(
      `SELECT rp.id, e.lat, e.lng FROM ruta_paradas rp JOIN envios e ON e.id = rp.envio_id
        WHERE rp.ruta_id = ? ORDER BY rp.orden`,
    )
    .bind(ruta.id)
    .all<{ id: string; lat: number | null; lng: number | null }>();
  const centro = ruta.centro_id
    ? await db
        .prepare('SELECT lat, lng FROM empresa_centros WHERE id = ?')
        .bind(ruta.centro_id)
        .first<{ lat: number | null; lng: number | null }>()
    : null;
  const paradas = results.filter((p) => p.lat !== null && p.lng !== null) as {
    id: string;
    lat: number;
    lng: number;
  }[];
  const origen =
    centro && centro.lat !== null && centro.lng !== null
      ? { lat: centro.lat, lng: centro.lng }
      : (paradas[0] ?? null);
  return { paradas, origen };
}

const aPublica = (f: {
  fuente: 'google' | 'estimada';
  metros: number;
  segundos: number;
  tramos_json: string;
  consultas: number;
  calculado_en: string;
}): RutaCalles => ({
  fuente: f.fuente,
  metros: f.metros,
  segundos: f.segundos,
  tramos: JSON.parse(f.tramos_json) as Tramo[],
  consultas: f.consultas,
  calculadoEn: f.calculado_en,
});

/** Lo guardado (una lectura por clave primaria). Nunca llama a Google. */
export async function rutaCallesGuardada(db: D1Database, rutaId: string) {
  const f = await db
    .prepare('SELECT * FROM rutas_flex_calles WHERE ruta_id = ?')
    .bind(rutaId)
    .first<Parameters<typeof aPublica>[0]>();
  return f ? aPublica(f) : null;
}

/**
 * Confirma los km y tiempos de la ruta con su orden actual. Si ya están calculados para ese mismo
 * orden, no pide nada. Nunca lanza por culpa de Google.
 */
export async function confirmarRutaCalles(
  env: Env,
  db: D1Database,
  ruta: { id: string; empresa_id: string; centro_id: string | null },
): Promise<RutaCalles | null> {
  const { paradas, origen } = await puntosDeRuta(db, ruta);
  if (!paradas.length || !origen) return null;
  const huella = await sha256(
    JSON.stringify([origen, ...paradas.map((p) => [p.id, p.lat, p.lng])]),
  );
  const previa = await db
    .prepare('SELECT huella_orden FROM rutas_flex_calles WHERE ruta_id = ?')
    .bind(ruta.id)
    .first<{ huella_orden: string }>();
  if (previa?.huella_orden === huella) return rutaCallesGuardada(db, ruta.id);
  // Si Google falló la vez anterior con este mismo orden, se permite UN reintento más tarde.
  const esReintento = previa?.huella_orden === `reintentar:${huella}`;

  const puntos: Punto[] = [origen, ...paradas];
  const ids = paradas.map((p) => p.id);
  const grupos = partirEnTramos(puntos);
  const k = grupos.length;
  const llave = llaveRutas(env);
  let tramos: Tramo[] | null = null;
  let consultas = 0;
  let fallo = false;
  const claveEmpresa = claveContadorEmpresa(ruta.empresa_id);
  if (llave) {
    // Primero el tope de la empresa; después el del sitio. Si uno no alcanza, no se pide nada.
    if (!(await apartar(db, claveEmpresa, k, TOPE_RUTAS_CALLES_EMPRESA_DIA))) {
      console.error('flex: tope diario de la empresa sin cupo; ruta', ruta.id, 'estimada');
    } else if (!(await apartar(db, claveContadorRutas(), k, topeRutasDia(env)))) {
      await devolver(db, claveEmpresa, k);
      console.error('flex: tope diario de rutas por calles sin cupo; ruta', ruta.id, 'estimada');
    } else {
      const respuestas = await Promise.all(grupos.map((g) => pedirTramo(llave, g)));
      if (respuestas.every(Boolean)) {
        consultas = k;
        const legs = respuestas.flatMap((r) => r!);
        tramos = ids.map((paradaId, i) => ({
          paradaId,
          metros: legs.at(i)!.metros,
          segundos: legs.at(i)!.segundos,
        }));
      } else {
        // Google falló: se devuelve lo apartado y el resultado no queda como definitivo.
        await devolver(db, claveContadorRutas(), k);
        await devolver(db, claveEmpresa, k);
        fallo = true;
      }
    }
  }
  const huellaGuardada = fallo && !esReintento ? `reintentar:${huella}` : huella;
  const fuente = tramos ? 'google' : 'estimada';
  const lista = tramos ?? estimada(puntos, ids);
  const metros = lista.reduce((a, t) => a + t.metros, 0);
  const segundos = lista.reduce((a, t) => a + t.segundos, 0);
  await db
    .prepare(
      `INSERT INTO rutas_flex_calles (ruta_id, empresa_id, huella_orden, fuente, metros, segundos, tramos_json, consultas)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(ruta_id) DO UPDATE SET huella_orden = ?3, fuente = ?4, metros = ?5, segundos = ?6,
         tramos_json = ?7, consultas = consultas + ?8, calculado_en = datetime('now')`,
    )
    .bind(
      ruta.id,
      ruta.empresa_id,
      huellaGuardada,
      fuente,
      metros,
      segundos,
      JSON.stringify(lista),
      consultas,
    )
    .run();
  return rutaCallesGuardada(db, ruta.id);
}

/**
 * Hora estimada de llegada a cada parada desde `salida` (ISO o «AAAA-MM-DD HH:MM:SS» UTC):
 * manejo de cada tramo + 3 minutos en cada parada anterior.
 */
export function horasEstimadas(
  rc: RutaCalles,
  salida: string,
): { paradaId: string; llegada: string }[] {
  const t0 = Date.parse(salida.includes('T') ? salida : `${salida.replace(' ', 'T')}Z`);
  if (!Number.isFinite(t0)) return [];
  let t = t0;
  return rc.tramos.map((x, i) => {
    t += (x.segundos + (i > 0 ? SEGUNDOS_POR_PARADA : 0)) * 1000;
    return { paradaId: x.paradaId, llegada: new Date(t).toISOString() };
  });
}

flexRutaCalles.get('/empresas/:id/rutas/:rutaId/calles', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  const rc = await rutaCallesGuardada(db, r.id);
  return c.json({
    calles: rc,
    horas: rc ? horasEstimadas(rc, r.bloque_desde ?? new Date().toISOString()) : [],
  });
});

/** «Calcular tiempos reales»: confirma con el orden de ahora (no pide nada si ya está). */
flexRutaCalles.post('/empresas/:id/rutas/:rutaId/calles', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  const rc = await confirmarRutaCalles(c.env, db, r);
  if (!rc) throw new ErrorDatos('La ruta no tiene paradas con coordenadas.', undefined, 409);
  return c.json({
    calles: rc,
    horas: horasEstimadas(rc, r.bloque_desde ?? new Date().toISOString()),
  });
});
