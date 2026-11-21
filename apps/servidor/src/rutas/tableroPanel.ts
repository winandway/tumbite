import { Hono } from 'hono';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import {
  accesoDe,
  alcanceObjetoSql,
  alcancePedidos,
  filtroAlcance,
  servicioOperacionSql,
} from '../accesoInterno';
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
