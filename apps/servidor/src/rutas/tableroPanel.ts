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
const dia = (hoy: Date, atras: number) =>
  new Date(hoy.getTime() - atras * 86_400_000).toISOString().slice(0, 10);

type Fila = { dia: string; estado: string; n: number };

/** Suma las filas (día, estado, cantidad) que cumplen una condición. */
const suma = (filas: Fila[], cumple: (f: Fila) => boolean) =>
  filas.reduce((s, f) => (cumple(f) ? s + Number(f.n) : s), 0);

tableroPanel.get('/admin/tablero', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  // UNA lectura por tabla, por el índice de la fecha (pedidos_creado y operaciones_viaje_creado):
  // 30 días agrupados por día y estado; de ahí salen la serie, los estados y la comparación.
  const { results: pedidos } = await db
    .prepare(
      `SELECT date(creado_en) AS dia, estado, COUNT(*) AS n FROM pedidos
        WHERE creado_en >= datetime('now', 'start of day', '-29 days') AND estado <> 'pago_pendiente'
        GROUP BY date(creado_en), estado`,
    )
    .all<Fila>();
  const { results: viajes } = await db
    .prepare(
      `SELECT date(creado_en) AS dia, estado_general AS estado, COUNT(*) AS n FROM operaciones
        WHERE tipo_operacion = 'viaje_pasajero'
          AND creado_en >= datetime('now', 'start of day', '-29 days')
          AND estado_general <> 'pago_pendiente'
        GROUP BY date(creado_en), estado_general`,
    )
    .all<Fila>();
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
        `SELECT id, codigo, tipo, estado, asunto, actualizado_en AS fecha FROM tickets
          WHERE estado = ? ORDER BY actualizado_en DESC LIMIT 8`,
      )
      .bind(estado)
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
