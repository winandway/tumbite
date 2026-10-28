import { Hono } from 'hono';
import { z } from 'zod';
import {
  documentoNormal,
  documentoValido,
  esquemaCobroEntrega,
  telefonoInternacional,
  validarCobro,
  venceRetiro,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { actorDeEmpresa, conIdempotencia, exigirPermiso, sentenciaAuditoria } from './autorizacion';
import { avisarDestinatarios, despues } from './avisosFlex';
import { paisDeEmpresa } from './ubicacion';

/**
 * Divoox Flex · C-FLEX-RETIRO: retiro en un punto con plazo, como la «agencia» de MRW o la
 * «oficina» de Zoom (docs/investigaciones-rea/2026-10-28-flex-venezuela.md). El centro de la
 * empresa es el punto: cuando el paquete está ahí se avisa al destinatario, que tiene 5 días hábiles
 * para retirarlo con su cédula y el número de seguimiento (o un tercero autorizado). Si había cobro,
 * paga ahí. Si vence, se devuelve al remitente. Todos los países; la cédula se exige donde el perfil
 * del país la pide.
 */
export const flexRetiro = new Hono<{ Bindings: Env; Variables: Variables }>();

/** El estado del envío según sus paquetes (todos entregados → entregado; todos devueltos → devuelto). */
const ACTUALIZAR_ENVIO_SUELTO = `UPDATE envios SET estado = CASE
    WHEN NOT EXISTS (SELECT 1 FROM paquetes WHERE envio_id = envios.id AND estado <> 'entregado') THEN 'entregado'
    WHEN NOT EXISTS (SELECT 1 FROM paquetes WHERE envio_id = envios.id AND estado <> 'devuelto') THEN 'devuelto'
    ELSE estado END, actualizado_en = datetime('now')
  WHERE id = ?`;

type EnvioPunto = {
  id: string;
  empresa_id: string;
  entrega_tipo: string;
  punto_centro_id: string | null;
  destinatario_nombre: string;
  destinatario_telefono: string;
  destinatario_documento: string;
  retiro_vence: string | null;
  cobro_monto: number | null;
  cobro_moneda: string | null;
  cobro_estado: string;
  centro: string | null;
  centro_direccion: string | null;
  empresa: string;
};

async function envioPunto(db: D1Database, empresaId: string, envioId: string) {
  const e = await db
    .prepare(
      `SELECT e.*, c.nombre AS centro, c.direccion AS centro_direccion, em.nombre AS empresa
         FROM envios e JOIN empresas em ON em.id = e.empresa_id
         LEFT JOIN empresa_centros c ON c.id = e.punto_centro_id
        WHERE e.id = ? AND e.empresa_id = ?`,
    )
    .bind(envioId, empresaId)
    .first<EnvioPunto>();
  if (!e) throw new ErrorDatos('Ese envío no existe.', undefined, 404);
  if (e.entrega_tipo !== 'punto')
    throw new ErrorDatos('Este envío se entrega a domicilio, no en un punto.', undefined, 409);
  return e;
}

const paquetesDe = async (db: D1Database, envioId: string) =>
  (
    await db
      .prepare('SELECT id, estado, codigo_seguimiento FROM paquetes WHERE envio_id = ?')
      .bind(envioId)
      .all<{ id: string; estado: string; codigo_seguimiento: string }>()
  ).results;

/** Cambia los paquetes del envío de estado, con su evento de custodia, en el mismo lote. */
function mover(
  db: D1Database,
  e: { id: string; empresa_id: string },
  desde: readonly string[],
  hacia: string,
  actor: { actorId: string; actorTipo: string },
  clave: string,
  meta: Record<string, unknown>,
) {
  const desdeJson = JSON.stringify(desde);
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO paquete_eventos (paquete_id, empresa_id, tipo, actor_id, actor_tipo, idempotencia, metadatos_json)
         SELECT id, empresa_id, ?, ?, ?, ? || ':' || id, ? FROM paquetes
          WHERE envio_id = ? AND estado IN (SELECT value FROM json_each(?))`,
      )
      .bind(hacia, actor.actorId, actor.actorTipo, clave, JSON.stringify(meta), e.id, desdeJson),
    db
      .prepare(
        `UPDATE paquetes SET estado = ?, actualizado_en = datetime('now')
          WHERE envio_id = ? AND estado IN (SELECT value FROM json_each(?))`,
      )
      .bind(hacia, e.id, desdeJson),
  ];
}

function mensajeAviso(e: EnvioPunto, codigo: string, vence: string, idioma: 'es' | 'en') {
  const cobro =
    e.cobro_estado === 'pendiente' && e.cobro_monto
      ? idioma === 'es'
        ? ` Al retirarlo pagas ${(e.cobro_monto / 100).toFixed(2)} ${e.cobro_moneda}.`
        : ` You pay ${(e.cobro_monto / 100).toFixed(2)} ${e.cobro_moneda} when you pick it up.`
      : '';
  return idioma === 'es'
    ? `Hola, ${e.destinatario_nombre}. Tu paquete de ${e.empresa} ya está listo para retirar en ${e.centro ?? ''}${e.centro_direccion ? `, ${e.centro_direccion}` : ''}. Tienes hasta el ${vence}. Lleva tu cédula y el número ${codigo}.${cobro}`
    : `Hi ${e.destinatario_nombre}. Your package from ${e.empresa} is ready for pickup at ${e.centro ?? ''}${e.centro_direccion ? `, ${e.centro_direccion}` : ''}. You have until ${vence}. Bring your ID and the number ${codigo}.${cobro}`;
}

/**
 * El paquete ya está en el punto: queda disponible para retirar, con su plazo, y se prepara el
 * aviso para el destinatario (WhatsApp). Repetir no cambia el plazo.
 */
flexRetiro.post('/empresas/:id/envios/:envioId/retiro/disponible', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'paquetes.eventos');
  const db = base(c);
  const envioId = c.req.param('envioId');
  return conIdempotencia(c, actor, { envioId, accion: 'retiro-disponible' }, async () => {
    const e = await envioPunto(db, actor.empresaId, envioId);
    const paquetes = await paquetesDe(db, e.id);
    if (!paquetes.some((p) => ['creado', 'registrado_centro', 'preparado'].includes(p.estado)))
      throw new ErrorDatos('Este envío ya no está en el punto.', undefined, 409);
    const vence = e.retiro_vence ?? venceRetiro(new Date(Date.now() - 4 * 3600_000));
    await db.batch([
      ...mover(
        db,
        e,
        ['creado', 'preparado'],
        'registrado_centro',
        actor,
        `retiro-disponible:${e.id}`,
        { punto: e.punto_centro_id, vence },
      ),
      db
        .prepare(
          `UPDATE envios SET retiro_disponible_en = COALESCE(retiro_disponible_en, datetime('now')),
             retiro_vence = COALESCE(retiro_vence, ?), actualizado_en = datetime('now') WHERE id = ?`,
        )
        .bind(vence, e.id),
      sentenciaAuditoria(db, actor, 'retiro.disponible', e.id, { vence }),
    ]);
    // C-AVISO-PAQUETE: si el destinatario tiene la app, también le llega al celular (gratis).
    await despues(c, () => avisarDestinatarios(c.env, db, [e.id], 'listo_retiro'));
    const codigo = paquetes[0]?.codigo_seguimiento ?? '';
    const mensaje = mensajeAviso(e, codigo, vence, actor.idioma);
    const tel = telefonoInternacional(
      e.destinatario_telefono,
      await paisDeEmpresa(db, e.empresa_id),
    );
    return {
      estado: 200,
      datos: {
        vence,
        mensaje,
        whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}` : null,
      },
    };
  });
});

const esquemaRetirar = z.object({
  /** El número de seguimiento (DVX…) que trae quien retira. */
  codigo: z.string().trim().min(6).max(40),
  /** La cédula de quien retira. */
  documento: z.string().trim().max(20).default(''),
  /** Si retira otra persona con autorización del destinatario. */
  tercero: z
    .object({ nombre: z.string().trim().min(3).max(120), documento: z.string().trim().max(20) })
    .nullable()
    .optional(),
  cobro: esquemaCobroEntrega.nullable().optional(),
});

/**
 * Entregar en el mostrador. Exige el número de seguimiento y, donde el país pide documento, la
 * cédula del destinatario (o la del tercero autorizado, que queda anotado). Si el envío se cobra,
 * se registra el cobro, que ya queda en la caja de la empresa (recibido). Solo personas.
 */
flexRetiro.post('/empresas/:id/envios/:envioId/retiro/entregar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'devoluciones.recibir');
  if (actor.actorTipo !== 'usuario')
    throw new ErrorDatos('Una entrega en el mostrador la hace una persona.', undefined, 403);
  const d = await leerCuerpo(c, esquemaRetirar);
  const db = base(c);
  const envioId = c.req.param('envioId');
  return conIdempotencia(c, actor, { envioId, accion: 'retiro-entregar' }, async () => {
    const e = await envioPunto(db, actor.empresaId, envioId);
    const paquetes = await paquetesDe(db, e.id);
    const codigo = d.codigo.toUpperCase();
    if (!paquetes.some((p) => p.codigo_seguimiento === codigo))
      throw new ErrorDatos('Ese número de seguimiento no es de este envío.', 'codigo', 422);
    if (!e.retiro_vence || !paquetes.some((p) => p.estado === 'registrado_centro'))
      throw new ErrorDatos('Este paquete no está disponible para retirar.', undefined, 409);
    const pais = await paisDeEmpresa(db, e.empresa_id);
    const quien = d.tercero?.documento || d.documento;
    if (pais === 'VE') {
      if (!documentoValido(pais, quien))
        throw new ErrorDatos(
          'Escribe la cédula de quien retira (por ejemplo V-12345678).',
          'documento',
          422,
        );
      if (
        !d.tercero &&
        e.destinatario_documento &&
        documentoNormal(e.destinatario_documento) !== documentoNormal(d.documento)
      )
        throw new ErrorDatos(
          'La cédula no es la del destinatario. Si retira otra persona, márcalo como tercero autorizado.',
          'documento',
          422,
        );
    }
    const sentencias: D1PreparedStatement[] = [];
    if (e.cobro_estado === 'pendiente' && e.cobro_monto) {
      if (!d.cobro)
        throw new ErrorDatos('Este envío se cobra al retirar: registra el cobro.', 'cobro', 422);
      const v = validarCobro({ monto: e.cobro_monto, moneda: e.cobro_moneda ?? 'USD' }, d.cobro);
      if (!v.ok)
        throw new ErrorDatos(
          v.error === 'monto_incompleto'
            ? 'El monto cobrado es menor que lo que hay que cobrar.'
            : v.error === 'falta_referencia'
              ? 'Escribe la referencia del pago (los últimos números del comprobante).'
              : 'Ese método no va en esa moneda (por ejemplo, Zelle es en dólares y pago móvil en bolívares).',
          'cobro',
          422,
        );
      // Pagó en el mostrador de la empresa: el dinero ya está en su caja (recibido).
      sentencias.push(
        db
          .prepare(
            `UPDATE envios SET cobro_estado = 'liquidado', cobro_metodo = ?, cobro_monto_recibido = ?,
               cobro_moneda_recibida = ?, cobro_referencia = ?, cobrado_en = datetime('now'),
               liquidado_en = datetime('now'), liquidado_por = ?
             WHERE id = ? AND cobro_estado = 'pendiente'`,
          )
          .bind(
            d.cobro.metodo,
            d.cobro.monto,
            d.cobro.moneda,
            d.cobro.referencia || null,
            actor.actorId,
            e.id,
          ),
      );
    }
    sentencias.push(
      ...mover(db, e, ['registrado_centro'], 'entregado', actor, `retiro-entregar:${e.id}`, {
        punto: e.punto_centro_id,
        recibio: d.tercero?.nombre ?? e.destinatario_nombre,
        documento: quien ? `••${documentoNormal(quien).slice(-4)}` : null,
        tercero: Boolean(d.tercero),
        cobro: d.cobro
          ? { metodo: d.cobro.metodo, monto: d.cobro.monto, moneda: d.cobro.moneda }
          : null,
      }),
      db
        .prepare(
          "UPDATE envios SET recibio_documento = ?, recibio_relacion = ?, actualizado_en = datetime('now') WHERE id = ?",
        )
        .bind(quien, d.tercero ? 'tercero_autorizado' : 'titular', e.id),
      db.prepare(ACTUALIZAR_ENVIO_SUELTO).bind(e.id),
      sentenciaAuditoria(db, actor, 'retiro.entregar', e.id, { tercero: Boolean(d.tercero) }),
    );
    await db.batch(sentencias);
    await despues(c, () => avisarDestinatarios(c.env, db, [e.id], 'entregado'));
    return { estado: 200, datos: { entregado: true } };
  });
});

/** Venció el plazo y nadie lo retiró: vuelve al remitente (queda «devuelto»). */
flexRetiro.post('/empresas/:id/envios/:envioId/retiro/devolver', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'devoluciones.recibir');
  const db = base(c);
  const envioId = c.req.param('envioId');
  return conIdempotencia(c, actor, { envioId, accion: 'retiro-devolver' }, async () => {
    const e = await envioPunto(db, actor.empresaId, envioId);
    const hoy = new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);
    if (!e.retiro_vence || e.retiro_vence >= hoy)
      throw new ErrorDatos(
        `Todavía está dentro del plazo para retirar (hasta el ${e.retiro_vence ?? '—'}).`,
        undefined,
        409,
      );
    await db.batch([
      ...mover(db, e, ['registrado_centro'], 'devuelto', actor, `retiro-devolver:${e.id}`, {
        motivo: 'plazo_vencido',
        vence: e.retiro_vence,
      }),
      db.prepare(ACTUALIZAR_ENVIO_SUELTO).bind(e.id),
      sentenciaAuditoria(db, actor, 'retiro.devolver', e.id, { vence: e.retiro_vence }),
    ]);
    return { estado: 200, datos: { devuelto: true } };
  });
});
