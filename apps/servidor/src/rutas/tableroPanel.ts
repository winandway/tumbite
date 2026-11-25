import { Hono } from 'hono';
import type { Env } from '../env';
import { zonaRealSql } from '../cuentaPais';
import { type Variables, base, exigir } from '../sesion';
import {
  accesoDe,
  alcanceObjetoSql,
  alcancePedidos,
  filtroAlcance,
  servicioOperacionSql,
} from '../accesoInterno';
import { avisosRestaurante, avisosSuperadmin, campanaDe } from '../campana';
import { operacionesPorCuentas, pedidosPorCuentas, usuarioPorCuentas } from '../cuentasPruebaSql';

/**
 * C-PANEL-ARMAZON (14 nov 2026): lo que leen los tableros del panel web. SOLO LECTURA: ninguna de
 * estas rutas escribe en la base (regla «prohibido escribir por mirar»). Las cuentas son de
 * cantidades, nunca de dinero, así no se mezclan monedas de países distintos.
 */
export const tableroPanel = new Hono<{ Bindings: Env; Variables: Variables }>();

const DIAS = 14;
const dia = (hoy: Date, atras: number) =>
  new Date(hoy.getTime() - atras * 86_400_000).toISOString().slice(0, 10);

type Fila = { dia: string; estado: string; n: number };

/** Suma las filas (día, estado, cantidad) que cumplen una condición. */
const suma = (filas: Fila[], cumple: (f: Fila) => boolean) =>
  filas.reduce((s, f) => (cumple(f) ? s + Number(f.n) : s), 0);

tableroPanel.get('/admin/tablero', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  // C-PERMISOS-FINOS: con alcance limitado, todo el tablero cuenta solo su zona y sus servicios.
  const acceso = accesoDe(c);
  // C-CUENTA-PRUEBA: por defecto solo cuentas reales; ?cuentas=prueba|todas lo cambia.
  const cuentas = c.req.query('cuentas');
  const alP0 = alcancePedidos(c);
  const alP = { sql: alP0.sql + pedidosPorCuentas(cuentas), valores: alP0.valores };
  const alV0 = filtroAlcance(acceso, {
    zona: '+o.zona_id',
    servicio: servicioOperacionSql('o.servicio_id'),
  });
  const alV = { sql: alV0.sql + operacionesPorCuentas(cuentas), valores: alV0.valores };
  const alC0 = alcanceObjetoSql(acceso, 'cliente', 'u.id');
  const alC = { sql: alC0.sql + usuarioPorCuentas(cuentas, 'u.id'), valores: alC0.valores };
  const alR0 = alcanceObjetoSql(acceso, 'restaurante', 'r.id');
  const alR = { sql: alR0.sql + usuarioPorCuentas(cuentas, 'r.dueno_id'), valores: alR0.valores };
  const alD0 = alcanceObjetoSql(acceso, 'repartidor', 'd.usuario_id');
  const alD = { sql: alD0.sql + usuarioPorCuentas(cuentas, 'd.usuario_id'), valores: alD0.valores };
  const alT = alcanceObjetoSql(acceso, 'ticket', 't.id');
  // UNA lectura por tabla, por el índice de la fecha (pedidos_creado y operaciones_viaje_creado):
  // 30 días agrupados por día y estado; de ahí salen la serie, los estados y la comparación.
  const { results: pedidos } = await db
    .prepare(
      `SELECT date(p.creado_en) AS dia, p.estado, COUNT(*) AS n FROM pedidos p
        WHERE p.creado_en >= datetime('now', 'start of day', '-29 days') AND p.estado <> 'pago_pendiente'${alP.sql}
        GROUP BY date(p.creado_en), p.estado`,
    )
    .bind(...alP.valores)
    .all<Fila>();
  const { results: viajes } = await db
    .prepare(
      `SELECT date(o.creado_en) AS dia, o.estado_general AS estado, COUNT(*) AS n FROM operaciones o
        WHERE o.tipo_operacion = 'viaje_pasajero'
          AND o.creado_en >= datetime('now', 'start of day', '-29 days')
          AND o.estado_general <> 'pago_pendiente'${alV.sql}
        GROUP BY date(o.creado_en), o.estado_general`,
    )
    .bind(...alV.valores)
    .all<Fila>();
  const gente = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM usuarios u WHERE u.rol = 'cliente' AND u.activo = 1${alC.sql}) AS clientes,
         (SELECT COUNT(*) FROM restaurantes r WHERE r.estado = 'aprobado'${alR.sql}) AS restaurantes,
         (SELECT COUNT(*) FROM restaurantes r WHERE r.estado = 'aprobado' AND r.abierto = 1${alR.sql}) AS abiertos,
         (SELECT COUNT(*) FROM restaurantes r WHERE r.estado = 'pendiente'${alR.sql}) AS por_aprobar,
         (SELECT COUNT(*) FROM repartidores d WHERE 1${alD.sql}) AS repartidores,
         (SELECT COUNT(*) FROM repartidores d WHERE d.conectado = 1${alD.sql}) AS conectados`,
    )
    .bind(
      ...alC.valores,
      ...alR.valores,
      ...alR.valores,
      ...alR.valores,
      ...alD.valores,
      ...alD.valores,
    )
    .first<Record<string, number | null>>();
  // Los últimos tickets: ocho por estado por el índice (estado, actualizado_en) y se mezclan aquí.
  type Ticket = {
    id: string;
    codigo: string;
    tipo: string;
    estado: string;
    asunto: string;
    fecha: string;
  };
  const ultimos: Ticket[] = [];
  for (const estado of ['abierto', 'respondido', 'cerrado']) {
    const { results } = await db
      .prepare(
        `SELECT t.id, t.codigo, t.tipo, t.estado, t.asunto, t.actualizado_en AS fecha FROM tickets t
          WHERE t.estado = ?${alT.sql} ORDER BY t.actualizado_en DESC LIMIT 8`,
      )
      .bind(estado, ...alT.valores)
      .all<Ticket>();
    ultimos.push(...results);
  }
  ultimos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const hoy = new Date();
  const desdeSemana = dia(hoy, 6);
  const desdeAnterior = dia(hoy, 13);
  const n = (x: number | null | undefined) => Number(x ?? 0);
  const EN_CURSO = ['pagado', 'aceptado', 'listo', 'en_camino'];
  // Las respuestas de un tablero se pueden guardar un minuto en el navegador de quien las pidió.
  c.header('Cache-Control', 'private, max-age=60');
  return c.json({
    tablero: {
      porDia: Array.from({ length: DIAS }, (_, i) => {
        const d = dia(hoy, DIAS - 1 - i);
        return {
          dia: d,
          pedidos: suma(pedidos, (f) => f.dia === d),
          viajes: suma(viajes, (f) => f.dia === d),
        };
      }),
      pedidos30: {
        entregados: suma(pedidos, (f) => f.estado === 'entregado'),
        enCurso: suma(pedidos, (f) => EN_CURSO.includes(f.estado)),
        cancelados: suma(pedidos, (f) => f.estado === 'cancelado'),
      },
      semana: {
        pedidos: suma(pedidos, (f) => f.dia >= desdeSemana),
        anterior: suma(pedidos, (f) => f.dia >= desdeAnterior && f.dia < desdeSemana),
      },
      viajes30: {
        terminados: suma(viajes, (f) => f.estado === 'terminada'),
        enCurso: suma(viajes, (f) => ['buscando', 'asignada', 'en_curso'].includes(f.estado)),
        cancelados: suma(viajes, (f) => ['cancelada', 'sin_conductor'].includes(f.estado)),
      },
      personas: {
        clientes: n(gente?.clientes),
        restaurantes: n(gente?.restaurantes),
        restaurantesAbiertos: n(gente?.abiertos),
        restaurantesPorAprobar: n(gente?.por_aprobar),
        repartidores: n(gente?.repartidores),
        repartidoresConectados: n(gente?.conectados),
      },
      actividad: ultimos.slice(0, 8),
    },
  });
});

/**
 * C-AVISOS-MENU (21 nov 2026, Gerencia) — todos los países. Lo que espera en cada sección del menú
 * del superadmin: el número y el tono del punto (`trabajo` verde, `urgente` rojo). Solo cuentas
 * reales (nunca las marcadas de prueba) y solo de la zona de trabajo de quien mira. Es UNA lectura
 * de solo conteos: mirar no escribe nada en la base (regla de la nube). La clave es la del menú.
 */
export type PendienteMenu = {
  clave: string;
  cantidad: number;
  tono: 'trabajo' | 'urgente';
  /** Cuántas de esas pasaron su límite (lo que vuelve rojo el punto); se dice en el texto. */
  urgentes?: number;
};
// C-VERIFICACION-UNICA: «Verificaciones» cuenta conductores con algo por decidir (identidad, vehículo
// o un papel), con la MISMA condición que la pestaña Pendientes; baja al decidirlo.
const REAL = (col: string) => `${col} NOT IN (SELECT id FROM usuarios WHERE es_prueba = 1)`;
/**
 * Las personas con algo por decidir y desde cuándo espera lo más viejo: su identidad enviada, un
 * vehículo en revisión o un papel suyo pendiente. Cada parte va por su índice de estado.
 */
export const POR_DECIDIR_PERSONAS = `SELECT id, MIN(desde) AS desde FROM (
    SELECT usuario_id AS id, enviado_en AS desde FROM kyc WHERE estado = 'pendiente'
    UNION ALL SELECT conductor_id, actualizado_en FROM vehiculos WHERE estado = 'en_revision'
    UNION ALL SELECT conductor_id, creado_en FROM conductor_documentos WHERE estado = 'pendiente'
  ) GROUP BY id`;
/** Horas que una verificación enviada puede esperar antes de volverse urgente. */
export const HORAS_VERIFICACION_URGENTE = 24;
export async function pendientesDelMenu(
  db: D1Database,
  acceso: Parameters<typeof alcanceObjetoSql>[0],
): Promise<PendienteMenu[]> {
  // C-VERIFICACIONES-VEHICULOS: un pendiente por PERSONA con algo por decidir (su identidad, un vehículo
  // en revisión o un papel), tenga o no su verificación de identidad empezada. Baja al decidirlo.
  const conductor = alcanceObjetoSql(acceso, 'repartidor', 'p.id');
  const conductorD = alcanceObjetoSql(acceso, 'repartidor', 'u.id');
  const ticket = alcanceObjetoSql(acceso, 'ticket', 't.id');
  const restaurante = alcanceObjetoSql(acceso, 'restaurante', 'r.id');
  const viaje = alcanceObjetoSql(acceso, 'viaje', 'e.operacion_id');
  const f = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM tickets t WHERE t.estado = 'abierto'
           AND (t.usuario_id IS NULL OR ${REAL('t.usuario_id')})${ticket.sql}) AS tickets,
        (SELECT COUNT(*) FROM camila_casos cc JOIN camila_personas cp ON cp.id = cc.persona_id
           WHERE cc.estado = 'abierto' AND (cp.usuario_id IS NULL OR ${REAL('cp.usuario_id')})) AS camila,
        (SELECT COUNT(*) FROM reportes_contenido rc WHERE rc.estado = 'abierto') AS moderacion,
        (SELECT COUNT(*) FROM aprobaciones_dinero a WHERE a.estado = 'pendiente') AS aprobaciones,
        (SELECT COUNT(*) FROM (${POR_DECIDIR_PERSONAS}) p WHERE ${REAL('p.id')}${conductor.sql}) AS verificaciones,
        (SELECT COUNT(*) FROM (${POR_DECIDIR_PERSONAS}) p WHERE ${REAL('p.id')}${conductor.sql}
           AND p.desde <= datetime('now', '-${HORAS_VERIFICACION_URGENTE} hours')) AS verificaciones_viejas,
        (SELECT COUNT(*) FROM restaurantes r WHERE r.estado = 'pendiente' AND ${REAL('r.dueno_id')}${restaurante.sql}) AS restaurantes,
        (SELECT COUNT(*) FROM solicitudes_linea s WHERE s.estado = 'pendiente') AS lineas,
        (SELECT COUNT(*) FROM usuarios u JOIN repartidores d ON d.usuario_id = u.id
           WHERE u.rol = 'repartidor' AND u.activo = 1 AND u.es_prueba = 0
             AND ${zonaRealSql('d', 'u')} IS NULL${conductorD.sql}) AS sin_zona,
        (SELECT COUNT(*) FROM emergencias_viaje e WHERE e.atendida_en IS NULL
           AND ${REAL('e.actor_id')}${viaje.sql}) AS emergencias`,
    )
    .bind(
      ...ticket.valores,
      ...conductor.valores,
      ...conductor.valores,
      ...restaurante.valores,
      ...conductorD.valores,
      ...viaje.valores,
    )
    .first<Record<string, number>>();
  const cuentas = new Map(Object.entries(f ?? {}));
  const n = (k: string) => Number(cuentas.get(k) ?? 0);
  const lista: PendienteMenu[] = [
    { clave: 'tickets', cantidad: n('tickets'), tono: 'trabajo' },
    { clave: 'camila', cantidad: n('camila'), tono: 'trabajo' },
    { clave: 'moderation', cantidad: n('moderacion'), tono: 'trabajo' },
    { clave: 'approvals', cantidad: n('aprobaciones'), tono: 'trabajo' },
    {
      clave: 'verifications',
      cantidad: n('verificaciones'),
      tono: n('verificaciones_viejas') > 0 ? 'urgente' : 'trabajo',
      urgentes: n('verificaciones_viejas'),
    },
    { clave: 'restaurants', cantidad: n('restaurantes'), tono: 'trabajo' },
    { clave: 'lines', cantidad: n('lineas'), tono: 'trabajo' },
    { clave: 'drivers', cantidad: n('sin_zona'), tono: 'trabajo' },
    // Una emergencia de viaje sin atender es lo más urgente del panel.
    {
      clave: 'rides',
      cantidad: n('emergencias'),
      tono: 'urgente',
      urgentes: n('emergencias'),
    },
  ];
  return lista.filter((x) => x.cantidad > 0);
}

/**
 * La cabecera del panel, en UNA lectura cada vez: la CAMPANA (lo que llegó y si esa persona ya lo vio,
 * C-CAMPANA-SE-VACIA) y los números del MENÚ (lo que espera una acción, C-CONTADORES-DE-TAREA). Son
 * cosas distintas: abrir la campana la deja en cero; los números del menú bajan solo al hacer la tarea.
 * Solo lectura: mirar no escribe nada.
 */
tableroPanel.get('/panel/avisos', async (c) => {
  const u = exigir(c);
  const db = base(c);
  if (u.rol === 'admin') {
    const acceso = accesoDe(c);
    const [menu, lista] = await Promise.all([
      pendientesDelMenu(db, acceso),
      avisosSuperadmin(db, acceso),
    ]);
    return c.json({ campana: await campanaDe(db, u.id, 'superadmin', lista), menu });
  }
  if (u.rol === 'restaurante') {
    const [f, lista] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'pagado' AND restaurante_id IN (
             SELECT id FROM restaurantes WHERE dueno_id = ?1
             UNION SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1)`,
        )
        .bind(u.id)
        .first<{ n: number }>(),
      avisosRestaurante(db, u.id),
    ]);
    const porAceptar = Number(f?.n ?? 0);
    const menu: PendienteMenu[] =
      porAceptar > 0 ? [{ clave: 'orders', cantidad: porAceptar, tono: 'trabajo' }] : [];
    return c.json({ campana: await campanaDe(db, u.id, 'restaurante', lista), menu });
  }
  return c.json({ campana: { avisos: [], sinLeer: 0 } });
});
