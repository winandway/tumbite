import { Hono } from 'hono';
import {
  type PaqueteEnvio,
  VIAJE_PROGRAMADO,
  cancelacionProgramadaGratis,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { notificar } from '../notificaciones';
import { cambiarEstadoViaje, repartirOperaciones } from '../operaciones';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';
import { crearViajeDeCotizacion, pinNuevo } from '../viajeCrear';
import { anularAutorizacionProgramada, autorizarViajeProgramado } from '../viajesCobro';
import { pinParaViajeNuevo } from './ajustesViaje';
import { estadoServicioEnZona } from './servicios';
import { avisarDestinatario } from './viajesPasajero';
import type { TareaReloj } from '../reloj';

/**
 * C-VIAJE-PROGRAMADO (14 nov 2026, todos los países): «Mis viajes programados» del pasajero,
 * cancelar una reserva y la tarea del reloj que, unos minutos antes de la hora, hace nacer el viaje
 * con el precio reservado y lo manda a buscar conductor con las reglas normales de oferta. Copiado
 * de Uber Reserve [DOC] y del pedido programado de Comida (C-PEDIDO-PROGRAMADO).
 */
export const viajesProgramados = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaProgramado = {
  id: string;
  cliente_id: string;
  cotizacion_id: string;
  servicio_id: string;
  zona_id: string;
  programado_para: string;
  metodo_pago: string;
  metodo_pago_ref: string | null;
  paquete_json: string | null;
  estado: string;
  total: number;
  moneda: string;
  tarifa_json: string | null;
  categoria: string | null;
  origen_direccion: string;
  destino_direccion: string;
  zona_horaria: string | null;
};

const COLUMNAS = `p.id, p.cliente_id, p.cotizacion_id, p.servicio_id, p.zona_id, p.programado_para, p.metodo_pago,
  p.metodo_pago_ref, p.paquete_json, p.estado, q.total, q.moneda, q.tarifa_json, q.categoria,
  q.origen_direccion, q.destino_direccion, z.zona_horaria`;

const FROM = `FROM viajes_programados p JOIN cotizaciones_viaje q ON q.id = p.cotizacion_id
  LEFT JOIN zonas z ON z.id = p.zona_id`;

/** «2026-11-14 15:30:00» (UTC) → Date. */
const deSql = (s: string) => new Date(`${s.replace(' ', 'T')}Z`);

function horaLocal(sql: string, zona: string | null, idioma: string) {
  try {
    return new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: zona ?? 'UTC',
    }).format(deSql(sql));
  } catch {
    return sql.slice(11, 16);
  }
}

function publico(f: FilaProgramado) {
  const hora = deSql(f.programado_para);
  return {
    id: f.id,
    servicio: f.servicio_id,
    categoria: f.categoria,
    programadoPara: hora.toISOString(),
    cancelacionGratisHasta: new Date(
      hora.getTime() - VIAJE_PROGRAMADO.cancelacionGratisMin * 60_000,
    ).toISOString(),
    total: Number(f.total),
    moneda: f.moneda,
    metodoPago: f.metodo_pago,
    origen: f.origen_direccion,
    destino: f.destino_direccion,
    estado: f.estado,
  };
}

/** Las reservas pendientes del pasajero, de la más próxima a la más lejana. */
viajesProgramados.get('/viajes/programados', async (c) => {
  const u = exigir(c, 'cliente');
  const { results } = await base(c)
    .prepare(
      `SELECT ${COLUMNAS} ${FROM} WHERE p.cliente_id = ? AND p.estado = 'programado'
        ORDER BY p.programado_para LIMIT 20`,
    )
    .bind(u.id)
    .all<FilaProgramado>();
  return c.json({ programados: results.map(publico) });
});

/**
 * Cancelar una reserva: gratis hasta 60 minutos antes; después, el cargo de cancelación de la
 * tarifa de la ciudad queda como deuda que se suma al próximo viaje (como Uber Reserve). Repetir la
 * cancelación devuelve lo mismo.
 */
viajesProgramados.post('/viajes/programados/:id/cancelar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await db
    .prepare(`SELECT ${COLUMNAS} ${FROM} WHERE p.id = ? AND p.cliente_id = ?`)
    .bind(c.req.param('id'), u.id)
    .first<FilaProgramado>();
  if (!f) throw new ErrorDatos('Esa reserva no existe.', undefined, 404);
  if (f.estado === 'cancelado') return c.json({ ok: true, cargo: 0 });
  if (f.estado !== 'programado')
    throw new ErrorDatos(
      'Tu viaje ya está buscando conductor: cancélalo desde la pantalla del viaje.',
      undefined,
      409,
    );
  const gratis = cancelacionProgramadaGratis(deSql(f.programado_para));
  const tarifa = f.tarifa_json ? (JSON.parse(f.tarifa_json) as { cargoCancelacion?: number }) : {};
  const cargo = gratis ? 0 : Math.max(0, Math.round(Number(tarifa.cargoCancelacion ?? 0)));
  const cancelar = db
    .prepare(
      `UPDATE viajes_programados SET estado = 'cancelado', motivo = 'cancelado_por_pasajero', resuelto_en = datetime('now')
        WHERE id = ? AND estado = 'programado'`,
    )
    .bind(f.id);
  let cancelada: boolean;
  if (cargo > 0) {
    // Todo en un lote: la reserva cancelada, su operación (nace ya cancelada, con el precio
    // reservado) y la deuda. Un corte a la mitad no deja la cancelación sin su cargo.
    cancelada = await crearViajeDeCotizacion(db, {
      op: f.id,
      cotizacionId: f.cotizacion_id,
      clienteId: u.id,
      tipo: f.servicio_id === 'envios' ? 'envio_paquete' : 'viaje_pasajero',
      estado: 'cancelado',
      metodoPago: f.metodo_pago,
      paquete: null,
      pinEntrega: pinNuevo(),
      exigirSinActivo: false,
      programadoPara: f.programado_para,
      reserva: {
        estado: 'cancelado',
        cambio: cancelar,
        despues: [
          db
            .prepare(
              `INSERT OR IGNORE INTO deudas_pasajero (id, cliente_id, operacion_id, motivo, monto, moneda)
               SELECT ?, ?, ?, 'cancelacion', ?, ? WHERE EXISTS (
                 SELECT 1 FROM viajes_programados WHERE id = ?3 AND estado = 'cancelado')
                 AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?3)`,
            )
            .bind(nuevoId(), u.id, f.id, cargo, f.moneda),
        ],
      },
    });
  } else {
    cancelada = Boolean((await cancelar.run()).meta.changes);
  }
  if (!cancelada) throw new ErrorDatos('La reserva cambió. Actualiza la pantalla.', undefined, 409);
  return c.json({ ok: true, cargo });
});

/** Los textos de los avisos al pasajero (español e inglés). */
const AVISO = {
  buscando: (i: string, hora: string, envio: boolean) =>
    i === 'en'
      ? {
          titulo: envio ? 'Your scheduled delivery' : 'Your scheduled ride',
          cuerpo: `It’s almost time (${hora}). We’re finding your driver now.`,
        }
      : {
          titulo: envio ? 'Tu envío programado' : 'Tu viaje programado',
          cuerpo: `Ya casi es la hora (${hora}). Estamos buscando a tu conductor.`,
        },
  fallido: (i: string, hora: string) =>
    i === 'en'
      ? {
          titulo: 'We couldn’t start your scheduled ride',
          cuerpo: `Your ride for ${hora} was canceled at no charge. You can book again in the app.`,
        }
      : {
          titulo: 'No pudimos iniciar tu viaje programado',
          cuerpo: `Tu viaje de ${hora} se canceló sin cargo. Puedes pedir otro en la app.`,
        },
};

async function idiomaDe(db: D1Database, usuarioId: string) {
  const f = await db
    .prepare('SELECT idioma, nombre FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ idioma: string | null; nombre: string | null }>();
  return { idioma: f?.idioma === 'en' ? 'en' : 'es', nombre: f?.nombre ?? '' };
}

async function avisar(
  env: Env,
  db: D1Database,
  usuarioId: string,
  aviso: { titulo: string; cuerpo: string },
  id: string,
) {
  await notificar(env, db, usuarioId, { ...aviso, datos: { tipo: 'viaje', viajeId: id } }).catch(
    (e: unknown) => console.error('viajes programados: aviso', id, e),
  );
}

/** Lo que el reloj puede activar en una vuelta (cada una escribe unas 8 filas). */
export const PROGRAMADOS_POR_VUELTA = 20;

/** Activa UNA reserva. Devuelve true si esta vuelta hizo nacer su viaje. */
async function activarUna(env: Env, db: D1Database, f: FilaProgramado): Promise<boolean> {
  const { idioma, nombre } = await idiomaDe(db, f.cliente_id);
  const hora = horaLocal(f.programado_para, f.zona_horaria, idioma);
  const fallar = async (motivo: string) => {
    const r = await db
      .prepare(
        `UPDATE viajes_programados SET estado = 'fallido', motivo = ?, resuelto_en = datetime('now')
          WHERE id = ? AND estado = 'programado'`,
      )
      .bind(motivo, f.id)
      .run();
    if (r.meta.changes) await avisar(env, db, f.cliente_id, AVISO.fallido(idioma, hora), f.id);
  };
  if ((await estadoServicioEnZona(db, f.servicio_id, f.zona_id, f.cliente_id)) !== 'disponible') {
    await fallar('servicio_cerrado');
    return false;
  }
  const envio = f.servicio_id === 'envios';
  const paquete = f.paquete_json ? (JSON.parse(f.paquete_json) as PaqueteEnvio) : null;
  const pinEntrega = pinNuevo();
  const tarjeta = f.metodo_pago === 'tarjeta';
  // La reserva se toma y el viaje nace en el MISMO lote: dos vueltas a la vez no hacen nacer dos
  // viajes, y un corte a la mitad no deja la reserva «activada» sin viaje.
  const tomada = await crearViajeDeCotizacion(db, {
    op: f.id,
    cotizacionId: f.cotizacion_id,
    clienteId: f.cliente_id,
    tipo: envio ? 'envio_paquete' : 'viaje_pasajero',
    estado: tarjeta ? 'pago_pendiente' : 'buscando',
    metodoPago: f.metodo_pago,
    paquete,
    pinEntrega,
    exigirSinActivo: false,
    programadoPara: f.programado_para,
    reserva: {
      estado: 'activado',
      cambio: db
        .prepare(
          `UPDATE viajes_programados SET estado = 'activado', resuelto_en = datetime('now')
            WHERE id = ? AND estado = 'programado'`,
        )
        .bind(f.id),
    },
  });
  if (!tomada) return false;
  if (envio || !(await pinParaViajeNuevo(db, f.servicio_id, f.zona_id)))
    await db.prepare('UPDATE viajes SET pin_requerido = 0 WHERE operacion_id = ?').bind(f.id).run();
  if (tarjeta) {
    const cliente = await db
      .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
      .bind(f.cliente_id)
      .first<{ stripe_cliente: string | null }>();
    const cobro = {
      operacionId: f.id,
      cliente: cliente?.stripe_cliente ?? '',
      pm: f.metodo_pago_ref ?? '',
      monto: Number(f.total),
      moneda: f.moneda,
    };
    try {
      if (!cobro.cliente || !cobro.pm) throw new Error('sin tarjeta guardada');
      await autorizarViajeProgramado(env, db, cobro);
    } catch (e) {
      console.error('viajes programados: la tarjeta no se autorizó', f.id, e);
      // Si la llamada se cortó pero Stripe sí autorizó, la retención se suelta (nunca se queda
      // el dinero del pasajero apartado por un viaje que no va a existir).
      if (cobro.cliente && cobro.pm)
        await anularAutorizacionProgramada(env, db, cobro).catch((x: unknown) =>
          console.error('viajes programados: no se pudo soltar la retención', f.id, x),
        );
      for (const desde of ['pago_pendiente', 'buscando'] as const)
        await cambiarEstadoViaje(db, {
          operacionId: f.id,
          desde,
          hacia: 'cancelado',
          actor: 'sistema',
          actorId: null,
          clave:
            desde === 'pago_pendiente'
              ? `programado-sin-pago:${f.id}`
              : `programado-sin-pago-buscando:${f.id}`,
          motivo: 'sin_pago',
        });
      await avisar(env, db, f.cliente_id, AVISO.fallido(idioma, hora), f.id);
      return true;
    }
  }
  if (envio && paquete)
    await avisarDestinatario(
      env,
      db,
      (env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, ''),
      f.id,
      paquete,
      pinEntrega,
      nombre,
    ).catch((e: unknown) => console.error('viajes programados: aviso a quien recibe', e));
  // El recordatorio: ya casi es la hora y se está buscando conductor.
  await avisar(env, db, f.cliente_id, AVISO.buscando(idioma, hora, envio), f.id);
  return true;
}

/**
 * La tarea del reloj. Lee por el índice parcial solo las reservas pendientes cuya búsqueda ya
 * empieza (N minutos antes de la hora, por ciudad; 15 por defecto). Sin ninguna, no escribe nada.
 */
export async function activarViajesProgramados(env: Env, db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS} ${FROM}
         LEFT JOIN ajustes_viaje_zona a ON a.zona_id = p.zona_id AND a.servicio_id = p.servicio_id
        WHERE p.estado = 'programado' AND p.programado_para <= datetime('now', '+${VIAJE_PROGRAMADO.despachoAntesMaximo} minutes')
          AND p.programado_para <= datetime('now', '+' || COALESCE(a.programado_antes_min, ${VIAJE_PROGRAMADO.despachoAntesMin}) || ' minutes')
        ORDER BY p.programado_para LIMIT ${PROGRAMADOS_POR_VUELTA}`,
    )
    .all<FilaProgramado>();
  let activados = 0;
  let errores = 0;
  for (const f of results) {
    // Cada reserva en su propio intento: si una falla, las que vienen detrás siguen su camino y
    // ella queda «programado» para la vuelta siguiente (o se cierra avisando si ya no hay viaje).
    try {
      if (await activarUna(env, db, f)) activados++;
    } catch (e) {
      errores++;
      console.error('viajes programados: no se pudo activar la reserva', f.id, e);
    }
  }
  if (activados) await repartirOperaciones(env, db);
  return { activados, errores };
}

/**
 * La tarea en TAREAS_RELOJ. Crítica: hace nacer viajes con dinero. Una vuelta sin reservas que
 * venzan solo lee el índice; con reservas, unas 8 filas por cada una.
 */
export const TAREA_VIAJES_PROGRAMADOS: TareaReloj = {
  nombre: 'viajes_programados',
  critica: true,
  escriturasEsperadas: PROGRAMADOS_POR_VUELTA * 8,
  correr: (env, db) => activarViajesProgramados(env, db),
};
