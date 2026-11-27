import {
  type LugarCuenta,
  leerLugarCuenta,
  lugarEnSuEstado,
  lugarEscrito,
} from '@tumbite/compartido';
import { mensajeDeCamila } from './camila/cerebro';
import { personaDeUsuario } from './camila/memoria';
import { alSaberseLaCiudad, asignarCiudadElegida } from './ciudadConductor';
import { zonaRealDe } from './cuentaPais';
import type { Env } from './env';
import { guardarError } from './errores';
import { ZONA_REVISION_TIENDAS } from './panicoZona';
import { cobertura } from './territorio';
import { SQL_CUENTA_INTERNA, evaluarVarios } from './whatsappFalta';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026; Venezuela y Estados Unidos) — parte del servidor.
 *
 * Lo que pasaba: la única «ciudad» que existía era una ZONA abierta. Quien vive en Maracaibo, Caracas,
 * Gilroy o Nueva York creaba su cuenta, pero quedaba «en Miami» (el valor por defecto de la ficha de
 * conductor), sin ID, con los papeles del país equivocado y como «Sin zona» en el panel.
 *
 * Ahora la cuenta guarda dónde VIVE (País → Estado → Ciudad del catálogo). Si ese punto cae dentro de
 * una zona abierta, la zona se asigna sola (como elegir la ciudad en Driver). Si no, la cuenta se crea
 * igual y queda EN ESPERA de su ciudad (`usuarios.lugar_espera = 1` y sin zona): sus papeles son los de
 * su país, no recibe ID ni viajes, y al abrirse una zona que cubre su ciudad pasa sola y Camila le avisa.
 */

/** Cuántas cuentas se revisan por llamada al pasar los que esperan (tope de la regla de la nube). */
export const LOTE_ESPERA = 25;
/** Cuántas filas puede escribir, como mucho, una llamada del paso (lo comprueba su prueba). */
export const PRESUPUESTO_PASO_ESPERA = LOTE_ESPERA * 20;
/**
 * Cuántos lotes revisa, como mucho, abrir una zona o tocar «Seguir» (100 cuentas). Lo que sobre queda
 * para «Seguir», con su número en la respuesta y en el canario. Con un tope fijo, una zona con miles
 * esperando no se come la petición ni el presupuesto de escrituras.
 */
export const LOTES_AL_ABRIR = 4;
/**
 * Tope de filas escritas de abrir una zona (los cuatro lotes, 100 cuentas); lo comprueba su prueba.
 * Medido el 26 nov: 413 filas con 76 que pasaron (unas 5 por persona: cuenta, ficha, ID, plazo,
 * Camila) más el canario. 10 por cuenta revisada deja margen para un lote todo de conductores y sigue
 * a la mitad de lo que se permitía por lote suelto (20 por cuenta).
 */
export const PRESUPUESTO_PASO_AL_ABRIR = LOTES_AL_ABRIR * LOTE_ESPERA * 10;
/** Cuántas filas escribe, como mucho, un registro con lugar (lo comprueba su prueba). */
export const PRESUPUESTO_REGISTRO_CON_LUGAR = 40;

const ZONA_DE_PRUEBA = /\((pruebas|test)\)/i;

/** Lo que ve quien espera su ciudad al intentar conectarse (Driver lo muestra tal cual). */
export const MENSAJE_EN_ESPERA_CIUDAD =
  'Tu cuenta quedó creada. En tu ciudad todavía no hay viajes; te avisamos apenas abramos. Mientras tanto, ya puedes subir tus papeles.';
export const CODIGO_EN_ESPERA_CIUDAD = 'en_espera_ciudad';

/**
 * Un lugar que llega de una app o del panel, como lo acepta el servidor: el contrato
 * (`leerLugarCuenta`) y, además, su punto dentro de la caja de su estado (`lugarEnSuEstado`). El
 * servidor no confía en el `lat`/`lng` que le mandan: «Maracaibo» con el punto de Miami no entra.
 */
export function leerLugarDeFuera(x: unknown): LugarCuenta | null {
  const l = leerLugarCuenta(x);
  return l && lugarEnSuEstado(l) ? l : null;
}

export type ZonaDeLugar = { id: string; nombre: string; pais: string };

/**
 * La zona ABIERTA que cubre el punto de su ciudad (la misma regla de cobertura de siempre), solo si es
 * de su país. Nunca la zona de revisión de las tiendas ni, en producción, una zona interna de pruebas.
 */
export async function zonaDeLugar(
  db: D1Database,
  lugar: Pick<LugarCuenta, 'pais' | 'lat' | 'lng'>,
  produccion: boolean,
): Promise<ZonaDeLugar | null> {
  const c = await cobertura(db, lugar.lat, lugar.lng);
  if (c.estado !== 'dentro' || !c.zona) return null;
  const z = c.zona;
  if (z.pais.toUpperCase() !== lugar.pais) return null;
  if (z.id === ZONA_REVISION_TIENDAS || (produccion && ZONA_DE_PRUEBA.test(z.nombre))) return null;
  return { id: z.id, nombre: z.nombre, pais: z.pais.toUpperCase() };
}

/**
 * C-LUGAR-CLIENTE-CON-SERVICIO (27 nov 2026) — todos los países. La zona que le da servicio a un
 * CLIENTE que vive en ese punto: la misma regla que su inicio (`zonaPara`: la zona activa que cubre el
 * punto), de su país. Sin las exclusiones del conductor (zona interna de pruebas, zona de revisión): si
 * el inicio le muestra restaurantes, el aviso no puede decirle «todavía no hay servicio».
 */
export async function zonaDelCliente(
  db: D1Database,
  lugar: Pick<LugarCuenta, 'pais' | 'lat' | 'lng'>,
): Promise<ZonaDeLugar | null> {
  const c = await cobertura(db, lugar.lat, lugar.lng);
  if (c.estado !== 'dentro' || !c.zona) return null;
  if (c.zona.pais.toUpperCase() !== lugar.pais) return null;
  return { id: c.zona.id, nombre: c.zona.nombre, pais: c.zona.pais.toUpperCase() };
}

/** La zona de una cuenta según su papel: el conductor con su regla, el cliente con la de su inicio. */
export const zonaSegunRol = (
  db: D1Database,
  rol: string,
  lugar: Pick<LugarCuenta, 'pais' | 'lat' | 'lng'>,
  produccion: boolean,
) => (rol === 'cliente' ? zonaDelCliente(db, lugar) : zonaDeLugar(db, lugar, produccion));

type FilaLugar = {
  rol: string;
  lugar_pais: string | null;
  lugar_estado: string | null;
  lugar_municipio: string | null;
  lugar_ciudad: string | null;
  lugar_id: string | null;
  lugar_lat: number | null;
  lugar_lng: number | null;
};

export function lugarDeFila(f: Partial<FilaLugar> | null | undefined): LugarCuenta | null {
  if (!f?.lugar_id || !f.lugar_pais || !f.lugar_estado || !f.lugar_ciudad) return null;
  return {
    pais: f.lugar_pais as LugarCuenta['pais'],
    estado: f.lugar_estado,
    municipio: f.lugar_municipio ?? null,
    ciudad: f.lugar_ciudad,
    lugarId: f.lugar_id,
    lat: Number(f.lugar_lat),
    lng: Number(f.lugar_lng),
  };
}

const COLUMNAS_LUGAR_SQL =
  'lugar_pais, lugar_estado, lugar_municipio, lugar_ciudad, lugar_id, lugar_lat, lugar_lng';

export async function leerLugar(db: D1Database, usuarioId: string) {
  const f = await db
    .prepare(`SELECT rol, ${COLUMNAS_LUGAR_SQL}, lugar_en FROM usuarios WHERE id = ?`)
    .bind(usuarioId)
    .first<FilaLugar & { lugar_en: string | null }>();
  return f ? { rol: f.rol, lugar: lugarDeFila(f), lugarEn: f.lugar_en } : null;
}

/** La sentencia que guarda el lugar (una fila). `espera`: 1 = en espera de su ciudad; null = no. */
export function sentenciaLugar(
  db: D1Database,
  usuarioId: string,
  lugar: LugarCuenta,
  espera: 1 | null,
) {
  return db
    .prepare(
      `UPDATE usuarios SET lugar_pais = ?, lugar_estado = ?, lugar_municipio = ?, lugar_ciudad = ?, lugar_id = ?,
         lugar_lat = ?, lugar_lng = ?, lugar_en = datetime('now'), lugar_espera = ? WHERE id = ?`,
    )
    .bind(
      lugar.pais,
      lugar.estado,
      lugar.municipio ?? null,
      lugar.ciudad,
      lugar.lugarId,
      lugar.lat,
      lugar.lng,
      espera,
      usuarioId,
    );
}

export type RespuestaLugar = {
  lugar: LugarCuenta | null;
  zona: { id: string; nombre: string } | null;
  enEspera: boolean;
  /** «Maracaibo, Zulia» / «Novi, Michigan (MI)»: como se le muestra a la persona. */
  lugarEscrito: string | null;
};

/**
 * Lo que devuelven `GET` y `PUT /datos/cuentas/lugar`. La zona del conductor es su zona REAL (la de su
 * ID); la del cliente, la que cubre su ciudad. Solo lee.
 */
export async function respuestaLugar(
  db: D1Database,
  usuarioId: string,
  produccion: boolean,
): Promise<RespuestaLugar> {
  const l = await leerLugar(db, usuarioId);
  const lugar = l?.lugar ?? null;
  let zona: RespuestaLugar['zona'] = null;
  if (l?.rol === 'repartidor') {
    const real = await zonaRealDe(db, usuarioId);
    zona = real ? { id: real.zonaId, nombre: real.nombre } : null;
  } else if (lugar) {
    const z = await zonaSegunRol(db, l?.rol ?? 'cliente', lugar, produccion);
    zona = z ? { id: z.id, nombre: z.nombre } : null;
  }
  return {
    lugar,
    zona,
    enEspera: Boolean(lugar) && !zona,
    lugarEscrito: lugar ? lugarEscrito(lugar) : null,
  };
}

/**
 * Guarda el lugar de una cuenta y, si su ciudad tiene una zona abierta, se la da (al conductor, como
 * ciudad elegida, con su ID y su plazo). Sin zona, queda en espera. Las reglas de cambio de ciudad
 * del conductor las comprueba quien llama (la ruta), antes. Devuelve la zona asignada (o null).
 */
export async function aplicarLugar(
  env: Env,
  db: D1Database,
  usuario: { id: string; rol: string },
  lugar: LugarCuenta,
  produccion: boolean,
): Promise<ZonaDeLugar | null> {
  const zona = await zonaSegunRol(db, usuario.rol, lugar, produccion);
  if (usuario.rol === 'repartidor') {
    const real = await zonaRealDe(db, usuario.id);
    if (zona && zona.id !== real?.zonaId) {
      await sentenciaLugar(db, usuario.id, lugar, null).run();
      await asignarCiudadElegida(env, db, usuario.id, zona.id);
      return zona;
    }
    // Con una zona real (aunque su ciudad nueva no tenga), no espera: sigue trabajando en la suya.
    await sentenciaLugar(db, usuario.id, lugar, real || zona ? null : 1).run();
    return zona;
  }
  await sentenciaLugar(db, usuario.id, lugar, zona ? null : 1).run();
  return zona;
}

// ───────────────────────── Al abrir una zona: los que esperan pasan solos ─────────────────────────

type Candidato = {
  id: string;
  rol: string;
  nombre: string;
  idioma: string;
  correo: string;
  lugar_pais: string;
  lugar_lat: number;
  lugar_lng: number;
};

export type ResultadoPaso = {
  zonaId: string;
  pasaron: number;
  conductores: number;
  clientes: number;
  revisados: number;
  /** Cuántas cuentas fallaron al pasar (siguen en espera y se reintentan en el próximo paso). */
  fallaron: number;
  /** Cuántas cuentas en espera de esa zona quedan por revisar (siguen en la próxima llamada). */
  quedan: number;
  /** Desde dónde sigue la próxima llamada (`desde`), o null si ya no queda nada. */
  siguiente: string | null;
  motivo: 'zona_cerrada' | 'zona_excluida' | null;
};

/** La caja donde puede caer un punto cubierto por la zona: sus áreas activas o, sin áreas, su círculo. */
async function cajaDeZona(
  db: D1Database,
  z: { id: string; lat: number; lng: number; radio_km: number },
) {
  const { results: areas } = await db
    .prepare(
      "SELECT estado, min_lat, max_lat, min_lng, max_lng FROM areas WHERE zona_id = ? AND estado <> 'borrador'",
    )
    .bind(z.id)
    .all<{ estado: string; min_lat: number; max_lat: number; min_lng: number; max_lng: number }>();
  if (areas.length) {
    const activas = areas.filter((a) => a.estado === 'activa');
    if (!activas.length) return null;
    return {
      minLat: Math.min(...activas.map((a) => Number(a.min_lat))),
      maxLat: Math.max(...activas.map((a) => Number(a.max_lat))),
      minLng: Math.min(...activas.map((a) => Number(a.min_lng))),
      maxLng: Math.max(...activas.map((a) => Number(a.max_lng))),
    };
  }
  const dLat = Number(z.radio_km) / 110.574;
  const dLng =
    Number(z.radio_km) / (111.32 * Math.max(0.05, Math.cos((Number(z.lat) * Math.PI) / 180)));
  return {
    minLat: Number(z.lat) - dLat,
    maxLat: Number(z.lat) + dLat,
    minLng: Number(z.lng) - dLng,
    maxLng: Number(z.lng) + dLng,
  };
}

const FILTRO_ESPERA = `lugar_id IS NOT NULL AND rol IN ('repartidor', 'cliente') AND lugar_pais = ?
  AND lugar_espera = 1 AND zona_id IS NULL AND activo = 1
  AND lugar_lat BETWEEN ? AND ? AND lugar_lng BETWEEN ? AND ?
  AND NOT ${SQL_CUENTA_INTERNA('usuarios')} AND correo NOT IN (SELECT correo FROM revisores)`;

export const CLAVE_ULTIMO_PASO = 'espera_ultimo_paso';

/**
 * Pasa a la zona `zonaId` (abierta) las cuentas que esperan su ciudad y viven dentro de ella: de a
 * LOTE_ESPERA por llamada, ordenadas por id. Idempotente: cada cuenta pasa UNA vez (la escritura lleva
 * la condición «todavía en espera») y solo a quien pasó se le avisa. No toca las cuentas de prueba ni
 * las nuestras ni las de los revisores de las tiendas, ni la zona de revisión.
 */
export async function pasarEspera(
  env: Env,
  db: D1Database,
  zonaId: string,
  o: { desde?: string | null; produccion: boolean; tope?: number; anotar?: boolean },
): Promise<ResultadoPaso> {
  const tope = Math.max(1, Math.min(o.tope ?? LOTE_ESPERA, LOTE_ESPERA));
  const vacio = (motivo: ResultadoPaso['motivo']): ResultadoPaso => ({
    zonaId,
    pasaron: 0,
    conductores: 0,
    clientes: 0,
    revisados: 0,
    fallaron: 0,
    quedan: 0,
    siguiente: null,
    motivo,
  });
  const z = await db
    .prepare('SELECT id, nombre, pais, lat, lng, radio_km, activa FROM zonas WHERE id = ?')
    .bind(zonaId)
    .first<{
      id: string;
      nombre: string;
      pais: string;
      lat: number;
      lng: number;
      radio_km: number;
      activa: number;
    }>();
  if (!z || Number(z.activa) !== 1) return vacio('zona_cerrada');
  if (z.id === ZONA_REVISION_TIENDAS || (o.produccion && ZONA_DE_PRUEBA.test(z.nombre)))
    return vacio('zona_excluida');
  const caja = await cajaDeZona(db, z);
  if (!caja) return vacio('zona_cerrada');
  const pais = z.pais.toUpperCase();
  const filtro = [pais, caja.minLat, caja.maxLat, caja.minLng, caja.maxLng];
  const desde = o.desde ?? '';
  const { results } = await db
    .prepare(
      `SELECT id, rol, nombre, idioma, correo, lugar_pais, lugar_lat, lugar_lng FROM usuarios
        WHERE ${FILTRO_ESPERA} AND id > ? ORDER BY id LIMIT ?`,
    )
    .bind(...filtro, desde, tope + 1)
    .all<Candidato>();
  const revisores = new Set(
    (env.CORREOS_REVISOR ?? '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );
  const lote = results.slice(0, tope);
  const pasados: Candidato[] = [];
  let fallaron = 0;
  let primerError: unknown = null;
  for (const cand of lote) {
    if (revisores.has(cand.correo.toLowerCase())) continue;
    // Cada cuenta por su lado: si una falla, queda en el registro de errores y en el canario, sigue en
    // espera (su escritura es un solo lote: o pasa entera o no pasa) y el paso sigue con la siguiente.
    try {
      const zona = await zonaDeLugar(
        db,
        { pais: cand.lugar_pais as LugarCuenta['pais'], lat: cand.lugar_lat, lng: cand.lugar_lng },
        o.produccion,
      );
      if (zona?.id !== z.id) continue;
      if (await pasarUna(env, db, z.id, cand)) pasados.push(cand);
    } catch (e) {
      fallaron++;
      primerError ??= e;
      console.error('espera: no pasó una cuenta', z.id, cand.id, e);
      await guardarError(db, 'ESPERA', `espera/${z.id}/${cand.id}`, e).catch((x: unknown) =>
        console.error('espera: no se pudo guardar el error', x),
      );
    }
  }
  // Los que pasaron reciben su aviso SIEMPRE (antes de cualquier otra lectura que pudiera fallar),
  // aunque otra cuenta del lote haya fallado.
  await avisarCiudadAbierta(env, db, z, pasados);
  const ultimo = lote.at(-1)?.id ?? null;
  const quedan =
    results.length > tope && ultimo
      ? Number(
          (
            await db
              .prepare(`SELECT COUNT(*) AS n FROM usuarios WHERE ${FILTRO_ESPERA} AND id > ?`)
              .bind(...filtro, ultimo)
              .first<{ n: number }>()
          )?.n ?? 0,
        )
      : 0;
  const resultado: ResultadoPaso = {
    zonaId: z.id,
    pasaron: pasados.length,
    conductores: pasados.filter((p) => p.rol === 'repartidor').length,
    clientes: pasados.filter((p) => p.rol !== 'repartidor').length,
    revisados: lote.length,
    fallaron,
    quedan,
    siguiente: quedan ? ultimo : null,
    motivo: null,
  };
  if (o.anotar !== false && lote.length)
    await anotarPaso(db, resultado, primerError ? String(primerError) : null);
  return resultado;
}

/**
 * Pasa UNA cuenta. El conductor en un solo lote de escritura (ficha con su ciudad elegida + cuenta con
 * su zona), los dos con la condición «todavía en espera»: si algo falla, no cambia nada y la cuenta
 * sigue en espera para el próximo paso; si otra llamada ya la pasó, aquí no cambia nada. Su ID y su
 * plazo van después (`alSaberseLaCiudad`, de una sola vez); si eso falla, la cuenta ya está en su
 * zona con su ficha y se completan solos al conectarse o al abrir Driver.
 */
async function pasarUna(env: Env, db: D1Database, zonaId: string, cand: Candidato) {
  const espera = 'lugar_espera = 1 AND zona_id IS NULL';
  if (cand.rol !== 'repartidor') {
    const r = await db
      .prepare(
        `UPDATE usuarios SET lugar_espera = NULL, lugar_paso_en = datetime('now') WHERE id = ? AND ${espera}`,
      )
      .bind(cand.id)
      .run();
    return Boolean(r.meta.changes);
  }
  const [, cuenta] = await db.batch([
    db
      .prepare(
        // La misma ficha que `asignarCiudadElegida` (ciudad elegida y ciudad base), solo si sigue en espera.
        `INSERT INTO repartidores (usuario_id, zona_id, ciudad_elegida_en, zona_base_id)
           SELECT ?1, ?2, datetime('now'), ?2 WHERE EXISTS (SELECT 1 FROM usuarios WHERE id = ?1 AND ${espera})
           ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id,
             ciudad_elegida_en = excluded.ciudad_elegida_en, zona_base_id = excluded.zona_base_id`,
      )
      .bind(cand.id, zonaId),
    db
      .prepare(
        `UPDATE usuarios SET zona_id = ?, lugar_espera = NULL, lugar_paso_en = datetime('now') WHERE id = ? AND ${espera}`,
      )
      .bind(zonaId, cand.id),
  ]);
  if (!cuenta?.meta.changes) return false;
  try {
    await alSaberseLaCiudad(env, db, cand.id);
  } catch (e) {
    console.error('espera: ID o plazo pendientes (se completan al conectarse)', cand.id, e);
    await guardarError(db, 'ESPERA', `espera/${zonaId}/${cand.id}/id`, e).catch(() => undefined);
  }
  return true;
}

/** El último paso, para el canario (una fila por llamada). Con `error`, el canario se pone en rojo. */
async function anotarPaso(
  db: D1Database,
  r: Pick<ResultadoPaso, 'zonaId' | 'pasaron' | 'quedan' | 'fallaron'>,
  error: string | null,
) {
  await db
    .prepare(
      `INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    )
    .bind(
      CLAVE_ULTIMO_PASO,
      JSON.stringify({
        en: new Date().toISOString(),
        zona: r.zonaId,
        pasaron: r.pasaron,
        quedan: r.quedan,
        ...(r.fallaron ? { fallaron: r.fallaron } : {}),
        ...(error ? { error: error.slice(0, 200) } : {}),
      }),
    )
    .run()
    .catch((e: unknown) => console.error('espera: no se pudo anotar el último paso', e));
}

/**
 * Varios lotes seguidos (hasta LOTES_AL_ABRIR), cada uno desde donde quedó el anterior: así las cuentas
 * de la caja que no caen dentro de la zona no tapan a las demás. Lo que sobre queda en `quedan` y
 * `siguiente` (para «Seguir»). El canario se anota una vez, con la suma.
 */
export async function pasarEsperaLotes(
  env: Env,
  db: D1Database,
  zonaId: string,
  o: { desde?: string | null; produccion: boolean; lotes?: number },
): Promise<ResultadoPaso> {
  const lotes = Math.max(1, Math.min(o.lotes ?? LOTES_AL_ABRIR, LOTES_AL_ABRIR));
  let desde = o.desde ?? null;
  let total: ResultadoPaso | null = null;
  let error: string | null = null;
  for (let i = 0; i < lotes; i++) {
    let r: ResultadoPaso;
    try {
      r = await pasarEspera(env, db, zonaId, { desde, produccion: o.produccion, anotar: false });
    } catch (e) {
      // Un lote que falla entero: lo que ya pasó en los anteriores queda contado y anotado.
      if (total) await anotarPaso(db, total, String(e));
      throw e;
    }
    if (r.fallaron && !error) error = `${r.fallaron} cuenta(s) no pasaron (ver errores ESPERA)`;
    total = total
      ? {
          ...r,
          pasaron: total.pasaron + r.pasaron,
          conductores: total.conductores + r.conductores,
          clientes: total.clientes + r.clientes,
          revisados: total.revisados + r.revisados,
          fallaron: total.fallaron + r.fallaron,
        }
      : r;
    if (!r.siguiente) break;
    desde = r.siguiente;
  }
  if (total && total.revisados) await anotarPaso(db, total, error);
  return total as ResultadoPaso;
}

/**
 * Lo mismo, como lo llaman las rutas que abren una zona o cambian sus áreas: nunca frena esa ruta (un
 * fallo queda en el registro de errores y en el canario) y dice cuántos pasaron y cuántos faltan.
 */
export async function pasarEsperaAlAbrir(
  env: Env,
  db: D1Database,
  zonaId: string,
  produccion: boolean,
): Promise<ResultadoPaso | null> {
  try {
    return await pasarEsperaLotes(env, db, zonaId, { produccion });
  } catch (e) {
    console.error('espera: no se pudo pasar a los que esperan', zonaId, e);
    await guardarError(db, 'ESPERA', `espera/${zonaId}`, e).catch(() => undefined);
    await db
      .prepare(
        `INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
      )
      .bind(
        CLAVE_ULTIMO_PASO,
        JSON.stringify({
          en: new Date().toISOString(),
          zona: zonaId,
          error: String(e).slice(0, 200),
        }),
      )
      .run()
      .catch(() => undefined);
    return null;
  }
}

// ───────────────────────── El aviso de Camila ─────────────────────────

const primerNombre = (nombre: string) =>
  (nombre.trim().split(/\s+/)[0] || nombre.trim()).slice(0, 30);

export function textoCiudadAbierta(
  rol: 'repartidor' | 'cliente',
  nombre: string,
  ciudad: string,
  idioma: 'es' | 'en',
) {
  const primer = primerNombre(nombre);
  if (rol === 'repartidor')
    return idioma === 'en'
      ? `Good news, ${primer}: Divoox is now open in ${ciudad}. Your account is already in your city. Finish your sign-up in Divoox Driver (your documents and your vehicle) and start taking trips.`
      : `Buenas noticias, ${primer}: abrimos Divoox en ${ciudad}. Tu cuenta ya está en tu ciudad. Termina tu registro en Divoox Driver (tus papeles y tu vehículo) y empieza a recibir viajes.`;
  return idioma === 'en'
    ? `Good news, ${primer}: Divoox is now open in ${ciudad}. Open the app and place your first order.`
    : `Buenas noticias, ${primer}: Divoox ya llegó a ${ciudad}. Abre la app y haz tu primer pedido.`;
}

/**
 * Camila avisa UNA vez a quienes acaban de pasar (solo los que cambiaron en esta llamada): en el chat
 * de la app con su aviso al celular y por correo. A los conductores, además, el WhatsApp «lo que te
 * falta» si su plantilla está aprobada, con TODAS sus compuertas (consentimiento, país, tope del día,
 * 24 horas, tres por paso). Nunca frena el paso.
 */
async function avisarCiudadAbierta(
  env: Env,
  db: D1Database,
  z: { id: string; nombre: string; pais: string },
  pasados: readonly Candidato[],
) {
  for (const p of pasados) {
    try {
      const idioma = p.idioma === 'en' ? 'en' : 'es';
      const rol = p.rol === 'repartidor' ? 'repartidor' : 'cliente';
      const persona = await personaDeUsuario(db, p.id);
      await mensajeDeCamila(
        env,
        db,
        persona,
        textoCiudadAbierta(rol, p.nombre, z.nombre, idioma),
        ['app', 'correo'],
        idioma === 'en' ? `Divoox is open in ${z.nombre}` : `Divoox abrió en ${z.nombre}`,
      );
    } catch (e) {
      console.error('espera: aviso de ciudad abierta', p.id, e);
    }
  }
  const conductores = pasados.filter((p) => p.rol === 'repartidor');
  if (conductores.length)
    await evaluarVarios(
      env,
      db,
      conductores.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        idioma: p.idioma === 'en' ? ('en' as const) : ('es' as const),
        pais: z.pais.toUpperCase(),
        rol: 'repartidor',
      })),
      { enviar: { origen: 'auto', actorId: null } },
    ).catch((e: unknown) => console.error('espera: whatsapp de lo que falta', e));
}

/** Canario de /datos/salud: el último paso (una lectura por clave). `error` si el último falló. */
export async function saludEspera(db: D1Database) {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_ULTIMO_PASO)
    .first<{ valor: string }>();
  let ultimo: {
    en?: string;
    zona?: string;
    pasaron?: number;
    quedan?: number;
    fallaron?: number;
    error?: string;
  } | null = null;
  try {
    ultimo = f ? JSON.parse(f.valor) : null;
  } catch {
    console.error('espera: último paso ilegible');
  }
  return {
    estado: (ultimo?.error ? 'error' : ultimo ? 'ok' : 'pendiente') as 'ok' | 'error' | 'pendiente',
    ultimoPaso: ultimo,
  };
}
