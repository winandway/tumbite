import { Hono } from 'hono';
import { z } from 'zod';
import { efectivoEnMano } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  CABECERA_CLAVE,
  actorDeEmpresa,
  conIdempotencia,
  exigirPermiso,
  sentenciaAuditoria,
} from './autorizacion';

/**
 * Divoox Flex · Fase 6: la CAJA del cobro contra entrega (C-FLEX-COBRO). País: Venezuela.
 * El conductor ve lo que tiene en la mano; la empresa ve lo cobrado por ruta y, al recibir el
 * efectivo en el centro, lo marca «recibido» (liquidado). Divoox no toca ese dinero: lo registra.
 */
export const flexCobros = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaCobro = {
  envio_id: string;
  referencia_externa: string | null;
  destinatario_nombre: string;
  cobro_monto: number;
  cobro_moneda: string;
  cobro_estado: string;
  cobro_metodo: string | null;
  cobro_monto_recibido: number | null;
  cobro_moneda_recibida: string | null;
  cobro_referencia: string | null;
  cobrado_en: string | null;
  liquidado_en: string | null;
  conductor: string | null;
  ruta_id: string | null;
  ruta: string | null;
};

const SELECT_COBROS = `SELECT e.id AS envio_id, e.referencia_externa, e.destinatario_nombre, e.cobro_monto,
    e.cobro_moneda, e.cobro_estado, e.cobro_metodo, e.cobro_monto_recibido, e.cobro_moneda_recibida,
    e.cobro_referencia, e.cobrado_en, e.liquidado_en, u.nombre AS conductor, e.cobro_ruta_id AS ruta_id,
    r.nombre AS ruta
  FROM envios e
  LEFT JOIN usuarios u ON u.id = e.cobro_conductor_id
  LEFT JOIN rutas_flex r ON r.id = e.cobro_ruta_id`;

const filaSalida = (f: FilaCobro) => ({
  envioId: f.envio_id,
  referenciaExterna: f.referencia_externa,
  destinatarioNombre: f.destinatario_nombre,
  monto: f.cobro_monto,
  moneda: f.cobro_moneda,
  estado: f.cobro_estado,
  metodo: f.cobro_metodo,
  montoRecibido: f.cobro_monto_recibido,
  monedaRecibida: f.cobro_moneda_recibida,
  referencia: f.cobro_referencia,
  cobradoEn: f.cobrado_en,
  liquidadoEn: f.liquidado_en,
  conductor: f.conductor,
  rutaId: f.ruta_id,
  ruta: f.ruta,
});

/** Totales por moneda: lo cobrado (todo), y lo que sigue en manos del conductor en efectivo. */
function totales(filas: FilaCobro[]) {
  const cobrado: Record<string, number> = {};
  for (const f of filas)
    if (f.cobro_estado === 'cobrado' || f.cobro_estado === 'liquidado') {
      const m = f.cobro_moneda_recibida ?? f.cobro_moneda;
      // eslint-disable-next-line security/detect-object-injection -- moneda de la base (USD o VES)
      cobrado[m] = (cobrado[m] ?? 0) + (f.cobro_monto_recibido ?? 0);
    }
  return {
    cobrado,
    efectivoEnMano: efectivoEnMano(
      filas
        .filter((f) => f.cobro_estado === 'cobrado' || f.cobro_estado === 'liquidado')
        .map((f) => ({
          metodo: f.cobro_metodo ?? '',
          monto: f.cobro_monto_recibido ?? 0,
          moneda: f.cobro_moneda_recibida ?? f.cobro_moneda,
          liquidado: f.cobro_estado === 'liquidado',
        })),
    ),
    pendientes: filas.filter((f) => f.cobro_estado === 'pendiente').length,
  };
}

const esquemaFiltro = z.object({
  estado: z.enum(['pendiente', 'cobrado', 'liquidado']).optional(),
  rutaId: z.string().uuid().optional(),
});

/** Los cobros de la empresa (los más nuevos primero), con sus totales. */
flexCobros.get('/empresas/:id/cobros', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const q = esquemaFiltro.safeParse(c.req.query());
  if (!q.success) throw new ErrorDatos('Filtro inválido.', 'estado');
  const db = base(c);
  const donde = ['e.empresa_id = ?', 'e.cobro_monto IS NOT NULL'];
  const valores: unknown[] = [actor.empresaId];
  if (q.data.estado) {
    donde.push('e.cobro_estado = ?');
    valores.push(q.data.estado);
  }
  if (q.data.rutaId) {
    donde.push(
      '(e.cobro_ruta_id = ? OR e.id IN (SELECT envio_id FROM ruta_paradas WHERE ruta_id = ?))',
    );
    valores.push(q.data.rutaId, q.data.rutaId);
  }
  const { results } = await db
    .prepare(`${SELECT_COBROS} WHERE ${donde.join(' AND ')} ORDER BY e.creado_en DESC LIMIT 500`)
    .bind(...valores)
    .all<FilaCobro>();
  return c.json({ cobros: results.map(filaSalida), totales: totales(results) });
});

/**
 * «Recibí el efectivo»: al cerrar la caja de una ruta en el centro, lo cobrado pasa a recibido.
 * Solo personas (una clave de API no recibe dinero) con permiso de recibir en el centro o de
 * finanzas. Se hace una sola vez: repetir no cambia nada.
 */
flexCobros.post('/empresas/:id/rutas/:rutaId/cobros/recibir', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  if (actor.actorTipo !== 'usuario')
    throw new ErrorDatos('Recibir dinero lo hace una persona, no una clave.', undefined, 403);
  if (
    !actor.permisos.includes('devoluciones.recibir') &&
    !actor.permisos.includes('finanzas.gestionar')
  )
    throw new ErrorDatos('Tu cuenta no tiene permiso para esto.', undefined, 403);
  await leerCuerpo(c, z.object({}).passthrough());
  const db = base(c);
  const rutaId = c.req.param('rutaId');
  const ruta = await db
    .prepare('SELECT id FROM rutas_flex WHERE id = ? AND empresa_id = ?')
    .bind(rutaId, actor.empresaId)
    .first();
  if (!ruta) throw new ErrorDatos('Esa ruta no existe.', undefined, 404);
  return conIdempotencia(c, actor, { rutaId, accion: 'recibir-cobros' }, async () => {
    const { results } = await db
      .prepare(
        `${SELECT_COBROS} WHERE e.empresa_id = ? AND e.cobro_ruta_id = ? AND e.cobro_estado = 'cobrado'`,
      )
      .bind(actor.empresaId, rutaId)
      .all<FilaCobro>();
    if (!results.length)
      throw new ErrorDatos('Esta ruta no tiene cobros por recibir.', undefined, 409);
    const t = totales(results);
    await db.batch([
      db
        .prepare(
          `UPDATE envios SET cobro_estado = 'liquidado', liquidado_en = datetime('now'), liquidado_por = ?
           WHERE empresa_id = ? AND cobro_ruta_id = ? AND cobro_estado = 'cobrado'`,
        )
        .bind(actor.actorId, actor.empresaId, rutaId),
      sentenciaAuditoria(db, actor, 'cobros.recibir', rutaId, {
        envios: results.length,
        efectivo: t.efectivoEnMano,
        cobrado: t.cobrado,
      }),
    ]);
    return {
      estado: 200,
      datos: { recibidos: results.length, efectivo: t.efectivoEnMano, cobrado: t.cobrado },
    };
  });
});

/** El conductor: lo que tiene en la mano (efectivo cobrado y no entregado todavía al centro). */
flexCobros.get('/conductor/cobros', async (c) => {
  if (c.req.header(CABECERA_CLAVE))
    throw new ErrorDatos('Una clave de API no puede actuar como conductor.', undefined, 403);
  const u = exigir(c, 'repartidor');
  const { results } = await base(c)
    .prepare(
      `${SELECT_COBROS} WHERE e.cobro_conductor_id = ? AND e.cobro_estado = 'cobrado' ORDER BY e.cobrado_en DESC LIMIT 500`,
    )
    .bind(u.id)
    .all<FilaCobro>();
  return c.json({ cobros: results.map(filaSalida), totales: totales(results) });
});
