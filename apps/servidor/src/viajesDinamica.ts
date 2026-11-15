import { z } from 'zod';
import { multiplicadorPorDemanda, perfilPasajeros } from '@tumbite/compartido';
import { MINUTOS_UBICACION_VIGENTE } from './operaciones';
import { ErrorDatos } from './validar';

/**
 * C-CARRO-DINAMICA (14 nov 2026, todos los países): tarifa dinámica de Carro por ciudad, como el
 * «surge» de Uber y la tarifa dinámica de DiDi (docs/investigaciones-rea/2026-11-14-carro-paradas-
 * categorias-dinamica.md). El multiplicador vive en UNA fila por ciudad (`dinamica_zona`):
 *
 * - El reloj la recalcula cada minuto con los viajes que buscan conductor frente a los conductores
 *   libres, y la ESCRIBE solo si el multiplicador cambió o si hay que renovar un recargo que sigue
 *   (regla «la nube no se come el dinero»: sin demanda alta, cero escrituras).
 * - Un recargo vale solo hasta `vale_hasta`: si el reloj se para, el recargo se cae solo.
 * - Nunca pasa del tope: el de la tarifa de la ciudad y el del país, el menor. Con el tope de la
 *   tarifa en 10 000 (como nace), la ciudad no tiene tarifa dinámica.
 * - El equipo la puede fijar a mano por un rato (un evento, una emergencia) o apagarla.
 */

/** Los servicios con tarifa dinámica. */
export const SERVICIOS_DINAMICA = ['carro'] as const;
/** Minutos que vale un recargo automático sin que el reloj lo renueve. */
export const MINUTOS_VIGENCIA_DINAMICA = 10;
/** El reloj renueva un recargo que sigue cuando le quedan menos de estos minutos. */
export const MINUTOS_RENOVAR_DINAMICA = 5;
/** Lo más que dura un multiplicador fijado a mano. */
export const HORAS_MAXIMAS_MANUAL = 6;
/** Un viaje que se quedó sin conductor hace menos de estos minutos también cuenta como demanda. */
export const MINUTOS_DEMANDA = 10;

type FilaDinamica = {
  multiplicador_pb: number;
  modo: 'auto' | 'manual' | 'apagada';
  vigente: number;
};

/**
 * El multiplicador que rige AHORA para cotizar (una lectura). 10 000 = precio normal. El tope se
 * aplica otra vez aquí: aunque la fila diga más, la cotización nunca cobra por encima.
 */
export async function multiplicadorVigente(
  db: D1Database,
  servicio: string,
  zona: { id: string; pais: string },
  topeTarifaPb: number,
): Promise<number> {
  if (!(SERVICIOS_DINAMICA as readonly string[]).includes(servicio)) return 10_000;
  const tope = Math.min(topeTarifaPb, perfilPasajeros(zona.pais).carro.dinamica.topePb);
  if (tope <= 10_000) return 10_000;
  const f = await db
    .prepare(
      `SELECT multiplicador_pb, modo, (vale_hasta IS NOT NULL AND vale_hasta > datetime('now')) AS vigente
         FROM dinamica_zona WHERE servicio_id = ? AND zona_id = ?`,
    )
    .bind(servicio, zona.id)
    .first<FilaDinamica>();
  if (!f || f.modo === 'apagada' || !f.vigente) return 10_000;
  return Math.max(10_000, Math.min(Number(f.multiplicador_pb), tope));
}

/**
 * Tarea del reloj. Lee las ciudades con tarifa dinámica encendida (tope de la tarifa por encima de
 * 10 000) y escribe, como mucho, UNA fila por ciudad y solo cuando hace falta. Devuelve cuántas
 * filas escribió. Filas esperadas por vuelta: 0 casi siempre; 1 por ciudad al cambiar el
 * multiplicador y 1 cada 5 minutos por ciudad mientras dure un recargo.
 */
export async function recalcularDinamica(db: D1Database): Promise<{ escritas: number }> {
  const { results } = await db
    .prepare(
      `SELECT t.servicio_id, t.zona_id, t.tope_dinamico_pb, z.pais,
              d.multiplicador_pb, d.modo,
              (d.vale_hasta IS NOT NULL AND d.vale_hasta > datetime('now')) AS vigente,
              (d.vale_hasta IS NOT NULL AND d.vale_hasta > datetime('now', ?)) AS con_margen
         FROM tarifas_viaje t JOIN zonas z ON z.id = t.zona_id
         LEFT JOIN dinamica_zona d ON d.servicio_id = t.servicio_id AND d.zona_id = t.zona_id
        WHERE t.activa = 1 AND t.tope_dinamico_pb > 10000
          AND t.servicio_id IN (${SERVICIOS_DINAMICA.map(() => '?').join(', ')})`,
    )
    .bind(`+${MINUTOS_RENOVAR_DINAMICA} minutes`, ...SERVICIOS_DINAMICA)
    .all<{
      servicio_id: string;
      zona_id: string;
      tope_dinamico_pb: number;
      pais: string;
      multiplicador_pb: number | null;
      modo: string | null;
      vigente: number | null;
      con_margen: number | null;
    }>();
  let escritas = 0;
  for (const f of results) {
    if (f.modo === 'apagada') continue;
    // Lo fijado a mano manda mientras dure; al vencer, vuelve a automático en esta misma vuelta.
    if (f.modo === 'manual' && f.vigente) continue;
    const { demanda, oferta } = await demandaYOferta(db, f.servicio_id, f.zona_id);
    const nuevo = multiplicadorPorDemanda(
      perfilPasajeros(f.pais).carro.dinamica,
      demanda,
      oferta,
      Number(f.tope_dinamico_pb),
    );
    const actual = f.modo === 'auto' && f.vigente ? Number(f.multiplicador_pb ?? 10_000) : 10_000;
    const hayFila = f.modo != null;
    // Sin recargo y sin fila que corregir: nada que escribir.
    const cambia = nuevo !== actual || (hayFila && f.modo !== 'auto');
    const renovar = nuevo > 10_000 && !f.con_margen;
    if (!cambia && !renovar) continue;
    if (!hayFila && nuevo === 10_000) continue;
    await db
      .prepare(
        `INSERT INTO dinamica_zona (servicio_id, zona_id, multiplicador_pb, demanda, oferta, modo, vale_hasta, motivo, actualizado_por)
         VALUES (?1, ?2, ?3, ?4, ?5, 'auto', CASE WHEN ?3 > 10000 THEN datetime('now', ?6) END, '', NULL)
         ON CONFLICT(servicio_id, zona_id) DO UPDATE SET multiplicador_pb = excluded.multiplicador_pb,
           demanda = excluded.demanda, oferta = excluded.oferta, modo = 'auto', vale_hasta = excluded.vale_hasta,
           motivo = '', actualizado_por = NULL, actualizado_en = datetime('now')`,
      )
      .bind(
        f.servicio_id,
        f.zona_id,
        nuevo,
        demanda,
        oferta,
        `+${MINUTOS_VIGENCIA_DINAMICA} minutes`,
      )
      .run();
    escritas++;
  }
  return { escritas };
}

/** Viajes que buscan conductor (o se quedaron sin uno hace poco) y conductores libres, por ciudad. */
export async function demandaYOferta(db: D1Database, servicio: string, zona: string) {
  const d = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM operaciones o WHERE o.zona_id = ?1 AND o.servicio_id = ?2
             AND o.estado_general = 'buscando') +
         (SELECT COUNT(*) FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
           WHERE o.tipo_operacion = 'viaje_pasajero' AND o.creado_en > datetime('now', ?3)
             AND o.zona_id = ?1 AND o.servicio_id = ?2 AND v.estado = 'sin_conductor') AS demanda,
         (SELECT COUNT(*) FROM conductores_elegibles e WHERE e.servicio_id = ?2 AND e.zona_id = ?1
             AND e.lat IS NOT NULL AND e.ubicacion_en > datetime('now', ?4)
             AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = e.conductor_id)) AS oferta`,
    )
    .bind(zona, servicio, `-${MINUTOS_DEMANDA} minutes`, `-${MINUTOS_UBICACION_VIGENTE} minutes`)
    .first<{ demanda: number; oferta: number }>();
  return { demanda: Number(d?.demanda ?? 0), oferta: Number(d?.oferta ?? 0) };
}

export const esquemaFijarDinamica = z.discriminatedUnion('modo', [
  z.object({ modo: z.literal('auto'), motivo: z.string().trim().min(3).max(200) }),
  z.object({ modo: z.literal('apagada'), motivo: z.string().trim().min(3).max(200) }),
  z.object({
    modo: z.literal('manual'),
    multiplicadorPb: z.number().int().min(10_000).max(30_000),
    minutos: z
      .number()
      .int()
      .min(5)
      .max(HORAS_MAXIMAS_MANUAL * 60),
    motivo: z.string().trim().min(3).max(200),
  }),
]);
export type FijarDinamica = z.infer<typeof esquemaFijarDinamica>;

/** El equipo fija, apaga o devuelve a automático la tarifa dinámica de una ciudad (con auditoría). */
export async function fijarDinamica(
  db: D1Database,
  adminId: string,
  servicio: string,
  zonaId: string,
  d: FijarDinamica,
) {
  if (!(SERVICIOS_DINAMICA as readonly string[]).includes(servicio))
    throw new ErrorDatos('Ese servicio no tiene tarifa dinámica.', 'servicio', 422);
  const t = await db
    .prepare(
      `SELECT t.tope_dinamico_pb, z.pais FROM tarifas_viaje t JOIN zonas z ON z.id = t.zona_id
        WHERE t.servicio_id = ? AND t.zona_id = ? AND t.activa = 1`,
    )
    .bind(servicio, zonaId)
    .first<{ tope_dinamico_pb: number; pais: string }>();
  if (!t) throw new ErrorDatos('Esa ciudad no tiene tarifa de este servicio.', 'zona', 404);
  const tope = Math.min(Number(t.tope_dinamico_pb), perfilPasajeros(t.pais).carro.dinamica.topePb);
  if (d.modo === 'manual' && d.multiplicadorPb > tope)
    throw new ErrorDatos(
      'Ese multiplicador pasa del tope de la ciudad. Sube primero el tope en la tarifa.',
      'multiplicadorPb',
      422,
    );
  const antes = await db
    .prepare('SELECT * FROM dinamica_zona WHERE servicio_id = ? AND zona_id = ?')
    .bind(servicio, zonaId)
    .first();
  const mult = d.modo === 'manual' ? d.multiplicadorPb : 10_000;
  await db.batch([
    db
      .prepare(
        `INSERT INTO dinamica_zona (servicio_id, zona_id, multiplicador_pb, demanda, oferta, modo, vale_hasta, motivo, actualizado_por)
         VALUES (?1, ?2, ?3, 0, 0, ?4, CASE WHEN ?5 IS NOT NULL THEN datetime('now', ?5) END, ?6, ?7)
         ON CONFLICT(servicio_id, zona_id) DO UPDATE SET multiplicador_pb = excluded.multiplicador_pb,
           modo = excluded.modo, vale_hasta = excluded.vale_hasta, motivo = excluded.motivo,
           actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
      )
      .bind(
        servicio,
        zonaId,
        mult,
        d.modo,
        d.modo === 'manual' ? `+${d.minutos} minutes` : null,
        d.motivo,
        adminId,
      ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        adminId,
        'viaje.dinamica',
        `dinamica:${servicio}:${zonaId}`,
        JSON.stringify(antes ?? null),
        JSON.stringify(d),
      ),
  ]);
  return estadoDinamica(db, servicio, zonaId);
}

/** Lo que el panel muestra de la tarifa dinámica de una ciudad. */
export async function estadoDinamica(db: D1Database, servicio: string, zonaId: string) {
  const f = await db
    .prepare(
      `SELECT t.tope_dinamico_pb, z.pais, d.multiplicador_pb, d.demanda, d.oferta, d.modo, d.vale_hasta,
              d.motivo, d.actualizado_en,
              (d.vale_hasta IS NOT NULL AND d.vale_hasta > datetime('now')) AS vigente
         FROM tarifas_viaje t JOIN zonas z ON z.id = t.zona_id
         LEFT JOIN dinamica_zona d ON d.servicio_id = t.servicio_id AND d.zona_id = t.zona_id
        WHERE t.servicio_id = ? AND t.zona_id = ? AND t.activa = 1`,
    )
    .bind(servicio, zonaId)
    .first<Record<string, unknown>>();
  if (!f) return null;
  const topePais = perfilPasajeros(String(f.pais)).carro.dinamica.topePb;
  const tope = Math.min(Number(f.tope_dinamico_pb), topePais);
  const modo = String(f.modo ?? 'auto');
  const mult =
    modo !== 'apagada' && f.vigente
      ? Math.max(10_000, Math.min(Number(f.multiplicador_pb), tope))
      : 10_000;
  return {
    servicio,
    zona: zonaId,
    encendida: tope > 10_000 && modo !== 'apagada',
    topePb: tope,
    topePaisPb: topePais,
    modo,
    multiplicadorPb: mult,
    demanda: Number(f.demanda ?? 0),
    oferta: Number(f.oferta ?? 0),
    valeHasta: f.vale_hasta == null ? null : String(f.vale_hasta),
    motivo: String(f.motivo ?? ''),
    actualizadoEn: f.actualizado_en == null ? null : String(f.actualizado_en),
  };
}
