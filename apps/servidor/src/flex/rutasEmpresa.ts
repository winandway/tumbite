import { avisarConductor, despues } from './avisosFlex';
import { evaluarCapacidadRuta } from './operaciones';
import { liberarCobroRuta, reservarCobroRuta } from '../finanzas/cobrosRuta';
import { Hono } from 'hono';
import { z } from 'zod';
import { CONFIG_ENTREGA_DEFECTO, configEntrega, leerCodigoEscaneado } from '@tumbite/compartido';
import { sha256 } from '../cripto';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  type ActorFlex,
  actorDeEmpresa,
  bytesAleatorios,
  conIdempotencia,
  exigirPermiso,
  sentenciaAuditoria,
} from './autorizacion';
import { ACTUALIZAR_ENVIOS_DE_RUTA } from './envios';
import {
  type FilaRuta,
  MAX_PAQUETES_RUTA,
  detalleRuta,
  eventoSuelto,
  moverPaquetes,
  recalcularParadas,
  resumenRuta,
  rutaPorId,
} from './rutasComun';

/**
 * Divoox Flex · Fase 2 · lo que hace la EMPRESA con sus rutas: asignar a un conductor propio
 * (lo ocupa), ofrecer a uno de la red (lo ocupa al aceptar), retirar, cancelar, reordenar las
 * paradas antes de salir, corregir coordenadas, el PIN del destinatario, las pruebas exigidas,
 * las incidencias y la recepción de devoluciones en el centro.
 */
export const flexRutasEmpresa = new Hono<{ Bindings: Env; Variables: Variables }>();

const fecha = z
  .string()
  // eslint-disable-next-line security/detect-unsafe-regex -- longitud acotada, sin repeticiones anidadas
  .regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/, 'Fecha con el formato 2026-10-28T09:00');
const esquemaAsignar = z.object({
  conductorId: z.string().uuid(),
  vehiculoId: z.string().uuid().nullable().optional(),
  bloqueDesde: fecha.nullable().optional(),
  bloqueHasta: fecha.nullable().optional(),
  /** Fase 3: la empresa vio el aviso de capacidad y asigna igual. */
  confirmarCapacidad: z.boolean().optional(),
});
const esquemaOfrecer = esquemaAsignar.extend({
  minutos: z.number().int().min(5).max(1440).default(60),
});
const esquemaMotivo = z.object({ motivo: z.string().trim().max(300).default('') });
const esquemaOrden = z.object({ paradaIds: z.array(z.string().uuid()).min(1).max(150) });
const esquemaEnvioCambio = z.object({
  direccion: z.string().trim().min(3).max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  instrucciones: z.string().trim().max(500).optional(),
  destinatarioTelefono: z.string().trim().max(32).optional(),
  configEntrega: z
    .object({
      foto: z.boolean().optional(),
      pin: z.boolean().optional(),
      firma: z.boolean().optional(),
      sinContacto: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});
const esquemaConfig = z.object({
  foto: z.boolean(),
  pin: z.boolean(),
  firma: z.boolean(),
  sinContacto: z.boolean(),
  reintentoEnRuta: z.boolean(),
});
const esquemaRecibir = z.object({
  codigo: z.string().trim().min(6).max(40),
  destino: z.enum(['centro', 'remitente']).default('centro'),
});
const esquemaListaRutas = z.object({
  estado: z.string().max(32).optional(),
  centroId: z.string().uuid().optional(),
  conductorId: z.string().uuid().optional(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const DUPLICADO = /UNIQUE constraint failed: ruta_paquetes\.paquete_id|ruta_paquetes_activo/;

function traducirError(e: unknown): never {
  const msg = String(e instanceof Error ? e.message : e);
  if (
    msg.includes('conductor_ocupado_en_otra_operacion') ||
    msg.includes('conductor_ocupacion.conductor_id') ||
    msg.includes('rutas_flex_una_activa')
  )
    throw new ErrorDatos(
      'Ese conductor ya está ocupado con otra ruta o pedido.',
      'conductorId',
      409,
    );
  if (DUPLICADO.test(msg) || msg.includes('UNIQUE constraint failed: ruta_paquetes'))
    throw new ErrorDatos('Algún paquete de esta ruta ya está en otra ruta activa.', undefined, 409);
  if (msg.includes('transicion_de_ruta_no_permitida'))
    throw new ErrorDatos('La ruta ya no está en un estado que permita esto.', undefined, 409);
  if (msg.includes('transicion_de_paquete_no_permitida'))
    throw new ErrorDatos('Un paquete no puede pasar a ese estado.', undefined, 409);
  throw e;
}

/** El conductor tiene que ser de ESTA empresa (vínculo activo) y tener cuenta de repartidor activa. */
async function conductorDeEmpresa(
  db: D1Database,
  empresaId: string,
  conductorId: string,
  modalidad: 'asignacion' | 'oferta',
) {
  const f = await db
    .prepare(
      `SELECT ec.vinculo FROM empresa_conductores ec JOIN usuarios u ON u.id = ec.usuario_id
        WHERE ec.empresa_id = ? AND ec.usuario_id = ? AND ec.estado = 'activo' AND u.rol = 'repartidor' AND u.activo = 1`,
    )
    .bind(empresaId, conductorId)
    .first<{ vinculo: 'propio' | 'red' | 'hibrido' }>();
  if (!f) throw new ErrorDatos('Ese conductor no está vinculado a tu empresa.', 'conductorId', 404);
  if (modalidad === 'asignacion' && f.vinculo === 'red')
    throw new ErrorDatos(
      'A un conductor de la red Divoox no se le asigna: se le ofrece la ruta y él la acepta.',
      'conductorId',
      409,
    );
  if (modalidad === 'oferta' && f.vinculo === 'propio')
    throw new ErrorDatos(
      'A un conductor propio se le asigna la ruta directamente.',
      'conductorId',
      409,
    );
}

async function comprobarVehiculo(
  db: D1Database,
  vehiculoId: string | null | undefined,
  conductorId: string,
) {
  if (!vehiculoId) return;
  const v = await db
    .prepare('SELECT 1 FROM vehiculos WHERE id = ? AND conductor_id = ?')
    .bind(vehiculoId, conductorId)
    .first();
  if (!v) throw new ErrorDatos('Ese vehículo no es del conductor.', 'vehiculoId', 404);
}

/**
 * Fase 3 (C-FLEX-CAPACIDAD): si la empresa declaró la capacidad del vehículo y la ruta no cabe, se
 * avisa ANTES de asignar; solo sigue si la empresa lo confirma. Sin datos, no se frena (es «sin dato»).
 */
async function comprobarCapacidad(
  db: D1Database,
  empresaId: string,
  rutaId: string,
  vehiculoId: string | null | undefined,
  confirmada: boolean | undefined,
) {
  if (!vehiculoId || confirmada) return;
  const cap = await evaluarCapacidadRuta(db, empresaId, rutaId, vehiculoId);
  if (cap.estado === 'excede')
    throw new ErrorDatos(
      'La ruta no cabe en ese vehículo según la capacidad declarada. Revisa la capacidad o confirma que igual quieres asignarla.',
      'capacidad',
      409,
    );
}

/** Paquetes que la ruta llevaría al salir del borrador (los del centro en sus paradas). */
async function paquetesDelBorrador(db: D1Database, rutaId: string) {
  const f = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM ruta_paradas rp JOIN paquetes p ON p.envio_id = rp.envio_id
        WHERE rp.ruta_id = ? AND p.estado IN ('creado', 'registrado_centro', 'preparado')`,
    )
    .bind(rutaId)
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

/** Lo que tiene que estar bien ANTES de que la ruta salga del borrador. */
async function rutaLista(db: D1Database, r: FilaRuta) {
  const f = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM ruta_paradas WHERE ruta_id = ?1) AS paradas,
        (SELECT COUNT(*) FROM ruta_paradas rp JOIN paquetes p ON p.envio_id = rp.envio_id
          WHERE rp.ruta_id = ?1 AND p.estado IN ('creado', 'registrado_centro', 'preparado')) AS paquetes,
        (SELECT json_group_array(e.referencia_externa) FROM ruta_paradas rp JOIN envios e ON e.id = rp.envio_id
          WHERE rp.ruta_id = ?1 AND (e.lat IS NULL OR e.lng IS NULL)) AS sin_coordenadas`,
    )
    .bind(r.id)
    .first<{ paradas: number; paquetes: number; sin_coordenadas: string }>();
  if (!f?.paradas) throw new ErrorDatos('La ruta no tiene paradas.', undefined, 409);
  if (!f.paquetes)
    throw new ErrorDatos('La ruta no tiene paquetes listos para salir.', undefined, 409);
  if (f.paquetes > MAX_PAQUETES_RUTA)
    throw new ErrorDatos(
      `Una ruta lleva como máximo ${MAX_PAQUETES_RUTA} paquetes. Divídela.`,
      undefined,
      409,
    );
  const faltan = JSON.parse(f.sin_coordenadas || '[]') as (string | null)[];
  if (faltan.length)
    throw new ErrorDatos(
      `Hay paradas sin coordenadas verificadas: corrígelas antes de asignar (${faltan.map((x) => x ?? '—').join(', ')}).`,
      'paradas',
      409,
    );
}

/** Sentencias que reservan los paquetes de la ruta (un paquete no puede estar en dos rutas activas). */
function reservarPaquetes(db: D1Database, r: FilaRuta, clave: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO ruta_paquetes (ruta_id, paquete_id, parada_id, empresa_id)
       SELECT ?1, p.id, rp.id, ?2 FROM ruta_paradas rp JOIN paquetes p ON p.envio_id = rp.envio_id
        WHERE rp.ruta_id = ?1 AND p.empresa_id = ?2 AND p.estado IN ('creado', 'registrado_centro', 'preparado')
          AND EXISTS (SELECT 1 FROM rutas_flex WHERE id = ?1 AND ultima_clave = ?3)`,
    )
    .bind(r.id, r.empresa_id, clave);
}

/** Ids de los paquetes activos de la ruta (para moverlos en bloque). */
export async function paquetesActivos(db: D1Database, rutaId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT paquete_id FROM ruta_paquetes WHERE ruta_id = ? AND activo = 1')
    .bind(rutaId)
    .all<{ paquete_id: string }>();
  return results.map((x) => x.paquete_id);
}

const ahora = "datetime('now')";

/** Asignar a un conductor propio (o híbrido): la ruta lo ocupa en la misma sentencia. */
flexRutasEmpresa.post('/empresas/:id/rutas/:rutaId/asignar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaAsignar);
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  return conIdempotencia(c, actor, { ...d, ruta: r.id, accion: 'asignar' }, async () => {
    const actual = await rutaPorId(db, r.id, actor.empresaId);
    if (actual.estado !== 'borrador')
      throw new ErrorDatos('Solo se asigna una ruta en borrador.', undefined, 409);
    await conductorDeEmpresa(db, actor.empresaId, d.conductorId, 'asignacion');
    await comprobarVehiculo(db, d.vehiculoId, d.conductorId);
    await rutaLista(db, actual);
    await comprobarCapacidad(db, actor.empresaId, actual.id, d.vehiculoId, d.confirmarCapacidad);
    // Fase 4 (C-FIN-RESERVAS): se aparta la comisión ANTES; si la asignación no entra, se devuelve.
    const cobro = await reservarCobroRuta(db, actual, await paquetesDelBorrador(db, actual.id));
    const soltar = async () => {
      if (cobro?.nuevo) await liberarCobroRuta(db, r.id, 'no_salio');
    };
    const clave = `asignar:${r.id}:${crypto.randomUUID()}`;
    const res = await db
      .batch([
        db
          .prepare(
            `UPDATE rutas_flex SET estado = 'asignada', conductor_id = ?, vehiculo_id = ?, modalidad = 'asignacion',
               bloque_desde = COALESCE(?, bloque_desde), bloque_hasta = COALESCE(?, bloque_hasta),
               asignada_en = ${ahora}, oferta_vence_en = NULL, ultima_clave = ?, actualizado_en = ${ahora}
             WHERE id = ? AND empresa_id = ? AND estado = 'borrador'`,
          )
          .bind(
            d.conductorId,
            d.vehiculoId ?? null,
            d.bloqueDesde ?? null,
            d.bloqueHasta ?? null,
            clave,
            r.id,
            actor.empresaId,
          ),
        reservarPaquetes(db, actual, clave),
        db
          .prepare(
            'INSERT INTO ruta_asignaciones (ruta_id, conductor_id, clave) SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM rutas_flex WHERE id = ?1 AND ultima_clave = ?3)',
          )
          .bind(r.id, d.conductorId, clave),
        // En el MISMO lote: si algo falla (conductor ocupado, paquete en otra ruta), no queda nada a medias.
        ...moverPaquetes(db, {
          ids: { deRuta: r.id },
          empresaId: actor.empresaId,
          desde: ['creado', 'registrado_centro', 'preparado'],
          hacia: 'asignado',
          actorId: actor.actorId,
          actorTipo: actor.actorTipo,
          rutaId: r.id,
          prefijo: clave,
          guardaClave: clave,
        }),
        db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
        sentenciaAuditoria(db, actor, 'ruta.asignar', r.id, { conductorId: d.conductorId }),
      ])
      .catch(async (e: unknown) => {
        await soltar();
        return traducirError(e);
      });
    if (!res[0]?.meta.changes) {
      await soltar();
      throw new ErrorDatos('La ruta cambió mientras tanto. Vuelve a cargarla.', undefined, 409);
    }
    await despues(c, () =>
      avisarConductor(c.env, db, { tipo: 'asignacion', rutaId: r.id, ocasion: clave }),
    );
    return {
      estado: 200,
      datos: await detalleRuta(db, await rutaPorId(db, r.id), { paraConductor: false }),
    };
  });
});

/** Ofrecer a un conductor de la red (o híbrido): no lo ocupa hasta que acepte; la oferta vence. */
flexRutasEmpresa.post('/empresas/:id/rutas/:rutaId/ofrecer', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaOfrecer);
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  return conIdempotencia(c, actor, { ...d, ruta: r.id, accion: 'ofrecer' }, async () => {
    const actual = await rutaPorId(db, r.id, actor.empresaId);
    if (actual.estado !== 'borrador')
      throw new ErrorDatos('Solo se ofrece una ruta en borrador.', undefined, 409);
    await conductorDeEmpresa(db, actor.empresaId, d.conductorId, 'oferta');
    await comprobarVehiculo(db, d.vehiculoId, d.conductorId);
    await rutaLista(db, actual);
    await comprobarCapacidad(db, actor.empresaId, actual.id, d.vehiculoId, d.confirmarCapacidad);
    // Fase 4 (C-FIN-RESERVAS): se aparta la comisión ANTES; si la asignación no entra, se devuelve.
    const cobro = await reservarCobroRuta(db, actual, await paquetesDelBorrador(db, actual.id));
    const soltar = async () => {
      if (cobro?.nuevo) await liberarCobroRuta(db, r.id, 'no_salio');
    };
    const clave = `ofrecer:${r.id}:${crypto.randomUUID()}`;
    const res = await db
      .batch([
        db
          .prepare(
            `UPDATE rutas_flex SET estado = 'ofrecida', conductor_id = ?, vehiculo_id = ?, modalidad = 'oferta',
               bloque_desde = COALESCE(?, bloque_desde), bloque_hasta = COALESCE(?, bloque_hasta),
               oferta_vence_en = datetime('now', '+' || ? || ' minutes'), ultima_clave = ?, actualizado_en = ${ahora}
             WHERE id = ? AND empresa_id = ? AND estado = 'borrador'`,
          )
          .bind(
            d.conductorId,
            d.vehiculoId ?? null,
            d.bloqueDesde ?? null,
            d.bloqueHasta ?? null,
            d.minutos,
            clave,
            r.id,
            actor.empresaId,
          ),
        reservarPaquetes(db, actual, clave),
        sentenciaAuditoria(db, actor, 'ruta.ofrecer', r.id, {
          conductorId: d.conductorId,
          minutos: d.minutos,
        }),
      ])
      .catch(async (e: unknown) => {
        await soltar();
        return traducirError(e);
      });
    if (!res[0]?.meta.changes) {
      await soltar();
      throw new ErrorDatos('La ruta cambió mientras tanto. Vuelve a cargarla.', undefined, 409);
    }
    await despues(c, () =>
      avisarConductor(c.env, db, { tipo: 'oferta', rutaId: r.id, ocasion: clave }),
    );
    return {
      estado: 200,
      datos: await detalleRuta(db, await rutaPorId(db, r.id), { paraConductor: false }),
    };
  });
});

/**
 * Devolver la ruta a borrador (la empresa retira la oferta o la asignación, o el conductor la
 * rechaza): los paquetes vuelven a «preparado», la reserva se suelta y la ocupación también.
 */
export async function volverABorrador(
  db: D1Database,
  r: FilaRuta,
  quien: { actorId: string; actorTipo: 'usuario' | 'api' | 'sistema' },
  resultado: 'liberada_conductor' | 'reasignada' | 'liberada_sistema',
  motivo: string,
): Promise<string> {
  if (!['ofrecida', 'asignada', 'aceptada'].includes(r.estado))
    throw new ErrorDatos(
      'Esa ruta ya salió a la calle: no se puede retirar, se cierra con devoluciones.',
      undefined,
      409,
    );
  const clave = `borrador:${r.id}:${crypto.randomUUID()}`;
  const guarda = 'EXISTS (SELECT 1 FROM rutas_flex WHERE id = ?2 AND ultima_clave = ?3)';
  const res = await db
    .batch([
      // Primero el cambio de la ruta (con su clave); todo lo demás solo si este cambio ganó.
      db
        .prepare(
          `UPDATE rutas_flex SET estado = 'borrador', conductor_id = NULL, vehiculo_id = NULL, modalidad = NULL,
             oferta_vence_en = NULL, asignada_en = NULL, aceptada_en = NULL, motivo = ?, ultima_clave = ?, actualizado_en = ${ahora}
           WHERE id = ? AND estado = ?`,
        )
        .bind(motivo, clave, r.id, r.estado),
      ...moverPaquetes(db, {
        ids: { deRuta: r.id },
        empresaId: r.empresa_id,
        desde: ['asignado'],
        hacia: 'preparado',
        actorId: quien.actorId,
        actorTipo: quien.actorTipo,
        rutaId: r.id,
        prefijo: clave,
        meta: { motivo: motivo || resultado },
        guardaClave: clave,
      }),
      db
        .prepare(
          'DELETE FROM ruta_paquetes WHERE ruta_id = ?1 AND EXISTS (SELECT 1 FROM rutas_flex WHERE id = ?1 AND ultima_clave = ?2)',
        )
        .bind(r.id, clave),
      db
        .prepare(
          `UPDATE ruta_asignaciones SET fin = ${ahora}, resultado = ?1 WHERE ruta_id = ?2 AND fin IS NULL AND ${guarda}`,
        )
        .bind(resultado, r.id, clave),
      db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
    ])
    .catch(traducirError);
  if (!res[0]?.meta.changes)
    throw new ErrorDatos('La ruta cambió mientras tanto. Vuelve a cargarla.', undefined, 409);
  // Fase 4: la comisión apartada vuelve al disponible (si falla, el reloj la recupera).
  await liberarCobroRuta(db, r.id, resultado).catch((e: unknown) =>
    console.error('finanzas: liberar reserva al volver a borrador', e),
  );
  return clave;
}

flexRutasEmpresa.post('/empresas/:id/rutas/:rutaId/retirar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaMotivo);
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  const clave = await volverABorrador(db, r, actor, 'reasignada', d.motivo);
  await sentenciaAuditoria(db, actor, 'ruta.retirar', r.id, d).run();
  if (r.conductor_id)
    await despues(c, () =>
      avisarConductor(c.env, db, {
        tipo: 'oferta_retirada',
        rutaId: r.id,
        ocasion: clave,
        conductorId: r.conductor_id,
      }),
    );
  return c.json(await detalleRuta(db, await rutaPorId(db, r.id), { paraConductor: false }));
});

/** Cancelar: solo antes de salir a la calle. Los paquetes vuelven al centro; libera al conductor. */
flexRutasEmpresa.post('/empresas/:id/rutas/:rutaId/cancelar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaMotivo);
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  if (r.estado === 'cancelada') return c.json(await detalleRuta(db, r, { paraConductor: false }));
  if (!['borrador', 'ofrecida', 'asignada', 'aceptada', 'en_carga'].includes(r.estado))
    throw new ErrorDatos(
      'Una ruta en la calle no se cancela: se cierra con sus devoluciones.',
      undefined,
      409,
    );
  const clave = `cancelar:${r.id}:${crypto.randomUUID()}`;
  const guardada = (sql: string) =>
    `${sql} AND EXISTS (SELECT 1 FROM rutas_flex WHERE id = ?1 AND ultima_clave = ?2)`;
  const res = await db
    .batch([
      db
        .prepare(
          `UPDATE rutas_flex SET estado = 'cancelada', motivo = ?, ultima_clave = ?, cerrada_en = ${ahora}, actualizado_en = ${ahora}
            WHERE id = ? AND estado = ?`,
        )
        .bind(d.motivo, clave, r.id, r.estado),
      ...moverPaquetes(db, {
        ids: { deRuta: r.id },
        empresaId: r.empresa_id,
        desde: ['asignado', 'cargado'],
        hacia: 'preparado',
        actorId: actor.actorId,
        actorTipo: actor.actorTipo,
        rutaId: r.id,
        prefijo: clave,
        meta: { motivo: d.motivo || 'ruta cancelada' },
        guardaClave: clave,
      }),
      db
        .prepare(guardada('UPDATE ruta_paquetes SET activo = 0 WHERE ruta_id = ?1'))
        .bind(r.id, clave),
      db
        .prepare(
          guardada(
            `UPDATE ruta_asignaciones SET fin = ${ahora}, resultado = 'cancelada' WHERE ruta_id = ?1 AND fin IS NULL`,
          ),
        )
        .bind(r.id, clave),
      db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(r.id),
      sentenciaAuditoria(db, actor, 'ruta.cancelar', r.id, d),
    ])
    .catch(traducirError);
  if (!res[0]?.meta.changes)
    throw new ErrorDatos('La ruta cambió mientras tanto. Vuelve a cargarla.', undefined, 409);
  await liberarCobroRuta(db, r.id, 'cancelada').catch((e: unknown) =>
    console.error('finanzas: liberar reserva al cancelar', e),
  );
  if (r.conductor_id)
    await despues(c, () =>
      avisarConductor(c.env, db, { tipo: 'ruta_cancelada', rutaId: r.id, ocasion: clave }),
    );
  return c.json(await detalleRuta(db, await rutaPorId(db, r.id), { paraConductor: false }));
});

/** Reordenar las paradas mientras la ruta no salió (borrador → en carga). */
flexRutasEmpresa.put('/empresas/:id/rutas/:rutaId/orden', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const d = await leerCuerpo(c, esquemaOrden);
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  if (!['borrador', 'ofrecida', 'asignada', 'aceptada', 'en_carga'].includes(r.estado))
    throw new ErrorDatos('El orden se cambia antes de salir a la calle.', undefined, 409);
  const { results } = await db
    .prepare('SELECT id FROM ruta_paradas WHERE ruta_id = ?')
    .bind(r.id)
    .all<{ id: string }>();
  const actuales = new Set(results.map((x) => x.id));
  if (
    d.paradaIds.length !== actuales.size ||
    new Set(d.paradaIds).size !== actuales.size ||
    d.paradaIds.some((x) => !actuales.has(x))
  )
    throw new ErrorDatos(
      'La lista tiene que traer todas las paradas de la ruta, una vez cada una.',
      'paradaIds',
      409,
    );
  await db.batch([
    // Dos pasos para no chocar con UNIQUE(ruta_id, orden).
    db.prepare('UPDATE ruta_paradas SET orden = orden + 10000 WHERE ruta_id = ?').bind(r.id),
    db
      .prepare(
        `UPDATE ruta_paradas SET orden = (SELECT CAST(key AS INTEGER) + 1 FROM json_each(?) WHERE value = ruta_paradas.id)
          WHERE ruta_id = ?`,
      )
      .bind(JSON.stringify(d.paradaIds), r.id),
    sentenciaAuditoria(db, actor, 'ruta.orden', r.id, { paradas: d.paradaIds.length }),
  ]);
  return c.json(await detalleRuta(db, await rutaPorId(db, r.id), { paraConductor: false }));
});

flexRutasEmpresa.get('/empresas/:id/rutas/:rutaId/detalle', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const r = await rutaPorId(db, c.req.param('rutaId'), actor.empresaId);
  const det = await detalleRuta(db, r, { paraConductor: false });
  const inc = await db
    .prepare(
      `SELECT i.id, i.paquete_id, i.parada_id, i.motivo, i.observaciones, i.proxima_accion, i.estado, i.reintento_autorizado,
              i.prueba_id, i.creado_en, p.codigo_seguimiento
         FROM flex_incidencias i JOIN paquetes p ON p.id = i.paquete_id WHERE i.ruta_id = ? ORDER BY i.creado_en`,
    )
    .bind(r.id)
    .all<Record<string, unknown>>();
  const pruebas = await db
    .prepare(
      'SELECT id, parada_id, tipo, creado_en FROM flex_pruebas WHERE ruta_id = ? ORDER BY creado_en',
    )
    .bind(r.id)
    .all<Record<string, unknown>>();
  return c.json({
    ...det,
    resumenActual: ['completada', 'con_incidencias'].includes(r.estado)
      ? await resumenRuta(db, r, r.cerrada_en)
      : null,
    incidencias: inc.results.map((i) => ({
      id: i.id,
      paqueteId: i.paquete_id,
      paradaId: i.parada_id,
      codigoSeguimiento: i.codigo_seguimiento,
      motivo: i.motivo,
      observaciones: i.observaciones,
      proximaAccion: i.proxima_accion,
      estado: i.estado,
      reintentoAutorizado: Boolean(i.reintento_autorizado),
      pruebaId: i.prueba_id,
      creadoEn: i.creado_en,
    })),
    pruebas: pruebas.results.map((p) => ({
      id: p.id,
      paradaId: p.parada_id,
      tipo: p.tipo,
      creadoEn: p.creado_en,
    })),
  });
});

/** Las fotos y firmas: solo a la empresa dueña, sin caché pública, nunca por un enlace abierto. */
flexRutasEmpresa.get('/empresas/:id/pruebas/:pruebaId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const db = base(c);
  const f = await db
    .prepare('SELECT clave FROM flex_pruebas WHERE id = ? AND empresa_id = ?')
    .bind(c.req.param('pruebaId'), actor.empresaId)
    .first<{ clave: string }>();
  if (!f || !c.env.BUCKET) throw new ErrorDatos('Esa prueba no existe.', undefined, 404);
  const obj = await c.env.BUCKET.get(f.clave);
  if (!obj) throw new ErrorDatos('Esa prueba no existe.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/webp',
      'cache-control': 'private, no-store',
    },
  });
});

/** Corregir los datos de entrega de un envío (coordenadas, dirección…) mientras no esté en la calle. */
flexRutasEmpresa.patch('/empresas/:id/envios/:envioId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.crear');
  const d = await leerCuerpo(c, esquemaEnvioCambio);
  if ((d.lat === undefined) !== (d.lng === undefined))
    throw new ErrorDatos('La latitud y la longitud van juntas.', 'lat');
  const db = base(c);
  const envioId = c.req.param('envioId');
  const enCalle = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM envios WHERE id = ?1 AND empresa_id = ?2) AS existe,
              (SELECT COUNT(*) FROM paquetes WHERE envio_id = ?1 AND estado IN ('cargado', 'en_transito')) AS en_calle`,
    )
    .bind(envioId, actor.empresaId)
    .first<{ existe: number; en_calle: number }>();
  if (!enCalle?.existe) throw new ErrorDatos('Ese envío no existe.', undefined, 404);
  if (enCalle.en_calle)
    throw new ErrorDatos('Ese envío ya va en camino: no se cambia ahora.', undefined, 409);
  await db.batch([
    db
      .prepare(
        `UPDATE envios SET direccion = COALESCE(?, direccion), lat = COALESCE(?, lat), lng = COALESCE(?, lng),
           instrucciones = COALESCE(?, instrucciones), destinatario_telefono = COALESCE(?, destinatario_telefono),
           config_entrega_json = CASE WHEN ? = 1 THEN ? ELSE config_entrega_json END, actualizado_en = ${ahora}
         WHERE id = ? AND empresa_id = ?`,
      )
      .bind(
        d.direccion ?? null,
        d.lat ?? null,
        d.lng ?? null,
        d.instrucciones ?? null,
        d.destinatarioTelefono ?? null,
        d.configEntrega === undefined ? 0 : 1,
        d.configEntrega ? JSON.stringify(d.configEntrega) : null,
        envioId,
        actor.empresaId,
      ),
    sentenciaAuditoria(db, actor, 'envio.corregir', envioId, { ...d }),
  ]);
  return c.json({ ok: true });
});

/** Pruebas de entrega que exige la empresa (por defecto: foto). */
flexRutasEmpresa.get('/empresas/:id/config-entrega', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'empresa.ver');
  const f = await base(c)
    .prepare('SELECT config_entrega_json FROM empresas WHERE id = ?')
    .bind(actor.empresaId)
    .first<{ config_entrega_json: string | null }>();
  return c.json({ config: configEntrega(f?.config_entrega_json), defecto: CONFIG_ENTREGA_DEFECTO });
});

flexRutasEmpresa.put('/empresas/:id/config-entrega', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'empresa.editar');
  if (actor.actorTipo !== 'usuario')
    throw new ErrorDatos('Una clave de API no puede hacer esto.', undefined, 403);
  const d = await leerCuerpo(c, esquemaConfig);
  const db = base(c);
  await db.batch([
    db
      .prepare(
        `UPDATE empresas SET config_entrega_json = ?, actualizado_en = ${ahora} WHERE id = ?`,
      )
      .bind(JSON.stringify(d), actor.empresaId),
    sentenciaAuditoria(db, actor, 'empresa.config_entrega', actor.empresaId, d),
  ]);
  return c.json({ config: d });
});

/**
 * PIN del destinatario: se genera y se muestra UNA vez para que la empresa se lo haga llegar; en
 * la base queda solo su hash con sal. Generar otro reemplaza al anterior (si no se usó).
 */
flexRutasEmpresa.post('/empresas/:id/envios/:envioId/pin', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.crear');
  const db = base(c);
  const envioId = c.req.param('envioId');
  const e = await db
    .prepare('SELECT 1 FROM envios WHERE id = ? AND empresa_id = ?')
    .bind(envioId, actor.empresaId)
    .first();
  if (!e) throw new ErrorDatos('Ese envío no existe.', undefined, 404);
  const usado = await db
    .prepare('SELECT usado_en FROM flex_pines WHERE envio_id = ?')
    .bind(envioId)
    .first<{ usado_en: string | null }>();
  if (usado?.usado_en) throw new ErrorDatos('Ese envío ya se entregó con su PIN.', undefined, 409);
  const b = bytesAleatorios(4);
  const pin = String((((b[0] ?? 0) << 8) | (b[1] ?? 0)) % 10000).padStart(4, '0');
  const sal = Array.from(bytesAleatorios(8), (x) => x.toString(16).padStart(2, '0')).join('');
  await db.batch([
    db
      .prepare(
        `INSERT INTO flex_pines (envio_id, empresa_id, pin_hash, sal) VALUES (?, ?, ?, ?)
         ON CONFLICT(envio_id) DO UPDATE SET pin_hash = excluded.pin_hash, sal = excluded.sal, intentos = 0, creado_en = ${ahora}`,
      )
      .bind(envioId, actor.empresaId, await sha256(`${sal}:${pin}`), sal),
    sentenciaAuditoria(db, actor, 'envio.pin', envioId),
  ]);
  return c.json(
    {
      pin,
      aviso: 'Este PIN se muestra una sola vez. Compártelo solo con quien recibe el paquete.',
    },
    201,
  );
});

// ───────────────────────────── Incidencias y devoluciones ─────────────────────────────

flexRutasEmpresa.get('/empresas/:id/incidencias', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const estado = c.req.query('estado');
  const { results } = await base(c)
    .prepare(
      `SELECT i.*, p.codigo_seguimiento, r.nombre AS ruta_nombre, u.nombre AS conductor
         FROM flex_incidencias i JOIN paquetes p ON p.id = i.paquete_id JOIN rutas_flex r ON r.id = i.ruta_id
         JOIN usuarios u ON u.id = i.conductor_id
        WHERE i.empresa_id = ? ${estado ? 'AND i.estado = ?' : ''} ORDER BY i.creado_en DESC LIMIT 200`,
    )
    .bind(...(estado ? [actor.empresaId, estado] : [actor.empresaId]))
    .all<Record<string, unknown>>();
  return c.json({
    incidencias: results.map((i) => ({
      id: i.id,
      rutaId: i.ruta_id,
      ruta: i.ruta_nombre,
      paqueteId: i.paquete_id,
      codigoSeguimiento: i.codigo_seguimiento,
      conductor: i.conductor,
      motivo: i.motivo,
      observaciones: i.observaciones,
      proximaAccion: i.proxima_accion,
      estado: i.estado,
      reintentoAutorizado: Boolean(i.reintento_autorizado),
      pruebaId: i.prueba_id,
      creadoEn: i.creado_en,
    })),
  });
});

/** La empresa autoriza reintentar en la ruta aunque su configuración no lo permita. */
flexRutasEmpresa.post('/empresas/:id/incidencias/:incId/autorizar-reintento', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'lotes.gestionar');
  const db = base(c);
  const r = await db
    .prepare(
      "UPDATE flex_incidencias SET reintento_autorizado = 1, proxima_accion = 'reintentar' WHERE id = ? AND empresa_id = ? AND estado = 'abierta'",
    )
    .bind(c.req.param('incId'), actor.empresaId)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa incidencia no está abierta.', undefined, 404);
  await sentenciaAuditoria(db, actor, 'incidencia.autorizar_reintento', c.req.param('incId')).run();
  const inc = await db
    .prepare('SELECT ruta_id FROM flex_incidencias WHERE id = ?')
    .bind(c.req.param('incId'))
    .first<{ ruta_id: string }>();
  if (inc)
    await despues(c, () =>
      avisarConductor(c.env, db, {
        tipo: 'reintento_autorizado',
        rutaId: inc.ruta_id,
        ocasion: c.req.param('incId'),
      }),
    );
  return c.json({ ok: true });
});

/** Paquetes que vienen de vuelta (o ya los dejó el conductor) y esperan la recepción del centro. */
flexRutasEmpresa.get('/empresas/:id/devoluciones', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const { results } = await base(c)
    .prepare(
      `SELECT p.id, p.codigo_seguimiento, p.codigo_etiqueta, rq.ruta_id, rq.devuelto_centro_en, r.nombre AS ruta,
              u.nombre AS conductor, e.referencia_externa, e.destinatario_nombre,
              (SELECT motivo FROM flex_incidencias i WHERE i.paquete_id = p.id AND i.ruta_id = rq.ruta_id ORDER BY i.creado_en DESC LIMIT 1) AS motivo,
              (SELECT proxima_accion FROM flex_incidencias i WHERE i.paquete_id = p.id AND i.ruta_id = rq.ruta_id ORDER BY i.creado_en DESC LIMIT 1) AS proxima
         FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id JOIN rutas_flex r ON r.id = rq.ruta_id
         JOIN envios e ON e.id = p.envio_id LEFT JOIN usuarios u ON u.id = r.conductor_id
        WHERE rq.empresa_id = ? AND rq.activo = 1 AND p.estado = 'en_devolucion' ORDER BY rq.devuelto_centro_en IS NULL, p.id`,
    )
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  return c.json({
    devoluciones: results.map((x) => ({
      paqueteId: x.id,
      codigoSeguimiento: x.codigo_seguimiento,
      codigoEtiqueta: x.codigo_etiqueta,
      rutaId: x.ruta_id,
      ruta: x.ruta,
      conductor: x.conductor,
      referenciaExterna: x.referencia_externa,
      destinatarioNombre: x.destinatario_nombre,
      motivo: x.motivo,
      proximaAccion: x.proxima,
      entregadoAlCentro: Boolean(x.devuelto_centro_en),
    })),
  });
});

/**
 * Recepción en el centro: una persona autorizada escanea el paquete devuelto. Solo así la
 * devolución queda completa. «centro» = vuelve a estar disponible para otra ruta; «remitente» =
 * se devuelve a quien lo envió (estado final).
 */
flexRutasEmpresa.post('/empresas/:id/devoluciones/recibir', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'devoluciones.recibir');
  if (actor.actorTipo !== 'usuario')
    throw new ErrorDatos(
      'La recepción la confirma una persona del centro, no una clave de API.',
      undefined,
      403,
    );
  const d = await leerCuerpo(c, esquemaRecibir);
  const leido = leerCodigoEscaneado(d.codigo);
  if (!leido) throw new ErrorDatos('Ese código no es de una etiqueta de Divoox.', 'codigo', 404);
  const db = base(c);
  const f = await db
    .prepare(
      `SELECT p.id, p.estado, p.envio_id, rq.ruta_id FROM paquetes p
         JOIN ruta_paquetes rq ON rq.paquete_id = p.id AND rq.activo = 1
        WHERE p.empresa_id = ? AND (p.codigo_etiqueta = ? OR p.codigo_seguimiento = ?)`,
    )
    .bind(actor.empresaId, leido.codigo, leido.codigo)
    .first<{ id: string; estado: string; envio_id: string; ruta_id: string }>();
  if (!f)
    throw new ErrorDatos(
      'Ese paquete no está pendiente de devolución en tu empresa.',
      'codigo',
      404,
    );
  if (f.estado !== 'en_devolucion')
    throw new ErrorDatos('Ese paquete no viene de vuelta.', 'codigo', 409);
  const hacia = d.destino === 'remitente' ? 'devuelto' : 'registrado_centro';
  const clave = `recibir:${f.ruta_id}`;
  await db.batch([
    ...moverPaquetes(db, {
      ids: [f.id],
      empresaId: actor.empresaId,
      desde: ['en_devolucion'],
      hacia,
      actorId: actor.actorId,
      actorTipo: actor.actorTipo,
      rutaId: f.ruta_id,
      prefijo: clave,
      meta: { recepcion: d.destino },
    }),
    db
      .prepare(
        `UPDATE ruta_paquetes SET activo = 0, recibido_en = ${ahora}, recibido_por = ? WHERE ruta_id = ? AND paquete_id = ?`,
      )
      .bind(actor.actorId, f.ruta_id, f.id),
    db
      .prepare(
        `UPDATE flex_incidencias SET estado = 'resuelta', resuelta_en = ${ahora} WHERE paquete_id = ? AND ruta_id = ? AND estado <> 'resuelta'`,
      )
      .bind(f.id, f.ruta_id),
    db.prepare(ACTUALIZAR_ENVIOS_DE_RUTA).bind(f.ruta_id),
    ...recalcularParadas(db, f.ruta_id),
    sentenciaAuditoria(db, actor, 'devolucion.recibir', f.id, { destino: d.destino }),
  ]);
  // Si la ruta ya se cerró, su resumen se pone al día con lo recibido.
  const r = await rutaPorId(db, f.ruta_id);
  if (r.cerrada_en && ['completada', 'con_incidencias'].includes(r.estado))
    await db
      .prepare('UPDATE rutas_flex SET resumen_json = ? WHERE id = ?')
      .bind(JSON.stringify(await resumenRuta(db, r, r.cerrada_en)), r.id)
      .run();
  return c.json({ ok: true, paqueteId: f.id, estado: hacia });
});

/** Rutas de la empresa con filtros (centro, conductor, fecha, estado) y su progreso. */
flexRutasEmpresa.get('/empresas/:id/rutas-operativas', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'envios.ver');
  const q = esquemaListaRutas.parse(c.req.query());
  const cond = ['r.empresa_id = ?'];
  const vals: unknown[] = [actor.empresaId];
  if (q.estado) {
    cond.push('r.estado = ?');
    vals.push(q.estado);
  }
  if (q.centroId) {
    cond.push('r.centro_id = ?');
    vals.push(q.centroId);
  }
  if (q.conductorId) {
    cond.push('r.conductor_id = ?');
    vals.push(q.conductorId);
  }
  if (q.fecha) {
    cond.push('(date(COALESCE(r.bloque_desde, r.creado_en)) = ?)');
    vals.push(q.fecha);
  }
  const { results } = await base(c)
    .prepare(
      `SELECT r.id, r.nombre, r.estado, r.centro_id, r.conductor_id, r.bloque_desde, r.bloque_hasta, r.creado_en,
              r.oferta_vence_en, u.nombre AS conductor, ce.nombre AS centro,
              (SELECT COUNT(*) FROM ruta_paradas rp WHERE rp.ruta_id = r.id) AS paradas,
              (SELECT COUNT(*) FROM ruta_paradas rp WHERE rp.ruta_id = r.id AND rp.estado IN ('entregada', 'fallida', 'omitida')) AS paradas_resueltas,
              (SELECT COUNT(*) FROM ruta_paquetes rq WHERE rq.ruta_id = r.id AND rq.excluido_en IS NULL) AS paquetes,
              (SELECT COUNT(*) FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
                WHERE rq.ruta_id = r.id AND rq.excluido_en IS NULL AND p.estado = 'entregado') AS entregados,
              (SELECT COUNT(*) FROM flex_incidencias i WHERE i.ruta_id = r.id) AS incidencias
         FROM rutas_flex r LEFT JOIN usuarios u ON u.id = r.conductor_id LEFT JOIN empresa_centros ce ON ce.id = r.centro_id
        WHERE ${cond.join(' AND ')} ORDER BY r.creado_en DESC LIMIT 100`,
    )
    .bind(...vals)
    .all<Record<string, unknown>>();
  return c.json({
    rutas: results.map((x) => ({
      id: x.id,
      nombre: x.nombre,
      estado: x.estado,
      centro: x.centro,
      centroId: x.centro_id,
      conductor: x.conductor,
      conductorId: x.conductor_id,
      bloqueDesde: x.bloque_desde,
      bloqueHasta: x.bloque_hasta,
      creadoEn: x.creado_en,
      ofertaVenceEn: x.oferta_vence_en,
      paradas: x.paradas,
      paradasResueltas: x.paradas_resueltas,
      paquetes: x.paquetes,
      entregados: x.entregados,
      incidencias: x.incidencias,
    })),
  });
});

export type { ActorFlex };
export { traducirError, eventoSuelto };
