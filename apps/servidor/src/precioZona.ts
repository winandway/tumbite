import { Hono } from 'hono';
import { z } from 'zod';
import { type DesgloseViaje, SERVICIOS_VIAJE, distanciaKm } from '@tumbite/compartido';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';

/**
 * C-PRECIO-ZONA (24 nov 2026, Richard): «etiquetas de ruta». En los pueblos la gente cobra un precio
 * fijo acostumbrado entre lugares cercanos (por km saldría 70; todos cobran 50). El equipo escribe la
 * ruta en el panel y el pasajero paga el MENOR entre ese precio y el calculado, siempre que la
 * diferencia pase del umbral de la tarifa (10 % por defecto): así un precio casi igual no cambia la
 * etiqueta del viaje por unos centavos. Comisión, pago al conductor, tarifa de servicio y regalos
 * salen del precio final (el total de la cotización, el único número que viaja al pedir).
 *
 * Solo para la categoría estándar y viajes sin paradas: con paradas la ruta ya no es la acostumbrada.
 * La ruta va en un sentido (desde → hasta); la vuelta es otra línea en el panel.
 */

/** Umbral por defecto: el precio de la zona manda si es al menos un 10 % más barato. */
export const UMBRAL_PRECIO_ZONA_PB = 1000;

export type FilaRutaPrecio = {
  id: string;
  zona_id: string;
  servicio_id: string;
  moneda: string;
  desde_lat: number | null;
  desde_lng: number | null;
  desde_radio_km: number | null;
  desde_nombre: string | null;
  hasta_lat: number;
  hasta_lng: number;
  hasta_radio_km: number;
  hasta_nombre: string;
  precio: number;
  precio_ida_vuelta: number | null;
  activa: number;
  creada_por: string | null;
  creada_en: string;
  actualizada_por: string | null;
  actualizada_en: string;
};

type Punto = { lat: number; lng: number };

const dentro = (p: Punto, centro: Punto, radioKm: number) => distanciaKm(p, centro) <= radioKm;

/** ¿La recogida y el destino caen en esta ruta? (la zona de la recogida ya es la de la ruta). */
export function caeEnRuta(f: FilaRutaPrecio, origen: Punto, destino: Punto): boolean {
  if (f.activa !== 1) return false;
  if (!dentro(destino, { lat: f.hasta_lat, lng: f.hasta_lng }, f.hasta_radio_km)) return false;
  if (f.desde_lat == null || f.desde_lng == null || f.desde_radio_km == null) return true;
  return dentro(origen, { lat: f.desde_lat, lng: f.desde_lng }, f.desde_radio_km);
}

/**
 * La ruta activa del servicio en la zona en la que caen la recogida y el destino (la más barata si
 * caen en varias), o null. Una sola lectura por el índice de la zona.
 */
export async function rutaPrecioPara(
  db: D1Database,
  servicio: string,
  zona: { id: string },
  moneda: string,
  origen: Punto,
  destino: Punto,
): Promise<FilaRutaPrecio | null> {
  const { results } = await db
    .prepare(
      `SELECT * FROM rutas_precio_zona WHERE zona_id = ? AND servicio_id = ? AND activa = 1
        AND moneda = ? ORDER BY precio, creada_en LIMIT 200`,
    )
    .bind(zona.id, servicio, moneda)
    .all<FilaRutaPrecio>();
  return results.find((f) => caeEnRuta(f, origen, destino)) ?? null;
}

/**
 * El precio final (sin la tarifa de servicio): el de la zona si es más barato que el calculado por
 * al menos el umbral; si no, el calculado de siempre. Las piezas del cálculo quedan en 0 para que
 * el desglose sume el total (las apps de antes ven solo el total).
 */
export function conPrecioZona(
  calculado: DesgloseViaje,
  precio: number,
  umbralPb: number | undefined,
  extra: { id: string; idaVuelta?: boolean },
): DesgloseViaje {
  const umbral = umbralPb ?? UMBRAL_PRECIO_ZONA_PB;
  // Más caro, igual o más barato por menos del umbral: el calculado de siempre (el pasajero paga el menor).
  if ((calculado.total - precio) * 10_000 < umbral * calculado.total) return calculado;
  if (precio >= calculado.total) return calculado;
  return {
    base: 0,
    distancia: 0,
    tiempo: 0,
    ajusteMinimo: 0,
    dinamico: 0,
    cargoFijo: 0,
    redondeo: 0,
    total: precio,
    precioZona: precio,
    calculado: calculado.total,
    precioZonaId: extra.id,
    ...(extra.idaVuelta ? { idaVuelta: 1 } : {}),
  };
}

function rutaPublica(f: FilaRutaPrecio) {
  return {
    id: f.id,
    zona: f.zona_id,
    servicio: f.servicio_id,
    moneda: f.moneda,
    desde:
      f.desde_lat == null || f.desde_lng == null || f.desde_radio_km == null
        ? null
        : {
            lat: f.desde_lat,
            lng: f.desde_lng,
            radioKm: f.desde_radio_km,
            nombre: f.desde_nombre ?? '',
          },
    hasta: {
      lat: f.hasta_lat,
      lng: f.hasta_lng,
      radioKm: f.hasta_radio_km,
      nombre: f.hasta_nombre,
    },
    precio: f.precio,
    precioIdaVuelta: f.precio_ida_vuelta,
    activa: f.activa === 1,
    creadaPor: f.creada_por,
    creadaEn: f.creada_en,
    actualizadaEn: f.actualizada_en,
  };
}

const lugar = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radioKm: z.number().min(0.05).max(30),
  nombre: z.string().trim().min(2).max(120),
});
const precio = z.number().int().min(1).max(100_000_000);
const esquemaRuta = z.object({
  zona: z.string().trim().min(2).max(40),
  servicio: z.enum(SERVICIOS_VIAJE),
  /** null = la zona entera. */
  desde: lugar.nullable(),
  hasta: lugar,
  precio,
  precioIdaVuelta: precio.nullable().optional(),
});

export const preciosZona = new Hono<{ Bindings: Env; Variables: Variables }>();

preciosZona.get('/admin/viajes/precios-zona', async (c) => {
  exigir(c, 'admin');
  const q = z
    .object({ zona: z.string().max(40).optional(), servicio: z.enum(SERVICIOS_VIAJE).optional() })
    .parse(c.req.query());
  const { results } = await base(c)
    .prepare(
      `SELECT * FROM rutas_precio_zona WHERE (?1 IS NULL OR zona_id = ?1) AND (?2 IS NULL OR servicio_id = ?2)
        ORDER BY activa DESC, zona_id, servicio_id, hasta_nombre LIMIT 300`,
    )
    .bind(q.zona ?? null, q.servicio ?? null)
    .all<FilaRutaPrecio>();
  return c.json({ rutas: results.map(rutaPublica) });
});

async function zonaDe(db: D1Database, id: string) {
  const z0 = await db
    .prepare('SELECT id, moneda FROM zonas WHERE id = ?')
    .bind(id.toUpperCase())
    .first<{ id: string; moneda: string }>();
  if (!z0) throw new ErrorDatos('Esa ciudad no existe.', 'zona', 404);
  return z0;
}

function auditoria(
  db: D1Database,
  actor: string,
  accion: string,
  id: string,
  antes: unknown,
  despues: unknown,
) {
  return db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      actor,
      accion,
      `precio-zona:${id}`,
      JSON.stringify(antes ?? null),
      JSON.stringify(despues ?? null),
    );
}

function exigirIdaVuelta(d: { precio: number; precioIdaVuelta?: number | null; servicio: string }) {
  if (d.precioIdaVuelta == null) return;
  if (d.servicio === 'envios')
    throw new ErrorDatos('Un envío no tiene precio de ida y vuelta.', 'precioIdaVuelta', 422);
  if (d.precioIdaVuelta < d.precio)
    throw new ErrorDatos(
      'El precio de ida y vuelta no puede ser menor que el de ida.',
      'precioIdaVuelta',
      422,
    );
}

preciosZona.post('/admin/viajes/precios-zona', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaRuta);
  exigirIdaVuelta(d);
  const zona = await zonaDe(db, d.zona);
  const id = nuevoId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO rutas_precio_zona (id, zona_id, servicio_id, moneda, desde_lat, desde_lng, desde_radio_km,
           desde_nombre, hasta_lat, hasta_lng, hasta_radio_km, hasta_nombre, precio, precio_ida_vuelta,
           creada_por, actualizada_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        zona.id,
        d.servicio,
        zona.moneda,
        d.desde?.lat ?? null,
        d.desde?.lng ?? null,
        d.desde?.radioKm ?? null,
        d.desde?.nombre ?? null,
        d.hasta.lat,
        d.hasta.lng,
        d.hasta.radioKm,
        d.hasta.nombre,
        d.precio,
        d.precioIdaVuelta ?? null,
        admin.id,
        admin.id,
      ),
    auditoria(db, admin.id, 'viaje.precio_zona.agregar', id, null, d),
  ]);
  const f = await db
    .prepare('SELECT * FROM rutas_precio_zona WHERE id = ?')
    .bind(id)
    .first<FilaRutaPrecio>();
  return c.json({ ruta: f ? rutaPublica(f) : null }, 201);
});

async function rutaExistente(db: D1Database, id: string) {
  const f = await db
    .prepare('SELECT * FROM rutas_precio_zona WHERE id = ?')
    .bind(id)
    .first<FilaRutaPrecio>();
  if (!f) throw new ErrorDatos('Esa ruta no existe.', undefined, 404);
  return f;
}

/** Editar: cambia el lugar o el precio; las cotizaciones ya hechas guardan el precio con que nacieron. */
preciosZona.put('/admin/viajes/precios-zona/:id', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const antes = await rutaExistente(db, c.req.param('id'));
  const d = await leerCuerpo(c, esquemaRuta.extend({ activa: z.boolean().optional() }));
  exigirIdaVuelta(d);
  const zona = await zonaDe(db, d.zona);
  await db.batch([
    db
      .prepare(
        `UPDATE rutas_precio_zona SET zona_id = ?, servicio_id = ?, moneda = ?, desde_lat = ?, desde_lng = ?,
           desde_radio_km = ?, desde_nombre = ?, hasta_lat = ?, hasta_lng = ?, hasta_radio_km = ?, hasta_nombre = ?,
           precio = ?, precio_ida_vuelta = ?, activa = ?, actualizada_por = ?, actualizada_en = datetime('now')
         WHERE id = ?`,
      )
      .bind(
        zona.id,
        d.servicio,
        zona.moneda,
        d.desde?.lat ?? null,
        d.desde?.lng ?? null,
        d.desde?.radioKm ?? null,
        d.desde?.nombre ?? null,
        d.hasta.lat,
        d.hasta.lng,
        d.hasta.radioKm,
        d.hasta.nombre,
        d.precio,
        d.precioIdaVuelta ?? null,
        d.activa === undefined ? antes.activa : d.activa ? 1 : 0,
        admin.id,
        antes.id,
      ),
    auditoria(db, admin.id, 'viaje.precio_zona.editar', antes.id, rutaPublica(antes), d),
  ]);
  const f = await rutaExistente(db, antes.id);
  return c.json({ ruta: rutaPublica(f) });
});

/** Apagar (nunca se borra: el registro queda para la auditoría y para encenderla otra vez). */
preciosZona.post('/admin/viajes/precios-zona/:id/apagar', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const antes = await rutaExistente(db, c.req.param('id'));
  if (antes.activa === 1)
    await db.batch([
      db
        .prepare(
          "UPDATE rutas_precio_zona SET activa = 0, actualizada_por = ?, actualizada_en = datetime('now') WHERE id = ?",
        )
        .bind(admin.id, antes.id),
      auditoria(db, admin.id, 'viaje.precio_zona.apagar', antes.id, rutaPublica(antes), {
        activa: false,
      }),
    ]);
  return c.json({ ruta: rutaPublica(await rutaExistente(db, antes.id)) });
});
