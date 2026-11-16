import {
  type CalculoLlegada,
  type Detenido,
  type FaseRastreo,
  INTERVALO_LLEGADA_S,
  QUIETO_RADIO_M,
  detenido,
  distanciaKm,
  faseDePedido,
  faseDeEspera,
  faseDeViaje,
  hayQueRecalcular,
  llegadaVigente,
  metrosEntre,
} from '@tumbite/compartido';
import { correosEquipo } from './avisosEquipo';
import { enviarCorreo } from './correo';
import type { Env } from './env';
import { URL_RUTAS, llaveRutas } from './rutaPorCalles';

/**
 * C-HORA-LLEGADA (16 nov 2026, orden de Richard: «nosotros vivimos del tiempo y de los mapas»).
 * Todos los países. UNA sola pieza para la hora estimada de llegada de un pedido o de un viaje en
 * marcha: la calcula el SERVIDOR con Google Routes «Compute Routes» CON tráfico y la guarda en UNA
 * fila por pedido o viaje (`llegadas_estimadas`), que leen la ficha del equipo y la app del cliente.
 *
 * Reglas de dinero que no se tocan (regla «la nube no se come el dinero»):
 * - Se calcula SOLO con una ubicación nueva del repartidor o conductor que tiene un pedido o viaje
 *   en marcha (`POST /datos/repartidor/ubicacion`), nunca por mirar. Mirar la ficha o el seguimiento
 *   solo LEE la fila (por su llave primaria) y descuenta el tiempo con el reloj.
 * - Como mucho cada `INTERVALO_LLEGADA_S` (90 s) por pedido, antes solo si cambió de tramo, y si no
 *   se movió 150 m, cada 5 minutos (`hayQueRecalcular`, compartido).
 * - Tope propio de cálculos con tráfico por día y por sitio (`TOPE_LLEGADA_DIA`, por defecto 160:
 *   160 × 31 = 4.960 al mes, dentro de las 5.000 gratis de «Compute Routes Pro»). Un solo contador
 *   por día en `contadores`. Pasado el tope, sin llave o si Google falla: la fórmula de siempre, sin
 *   error para nadie, el motivo en el registro, un correo al equipo una vez al día y el canario
 *   `llegada` en «tope».
 * - Con tráfico Google lo cobra como «Pro» (10 USD cada 1.000 después de las 5.000 gratis del mes,
 *   leído el 16 nov 2026): cuentas en docs/COSTO-MAPA-Y-LLEGADA.md.
 * - La línea de la ruta solo se dibuja sobre el mapa de Google (sus términos) y se guarda de forma
 *   temporal: la fila se borra a las 24 horas (`depurarLlegadas`).
 */

export const TOPE_LLEGADA_DIA = 160;
export const TIEMPO_LLEGADA_MS = 3_000;
/** La fila de la llegada se borra pasado este tiempo desde su último cálculo. */
export const HORAS_FILA_LLEGADA = 24;
/** Fórmula de respaldo: la recta por este factor de calle a esta velocidad de ciudad. */
const FACTOR_CALLE = 1.3;
const KMH_CIUDAD = 25;
const MASCARA =
  'routes.distanceMeters,routes.duration,routes.legs.duration,routes.polyline.encodedPolyline';

type Punto = { lat: number; lng: number };
type Fila = Record<string, unknown>;

/** Último estado visto (para el canario; no se escribe en la base por mirar). */
let ultimoEstado: 'ok' | 'estimada' | 'error' | null = null;

export function topeLlegadaDia(env: Env): number {
  const n = Number(env.TOPE_LLEGADA_DIA ?? TOPE_LLEGADA_DIA);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : TOPE_LLEGADA_DIA;
}

export function claveContadorLlegada(fecha = new Date()): string {
  return `llegada-trafico:${fecha.toISOString().slice(0, 10)}`;
}

/** El cuerpo exacto que se manda a Google (exportado para que la prueba lo vigile). */
export function cuerpoLlegada(origen: Punto, intermedios: readonly Punto[], destino: Punto) {
  const lugar = (p: Punto) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  return {
    origin: lugar(origen),
    destination: lugar(destino),
    ...(intermedios.length ? { intermediates: intermedios.map(lugar) } : {}),
    travelMode: 'DRIVE',
    // Con tráfico: la hora de llegada tiene que ser la real (Google lo cobra como «Pro»).
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
  };
}

type Ruta = {
  distanciaM: number;
  duracionS: number;
  primerTramoS: number | null;
  ruta: string | null;
};

const segundos = (t: unknown): number => {
  const s = typeof t === 'string' ? t : '';
  return s.endsWith('s') && s.length > 1 ? Number(s.slice(0, -1)) : NaN;
};

/** Una consulta a Google con tráfico (sin contador). Nunca lanza. */
export async function consultarLlegadaGoogle(
  llave: string,
  origen: Punto,
  intermedios: readonly Punto[],
  destino: Punto,
): Promise<({ ok: true } & Ruta) | { ok: false; motivo: string }> {
  let r: Response;
  try {
    r = await fetch(URL_RUTAS, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': llave,
        'X-Goog-FieldMask': MASCARA,
      },
      body: JSON.stringify(cuerpoLlegada(origen, intermedios, destino)),
      signal: AbortSignal.timeout(TIEMPO_LLEGADA_MS),
    });
  } catch (e) {
    ultimoEstado = 'estimada';
    const n = e instanceof Error ? e.name : '';
    return {
      ok: false,
      motivo: n === 'TimeoutError' || n === 'AbortError' ? 'tiempo_agotado' : 'sin_red',
    };
  }
  if (!r.ok) {
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
    routes?: {
      distanceMeters?: number;
      duration?: string;
      legs?: { duration?: string }[];
      polyline?: { encodedPolyline?: string };
    }[];
  } | null;
  if (!d) {
    ultimoEstado = 'error';
    return { ok: false, motivo: 'respuesta_ilegible' };
  }
  ultimoEstado = 'ok';
  const ruta = d.routes?.[0];
  const metros = Number(ruta?.distanceMeters ?? NaN);
  const s = segundos(ruta?.duration);
  if (!Number.isFinite(metros) || !Number.isFinite(s) || metros < 0)
    return { ok: false, motivo: 'sin_ruta' };
  const primer = intermedios.length ? segundos(ruta?.legs?.[0]?.duration) : NaN;
  return {
    ok: true,
    distanciaM: Math.round(metros),
    duracionS: Math.max(0, Math.round(s)),
    primerTramoS: Number.isFinite(primer) ? Math.round(primer) : null,
    ruta: ruta?.polyline?.encodedPolyline ?? null,
  };
}

/** La fórmula de siempre: la recta por el factor de calle a velocidad de ciudad, tramo por tramo. */
export function llegadaPorFormula(
  origen: Punto,
  intermedios: readonly Punto[],
  destino: Punto,
): Ruta {
  const puntos = [origen, ...intermedios, destino];
  const tramos = puntos.slice(1).map((b, i) => {
    const km = distanciaKm(puntos.at(i) ?? b, b) * FACTOR_CALLE;
    return { m: km * 1000, s: Math.round((km / KMH_CIUDAD) * 3600) };
  });
  return {
    distanciaM: Math.round(tramos.reduce((t, x) => t + x.m, 0)),
    duracionS: tramos.reduce((t, x) => t + x.s, 0),
    primerTramoS: intermedios.length ? (tramos[0]?.s ?? null) : null,
    ruta: null,
  };
}

/** Aparta un cálculo del tope del día en UNA sentencia; false si ya no quedan. */
async function apartarCalculo(env: Env, db: D1Database): Promise<boolean> {
  const tope = topeLlegadaDia(env);
  if (tope <= 0) return false;
  const r = await db
    .prepare(
      `INSERT INTO contadores (clave, n) VALUES (?1, 1)
       ON CONFLICT(clave) DO UPDATE SET n = n + 1 WHERE n < ?2`,
    )
    .bind(claveContadorLlegada(), tope)
    .run();
  return Number(r.meta?.changes ?? 0) > 0;
}

/** Al llegar al tope, un correo al equipo UNA vez al día (una fila de contador que se marca). */
async function avisarTope(env: Env, db: D1Database): Promise<void> {
  const r = await db
    .prepare('INSERT OR IGNORE INTO contadores (clave, n) VALUES (?, 1)')
    .bind(`llegada-tope-aviso:${new Date().toISOString().slice(0, 10)}`)
    .run();
  if (Number(r.meta?.changes ?? 0) === 0) return;
  console.error('llegada: se alcanzó el tope diario de cálculos con tráfico; se usa la fórmula');
  const asunto = 'Hora de llegada: se alcanzó el tope diario de Google';
  const texto = `Hoy se hicieron ${topeLlegadaDia(env)} cálculos de la hora de llegada con tráfico (el tope del día). Hasta mañana, las horas de llegada se calculan con la fórmula de siempre, sin tráfico. Si hay muchos pedidos, se puede subir el tope con la variable TOPE_LLEGADA_DIA (cada 1.000 cálculos de más cuestan unos 10 USD).`;
  for (const para of await correosEquipo(env, 'sistema'))
    await enviarCorreo(env, { de: 'avisos', para, asunto, texto }).catch((e: unknown) =>
      console.error('llegada: correo del tope', e),
    );
}

/** Cálculos con tráfico hechos hoy (una lectura). */
export async function calculosLlegadaHoy(db: D1Database): Promise<number> {
  const f = await db
    .prepare('SELECT n FROM contadores WHERE clave = ?')
    .bind(claveContadorLlegada())
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

export type FilaLlegada = {
  calculo: CalculoLlegada;
  motivo: string;
  ruta: string | null;
  ancla: Punto & { en: number };
  objetivo: Punto | null;
  destino: Punto | null;
};

const num = (v: unknown): number | null =>
  v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const punto = (lat: unknown, lng: unknown): Punto | null => {
  const a = num(lat);
  const b = num(lng);
  return a == null || b == null ? null : { lat: a, lng: b };
};

/** La fila de la llegada de un pedido («pedido:<id>») o viaje («viaje:<id>»). Una lectura por PK. */
export async function leerLlegada(db: D1Database, clave: string): Promise<FilaLlegada | null> {
  const f = await db
    .prepare('SELECT * FROM llegadas_estimadas WHERE clave = ?')
    .bind(clave)
    .first<Fila>();
  return f ? aFilaLlegada(f) : null;
}

export function aFilaLlegada(f: Fila): FilaLlegada {
  return {
    calculo: {
      fase: String(f.fase) as FaseRastreo,
      duracionS: Number(f.duracion_s),
      tramoS: num(f.tramo_s),
      distanciaM: Number(f.distancia_m),
      fuente: f.fuente === 'trafico' ? 'trafico' : 'estimada',
      desde: { lat: Number(f.desde_lat), lng: Number(f.desde_lng) },
      calculadaEn: Number(f.calculada_en),
    },
    motivo: String(f.motivo ?? ''),
    ruta: f.ruta == null ? null : String(f.ruta),
    ancla: { lat: Number(f.ancla_lat), lng: Number(f.ancla_lng), en: Number(f.ancla_en) },
    objetivo: punto(f.objetivo_lat, f.objetivo_lng),
    destino: punto(f.destino_lat, f.destino_lng),
  };
}

/** Lo que hace falta para calcular la llegada de un pedido o viaje en marcha. */
export type Trayecto = {
  clave: string;
  fase: FaseRastreo;
  /** Paradas antes del destino final (el local, las paradas pendientes del viaje). */
  intermedios: Punto[];
  /** El próximo punto (el local o la recogida) para «detenido»; null si va directo al destino. */
  objetivo: Punto | null;
  destino: Punto;
  /** Para pedidos que todavía no recogió: cuándo estará lista la comida (ms). */
  listoMs?: number | null;
};

/**
 * Calcula (si toca) y guarda la llegada de un trayecto. Devuelve si se escribió. Nunca lanza por
 * Google: si falla, usa la fórmula y deja el motivo.
 */
export async function calcularSiToca(
  env: Env,
  db: D1Database,
  t: Trayecto,
  posicion: Punto,
  ahora = Date.now(),
): Promise<boolean> {
  const previa = await leerLlegada(db, t.clave);
  if (!hayQueRecalcular(previa?.calculo ?? null, { fase: t.fase, posicion, ms: ahora }))
    return false;
  let r: Ruta | null = null;
  let fuente: 'trafico' | 'estimada' = 'estimada';
  let motivo = '';
  const llave = llaveRutas(env);
  if (!llave) {
    ultimoEstado = 'estimada';
    motivo = 'sin_llave';
  } else if (!(await apartarCalculo(env, db))) {
    motivo = 'tope_del_dia';
    await avisarTope(env, db).catch((e: unknown) => console.error('llegada: aviso del tope', e));
  } else {
    const g = await consultarLlegadaGoogle(llave, posicion, t.intermedios, t.destino);
    if (g.ok) {
      r = g;
      fuente = 'trafico';
    } else motivo = g.motivo;
  }
  if (!r) {
    console.warn(`llegada: se usa la hora estimada por fórmula (${motivo})`);
    r = llegadaPorFormula(posicion, t.intermedios, t.destino);
  }
  // Va al local y la comida no estará lista cuando llegue: se suma lo que tendrá que esperar.
  let duracionS = r.duracionS;
  if (t.fase === 'al_restaurante' && t.listoMs != null && r.primerTramoS != null) {
    const llegaAlLocal = ahora + r.primerTramoS * 1000;
    duracionS += Math.max(0, Math.round((t.listoMs - llegaAlLocal) / 1000));
  }
  // El ancla (último lugar donde se lo vio moverse) solo cambia si se movió de verdad.
  const ancla =
    previa && metrosEntre(previa.ancla, posicion) < QUIETO_RADIO_M
      ? previa.ancla
      : { ...posicion, en: ahora };
  await db
    .prepare(
      `INSERT INTO llegadas_estimadas (clave, fase, duracion_s, tramo_s, distancia_m, fuente, motivo, ruta,
          desde_lat, desde_lng, calculada_en, ancla_lat, ancla_lng, ancla_en, objetivo_lat, objetivo_lng,
          destino_lat, destino_lng)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
       ON CONFLICT(clave) DO UPDATE SET fase = excluded.fase, duracion_s = excluded.duracion_s,
          tramo_s = excluded.tramo_s, distancia_m = excluded.distancia_m, fuente = excluded.fuente,
          motivo = excluded.motivo, ruta = excluded.ruta, desde_lat = excluded.desde_lat,
          desde_lng = excluded.desde_lng, calculada_en = excluded.calculada_en,
          ancla_lat = excluded.ancla_lat, ancla_lng = excluded.ancla_lng, ancla_en = excluded.ancla_en,
          objetivo_lat = excluded.objetivo_lat, objetivo_lng = excluded.objetivo_lng,
          destino_lat = excluded.destino_lat, destino_lng = excluded.destino_lng`,
    )
    .bind(
      t.clave,
      t.fase,
      duracionS,
      r.primerTramoS,
      r.distanciaM,
      fuente,
      motivo,
      r.ruta,
      posicion.lat,
      posicion.lng,
      ahora,
      ancla.lat,
      ancla.lng,
      ancla.en,
      t.objetivo?.lat ?? null,
      t.objetivo?.lng ?? null,
      t.destino.lat,
      t.destino.lng,
    )
    .run();
  return true;
}

const msDeBase = (f: unknown): number | null => {
  if (f == null || f === '') return null;
  const s = String(f);
  const v = Date.parse(`${s.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'}`);
  return Number.isNaN(v) ? null : v;
};

/** Cuándo estará lista la comida de un pedido (null si ya está lista o no se sabe). */
export function listoMsDe(p: {
  estado?: unknown;
  aceptado_en?: unknown;
  tiempo_prep_min?: unknown;
}) {
  if (p.estado === 'listo' || p.estado === 'en_camino') return null;
  const aceptado = msDeBase(p.aceptado_en);
  const prep = num(p.tiempo_prep_min);
  return aceptado == null ? null : aceptado + (prep ?? 20) * 60_000;
}

/** Los trayectos en marcha de un repartidor o conductor (pedidos agrupados y su viaje). */
export async function trayectosDe(db: D1Database, conductorId: string): Promise<Trayecto[]> {
  const [pedidos, viaje] = await Promise.all([
    db
      .prepare(
        `SELECT p.id, p.estado, p.lat, p.lng, p.aceptado_en, p.tiempo_prep_min, r.lat AS rest_lat, r.lng AS rest_lng,
            EXISTS (SELECT 1 FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'llego_restaurante') AS llego
           FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
          WHERE p.repartidor_id = ? AND p.estado IN ('aceptado', 'listo', 'en_camino')`,
      )
      .bind(conductorId)
      .all<Fila>()
      .then((x) => x.results),
    db
      .prepare(
        `SELECT o.id, v.estado, v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng
           FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
          WHERE o.conductor_id = ? AND o.estado_general IN ('asignada', 'en_curso')`,
      )
      .bind(conductorId)
      .first<Fila>(),
  ]);
  const lista: Trayecto[] = [];
  for (const p of pedidos) {
    const casa = punto(p.lat, p.lng);
    const local = punto(p.rest_lat, p.rest_lng);
    const fase = faseDePedido({
      estado: String(p.estado),
      conRepartidor: true,
      llegoAlRestaurante: Number(p.llego) === 1,
    });
    if (!fase || !casa) continue;
    const alLocal = fase === 'al_restaurante' && local != null;
    lista.push({
      clave: `pedido:${String(p.id)}`,
      fase,
      intermedios: alLocal ? [local] : [],
      objetivo: fase === 'llevando' ? null : local,
      destino: casa,
      listoMs: listoMsDe(p),
    });
  }
  if (viaje) {
    const fase = faseDeViaje(String(viaje.estado));
    const origen = punto(viaje.origen_lat, viaje.origen_lng);
    const destino = punto(viaje.destino_lat, viaje.destino_lng);
    if (fase && origen && destino) {
      const paradas =
        fase === 'a_recogida'
          ? []
          : await db
              .prepare(
                "SELECT lat, lng FROM paradas_viaje WHERE operacion_id = ? AND estado IN ('pendiente', 'en_parada') ORDER BY orden",
              )
              .bind(String(viaje.id))
              .all<Fila>()
              .then((x) => x.results.flatMap((f) => punto(f.lat, f.lng) ?? []));
      // Viniendo a recoger, la hora que importa es la de la recogida (como Uber: «llega a las…»).
      lista.push({
        clave: `viaje:${String(viaje.id)}`,
        fase,
        intermedios: fase === 'a_recogida' ? [] : paradas,
        objetivo: fase === 'a_recogida' ? null : origen,
        destino: fase === 'a_recogida' ? origen : destino,
      });
    }
  }
  return lista;
}

/**
 * Con cada ubicación nueva del repartidor o conductor: la llegada de sus trayectos en marcha, si
 * toca. Lo llama `POST /datos/repartidor/ubicacion` después de responder (waitUntil).
 */
export async function actualizarLlegadas(
  env: Env,
  db: D1Database,
  conductorId: string,
  posicion: Punto,
  ahora = Date.now(),
): Promise<number> {
  let escritas = 0;
  for (const t of await trayectosDe(db, conductorId))
    if (await calcularSiToca(env, db, t, posicion, ahora)) escritas++;
  return escritas;
}

/** La posición más fresca de un repartidor o conductor (la última lectura o su ficha). Solo lee. */
export async function posicionDe(
  db: D1Database,
  usuarioId: string,
): Promise<(Punto & { en: number }) | null> {
  const [reciente, ficha] = await Promise.all([
    db
      .prepare(
        'SELECT lat, lng, creado_en FROM ubicaciones_recientes WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
      )
      .bind(usuarioId)
      .first<Fila>(),
    db
      .prepare('SELECT lat, lng, ubicacion_en FROM repartidores WHERE usuario_id = ?')
      .bind(usuarioId)
      .first<Fila>(),
  ]);
  const a = reciente ? punto(reciente.lat, reciente.lng) : null;
  const aEn = msDeBase(reciente?.creado_en);
  const b = ficha ? punto(ficha.lat, ficha.lng) : null;
  const bEn = msDeBase(ficha?.ubicacion_en);
  if (a && aEn != null && (bEn == null || aEn >= bEn)) return { ...a, en: aEn };
  if (b && bEn != null) return { ...b, en: bEn };
  return null;
}

export type LlegadaPublica = {
  fase: FaseRastreo;
  llegaEn: string;
  faltanS: number;
  tramoFaltanS: number | null;
  distanciaM: number;
  fuente: 'trafico' | 'estimada';
  calculadaHaceS: number;
};

/** La llegada para mostrar (ISO), a partir de la fila guardada. Null si no corresponde al tramo. */
export function llegadaParaMostrar(
  fila: FilaLlegada | null,
  faseActual: FaseRastreo | null,
  ahora = Date.now(),
  listoMs: number | null = null,
): LlegadaPublica | null {
  if (!fila || !faseActual || fila.calculo.fase !== faseActual) return null;
  const espera =
    faseDeEspera(faseActual) && listoMs != null ? Math.max(0, (listoMs - ahora) / 1000) : 0;
  const v = llegadaVigente(fila.calculo, ahora, espera);
  return {
    fase: v.fase,
    llegaEn: new Date(v.llegaEnMs).toISOString(),
    faltanS: v.faltanS,
    tramoFaltanS: v.tramoFaltanS,
    distanciaM: v.distanciaM,
    fuente: v.fuente,
    calculadaHaceS: v.calculadaHaceS,
  };
}

/** ¿Detenido? Con la fila (ancla, objetivo y destino) y la posición. */
export function detenidoDe(
  fila: FilaLlegada | null,
  fase: FaseRastreo | null,
  pos: (Punto & { en: number }) | null,
  ahora = Date.now(),
): Detenido | null {
  return detenido({
    fase,
    posicion: pos,
    posicionEn: pos?.en ?? null,
    ancla: fila && fila.calculo.fase === fase ? fila.ancla : null,
    puntos: [fila?.objetivo ?? null, fila?.destino ?? null],
    ahoraMs: ahora,
  });
}

/** Canario: ok (Google con tráfico), estimada (sin llave o sin la API), tope o error. Solo lee. */
export async function saludLlegada(
  env: Env,
  db: D1Database | undefined,
): Promise<{ estado: 'ok' | 'estimada' | 'tope' | 'error'; calculosHoy: number; tope: number }> {
  const tope = topeLlegadaDia(env);
  const calculosHoy = db ? await calculosLlegadaHoy(db).catch(() => 0) : 0;
  const estado = !llaveRutas(env)
    ? 'estimada'
    : calculosHoy >= tope
      ? 'tope'
      : (ultimoEstado ?? 'ok');
  return { estado, calculosHoy, tope };
}

/** Borra las filas de llegada viejas (guardado temporal de la ruta de Google). Lee por la tabla chica. */
export async function depurarLlegadas(db: D1Database, ahora = Date.now()): Promise<number> {
  const r = await db
    .prepare('DELETE FROM llegadas_estimadas WHERE calculada_en < ?')
    .bind(ahora - HORAS_FILA_LLEGADA * 3_600_000)
    .run();
  return Number(r.meta?.changes ?? 0);
}

/** Solo para las pruebas. */
export function reiniciarEstadoLlegada(): void {
  ultimoEstado = null;
}

export { INTERVALO_LLEGADA_S };

/**
 * C-RASTREO-VIVO: la marca «detenido» de cada pedido o viaje vivo de la lista de «Pedidos en curso».
 * Tres lecturas por página, todas por llave (las filas de llegada, los pedidos y los viajes con la
 * ficha del repartidor), sin escribir nada. La posición es la de la ficha del repartidor (se renueva
 * cada minuto mientras tiene señal): basta para un umbral de 3 minutos.
 */
/** Valores por consulta `IN (…)`: por debajo del límite de 100 de D1. */
export const TANDA_IN = 80;

export async function conDetenidos<T extends { id: string; tipo?: string; estado: string }>(
  db: D1Database,
  elementos: T[],
  ahora = Date.now(),
): Promise<(T & { detenido: Detenido | null })[]> {
  const VIVOS = new Set([
    'aceptado',
    'listo',
    'en_camino',
    'asignado',
    'conductor_llego',
    'en_curso',
  ]);
  const vivos = elementos.filter((e) => VIVOS.has(e.estado));
  if (!vivos.length) return elementos.map((e) => ({ ...e, detenido: null }));
  const pedidos = vivos.filter((e) => e.tipo !== 'viaje').map((e) => e.id);
  const viajes = vivos.filter((e) => e.tipo === 'viaje').map((e) => e.id);
  const huecos = (n: number) => Array.from({ length: n }, () => '?').join(',');
  const claves = [...pedidos.map((id) => `pedido:${id}`), ...viajes.map((id) => `viaje:${id}`)];
  // D1 acepta como mucho 100 valores por consulta: cada `IN (…)` va en tandas (la primera página
  // de una búsqueda por una letra puede traer cientos de vivos).
  const enTandas = async (ids: string[], sql: (h: string) => string): Promise<Fila[]> => {
    const partes: Promise<Fila[]>[] = [];
    for (let i = 0; i < ids.length; i += TANDA_IN) {
      const t = ids.slice(i, i + TANDA_IN);
      partes.push(
        db
          .prepare(sql(huecos(t.length)))
          .bind(...t)
          .all<Fila>()
          .then((r) => r.results),
      );
    }
    return (await Promise.all(partes)).flat();
  };
  const [filas, posP, posV] = await Promise.all([
    enTandas(claves, (h) => `SELECT * FROM llegadas_estimadas WHERE clave IN (${h})`).then(
      (r) => new Map(r.map((f) => [String(f.clave), aFilaLlegada(f)])),
    ),
    enTandas(
      pedidos,
      (h) => `SELECT p.id, p.estado, d.lat, d.lng, d.ubicacion_en,
                EXISTS (SELECT 1 FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'llego_restaurante') AS llego
               FROM pedidos p LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id
              WHERE p.id IN (${h}) AND p.repartidor_id IS NOT NULL`,
    ),
    enTandas(
      viajes,
      (h) => `SELECT o.id, v.estado, d.lat, d.lng, d.ubicacion_en
               FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
               LEFT JOIN repartidores d ON d.usuario_id = o.conductor_id
              WHERE o.id IN (${h}) AND o.conductor_id IS NOT NULL`,
    ),
  ]);
  const marca = new Map<string, Detenido | null>();
  const posDe = (f: Fila) => {
    const p = punto(f.lat, f.lng);
    const en = msDeBase(f.ubicacion_en);
    return p && en != null ? { ...p, en } : null;
  };
  for (const f of posP) {
    const fase = faseDePedido({
      estado: String(f.estado),
      conRepartidor: true,
      llegoAlRestaurante: Number(f.llego) === 1,
    });
    marca.set(
      `pedido:${String(f.id)}`,
      detenidoDe(filas.get(`pedido:${String(f.id)}`) ?? null, fase, posDe(f), ahora),
    );
  }
  for (const f of posV) {
    const fase = faseDeViaje(String(f.estado));
    marca.set(
      `viaje:${String(f.id)}`,
      detenidoDe(filas.get(`viaje:${String(f.id)}`) ?? null, fase, posDe(f), ahora),
    );
  }
  return elementos.map((e) => ({
    ...e,
    detenido: marca.get(`${e.tipo === 'viaje' ? 'viaje' : 'pedido'}:${e.id}`) ?? null,
  }));
}
