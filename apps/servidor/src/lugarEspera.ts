import { type LugarCuenta, lugarEscrito } from '@tumbite/compartido';
import { mensajeDeCamila } from './camila/cerebro';
import { personaDeUsuario } from './camila/memoria';
import { asignarCiudadElegida } from './ciudadConductor';
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
/** Cuántas filas escribe, como mucho, un registro con lugar (lo comprueba su prueba). */
export const PRESUPUESTO_REGISTRO_CON_LUGAR = 40;

const ZONA_DE_PRUEBA = /\((pruebas|test)\)/i;

/** Lo que ve quien espera su ciudad al intentar conectarse (Driver lo muestra tal cual). */
export const MENSAJE_EN_ESPERA_CIUDAD =
  'Tu cuenta quedó creada. En tu ciudad todavía no hay viajes; te avisamos apenas abramos. Mientras tanto, ya puedes subir tus papeles.';
export const CODIGO_EN_ESPERA_CIUDAD = 'en_espera_ciudad';

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
    const z = await zonaDeLugar(db, lugar, produccion);
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
  const zona = await zonaDeLugar(db, lugar, produccion);
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
  o: { desde?: string | null; produccion: boolean; tope?: number },
): Promise<ResultadoPaso> {
  const tope = Math.max(1, Math.min(o.tope ?? LOTE_ESPERA, LOTE_ESPERA));
  const vacio = (motivo: ResultadoPaso['motivo']): ResultadoPaso => ({
    zonaId,
    pasaron: 0,
    conductores: 0,
    clientes: 0,
    revisados: 0,
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
  for (const cand of lote) {
    if (revisores.has(cand.correo.toLowerCase())) continue;
    const zona = await zonaDeLugar(
      db,
      { pais: cand.lugar_pais as LugarCuenta['pais'], lat: cand.lugar_lat, lng: cand.lugar_lng },
      o.produccion,
    );
    if (zona?.id !== z.id) continue;
    if (cand.rol === 'repartidor') {
      // La condición en la misma escritura: si otra llamada ya lo pasó, aquí no cambia nada.
      const r = await db
        .prepare(
          "UPDATE usuarios SET zona_id = ?, lugar_espera = NULL, lugar_paso_en = datetime('now') WHERE id = ? AND lugar_espera = 1 AND zona_id IS NULL",
        )
        .bind(z.id, cand.id)
        .run();
      if (!r.meta.changes) continue;
      await asignarCiudadElegida(env, db, cand.id, z.id);
    } else {
      const r = await db
        .prepare(
          "UPDATE usuarios SET lugar_espera = NULL, lugar_paso_en = datetime('now') WHERE id = ? AND lugar_espera = 1 AND zona_id IS NULL",
        )
        .bind(cand.id)
        .run();
      if (!r.meta.changes) continue;
    }
    pasados.push(cand);
  }
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
  await avisarCiudadAbierta(env, db, z, pasados);
  const resultado: ResultadoPaso = {
    zonaId: z.id,
    pasaron: pasados.length,
    conductores: pasados.filter((p) => p.rol === 'repartidor').length,
    clientes: pasados.filter((p) => p.rol !== 'repartidor').length,
    revisados: lote.length,
    quedan,
    siguiente: quedan ? ultimo : null,
    motivo: null,
  };
  // El último paso, para el canario (una fila por llamada, solo si revisó a alguien).
  if (lote.length)
    await db
      .prepare(
        `INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
      )
      .bind(
        CLAVE_ULTIMO_PASO,
        JSON.stringify({
          en: new Date().toISOString(),
          zona: z.id,
          pasaron: resultado.pasaron,
          quedan,
        }),
      )
      .run()
      .catch((e: unknown) => console.error('espera: no se pudo anotar el último paso', e));
  return resultado;
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
    return await pasarEspera(env, db, zonaId, { produccion });
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
