import { Hono } from 'hono';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';

/**
 * C-PANEL-ARMAZON (14 nov 2026): lo que leen los tableros del panel web. SOLO LECTURA: ninguna de
 * estas rutas escribe en la base (regla «prohibido escribir por mirar»). Las cuentas son de
 * cantidades, nunca de dinero, así no se mezclan monedas de países distintos.
 */
export const tableroPanel = new Hono<{ Bindings: Env; Variables: Variables }>();

const DIAS = 14;

/** Los últimos `DIAS` días (UTC), del más viejo al de hoy, con cero donde no hubo nada. */
function serie(filas: { dia: string; n: number }[], campo: 'pedidos' | 'viajes', hoy = new Date()) {
  const porDia = new Map(filas.map((f) => [f.dia, Number(f.n)]));
  return Array.from({ length: DIAS }, (_, i) => {
    const d = new Date(hoy.getTime() - (DIAS - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { dia: d, [campo]: porDia.get(d) ?? 0 };
  });
}

tableroPanel.get('/admin/tablero', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const desde = `-${DIAS - 1} days`;
  const { results: pedidosDia } = await db
    .prepare(
      `SELECT date(creado_en) AS dia, COUNT(*) AS n FROM pedidos
        WHERE estado <> 'pago_pendiente' AND creado_en >= datetime('now', 'start of day', ?)
        GROUP BY date(creado_en)`,
    )
    .bind(desde)
    .all<{ dia: string; n: number }>();
  const { results: viajesDia } = await db
    .prepare(
      `SELECT date(creado_en) AS dia, COUNT(*) AS n FROM operaciones
        WHERE tipo_operacion = 'viaje_pasajero' AND estado_general <> 'pago_pendiente'
          AND creado_en >= datetime('now', 'start of day', ?)
        GROUP BY date(creado_en)`,
    )
    .bind(desde)
    .all<{ dia: string; n: number }>();
  const p = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN estado = 'entregado' THEN 1 ELSE 0 END) AS entregados,
         SUM(CASE WHEN estado IN ('pagado','aceptado','listo','en_camino') THEN 1 ELSE 0 END) AS en_curso,
         SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
         SUM(CASE WHEN creado_en >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS semana,
         SUM(CASE WHEN creado_en < datetime('now','-7 days') AND creado_en >= datetime('now','-14 days') THEN 1 ELSE 0 END) AS anterior
       FROM pedidos WHERE estado <> 'pago_pendiente' AND creado_en >= datetime('now','-30 days')`,
    )
    .first<Record<string, number | null>>();
  const v = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN estado_general = 'terminada' THEN 1 ELSE 0 END) AS terminados,
         SUM(CASE WHEN estado_general IN ('buscando','asignada','en_curso') THEN 1 ELSE 0 END) AS en_curso,
         SUM(CASE WHEN estado_general IN ('cancelada','sin_conductor') THEN 1 ELSE 0 END) AS cancelados
       FROM operaciones WHERE tipo_operacion = 'viaje_pasajero' AND estado_general <> 'pago_pendiente'
         AND creado_en >= datetime('now','-30 days')`,
    )
    .first<Record<string, number | null>>();
  const gente = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente' AND activo = 1) AS clientes,
         (SELECT COUNT(*) FROM restaurantes WHERE estado = 'aprobado') AS restaurantes,
         (SELECT COUNT(*) FROM restaurantes WHERE estado = 'aprobado' AND abierto = 1) AS abiertos,
         (SELECT COUNT(*) FROM restaurantes WHERE estado = 'pendiente') AS por_aprobar,
         (SELECT COUNT(*) FROM repartidores) AS repartidores,
         (SELECT COUNT(*) FROM repartidores WHERE conectado = 1) AS conectados`,
    )
    .first<Record<string, number | null>>();
  const { results: ultimos } = await db
    .prepare(
      `SELECT id, codigo, tipo, estado, asunto, actualizado_en AS fecha FROM tickets
        ORDER BY actualizado_en DESC LIMIT 8`,
    )
    .all<{
      id: string;
      codigo: string;
      tipo: string;
      estado: string;
      asunto: string;
      fecha: string;
    }>();
  const n = (x: number | null | undefined) => Number(x ?? 0);
  const viajes = serie(viajesDia, 'viajes');
  return c.json({
    tablero: {
      porDia: serie(pedidosDia, 'pedidos').map((d, i) => ({
        ...d,
        viajes: viajes.at(i)?.viajes ?? 0,
      })),
      pedidos30: {
        entregados: n(p?.entregados),
        enCurso: n(p?.en_curso),
        cancelados: n(p?.cancelados),
      },
      semana: { pedidos: n(p?.semana), anterior: n(p?.anterior) },
      viajes30: {
        terminados: n(v?.terminados),
        enCurso: n(v?.en_curso),
        cancelados: n(v?.cancelados),
      },
      personas: {
        clientes: n(gente?.clientes),
        restaurantes: n(gente?.restaurantes),
        restaurantesAbiertos: n(gente?.abiertos),
        restaurantesPorAprobar: n(gente?.por_aprobar),
        repartidores: n(gente?.repartidores),
        repartidoresConectados: n(gente?.conectados),
      },
      actividad: ultimos,
    },
  });
});

/** La campana de la cabecera: lo que espera por la persona, según su rol. Solo cantidades. */
tableroPanel.get('/panel/avisos', async (c) => {
  const u = exigir(c);
  const db = base(c);
  if (u.rol === 'admin') {
    const f = await db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM tickets WHERE estado = 'abierto') AS tickets,
                (SELECT COUNT(*) FROM restaurantes WHERE estado = 'pendiente') AS restaurantes`,
      )
      .first<{ tickets: number; restaurantes: number }>();
    return c.json({
      avisos: [
        { clave: 'tickets', cantidad: Number(f?.tickets ?? 0) },
        { clave: 'restaurantes', cantidad: Number(f?.restaurantes ?? 0) },
      ],
    });
  }
  if (u.rol === 'restaurante') {
    const f = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'pagado' AND restaurante_id IN (
           SELECT id FROM restaurantes WHERE dueno_id = ?1
           UNION SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1)`,
      )
      .bind(u.id)
      .first<{ n: number }>();
    return c.json({ avisos: [{ clave: 'pedidos', cantidad: Number(f?.n ?? 0) }] });
  }
  return c.json({ avisos: [] });
});
