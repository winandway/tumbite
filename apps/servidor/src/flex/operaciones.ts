import { Hono } from 'hono';
import { z } from 'zod';
import {
  type CapacidadVehiculo,
  type ResultadoCapacidad,
  evaluarCapacidad,
  optimizarRuta,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { actorDeEmpresa, exigirPermiso, sentenciaAuditoria } from './autorizacion';
import { rutaPorId } from './rutasComun';

/**
 * Divoox Flex · Fase 3: optimización básica, capacidad del vehículo e indicadores de operación
 * (C-FLEX-OPTIMIZAR, C-FLEX-CAPACIDAD, C-FLEX-KPI).
 *
 * - La optimización SOLO sugiere: no escribe nada. La empresa la aplica con el reordenamiento de
 *   siempre, que la base solo acepta antes de salir a la calle.
 * - La capacidad usa lo que la empresa declaró del vehículo; lo que no declaró es «sin dato».
 * - Los indicadores son de operación; no hay ni un número de dinero aquí (eso es la Fase 4).
 */
export const flexOperaciones = new Hono<{ Bindings: Env; Variables: Variables }>();

const ESTADOS_ANTES_DE_SALIR = ['borrador', 'ofrecida', 'asignada', 'aceptada', 'en_carga'];

// ───────────────────────────── Optimización ─────────────────────────────

const esquemaOptimizar = z.object({
  /** Paradas que deben hacerse sí o sí primero (urgentes). */
  obligatorias: z.array(z.string().uuid()).max(150).default([]),
});

flexOperaciones.post('/empresas/:id/rutas/:rutaId/optimizar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaOptimizar);
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  const { results } = await db
    .prepare(
      `SELECT rp.id, rp.orden, e.lat, e.lng, COALESCE(rp.ventana_desde, e.ventana_desde) AS desde,
              COALESCE(rp.ventana_hasta, e.ventana_hasta) AS hasta
         FROM ruta_paradas rp JOIN envios e ON e.id = rp.envio_id
        WHERE rp.ruta_id = ? ORDER BY rp.orden`,
    )
    .bind(r.id)
    .all<{
      id: string;
      orden: number;
      lat: number | null;
      lng: number | null;
      desde: string | null;
      hasta: string | null;
    }>();
  if (!results.length) throw new ErrorDatos('La ruta no tiene paradas.', undefined, 409);
  const centro = r.centro_id
    ? await db
        .prepare('SELECT lat, lng FROM empresa_centros WHERE id = ?')
        .bind(r.centro_id)
        .first<{ lat: number | null; lng: number | null }>()
    : null;
  const origen =
    centro && centro.lat !== null && centro.lng !== null
      ? { lat: centro.lat, lng: centro.lng }
      : null;
  const obligatorias = new Set(d.obligatorias);
  const t = Date.now();
  const s = optimizarRuta(
    results.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      ventanaDesde: p.desde,
      ventanaHasta: p.hasta,
      obligatoria: obligatorias.has(p.id),
    })),
    origen,
  );
  return c.json({
    sugerencia: s,
    // Solo se puede aplicar antes de salir; una ruta en la calle nunca se reordena sola.
    aplicable: ESTADOS_ANTES_DE_SALIR.includes(r.estado),
    estadoRuta: r.estado,
    calculoMs: Date.now() - t,
  });
});

// ───────────────────────────── Capacidad ─────────────────────────────

const esquemaCapacidad = z.object({
  maxPaquetes: z.number().int().min(1).max(1000).nullable().optional(),
  maxPesoKg: z.number().min(0.1).max(5000).nullable().optional(),
  maxVolumenLitros: z.number().min(1).max(50000).nullable().optional(),
  maxLadoCm: z.number().int().min(1).max(1000).nullable().optional(),
});

type FilaCapacidad = {
  max_paquetes: number | null;
  max_peso_g: number | null;
  max_volumen_cm3: number | null;
  max_lado_cm: number | null;
};

const aCapacidad = (f: FilaCapacidad | null): CapacidadVehiculo | null =>
  f
    ? {
        maxPaquetes: f.max_paquetes,
        maxPesoG: f.max_peso_g,
        maxVolumenCm3: f.max_volumen_cm3,
        maxLadoCm: f.max_lado_cm,
      }
    : null;

/** El vehículo tiene que ser de un conductor vinculado (activo) a la empresa. */
async function vehiculoDeEmpresa(db: D1Database, empresaId: string, vehiculoId: string) {
  const v = await db
    .prepare(
      `SELECT v.id, v.tipo, v.conductor_id, v.estado FROM vehiculos v
         JOIN empresa_conductores ec ON ec.usuario_id = v.conductor_id AND ec.empresa_id = ? AND ec.estado = 'activo'
        WHERE v.id = ?`,
    )
    .bind(empresaId, vehiculoId)
    .first<{ id: string; tipo: string; conductor_id: string; estado: string }>();
  if (!v) throw new ErrorDatos('Ese vehículo no existe.', 'vehiculoId', 404);
  return v;
}

export async function capacidadDe(db: D1Database, empresaId: string, vehiculoId: string) {
  return aCapacidad(
    await db
      .prepare(
        'SELECT max_paquetes, max_peso_g, max_volumen_cm3, max_lado_cm FROM flex_capacidad_vehiculo WHERE vehiculo_id = ? AND empresa_id = ?',
      )
      .bind(vehiculoId, empresaId)
      .first<FilaCapacidad>(),
  );
}

/** Paquetes que llevaría la ruta: los reservados o, en borrador, los de sus paradas en el centro. */
export async function evaluarCapacidadRuta(
  db: D1Database,
  empresaId: string,
  rutaId: string,
  vehiculoId: string | null | undefined,
): Promise<ResultadoCapacidad & { vehiculoId: string | null }> {
  const { results } = await db
    .prepare(
      `SELECT p.peso_g, p.largo_cm, p.ancho_cm, p.alto_cm FROM paquetes p
        WHERE p.empresa_id = ?2 AND (
          p.id IN (SELECT paquete_id FROM ruta_paquetes WHERE ruta_id = ?1 AND activo = 1 AND excluido_en IS NULL)
          OR (NOT EXISTS (SELECT 1 FROM ruta_paquetes WHERE ruta_id = ?1 AND activo = 1)
              AND p.envio_id IN (SELECT envio_id FROM ruta_paradas WHERE ruta_id = ?1)
              AND p.estado IN ('creado', 'registrado_centro', 'preparado')))`,
    )
    .bind(rutaId, empresaId)
    .all<{
      peso_g: number | null;
      largo_cm: number | null;
      ancho_cm: number | null;
      alto_cm: number | null;
    }>();
  const cap = vehiculoId ? await capacidadDe(db, empresaId, vehiculoId) : null;
  return {
    vehiculoId: vehiculoId ?? null,
    ...evaluarCapacidad(
      cap,
      results.map((p) => ({
        pesoG: p.peso_g,
        largoCm: p.largo_cm,
        anchoCm: p.ancho_cm,
        altoCm: p.alto_cm,
      })),
    ),
  };
}

flexOperaciones.get('/empresas/:id/vehiculos', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'conductores.gestionar');
  const { results } = await base(c)
    .prepare(
      `SELECT v.id, v.tipo, v.marca, v.modelo, v.placa, v.estado, v.conductor_id, u.nombre AS conductor,
              k.max_paquetes, k.max_peso_g, k.max_volumen_cm3, k.max_lado_cm, k.actualizado_en
         FROM vehiculos v
         JOIN empresa_conductores ec ON ec.usuario_id = v.conductor_id AND ec.empresa_id = ? AND ec.estado = 'activo'
         JOIN usuarios u ON u.id = v.conductor_id
         LEFT JOIN flex_capacidad_vehiculo k ON k.vehiculo_id = v.id AND k.empresa_id = ec.empresa_id
        WHERE v.estado NOT IN ('rechazado', 'retirado')
        ORDER BY u.nombre, v.tipo`,
    )
    .bind(actor.empresaId)
    .all<
      FilaCapacidad & {
        id: string;
        tipo: string;
        marca: string;
        modelo: string;
        placa: string;
        estado: string;
        conductor_id: string;
        conductor: string;
        actualizado_en: string | null;
      }
    >();
  return c.json({
    vehiculos: results.map((v) => ({
      id: v.id,
      tipo: v.tipo,
      descripcion: [v.marca, v.modelo].filter(Boolean).join(' '),
      placa: v.placa,
      estado: v.estado,
      conductorId: v.conductor_id,
      conductor: v.conductor,
      capacidad: v.actualizado_en
        ? {
            maxPaquetes: v.max_paquetes,
            maxPesoKg: v.max_peso_g === null ? null : v.max_peso_g / 1000,
            maxVolumenLitros: v.max_volumen_cm3 === null ? null : v.max_volumen_cm3 / 1000,
            maxLadoCm: v.max_lado_cm,
          }
        : null,
    })),
  });
});

flexOperaciones.put('/empresas/:id/vehiculos/:vehiculoId/capacidad', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'conductores.gestionar');
  const d = await leerCuerpo(c, esquemaCapacidad);
  const db = base(c);
  const v = await vehiculoDeEmpresa(db, actor.empresaId, c.req.param('vehiculoId'));
  await db.batch([
    db
      .prepare(
        `INSERT INTO flex_capacidad_vehiculo (vehiculo_id, empresa_id, max_paquetes, max_peso_g, max_volumen_cm3, max_lado_cm, actualizado_por)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (vehiculo_id, empresa_id) DO UPDATE SET max_paquetes = ?3, max_peso_g = ?4,
           max_volumen_cm3 = ?5, max_lado_cm = ?6, actualizado_por = ?7, actualizado_en = datetime('now')`,
      )
      .bind(
        v.id,
        actor.empresaId,
        d.maxPaquetes ?? null,
        d.maxPesoKg == null ? null : Math.round(d.maxPesoKg * 1000),
        d.maxVolumenLitros == null ? null : Math.round(d.maxVolumenLitros * 1000),
        d.maxLadoCm ?? null,
        actor.actorTipo === 'usuario' ? actor.actorId : null,
      ),
    sentenciaAuditoria(db, actor, 'vehiculo.capacidad', v.id, d),
  ]);
  return c.json({ ok: true, capacidad: await capacidadDe(db, actor.empresaId, v.id) });
});

flexOperaciones.get('/empresas/:id/rutas/:rutaId/capacidad', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  const vehiculoId = c.req.query('vehiculoId') || r.vehiculo_id;
  if (vehiculoId) await vehiculoDeEmpresa(db, actor.empresaId, vehiculoId);
  return c.json({ capacidad: await evaluarCapacidadRuta(db, actor.empresaId, r.id, vehiculoId) });
});

// ───────────────────────────── Indicadores de operación ─────────────────────────────

const dia = /^\d{4}-\d{2}-\d{2}$/;

flexOperaciones.get('/empresas/:id/operaciones', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const hoy = new Date().toISOString().slice(0, 10);
  const hasta = dia.test(c.req.query('hasta') ?? '') ? (c.req.query('hasta') as string) : hoy;
  const desde = dia.test(c.req.query('desde') ?? '')
    ? (c.req.query('desde') as string)
    : new Date(Date.parse(hasta) - 6 * 86_400_000).toISOString().slice(0, 10);
  if (desde > hasta) throw new ErrorDatos('La fecha inicial va antes que la final.', 'desde');
  if (Date.parse(hasta) - Date.parse(desde) > 92 * 86_400_000)
    throw new ErrorDatos('Consulta como máximo tres meses.', 'desde');
  const centro = c.req.query('centroId') || null;
  const p = [actor.empresaId, desde, `${hasta} 23:59:59`, centro] as const;
  const filtroRuta = `r.empresa_id = ?1 AND r.creado_en BETWEEN ?2 AND ?3 AND (?4 IS NULL OR r.centro_id = ?4)`;
  const [rutas, paquetes, incid, tiempos, ahora, cola] = await db.batch([
    db
      .prepare(
        `SELECT r.estado, COUNT(*) AS n FROM rutas_flex r WHERE ${filtroRuta} GROUP BY r.estado`,
      )
      .bind(...p),
    // Paquetes de rutas del periodo, por cómo terminaron.
    db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(pq.estado = 'entregado') AS entregados,
                SUM(pq.estado IN ('entrega_fallida', 'en_devolucion')) AS fallidos,
                SUM(pq.estado IN ('devuelto', 'registrado_centro') AND rp.recibido_en IS NOT NULL) AS devueltos,
                SUM(pq.estado = 'entregado' AND NOT EXISTS (
                  SELECT 1 FROM flex_incidencias i WHERE i.paquete_id = pq.id AND i.ruta_id = r.id)) AS primer_intento,
                SUM(pq.estado = 'entregado' AND e.ventana_hasta IS NOT NULL) AS con_ventana,
                SUM(pq.estado = 'entregado' AND e.ventana_hasta IS NOT NULL AND EXISTS (
                  SELECT 1 FROM paquete_eventos ev WHERE ev.paquete_id = pq.id AND ev.tipo = 'entregado'
                    AND ev.creado_en <= replace(replace(e.ventana_hasta, 'T', ' '), 'Z', ''))) AS a_tiempo
           FROM rutas_flex r
           JOIN ruta_paquetes rp ON rp.ruta_id = r.id AND rp.excluido_en IS NULL
           JOIN paquetes pq ON pq.id = rp.paquete_id
           JOIN envios e ON e.id = pq.envio_id
          WHERE ${filtroRuta}`,
      )
      .bind(...p),
    db
      .prepare(
        `SELECT i.motivo, COUNT(*) AS n FROM flex_incidencias i JOIN rutas_flex r ON r.id = i.ruta_id
          WHERE ${filtroRuta} GROUP BY i.motivo ORDER BY n DESC`,
      )
      .bind(...p),
    db
      .prepare(
        `SELECT COUNT(*) AS cerradas,
                AVG((julianday(r.cerrada_en) - julianday(r.iniciada_en)) * 1440) AS minutos,
                AVG((SELECT COUNT(*) FROM ruta_paradas WHERE ruta_id = r.id)) AS paradas,
                COUNT(DISTINCT r.conductor_id) AS conductores
           FROM rutas_flex r
          WHERE ${filtroRuta} AND r.estado IN ('completada', 'con_incidencias') AND r.iniciada_en IS NOT NULL`,
      )
      .bind(...p),
    db
      .prepare(
        `SELECT SUM(estado = 'en_curso') AS en_curso, SUM(estado = 'ofrecida') AS ofertas,
                SUM(estado IN ('asignada', 'aceptada', 'en_carga')) AS por_salir
           FROM rutas_flex r WHERE r.empresa_id = ?1 AND (?2 IS NULL OR r.centro_id = ?2)`,
      )
      .bind(actor.empresaId, centro),
    db
      .prepare(
        `SELECT SUM(en.estado IN ('pendiente', 'enviando')) AS pendientes, SUM(en.estado = 'fallido') AS fallidos
           FROM flex_webhook_entregas en WHERE en.empresa_id = ? AND en.es_prueba = 0`,
      )
      .bind(actor.empresaId),
  ]);
  const fila = <T>(r: D1Result | undefined) => (r?.results?.[0] ?? {}) as T;
  const pq = fila<Record<string, number | null>>(paquetes);
  const ti = fila<Record<string, number | null>>(tiempos);
  const ah = fila<Record<string, number | null>>(ahora);
  const co = fila<Record<string, number | null>>(cola);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const entregados = Number(pq.entregados ?? 0);
  const conVentana = Number(pq.con_ventana ?? 0);
  return c.json({
    periodo: { desde, hasta, centroId: centro },
    rutas: Object.fromEntries(
      ((rutas?.results ?? []) as { estado: string; n: number }[]).map((x) => [
        x.estado,
        Number(x.n),
      ]),
    ),
    ahora: {
      enCurso: Number(ah.en_curso ?? 0),
      ofertasAbiertas: Number(ah.ofertas ?? 0),
      porSalir: Number(ah.por_salir ?? 0),
    },
    paquetes: {
      total: Number(pq.total ?? 0),
      entregados,
      fallidos: Number(pq.fallidos ?? 0),
      devueltos: Number(pq.devueltos ?? 0),
    },
    tasas: {
      entregaPct: pct(entregados, Number(pq.total ?? 0)),
      primerIntentoPct: pct(Number(pq.primer_intento ?? 0), entregados),
      // Solo se calcula sobre entregas con ventana; sin ventanas, no hay dato (null), nunca 100 %.
      aTiempoPct: pct(Number(pq.a_tiempo ?? 0), conVentana),
      entregasConVentana: conVentana,
    },
    incidenciasPorMotivo: ((incid?.results ?? []) as { motivo: string; n: number }[]).map((x) => ({
      motivo: x.motivo,
      cantidad: Number(x.n),
    })),
    rutasCerradas: {
      cantidad: Number(ti.cerradas ?? 0),
      // Duración medida (salida → cierre), no estimada. Null si no hay rutas cerradas.
      duracionMediaMin: ti.minutos == null ? null : Math.round(Number(ti.minutos)),
      paradasPorRuta: ti.paradas == null ? null : Math.round(Number(ti.paradas) * 10) / 10,
      conductores: Number(ti.conductores ?? 0),
    },
    integraciones: {
      pendientes: Number(co.pendientes ?? 0),
      fallidas: Number(co.fallidos ?? 0),
    },
  });
});
