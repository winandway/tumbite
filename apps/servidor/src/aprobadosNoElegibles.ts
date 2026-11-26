import { ESQUEMA_FASE3 } from './esquemaFase3';

/**
 * C-APROBADOS-NO-ELEGIBLES (23 nov 2026, Richard: «dos conductores reales registrados y ninguno ha
 * recibido una carrera»). Canario: conductores con un vehículo APROBADO por el equipo que el reparto
 * NO tomaría aunque abrieran Driver ahora mismo, con el motivo de cada uno. Todos los países.
 *
 * No es una regla aparte que pueda mentir: la lista de «aptos» sale del MISMO texto de la vista
 * `conductores_elegibles` que usa el reparto, solo sin la condición de estar conectado (estar
 * conectado y con ubicación fresca depende de que el conductor abra la app, no del equipo).
 * Solo lee: una consulta por llamada, sin escribir nada (regla de la nube).
 */

const VISTA = ESQUEMA_FASE3.find((s) => s.includes('VIEW IF NOT EXISTS conductores_elegibles'));
const CABEZA = 'CREATE VIEW IF NOT EXISTS conductores_elegibles AS';
const CONECTADO = 'WHERE d.conectado = 1\n   AND ';
const DESDE = '  FROM repartidores d\n';

/**
 * La vista del reparto sin «conectado»: quien recibiría viajes con solo abrir Driver. Con `desde` (una
 * tabla o CTE con columna `id`), solo esos conductores, para no recorrer a todos.
 */
export function sqlAptos(vista: string | undefined = VISTA, desde?: string): string {
  // Si alguien cambia la vista y esto deja de encajar, se rompe aquí (y su prueba), nunca en silencio.
  if (!vista || !vista.includes(CABEZA) || !vista.includes(CONECTADO) || !vista.includes(DESDE))
    throw new Error('aprobadosNoElegibles: la vista conductores_elegibles cambió de forma');
  const sql = vista.replace(CABEZA, '').replace(CONECTADO, 'WHERE ');
  // CROSS JOIN fija el orden en SQLite: primero la lista corta, después cada conductor por su clave.
  return desde
    ? sql.replace(
        DESDE,
        `  FROM ${desde} CROSS JOIN repartidores d ON d.usuario_id = ${desde}.id\n`,
      )
    : sql;
}

export type MotivoNoElegible =
  | 'sin_vehiculo_activo'
  | 'vehiculo_activo_sin_aprobar'
  | 'servicio_cerrado_en_zona'
  | 'servicio_apagado'
  | 'bloqueado'
  | 'papeles_o_habilitacion';

export type AprobadoNoElegible = {
  conductorId: string;
  codigo: string | null;
  zonaId: string | null;
  esPrueba: boolean;
  /** Cuenta de revisión de las tiendas: se lista, pero no pone el canario en rojo. */
  esRevisor: boolean;
  motivo: MotivoNoElegible;
};

/** Servicio abierto en su zona (o solo de pruebas, para una cuenta de prueba) para ese vehículo. */
const SERVICIO_ABIERTO = (v: string) => `EXISTS (
  SELECT 1 FROM servicio_vehiculos sv JOIN servicios s ON s.id = sv.servicio_id AND s.estado = 'disponible'
    JOIN servicios_implementados si ON si.servicio_id = s.id
   WHERE sv.vehiculo_tipo = ${v}.tipo AND (
         EXISTS (SELECT 1 FROM servicios_zona sz WHERE sz.zona_id = d.zona_id AND sz.servicio_id = s.id
                  AND sz.estado = 'disponible'
                  AND (sz.activo_desde IS NULL OR sz.activo_desde <= datetime('now'))
                  AND (sz.activo_hasta IS NULL OR sz.activo_hasta > datetime('now')))
      OR (u.es_prueba = 1 AND EXISTS (SELECT 1 FROM servicios_prueba sp
                                       WHERE sp.servicio_id = s.id AND sp.zona_id = d.zona_id)))
     %PREF%)`;

export async function aprobadosNoElegibles(
  db: D1Database,
  limite = 50,
  /** El alcance de quien mira (un encargado de zona ve solo los suyos): `' AND …'` sobre `d.usuario_id`. */
  alcance: { sql: string; valores: unknown[] } = { sql: '', valores: [] },
): Promise<AprobadoNoElegible[]> {
  const conPreferencia = SERVICIO_ABIERTO('va').replace(
    '%PREF%',
    `AND EXISTS (SELECT 1 FROM preferencias_servicio p
                  WHERE p.conductor_id = d.usuario_id AND p.servicio_id = s.id AND p.activa = 1)`,
  );
  const { results } = await db
    .prepare(
      `WITH ap AS MATERIALIZED (
         SELECT v.conductor_id AS id FROM vehiculos v WHERE v.estado = 'aprobado' GROUP BY v.conductor_id
       ),
       aptos AS MATERIALIZED (${sqlAptos(VISTA, 'ap')})
       SELECT d.usuario_id AS conductor_id, d.codigo, d.zona_id, COALESCE(u.es_prueba, 0) AS es_prueba,
              EXISTS (SELECT 1 FROM revisores rv WHERE rv.correo = u.correo) AS es_revisor,
              CASE
                WHEN va.id IS NULL THEN 'sin_vehiculo_activo'
                WHEN va.estado <> 'aprobado' AND NOT EXISTS (
                       SELECT 1 FROM plazo_papeles pp WHERE pp.conductor_id = d.usuario_id
                          AND pp.estado = 'en_plazo' AND pp.vence_en > datetime('now'))
                  THEN 'vehiculo_activo_sin_aprobar'
                WHEN NOT ${SERVICIO_ABIERTO('va').replace('%PREF%', '')} THEN 'servicio_cerrado_en_zona'
                WHEN NOT ${conPreferencia} THEN 'servicio_apagado'
                WHEN EXISTS (SELECT 1 FROM conductor_bloqueos b WHERE b.conductor_id = d.usuario_id
                               AND b.levantado_en IS NULL AND (b.hasta IS NULL OR b.hasta > datetime('now')))
                  THEN 'bloqueado'
                ELSE 'papeles_o_habilitacion'
              END AS motivo
         FROM ap CROSS JOIN repartidores d ON d.usuario_id = ap.id
         JOIN usuarios u ON u.id = d.usuario_id AND u.activo = 1 AND u.rol = 'repartidor'
         LEFT JOIN vehiculos va ON va.id = d.vehiculo_activo_id AND va.conductor_id = d.usuario_id
        WHERE d.usuario_id NOT IN (SELECT conductor_id FROM aptos)${alcance.sql}
        ORDER BY d.codigo
        LIMIT ?`,
    )
    .bind(...alcance.valores, limite)
    .all<{
      conductor_id: string;
      codigo: string | null;
      zona_id: string | null;
      es_prueba: number;
      es_revisor: number;
      motivo: MotivoNoElegible;
    }>();
  return results.map((r) => ({
    conductorId: r.conductor_id,
    codigo: r.codigo,
    zonaId: r.zona_id,
    esPrueba: r.es_prueba === 1,
    esRevisor: r.es_revisor === 1,
    motivo: r.motivo,
  }));
}

/** Piezas de la salud que se ven en rojo y avisan, pero no ponen el sitio en 503. */
// C-PANICO-CENTRAL: una zona sin responsable de pánico es de operación: se ve en rojo y avisa, sin
// tumbar la salud del sitio.
export const PIEZAS_DE_OPERACION: ReadonlySet<string> = new Set([
  'aprobadosNoElegibles',
  'panicoZonas',
  // C-REGISTRO-TODO-EL-PAIS: un paso fallido de los que esperan su ciudad no es una caída del sitio.
  'esperaCiudades',
]);

/** El canario se llama a menudo: el resultado se guarda en memoria unos minutos (sin escribir nada). */
const MS_MEMORIA = 5 * 60_000;
let memoria: { db: D1Database; en: number; lista: AprobadoNoElegible[] } | null = null;

/** Pieza del canario: «error» si un conductor real aprobado no podría recibir viajes. */
export async function saludAprobadosNoElegibles(
  db: D1Database,
  ahora = Date.now(),
): Promise<'ok' | 'error'> {
  const lista =
    memoria && memoria.db === db && ahora - memoria.en < MS_MEMORIA
      ? memoria.lista
      : await aprobadosNoElegibles(db);
  if (!memoria || memoria.lista !== lista) memoria = { db, en: ahora, lista };
  const reales = lista.filter((x) => !x.esPrueba && !x.esRevisor);
  if (reales.length)
    console.error(
      'salud: aprobados que el reparto no toma',
      reales.map((x) => `${x.codigo ?? x.conductorId}:${x.motivo}`).join(' · '),
    );
  return reales.length ? 'error' : 'ok';
}
