import { Hono } from 'hono';
import { z } from 'zod';
import {
  distanciaKm,
  esHoraDeNoche,
  formatearMonto,
  llanoLugar,
  recargoNocheDe,
} from '@tumbite/compartido';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';

/**
 * C-LUGARES-PROPIOS (27 nov 2026, Richard: «si alguien agrega ese nombre, lanza las coordenadas reales…
 * en esa ciudad») — todas las ciudades. Los lugares que la ciudad conoce por su nombre y que Google no
 * tiene o pone mal («KM 9», «Pedeca», «La Vega II»): el equipo los carga en el panel con sus otros
 * nombres («km9», «kilómetro 9») y el punto puesto a mano en el mapa, y si tienen precio del tabulador,
 * van atados a esa ruta. El buscador de destino (app de clientes, web y Driver: todos usan
 * /datos/lugares/sugerencias) los pone primero, SOLO dentro de la ciudad de la persona.
 *
 * - Junto con ellos salen las rutas del tabulador de la ciudad que no tienen lugar propio (por su
 *   nombre, como antes: C-DESTINO-TABULADOR).
 * - Lectura con caché: la primera búsqueda de una ciudad lee UNA vez (un solo viaje a la base: lugares,
 *   rutas y tarifas) y el servidor la guarda CACHE_LUGARES_MS. Buscar nunca escribe.
 * - Mover el punto de un lugar atado a una ruta mueve también el punto de esa ruta (y el de su regreso),
 *   para que el precio caiga donde el pasajero eligió. Todo queda en auditoria_admin.
 */

/** Cuánto guarda cada servidor la lista de una ciudad (un cambio del panel en otro servidor tarda esto). */
export const CACHE_LUGARES_MS = 5 * 60_000;
/** Cuántos lugares propios o del tabulador van arriba como mucho. */
export const TOPE_LUGARES_CIUDAD = 3;
/** El id de una sugerencia de lugar propio (no choca con Google, que no lleva «~»). */
export const PREFIJO_LUGAR_PROPIO = 'lp~';
/** El id de una sugerencia de ruta del tabulador sin lugar propio. */
export const PREFIJO_TABULADOR = 'tab~';

/** C-LUGARES-PROPIOS: la misma regla en el servidor y en el panel (pieza compartida). */
export { llanoLugar };

/** Cada palabra escrita, en orden, es el comienzo de una palabra del nombre («la veg» → «La Vega I»). */
export function casaNombre(nombreLlano: string, buscado: readonly string[]): boolean {
  let resto = nombreLlano.split(' ');
  for (const b of buscado) {
    const donde = resto.findIndex((p) => p.startsWith(b));
    if (donde < 0) return false;
    resto = resto.slice(donde + 1);
  }
  return true;
}

type Circulo = { lat: number; lng: number; radioKm: number };
export type LugarCiudad = {
  /** `lp~<id>` (lugar propio) o `tab~<id>` (ruta del tabulador sin lugar propio). */
  id: string;
  nombre: string;
  /** El nombre y los otros nombres, ya en llano. */
  llanos: string[];
  lat: number;
  lng: number;
  /** Precio del tabulador (unidad menor) y dónde empieza su ruta, si tiene. */
  precio?: { monto: number; moneda: string; servicio: string; desde: Circulo | null };
};

/**
 * Los lugares de la ciudad que casan con lo escrito, el mejor primero: el nombre (u otro nombre) igual
 * a lo escrito, después el que empieza así, después el resto (en el orden de la lista: precio).
 */
export function buscarEnCiudad(
  lista: readonly LugarCiudad[],
  texto: string,
  tope = TOPE_LUGARES_CIUDAD,
): LugarCiudad[] {
  const llano = llanoLugar(texto);
  const buscado = llano.split(' ').filter(Boolean);
  if (!buscado.length) return [];
  const puntos = (l: LugarCiudad) =>
    l.llanos.includes(llano) ? 3 : l.llanos.some((n) => n.startsWith(llano)) ? 2 : 1;
  return lista
    .filter((l) => l.llanos.some((n) => casaNombre(n, buscado)))
    .map((l, i) => ({ l, i, p: puntos(l) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, tope)
    .map((x) => x.l);
}

export type FilaLugar = {
  id: string;
  zona_id: string;
  nombre: string;
  otros_nombres: string;
  lat: number;
  lng: number;
  ruta_id: string | null;
  activo: number;
};
export type FilaRutaLugar = {
  id: string;
  servicio_id: string;
  moneda: string;
  desde_lat: number | null;
  desde_lng: number | null;
  desde_radio_km: number | null;
  hasta_lat: number;
  hasta_lng: number;
  hasta_nombre: string;
  precio: number;
  revisar: number;
  grupo: string | null;
};
export type FilaNoche = {
  servicio_id: string;
  recargo_noche_pb: number | null;
  noche_desde_h: number | null;
  noche_hasta_h: number | null;
  redondeo: number;
};
type TarifaNoche = {
  recargoNochePb?: number;
  nocheDesdeH?: number;
  nocheHastaH?: number;
  redondeo: number;
};
export type DatosCiudad = { lista: LugarCiudad[]; noche: Map<string, TarifaNoche> };

export const otrosNombresDe = (json: string): string[] => {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** Arma la lista de la ciudad con lo leído (pura, para probarla). */
export function armarCiudad(
  lugares: readonly FilaLugar[],
  rutas: readonly FilaRutaLugar[],
  tarifas: readonly FilaNoche[] = [],
): DatosCiudad {
  const porId = new Map(rutas.map((r) => [r.id, r]));
  const conPrecio = (r: FilaRutaLugar | undefined): LugarCiudad['precio'] =>
    r
      ? {
          monto: r.precio,
          moneda: r.moneda,
          servicio: r.servicio_id,
          desde:
            r.desde_lat == null || r.desde_lng == null || r.desde_radio_km == null
              ? null
              : { lat: r.desde_lat, lng: r.desde_lng, radioKm: r.desde_radio_km },
        }
      : undefined;
  const lista: LugarCiudad[] = [];
  const vistos = new Set<string>();
  const atadas = new Set<string>();
  for (const l of lugares) {
    if (l.activo !== 1) continue;
    if (l.ruta_id) atadas.add(l.ruta_id);
    const llanos = [...new Set([l.nombre, ...otrosNombresDe(l.otros_nombres)].map(llanoLugar))];
    lista.push({
      id: `${PREFIJO_LUGAR_PROPIO}${l.id}`,
      nombre: l.nombre,
      llanos: llanos.filter(Boolean),
      lat: Number(l.lat),
      lng: Number(l.lng),
      precio: conPrecio(l.ruta_id ? porId.get(l.ruta_id) : undefined),
    });
    vistos.add(llanoLugar(l.nombre));
  }
  // Las rutas del tabulador sin lugar propio, por su nombre (las de punto aproximado, no).
  for (const r of [...rutas].sort((a, b) => a.precio - b.precio)) {
    const llano = llanoLugar(r.hasta_nombre);
    if (atadas.has(r.id) || r.revisar === 1 || vistos.has(llano)) continue;
    vistos.add(llano);
    lista.push({
      id: `${PREFIJO_TABULADOR}${r.id}`,
      nombre: r.hasta_nombre,
      llanos: [llano],
      lat: Number(r.hasta_lat),
      lng: Number(r.hasta_lng),
      precio: conPrecio(r),
    });
  }
  const noche = new Map<string, TarifaNoche>();
  for (const t of tarifas)
    noche.set(t.servicio_id, {
      redondeo: t.redondeo,
      ...(t.recargo_noche_pb ? { recargoNochePb: t.recargo_noche_pb } : {}),
      ...(t.noche_desde_h != null ? { nocheDesdeH: t.noche_desde_h } : {}),
      ...(t.noche_hasta_h != null ? { nocheHastaH: t.noche_hasta_h } : {}),
    });
  return { lista, noche };
}

const cache = new Map<string, { hasta: number; datos: Promise<DatosCiudad> }>();

/** Al cambiar algo en el panel, este servidor vuelve a leer la ciudad en la próxima búsqueda. */
export function olvidarLugaresDe(zona: string): void {
  cache.delete(zona);
}
/** Solo para las pruebas. */
export function vaciarCacheLugares(): void {
  cache.clear();
}

/** Los lugares de la ciudad: una lectura (un viaje a la base) cada CACHE_LUGARES_MS por servidor. */
export function lugaresDeLaCiudad(
  db: D1Database,
  zona: string,
  ahora = Date.now(),
): Promise<DatosCiudad> {
  const g = cache.get(zona);
  if (g && g.hasta > ahora) return g.datos;
  const datos = db
    .batch([
      db
        .prepare(
          `SELECT id, zona_id, nombre, otros_nombres, lat, lng, ruta_id, activo FROM lugares_propios
            WHERE zona_id = ? AND activo = 1 ORDER BY nombre LIMIT 500`,
        )
        .bind(zona),
      db
        .prepare(
          `SELECT id, servicio_id, moneda, desde_lat, desde_lng, desde_radio_km, hasta_lat, hasta_lng,
                  hasta_nombre, precio, revisar, grupo
             FROM rutas_precio_zona WHERE zona_id = ? AND activa = 1 ORDER BY precio, hasta_nombre LIMIT 500`,
        )
        .bind(zona),
      db
        .prepare(
          `SELECT servicio_id, recargo_noche_pb, noche_desde_h, noche_hasta_h, redondeo
             FROM tarifas_viaje WHERE zona_id = ? AND activa = 1 LIMIT 20`,
        )
        .bind(zona),
    ])
    .then(([l, r, t]) =>
      armarCiudad(
        (l?.results ?? []) as FilaLugar[],
        (r?.results ?? []) as FilaRutaLugar[],
        (t?.results ?? []) as FilaNoche[],
      ),
    );
  cache.set(zona, { hasta: ahora + CACHE_LUGARES_MS, datos });
  // Si la lectura falla, no se guarda el error: la próxima búsqueda lo intenta otra vez.
  datos.catch(() => cache.delete(zona));
  return datos;
}

const TEXTOS = {
  es: { zona: 'Precio de la zona', noche: 'nocturna', moto: ' en moto' },
  en: { zona: 'Local fixed price', noche: 'night', moto: ' by moto' },
} as const;

/**
 * La sugerencia como la ve la persona. El precio solo sale si la persona está donde empieza la ruta
 * (o no se sabe dónde está: la ciudad de su cuenta), y de noche ya con el recargo de la tarifa.
 */
export function sugerenciaDeLugar(
  l: LugarCiudad,
  ciudad: { nombre: string; zonaHoraria: string },
  noche: Map<string, TarifaNoche>,
  op: { idioma: 'es' | 'en'; donde?: { lat: number; lng: number } | null; ahora?: Date },
) {
  const t = TEXTOS[op.idioma];
  const p = l.precio;
  const aplica = Boolean(
    p && (!p.desde || !op.donde || distanciaKm(op.donde, p.desde) <= p.desde.radioKm),
  );
  let detalle = p ? `${ciudad.nombre} · ${t.zona}` : ciudad.nombre;
  let monto: number | null = null;
  if (p && aplica) {
    const tarifa = noche.get(p.servicio);
    const deNoche = Boolean(
      tarifa?.recargoNochePb &&
      esHoraDeNoche(
        op.ahora ?? new Date(),
        ciudad.zonaHoraria,
        tarifa.nocheDesdeH,
        tarifa.nocheHastaH,
      ),
    );
    monto = deNoche && tarifa ? p.monto + recargoNocheDe(p.monto, tarifa) : p.monto;
    detalle = `${detalle}${p.servicio === 'moto' ? t.moto : ''}: ${formatearMonto(monto, p.moneda, op.idioma)}${deNoche ? ` (${t.noche})` : ''}`;
  }
  return {
    id: l.id,
    texto: `${l.nombre}, ${ciudad.nombre}`,
    principal: l.nombre,
    secundario: detalle,
    ...(p && monto != null ? { precio: monto, moneda: p.moneda } : {}),
  };
}

/** El punto de una sugerencia propia o del tabulador (null si el id no es de los nuestros). */
export async function puntoDeLugar(
  db: D1Database,
  id: string,
): Promise<{ punto: { lat: number; lng: number }; direccion: string } | null> {
  const propio = id.startsWith(PREFIJO_LUGAR_PROPIO);
  if (!propio && !id.startsWith(PREFIJO_TABULADOR)) return null;
  const clave = id.slice(propio ? PREFIJO_LUGAR_PROPIO.length : PREFIJO_TABULADOR.length);
  const f = await db
    .prepare(
      propio
        ? `SELECT l.lat, l.lng, l.nombre, z.nombre AS ciudad FROM lugares_propios l
             LEFT JOIN zonas z ON z.id = l.zona_id WHERE l.id = ? AND l.activo = 1`
        : `SELECT r.hasta_lat AS lat, r.hasta_lng AS lng, r.hasta_nombre AS nombre, z.nombre AS ciudad
             FROM rutas_precio_zona r LEFT JOIN zonas z ON z.id = r.zona_id
            WHERE r.id = ? AND r.activa = 1 AND r.revisar = 0`,
    )
    .bind(clave)
    .first<{ lat: number; lng: number; nombre: string; ciudad: string | null }>();
  if (!f) throw new ErrorDatos('Esa dirección no existe.', undefined, 404);
  return {
    punto: { lat: Number(f.lat), lng: Number(f.lng) },
    direccion: f.ciudad ? `${f.nombre}, ${f.ciudad}` : f.nombre,
  };
}

// ───────────────────────────── Panel: «Lugares propios de tu ciudad» ─────────────────────────────

const esquemaLugar = z.object({
  zona: z.string().trim().min(2).max(40),
  nombre: z.string().trim().min(2).max(80),
  otrosNombres: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** La ruta del tabulador de esa ciudad que da su precio (null = sin precio fijo). */
  rutaId: z.string().trim().min(4).max(64).nullable().default(null),
});

type LugarPanel = {
  id: string;
  zona: string;
  nombre: string;
  otrosNombres: string[];
  lat: number;
  lng: number;
  rutaId: string | null;
  activo: boolean;
  actualizadoEn: string;
};
const lugarPanel = (f: FilaLugar & { actualizado_en: string }): LugarPanel => ({
  id: f.id,
  zona: f.zona_id,
  nombre: f.nombre,
  otrosNombres: otrosNombresDe(f.otros_nombres),
  lat: Number(f.lat),
  lng: Number(f.lng),
  rutaId: f.ruta_id,
  activo: f.activo === 1,
  actualizadoEn: f.actualizado_en,
});

/** Otros nombres limpios: sin repetir el nombre ni repetirse entre ellos (en llano). */
export function limpiarOtrosNombres(nombre: string, otros: readonly string[]): string[] {
  const vistos = new Set([llanoLugar(nombre)]);
  const salida: string[] = [];
  for (const o of otros) {
    const k = llanoLugar(o);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    salida.push(o.trim());
  }
  return salida;
}

export const lugaresPropios = new Hono<{ Bindings: Env; Variables: Variables }>();

async function zonaPanel(db: D1Database, id: string) {
  const z0 = await db
    .prepare('SELECT id, nombre FROM zonas WHERE id = ?')
    .bind(id.toUpperCase())
    .first<{ id: string; nombre: string }>();
  if (!z0) throw new ErrorDatos('Esa ciudad no existe.', 'zona', 404);
  return z0;
}

export type RutaAtada = {
  id: string;
  zona_id: string;
  servicio_id: string;
  hasta_lat: number;
  hasta_lng: number;
};
export async function rutaDeLaCiudad(db: D1Database, rutaId: string | null, zona: string) {
  if (!rutaId) return null;
  const r = await db
    .prepare(
      'SELECT id, zona_id, servicio_id, hasta_lat, hasta_lng FROM rutas_precio_zona WHERE id = ?',
    )
    .bind(rutaId)
    .first<RutaAtada>();
  if (!r || r.zona_id !== zona)
    throw new ErrorDatos('Ese precio del tabulador no es de esta ciudad.', 'rutaId', 400);
  return r;
}

/** Un nombre (o un otro nombre) que ya usa OTRO lugar activo de la ciudad no se repite. */
async function exigirNombreLibre(
  db: D1Database,
  zona: string,
  nombres: string[],
  propio: string | null,
) {
  const { results } = await db
    .prepare(
      'SELECT id, nombre, otros_nombres FROM lugares_propios WHERE zona_id = ? AND activo = 1 LIMIT 500',
    )
    .bind(zona)
    .all<{ id: string; nombre: string; otros_nombres: string }>();
  const pedidos = new Set(nombres.map(llanoLugar));
  for (const f of results) {
    if (f.id === propio) continue;
    const choque = [f.nombre, ...otrosNombresDe(f.otros_nombres)].find((u) =>
      pedidos.has(llanoLugar(u)),
    );
    if (choque)
      throw new ErrorDatos(
        `«${choque}» ya es el nombre de «${f.nombre}» en esta ciudad.`,
        'nombre',
      );
  }
}

export function auditoria(
  db: D1Database,
  actor: string,
  accion: string,
  objeto: string,
  antes: unknown,
  despues: unknown,
) {
  return db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(actor, accion, objeto, JSON.stringify(antes ?? null), JSON.stringify(despues ?? null));
}

/**
 * Mover el punto de la ruta atada (y el de su regreso: la ruta que sale de ese mismo punto). Corregir
 * el punto en el mapa desmarca «revisar», como en Precios de la zona.
 */
export function moverRuta(
  db: D1Database,
  admin: string,
  ruta: RutaAtada,
  punto: { lat: number; lng: number },
): D1PreparedStatement[] {
  if (Number(ruta.hasta_lat) === punto.lat && Number(ruta.hasta_lng) === punto.lng) return [];
  return [
    db
      .prepare(
        `UPDATE rutas_precio_zona SET hasta_lat = ?, hasta_lng = ?, revisar = 0, actualizada_por = ?,
           actualizada_en = datetime('now') WHERE id = ?`,
      )
      .bind(punto.lat, punto.lng, admin, ruta.id),
    db
      .prepare(
        `UPDATE rutas_precio_zona SET desde_lat = ?, desde_lng = ?, revisar = 0, actualizada_por = ?,
           actualizada_en = datetime('now')
         WHERE zona_id = ? AND servicio_id = ? AND desde_lat = ? AND desde_lng = ? AND activa = 1`,
      )
      .bind(
        punto.lat,
        punto.lng,
        admin,
        ruta.zona_id,
        ruta.servicio_id,
        ruta.hasta_lat,
        ruta.hasta_lng,
      ),
    auditoria(
      db,
      admin,
      'viaje.precio_zona.mover_por_lugar',
      `precio-zona:${ruta.id}`,
      { lat: ruta.hasta_lat, lng: ruta.hasta_lng },
      punto,
    ),
  ];
}

export const leerLugar = async (db: D1Database, id: string) => {
  const f = await db
    .prepare('SELECT * FROM lugares_propios WHERE id = ?')
    .bind(id)
    .first<FilaLugar & { actualizado_en: string }>();
  if (!f) throw new ErrorDatos('Ese lugar no existe.', undefined, 404);
  return f;
};

/** La lista de una ciudad, con los precios del tabulador que se le pueden atar. */
lugaresPropios.get('/admin/lugares-propios', async (c) => {
  exigir(c, 'admin');
  const q = z.object({ zona: z.string().trim().min(2).max(40) }).parse(c.req.query());
  const db = base(c);
  const zona = await zonaPanel(db, q.zona);
  const [l, r] = await db.batch([
    db
      .prepare(
        'SELECT * FROM lugares_propios WHERE zona_id = ? ORDER BY activo DESC, nombre LIMIT 500',
      )
      .bind(zona.id),
    db
      .prepare(
        `SELECT id, servicio_id, moneda, hasta_nombre, precio, grupo, revisar
           FROM rutas_precio_zona WHERE zona_id = ? AND activa = 1 ORDER BY grupo, precio, hasta_nombre LIMIT 500`,
      )
      .bind(zona.id),
  ]);
  return c.json({
    ciudad: zona,
    lugares: ((l?.results ?? []) as (FilaLugar & { actualizado_en: string })[]).map(lugarPanel),
    rutas: ((r?.results ?? []) as FilaRutaLugar[]).map((x) => ({
      id: x.id,
      servicio: x.servicio_id,
      nombre: x.hasta_nombre,
      precio: x.precio,
      moneda: x.moneda,
      grupo: x.grupo,
      revisar: x.revisar === 1,
    })),
  });
});

lugaresPropios.post('/admin/lugares-propios', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaLugar);
  const zona = await zonaPanel(db, d.zona);
  const otros = limpiarOtrosNombres(d.nombre, d.otrosNombres);
  await exigirNombreLibre(db, zona.id, [d.nombre, ...otros], null);
  const ruta = await rutaDeLaCiudad(db, d.rutaId, zona.id);
  const id = nuevoId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO lugares_propios (id, zona_id, nombre, otros_nombres, lat, lng, ruta_id, creado_por, actualizado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        zona.id,
        d.nombre,
        JSON.stringify(otros),
        d.lat,
        d.lng,
        ruta?.id ?? null,
        admin.id,
        admin.id,
      ),
    ...(ruta ? moverRuta(db, admin.id, ruta, d) : []),
    auditoria(db, admin.id, 'lugar_propio.agregar', `lugar-propio:${id}`, null, d),
  ]);
  olvidarLugaresDe(zona.id);
  return c.json({ lugar: lugarPanel(await leerLugar(db, id)) }, 201);
});

lugaresPropios.put('/admin/lugares-propios/:id', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const antes = await leerLugar(db, c.req.param('id'));
  const d = await leerCuerpo(c, esquemaLugar);
  const zona = await zonaPanel(db, d.zona);
  if (zona.id !== antes.zona_id)
    throw new ErrorDatos('Un lugar no cambia de ciudad: créalo en la otra.', 'zona', 400);
  const otros = limpiarOtrosNombres(d.nombre, d.otrosNombres);
  await exigirNombreLibre(db, zona.id, [d.nombre, ...otros], antes.id);
  const ruta = await rutaDeLaCiudad(db, d.rutaId, zona.id);
  await db.batch([
    db
      .prepare(
        `UPDATE lugares_propios SET nombre = ?, otros_nombres = ?, lat = ?, lng = ?, ruta_id = ?, actualizado_por = ?,
           actualizado_en = datetime('now') WHERE id = ?`,
      )
      .bind(d.nombre, JSON.stringify(otros), d.lat, d.lng, ruta?.id ?? null, admin.id, antes.id),
    ...(ruta ? moverRuta(db, admin.id, ruta, d) : []),
    auditoria(
      db,
      admin.id,
      'lugar_propio.editar',
      `lugar-propio:${antes.id}`,
      lugarPanel(antes),
      d,
    ),
  ]);
  olvidarLugaresDe(zona.id);
  return c.json({ lugar: lugarPanel(await leerLugar(db, antes.id)) });
});

/** Apagar o encender (nunca se borra: queda para la auditoría y para encenderlo otra vez). */
for (const [accion, valor] of [
  ['apagar', 0],
  ['encender', 1],
] as const)
  lugaresPropios.post(`/admin/lugares-propios/:id/${accion}`, async (c) => {
    const admin = exigir(c, 'admin');
    const db = base(c);
    const antes = await leerLugar(db, c.req.param('id'));
    if (valor === 1)
      await exigirNombreLibre(
        db,
        antes.zona_id,
        [antes.nombre, ...otrosNombresDe(antes.otros_nombres)],
        antes.id,
      );
    if (antes.activo !== valor)
      await db.batch([
        db
          .prepare(
            "UPDATE lugares_propios SET activo = ?, actualizado_por = ?, actualizado_en = datetime('now') WHERE id = ?",
          )
          .bind(valor, admin.id, antes.id),
        auditoria(
          db,
          admin.id,
          `lugar_propio.${accion}`,
          `lugar-propio:${antes.id}`,
          { activo: antes.activo === 1 },
          { activo: valor === 1 },
        ),
      ]);
    olvidarLugaresDe(antes.zona_id);
    return c.json({ lugar: lugarPanel(await leerLugar(db, antes.id)) });
  });
