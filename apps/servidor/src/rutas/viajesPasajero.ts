import { Hono } from 'hono';
import { z } from 'zod';
import {
  type CotizacionViaje,
  DISTANCIA_MAXIMA_KM,
  SERVICIOS_VIAJE,
  type TarifaViaje,
  VIGENCIA_COTIZACION_S,
  cotizarViaje,
  esquemaCotizarViaje,
  esquemaTarifaViaje,
  estimarRuta,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { estadoServicioEnZona } from './servicios';
import { zonaPara } from './zonas';

/**
 * Divoox Moto · Fase M1 (docs/PLAN-MOTO-PASAJEROS.md): la tarifa por ciudad que guarda el
 * superadmin y la cotización con PRECIO FIJO del pasajero (C-VIAJE-PRECIO-FIJO). La cotización se
 * guarda en el servidor y vence a los 5 minutos: al pedir (M2) solo viaja su id, así el precio no
 * se puede alterar desde la app. Moto existe solo en el sitio de pruebas (C-MOTO-SOLO-PRUEBAS):
 * en producción el servicio no está implementado y la cotización responde «no disponible».
 */
export const viajesPasajero = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaTarifa = {
  id: string;
  servicio_id: string;
  zona_id: string;
  moneda: string;
  base: number;
  por_km: number;
  por_minuto: number;
  minimo: number;
  espera_gratis_s: number;
  por_minuto_espera: number;
  cancelacion_gratis_s: number;
  cargo_cancelacion: number;
  cargo_no_se_presento: number;
  tope_dinamico_pb: number;
  redondeo: number;
  cargo_fijo: number;
  factor_calle_pb: number;
  velocidad_kmh: number;
  de_prueba: number;
  activa: number;
  motivo: string;
  creada_por: string | null;
  creada_en: string;
  cerrada_en: string | null;
};

export function filaATarifa(f: FilaTarifa): TarifaViaje {
  return {
    base: f.base,
    porKm: f.por_km,
    porMinuto: f.por_minuto,
    minimo: f.minimo,
    esperaGratisS: f.espera_gratis_s,
    porMinutoEspera: f.por_minuto_espera,
    cancelacionGratisS: f.cancelacion_gratis_s,
    cargoCancelacion: f.cargo_cancelacion,
    cargoNoSePresento: f.cargo_no_se_presento,
    topeDinamicoPb: f.tope_dinamico_pb,
    redondeo: f.redondeo,
    cargoFijo: f.cargo_fijo,
    factorCallePb: f.factor_calle_pb,
    velocidadKmh: f.velocidad_kmh,
  };
}

function tarifaPublica(f: FilaTarifa) {
  return {
    id: f.id,
    servicio: f.servicio_id,
    zona: f.zona_id,
    moneda: f.moneda,
    ...filaATarifa(f),
    dePrueba: f.de_prueba === 1,
    activa: f.activa === 1,
    motivo: f.motivo,
    creadaPor: f.creada_por,
    creadaEn: f.creada_en,
    cerradaEn: f.cerrada_en,
  };
}

/** La tarifa activa de un servicio en una zona, o null. */
export async function tarifaActiva(
  db: D1Database,
  servicio: string,
  zona: string,
): Promise<FilaTarifa | null> {
  return db
    .prepare('SELECT * FROM tarifas_viaje WHERE servicio_id = ? AND zona_id = ? AND activa = 1')
    .bind(servicio, zona)
    .first<FilaTarifa>();
}

const sqlFecha = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

// ---------------------------------------------------------------- superadmin

viajesPasajero.get('/admin/viajes/tarifas', async (c) => {
  exigir(c, 'admin');
  const q = z
    .object({ servicio: z.enum(SERVICIOS_VIAJE).optional(), zona: z.string().max(40).optional() })
    .parse(c.req.query());
  const { results } = await base(c)
    .prepare(
      `SELECT * FROM tarifas_viaje WHERE (? IS NULL OR servicio_id = ?) AND (? IS NULL OR zona_id = ?)
        ORDER BY servicio_id, zona_id, activa DESC, creada_en DESC LIMIT 200`,
    )
    .bind(q.servicio ?? null, q.servicio ?? null, q.zona ?? null, q.zona ?? null)
    .all<FilaTarifa>();
  return c.json({ tarifas: results.map(tarifaPublica) });
});

/**
 * Nueva versión de la tarifa: cierra la activa (si hay) y abre esta, en un solo lote. Nunca se
 * edita una tarifa: así cada cotización vieja sigue apuntando a la tarifa con que se calculó.
 */
viajesPasajero.post('/admin/viajes/tarifas', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(
    c,
    z.object({
      servicio: z.enum(SERVICIOS_VIAJE),
      zona: z.string().trim().min(2).max(40),
      tarifa: esquemaTarifaViaje,
      dePrueba: z.boolean().default(true),
      motivo: z.string().trim().min(3).max(200),
    }),
  );
  const zona = await db
    .prepare('SELECT id, moneda FROM zonas WHERE id = ?')
    .bind(d.zona)
    .first<{ id: string; moneda: string }>();
  if (!zona) throw new ErrorDatos('Esa ciudad no existe.', 'zona', 404);
  const antes = await tarifaActiva(db, d.servicio, zona.id);
  const id = nuevoId();
  const t = d.tarifa;
  await db.batch([
    db
      .prepare(
        "UPDATE tarifas_viaje SET activa = 0, cerrada_en = datetime('now') WHERE servicio_id = ? AND zona_id = ? AND activa = 1",
      )
      .bind(d.servicio, zona.id),
    db
      .prepare(
        `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
           espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion,
           cargo_no_se_presento, tope_dinamico_pb, redondeo, cargo_fijo, factor_calle_pb, velocidad_kmh,
           de_prueba, motivo, creada_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        d.servicio,
        zona.id,
        zona.moneda,
        t.base,
        t.porKm,
        t.porMinuto,
        t.minimo,
        t.esperaGratisS,
        t.porMinutoEspera,
        t.cancelacionGratisS,
        t.cargoCancelacion,
        t.cargoNoSePresento,
        t.topeDinamicoPb,
        t.redondeo,
        t.cargoFijo,
        t.factorCallePb,
        t.velocidadKmh,
        d.dePrueba ? 1 : 0,
        d.motivo,
        admin.id,
      ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        admin.id,
        'viaje.tarifa',
        `tarifa:${d.servicio}:${zona.id}`,
        JSON.stringify(antes ?? null),
        JSON.stringify({ id, ...t, dePrueba: d.dePrueba, motivo: d.motivo }),
      ),
  ]);
  const nueva = await db
    .prepare('SELECT * FROM tarifas_viaje WHERE id = ?')
    .bind(id)
    .first<FilaTarifa>();
  return c.json({ tarifa: nueva ? tarifaPublica(nueva) : null }, 201);
});

// ---------------------------------------------------------------- pasajero

viajesPasajero.post('/viajes/cotizar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaCotizarViaje);
  const zona = await zonaPara(db, d.origen.lat, d.origen.lng);
  if (!zona) throw new ErrorDatos('Todavía no llegamos a esa dirección.', 'origen', 409);
  const zonaDestino = await zonaPara(db, d.destino.lat, d.destino.lng);
  if (zonaDestino?.id !== zona.id)
    throw new ErrorDatos('El destino queda fuera de la ciudad del viaje.', 'destino', 422);
  if ((await estadoServicioEnZona(db, d.servicio, zona.id)) !== 'disponible')
    throw new ErrorDatos('Este servicio todavía no está disponible en tu ciudad.', 'servicio', 409);
  const fila = await tarifaActiva(db, d.servicio, zona.id);
  if (!fila)
    throw new ErrorDatos('Este servicio todavía no tiene precio en tu ciudad.', 'servicio', 409);
  const tarifa = filaATarifa(fila);
  const ruta = estimarRuta(tarifa, d.origen, d.destino);
  if (ruta.distanciaM < 200)
    throw new ErrorDatos('El destino está demasiado cerca del punto de recogida.', 'destino', 422);
  if (ruta.distanciaM > DISTANCIA_MAXIMA_KM[d.servicio] * 1000)
    throw new ErrorDatos('El destino está demasiado lejos para este servicio.', 'destino', 422);
  // M1: sin precio dinámico todavía (multiplicador 1). El tope ya vive en la tarifa.
  const multiplicadorPb = 10_000;
  const desglose = cotizarViaje(tarifa, ruta, multiplicadorPb);
  const id = nuevoId();
  const venceEn = sqlFecha(new Date(Date.now() + VIGENCIA_COTIZACION_S * 1000));
  await db
    .prepare(
      `INSERT INTO cotizaciones_viaje (id, cliente_id, servicio_id, zona_id, tarifa_id,
         origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion,
         distancia_m, duracion_s, multiplicador_pb, desglose_json, tarifa_json, total, moneda, vence_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      u.id,
      d.servicio,
      zona.id,
      fila.id,
      d.origen.lat,
      d.origen.lng,
      d.origen.direccion,
      d.destino.lat,
      d.destino.lng,
      d.destino.direccion,
      ruta.distanciaM,
      ruta.duracionS,
      multiplicadorPb,
      JSON.stringify(desglose),
      JSON.stringify(tarifa),
      desglose.total,
      fila.moneda,
      venceEn,
    )
    .run();
  const cotizacion: CotizacionViaje = {
    id,
    servicio: d.servicio,
    zona: { id: zona.id, nombre: zona.nombre },
    moneda: fila.moneda,
    distanciaM: ruta.distanciaM,
    duracionS: ruta.duracionS,
    desglose,
    total: desglose.total,
    venceEn,
    dePrueba: fila.de_prueba === 1,
  };
  return c.json({ cotizacion }, 201);
});
