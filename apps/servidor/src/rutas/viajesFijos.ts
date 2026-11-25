import { Hono } from 'hono';
import { exigirPuntoEnElPais } from '../destinoEnElPais';
import { z } from 'zod';
import {
  CONFIANZA,
  RUTINA,
  type DatosRutina,
  type Salida,
  cancelacionProgramadaGratis,
  enPausa,
  esquemaPinMenor,
  esquemaRutina,
  fechaLocalRutina,
  perfilPasajeros,
  proximasSalidas,
  siguienteSalida,
  telefonoCanonico,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { notificar } from '../notificaciones';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { fechaSql, programarViaje, tarjetaGuardada } from '../viajeCrear';
import { accesoDe, filtroAlcance, servicioOperacionSql } from '../accesoInterno';
import type { TareaReloj } from '../reloj';
import { estadoServicioEnZona } from './servicios';
import { zonaPara } from './zonas';
import { cotizarParaCliente } from './viajesPasajero';

/**
 * C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026, todos los países). Nacen del piloto de El
 * Vigía y Tucaní: mototaxistas con clientes fijos (la niña a la escuela cada mañana, el trabajo a la
 * misma hora, «siempre el mismo conductor»). Ficha con las fuentes:
 * docs/investigaciones-rea/2026-11-16-conductor-de-confianza-y-viajes-fijos.md.
 *
 * - Conductor de confianza (hasta 3): se marca desde un viaje terminado con él. Al pedir, se le
 *   ofrece primero por un minuto; si no lo toma, pasa a los demás (operaciones.ts, turnoDeConfianza).
 * - Viajes fijos: días de la semana, ida y vuelta a la hora local de la ciudad. Cada salida nace como
 *   un viaje programado 24 horas antes (precio fijo, cancelación gratis hasta 60 minutos antes). Se
 *   pausan (con o sin fecha), se salta un día y se borran sin perder la historia.
 * - Menores: el viaje lleva SIEMPRE el PIN fijo que el responsable le enseña al menor, solo va a un
 *   vehículo que acepta menores y el responsable recibe un aviso al aceptar, al llegar, al recogerlo
 *   y al dejarlo.
 * - El conductor ve sus clientes fijos y su agenda, recibe el aviso previo y puede decir «no puedo».
 * - El equipo lo ve en el monitoreo (GET /admin/viajes-fijos).
 */
export const viajesFijos = new Hono<{ Bindings: Env; Variables: Variables }>();

const nombrePila = (n: string | null | undefined) => String(n ?? '').split(' ')[0] ?? '';
const deSql = (s: string) => new Date(`${s.replace(' ', 'T')}Z`);

function horaLocal(fecha: Date, tz: string | null, idioma: string, conDia = true) {
  try {
    return new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es', {
      ...(conDia ? { weekday: 'short' as const } : {}),
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz ?? 'UTC',
    }).format(fecha);
  } catch {
    return fecha.toISOString().slice(11, 16);
  }
}

// ======================================================================= conductor de confianza

/** ¿Tuvieron un viaje terminado juntos? Es la condición para marcarlo de confianza. */
async function viajaronJuntos(db: D1Database, clienteId: string, conductorId: string) {
  return Boolean(
    await db
      .prepare(
        `SELECT 1 FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
          WHERE o.cliente_id = ? AND o.conductor_id = ? AND v.estado = 'terminado' LIMIT 1`,
      )
      .bind(clienteId, conductorId)
      .first(),
  );
}

async function marcarConfianza(
  env: Env,
  db: D1Database,
  cliente: { id: string; nombre: string },
  conductorId: string,
) {
  if (!(await viajaronJuntos(db, cliente.id, conductorId)))
    throw new ErrorDatos(
      'Solo puedes elegir de confianza a un conductor con quien ya viajaste.',
      undefined,
      409,
    );
  const bloqueo = await db
    .prepare(
      `SELECT 1 FROM bloqueos_usuario WHERE (usuario_id = ?1 AND bloqueado_id = ?2)
          OR (usuario_id = ?2 AND bloqueado_id = ?1) LIMIT 1`,
    )
    .bind(cliente.id, conductorId)
    .first();
  if (bloqueo) throw new ErrorDatos('No puedes elegir a este conductor.', undefined, 409);
  // El tope va en la MISMA sentencia: dos toques a la vez no dejan 4.
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO conductores_confianza (cliente_id, conductor_id)
       SELECT ?1, ?2 WHERE (SELECT COUNT(*) FROM conductores_confianza WHERE cliente_id = ?1) < ?3`,
    )
    .bind(cliente.id, conductorId, CONFIANZA.maxConductores)
    .run();
  if (!r.meta.changes) {
    const ya = await db
      .prepare('SELECT 1 FROM conductores_confianza WHERE cliente_id = ? AND conductor_id = ?')
      .bind(cliente.id, conductorId)
      .first();
    if (ya) return;
    throw new ErrorDatos(
      `Puedes tener hasta ${CONFIANZA.maxConductores} conductores de confianza. Quita uno primero.`,
      undefined,
      409,
    );
  }
  const quien = nombrePila(cliente.nombre);
  await notificar(env, db, { id: conductorId, app: 'repartidor' }, (i) => ({
    ...(i === 'en'
      ? {
          titulo: 'You’re a trusted driver',
          cuerpo: `${quien} added you as their trusted driver. Their rides will reach you first.`,
        }
      : {
          titulo: 'Eres conductor de confianza',
          cuerpo: `${quien} te eligió como su conductor de confianza. Sus viajes te llegarán primero.`,
        }),
    datos: { tipo: 'clientes_fijos' },
  })).catch((e: unknown) => console.error('confianza: aviso al conductor', e));
}

/** Quitar a un conductor de confianza: sus viajes fijos y reservas pendientes pasan a cualquiera. */
async function quitarConfianza(db: D1Database, clienteId: string, conductorId: string) {
  await db.batch([
    db
      .prepare('DELETE FROM conductores_confianza WHERE cliente_id = ? AND conductor_id = ?')
      .bind(clienteId, conductorId),
    db
      .prepare(
        `UPDATE rutinas_viaje SET conductor_id = NULL, actualizado_en = datetime('now')
          WHERE cliente_id = ? AND conductor_id = ?`,
      )
      .bind(clienteId, conductorId),
    db
      .prepare(
        `UPDATE viajes_programados SET conductor_preferido_id = NULL
          WHERE cliente_id = ? AND conductor_preferido_id = ? AND estado = 'programado'`,
      )
      .bind(clienteId, conductorId),
  ]);
}

/** Los conductores de confianza del cliente, con lo que la app muestra. */
viajesFijos.get('/confianza', async (c) => {
  const u = exigir(c, 'cliente');
  const { results } = await base(c)
    .prepare(
      `SELECT k.conductor_id, k.creado_en, us.nombre, h.tipo, h.marca, h.modelo, h.color, h.placa,
              h.lleva_menores,
              (SELECT 1 FROM kyc ky WHERE ky.usuario_id = k.conductor_id AND ky.estado = 'aprobado'
                 AND ky.selfie_miniatura IS NOT NULL) AS foto,
              (d.ubicacion_en > datetime('now', '-10 minutes') AND COALESCE(d.pausado, 0) = 0) AS conectado,
              (SELECT COUNT(*) FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
                WHERE o.cliente_id = k.cliente_id AND o.conductor_id = k.conductor_id AND v.estado = 'terminado') AS viajes,
              (SELECT group_concat(DISTINCT e.servicio_id) FROM conductores_elegibles e WHERE e.conductor_id = k.conductor_id) AS servicios
         FROM conductores_confianza k JOIN usuarios us ON us.id = k.conductor_id
         LEFT JOIN repartidores d ON d.usuario_id = k.conductor_id
         LEFT JOIN vehiculos h ON h.id = d.vehiculo_activo_id
        WHERE k.cliente_id = ? ORDER BY k.creado_en`,
    )
    .bind(u.id)
    .all<Record<string, unknown>>();
  return c.json({
    max: CONFIANZA.maxConductores,
    segundos: CONFIANZA.segundosOfertaExclusiva,
    conductores: results.map((f) => ({
      id: String(f.conductor_id),
      nombre: nombrePila(f.nombre as string),
      foto: f.foto === 1,
      conectado: f.conectado === 1,
      viajes: Number(f.viajes ?? 0),
      aceptaMenores: f.lleva_menores === 1,
      servicios: String(f.servicios ?? '')
        .split(',')
        .filter(Boolean),
      vehiculo: f.tipo
        ? {
            tipo: f.tipo,
            marca: f.marca,
            modelo: f.modelo,
            color: f.color,
            placa: f.placa,
          }
        : null,
      desde: String(f.creado_en),
    })),
  });
});

/**
 * La foto del conductor de confianza: solo la miniatura aprobada (C-FOTO-CONDUCTOR-MINIATURA), y
 * solo para un cliente que lo tiene de confianza.
 */
viajesFijos.get('/confianza/:conductorId/foto', async (c) => {
  const u = exigir(c, 'cliente');
  const f = await base(c)
    .prepare(
      `SELECT ky.selfie_miniatura FROM conductores_confianza k
         JOIN kyc ky ON ky.usuario_id = k.conductor_id AND ky.estado = 'aprobado'
        WHERE k.cliente_id = ? AND k.conductor_id = ?`,
    )
    .bind(u.id, c.req.param('conductorId'))
    .first<{ selfie_miniatura: string | null }>();
  const obj =
    f?.selfie_miniatura && c.env.BUCKET ? await c.env.BUCKET.get(f.selfie_miniatura) : null;
  if (!obj) throw new ErrorDatos('No hay foto para mostrar.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});

/** Marcar de confianza al conductor de un viaje terminado (desde «Mis viajes» o al calificar). */
viajesFijos.put('/viajes/:id/confianza', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const op = await db
    .prepare('SELECT conductor_id FROM operaciones WHERE id = ? AND cliente_id = ?')
    .bind(c.req.param('id'), u.id)
    .first<{ conductor_id: string | null }>();
  if (!op?.conductor_id) throw new ErrorDatos('Ese viaje no tiene conductor.', undefined, 404);
  await marcarConfianza(c.env, db, u, op.conductor_id);
  return c.json({ ok: true, conductorId: op.conductor_id });
});

viajesFijos.delete('/viajes/:id/confianza', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const op = await db
    .prepare('SELECT conductor_id FROM operaciones WHERE id = ? AND cliente_id = ?')
    .bind(c.req.param('id'), u.id)
    .first<{ conductor_id: string | null }>();
  if (op?.conductor_id) await quitarConfianza(db, u.id, op.conductor_id);
  return c.json({ ok: true });
});

viajesFijos.delete('/confianza/:conductorId', async (c) => {
  const u = exigir(c, 'cliente');
  await quitarConfianza(base(c), u.id, c.req.param('conductorId'));
  return c.json({ ok: true });
});

/**
 * Al pedir: a cuál conductor de confianza se le ofrece primero. `elegido` = el que eligió la persona
 * (tiene que ser uno de los suyos); sin elegir, el más cercano de los suyos que está conectado para
 * ese servicio y esa ciudad; «ninguno», nadie. Lee por la llave del cliente (3 filas como mucho).
 */
export async function conductorDeConfianzaParaPedir(
  db: D1Database,
  clienteId: string,
  op: { servicioId: string; zonaId: string; lat: number; lng: number },
  elegido: string | undefined,
): Promise<string | null> {
  if (elegido === 'ninguno') return null;
  // Programado sin elegir: el primero de los suyos (a esa hora no se sabe quién estará cerca).
  const programado = elegido === 'auto-programado';
  if (programado) elegido = undefined;
  const { results } = await db
    .prepare(
      `SELECT k.conductor_id,
              (SELECT (e.lat - ?3) * (e.lat - ?3) + (e.lng - ?4) * (e.lng - ?4) FROM conductores_elegibles e
                WHERE e.conductor_id = k.conductor_id AND e.servicio_id = ?1 AND e.zona_id = ?2
                  AND e.lat IS NOT NULL AND e.ubicacion_en > datetime('now', '-10 minutes')) AS cerca,
              EXISTS (SELECT 1 FROM conductores_elegibles e WHERE e.conductor_id = k.conductor_id
                  AND e.servicio_id = ?1 AND e.zona_id = ?2) AS sirve
         FROM conductores_confianza k WHERE k.cliente_id = ?5 ORDER BY k.creado_en`,
    )
    .bind(op.servicioId, op.zonaId, op.lat, op.lng, clienteId)
    .all<{ conductor_id: string; cerca: number | null; sirve: number }>();
  if (elegido) {
    if (!results.some((r) => r.conductor_id === elegido))
      throw new ErrorDatos('Ese conductor ya no está entre los tuyos.', 'confianza', 409);
    return elegido;
  }
  if (programado) return results.find((r) => r.sirve === 1)?.conductor_id ?? null;
  const conectados = results
    .filter((r) => r.cerca != null)
    .sort((a, b) => Number(a.cerca) - Number(b.cerca));
  return conectados[0]?.conductor_id ?? null;
}

// ======================================================================= viajes fijos (cliente)

type FilaRutina = {
  id: string;
  cliente_id: string;
  nombre: string;
  servicio_id: string;
  zona_id: string;
  categoria: string;
  origen_lat: number;
  origen_lng: number;
  origen_direccion: string;
  destino_lat: number;
  destino_lng: number;
  destino_direccion: string;
  dias: string;
  hora_ida: string;
  hora_vuelta: string | null;
  metodo_pago: string;
  conductor_id: string | null;
  menor_nombre: string | null;
  pin_menor: string | null;
  paquete_json: string | null;
  estado: string;
  pausada_hasta: string | null;
  proxima_revision_en: string | null;
  creado_en: string;
  zona_horaria: string | null;
  pais: string | null;
  conductor_nombre?: string | null;
  cliente_nombre?: string | null;
};

const SELECT_RUTINA = `SELECT r.*, z.zona_horaria, z.pais, cu.nombre AS conductor_nombre, cl.nombre AS cliente_nombre
  FROM rutinas_viaje r JOIN zonas z ON z.id = r.zona_id
  LEFT JOIN usuarios cu ON cu.id = r.conductor_id LEFT JOIN usuarios cl ON cl.id = r.cliente_id`;

const diasDe = (s: string) =>
  s
    .split(',')
    .map(Number)
    .filter((n) => n >= 1 && n <= 7);

function reglas(f: FilaRutina) {
  return { dias: diasDe(f.dias), horaIda: f.hora_ida, horaVuelta: f.hora_vuelta };
}

/** Las salidas creadas (las próximas 24 horas) y saltadas de los próximos días, por rutina. */
async function salidasDe(db: D1Database, ids: string[]) {
  const mapa = new Map<string, Record<string, unknown>[]>();
  if (!ids.length) return mapa;
  const { results } = await db
    .prepare(
      `SELECT s.rutina_id, s.fecha, s.sentido, s.hora, s.estado, s.motivo, s.conductor_no_puede_en,
              p.estado AS reserva, v.estado AS viaje
         FROM rutina_salidas s LEFT JOIN viajes_programados p ON p.id = s.programado_id
         LEFT JOIN viajes v ON v.operacion_id = s.programado_id
        WHERE s.rutina_id IN (${ids.map(() => '?').join(',')}) AND s.hora >= datetime('now', '-12 hours')
        ORDER BY s.hora`,
    )
    .bind(...ids)
    .all<Record<string, unknown>>();
  for (const f of results) {
    const k = String(f.rutina_id);
    mapa.set(k, [...(mapa.get(k) ?? []), f]);
  }
  return mapa;
}

function rutinaPublica(f: FilaRutina, salidas: Record<string, unknown>[], dueno: boolean) {
  const tz = f.zona_horaria ?? 'UTC';
  const ahora = new Date();
  const proximas = proximasSalidas(reglas(f), tz, ahora, new Date(ahora.getTime() + 8 * 86_400_000))
    .filter((s) => !enPausa(f.estado, f.pausada_hasta, s.fecha))
    .filter(
      (s) =>
        !salidas.some(
          (x) => x.fecha === s.fecha && x.sentido === s.sentido && x.estado !== 'creada',
        ),
    )
    .slice(0, 4);
  return {
    id: f.id,
    nombre: f.nombre,
    servicio: f.servicio_id,
    categoria: f.categoria,
    origen: { direccion: f.origen_direccion, lat: f.origen_lat, lng: f.origen_lng },
    destino: { direccion: f.destino_direccion, lat: f.destino_lat, lng: f.destino_lng },
    dias: diasDe(f.dias),
    horaIda: f.hora_ida,
    horaVuelta: f.hora_vuelta,
    metodoPago: f.metodo_pago,
    zonaHoraria: tz,
    estado: f.estado,
    pausadaHasta: f.pausada_hasta,
    conductor: f.conductor_id
      ? { id: f.conductor_id, nombre: nombrePila(f.conductor_nombre) }
      : null,
    // El PIN del menor lo ve solo el responsable (dueño de la cuenta).
    menor: f.menor_nombre ? { nombre: f.menor_nombre, pin: dueno ? f.pin_menor : null } : null,
    paquete: dueno && f.paquete_json ? (JSON.parse(f.paquete_json) as unknown) : null,
    proximas: proximas.map((s) => ({
      fecha: s.fecha,
      sentido: s.sentido,
      hora: s.hora.toISOString(),
    })),
    salidas: salidas.map((s) => ({
      fecha: String(s.fecha),
      sentido: String(s.sentido),
      hora: deSql(String(s.hora)).toISOString(),
      estado: String(s.estado),
      conductorNoPuede: s.conductor_no_puede_en != null,
      reserva: s.reserva == null ? null : String(s.reserva),
      viaje: s.viaje == null ? null : String(s.viaje),
    })),
  };
}

viajesFijos.get('/rutinas', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const { results } = await db
    .prepare(
      `${SELECT_RUTINA} WHERE r.cliente_id = ? AND r.estado != 'borrada' ORDER BY r.creado_en`,
    )
    .bind(u.id)
    .all<FilaRutina>();
  const salidas = await salidasDe(
    db,
    results.map((r) => r.id),
  );
  return c.json({
    max: RUTINA.maxRutinas,
    rutinas: results.map((r) => rutinaPublica(r, salidas.get(r.id) ?? [], true)),
  });
});

/** Comprueba todo lo que un viaje fijo necesita para funcionar (lo mismo al crear y al cambiar). */
async function validarRutina(env: Env, db: D1Database, clienteId: string, d: DatosRutina) {
  const zona = await zonaPara(db, d.origen.lat, d.origen.lng);
  if (!zona) throw new ErrorDatos('Todavía no llegamos a esa dirección.', 'origen', 409);
  if ((await estadoServicioEnZona(db, d.servicio, zona.id, clienteId)) !== 'disponible')
    throw new ErrorDatos('Este servicio todavía no está disponible en tu ciudad.', 'servicio', 409);
  // C-DESTINO-EN-EL-PAIS: el destino puede salir de la ciudad, sin salir del país.
  await exigirPuntoEnElPais(env, db, zona, d.destino, 'destino');
  if (!perfilPasajeros(zona.pais).metodosPago.includes(d.metodoPago))
    throw new ErrorDatos('Ese método de pago no está disponible en tu ciudad.', 'metodoPago', 422);
  if (d.metodoPago === 'tarjeta' && !(await tarjetaGuardada(env, db, clienteId)))
    throw new ErrorDatos(
      'Para un viaje fijo con tarjeta, primero paga un viaje con tarjeta en la app (queda guardada).',
      'metodoPago',
      409,
    );
  if (d.paquete && !telefonoCanonico(d.paquete.destinatario.telefono))
    throw new ErrorDatos('El celular de quien recibe no parece válido.', 'telefono', 422);
  if (d.conductorId) {
    const k = await db
      .prepare(
        `SELECT h.lleva_menores FROM conductores_confianza k
           LEFT JOIN repartidores r ON r.usuario_id = k.conductor_id
           LEFT JOIN vehiculos h ON h.id = r.vehiculo_activo_id
          WHERE k.cliente_id = ? AND k.conductor_id = ?`,
      )
      .bind(clienteId, d.conductorId)
      .first<{ lleva_menores: number | null }>();
    if (!k)
      throw new ErrorDatos(
        'Ese conductor no está entre tus conductores de confianza.',
        'conductorId',
        409,
      );
    if (d.menor && k.lleva_menores !== 1)
      throw new ErrorDatos(
        'Tu conductor no tiene activado «Acepto llevar menores». Pídele que lo active en su app.',
        'conductorId',
        409,
      );
  }
  return zona;
}

viajesFijos.post('/rutinas', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaRutina);
  const zona = await validarRutina(c.env, db, u.id, d);
  const id = nuevoId();
  const r = await db
    .prepare(
      `INSERT INTO rutinas_viaje (id, cliente_id, nombre, servicio_id, zona_id, categoria, origen_lat, origen_lng,
         origen_direccion, destino_lat, destino_lng, destino_direccion, dias, hora_ida, hora_vuelta,
         metodo_pago, conductor_id, menor_nombre, pin_menor, paquete_json, proxima_revision_en)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, datetime('now')
        WHERE (SELECT COUNT(*) FROM rutinas_viaje WHERE cliente_id = ?2 AND estado != 'borrada') < ?21`,
    )
    .bind(
      id,
      u.id,
      d.nombre,
      d.servicio,
      zona.id,
      d.categoria,
      d.origen.lat,
      d.origen.lng,
      d.origen.direccion,
      d.destino.lat,
      d.destino.lng,
      d.destino.direccion,
      d.dias.join(','),
      d.horaIda,
      d.horaVuelta,
      d.metodoPago,
      d.conductorId,
      d.menor?.nombre ?? null,
      d.menor?.pin ?? null,
      d.paquete ? JSON.stringify(d.paquete) : null,
      RUTINA.maxRutinas,
    )
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos(`Puedes tener hasta ${RUTINA.maxRutinas} viajes fijos.`, undefined, 409);
  if (d.conductorId) await avisarConductorNuevaRutina(c.env, db, d.conductorId, u.nombre, d);
  const f = await db.prepare(`${SELECT_RUTINA} WHERE r.id = ?`).bind(id).first<FilaRutina>();
  return c.json({ rutina: f ? rutinaPublica(f, [], true) : { id } }, 201);
});

async function avisarConductorNuevaRutina(
  env: Env,
  db: D1Database,
  conductorId: string,
  cliente: string,
  d: Pick<DatosRutina, 'horaIda' | 'menor'>,
) {
  const quien = d.menor ? d.menor.nombre : nombrePila(cliente);
  await notificar(env, db, { id: conductorId, app: 'repartidor' }, (i) => ({
    ...(i === 'en'
      ? {
          titulo: 'New regular ride',
          cuerpo: `${nombrePila(cliente)} set up a regular ride with you (${quien}, ${d.horaIda}). See it in Regular riders.`,
        }
      : {
          titulo: 'Nuevo viaje fijo',
          cuerpo: `${nombrePila(cliente)} armó un viaje fijo contigo (${quien}, ${d.horaIda}). Míralo en Clientes fijos.`,
        }),
    datos: { tipo: 'clientes_fijos' },
  })).catch((e: unknown) => console.error('viajes fijos: aviso al conductor', e));
}

async function miRutina(db: D1Database, id: string, clienteId: string) {
  const f = await db
    .prepare(`${SELECT_RUTINA} WHERE r.id = ? AND r.cliente_id = ? AND r.estado != 'borrada'`)
    .bind(id, clienteId)
    .first<FilaRutina>();
  if (!f) throw new ErrorDatos('Ese viaje fijo no existe.', undefined, 404);
  return f;
}

/**
 * Suelta las salidas ya creadas de una rutina que todavía se cancelan gratis (más de 60 minutos
 * antes): la reserva se cancela y la salida se borra para que vuelva a nacer con lo nuevo (o no
 * nazca, si quedó en pausa). Las que faltan menos de 60 minutos se quedan: se cancelan desde el viaje.
 * `soloFecha` limita a un día (saltar).
 */
async function soltarSalidas(
  db: D1Database,
  rutinaId: string,
  soloFecha?: { fecha: string; sentido: 'ida' | 'vuelta' | 'ambos' },
): Promise<{ soltadas: number; quedan: number }> {
  const { results } = await db
    .prepare(
      `SELECT s.fecha, s.sentido, s.hora, s.programado_id, p.estado AS reserva FROM rutina_salidas s
         LEFT JOIN viajes_programados p ON p.id = s.programado_id
        WHERE s.rutina_id = ? AND s.estado = 'creada' AND s.hora > datetime('now')`,
    )
    .bind(rutinaId)
    .all<{
      fecha: string;
      sentido: string;
      hora: string;
      programado_id: string | null;
      reserva: string | null;
    }>();
  let soltadas = 0;
  let quedan = 0;
  for (const s of results) {
    if (
      soloFecha &&
      (s.fecha !== soloFecha.fecha ||
        (soloFecha.sentido !== 'ambos' && s.sentido !== soloFecha.sentido))
    )
      continue;
    if (s.reserva !== 'programado' || !cancelacionProgramadaGratis(deSql(s.hora))) {
      quedan++;
      continue;
    }
    const r = await db.batch([
      db
        .prepare(
          `UPDATE viajes_programados SET estado = 'cancelado', motivo = 'viaje_fijo_cambiado', resuelto_en = datetime('now')
            WHERE id = ? AND estado = 'programado'`,
        )
        .bind(s.programado_id),
      db
        .prepare(
          `DELETE FROM rutina_salidas WHERE rutina_id = ? AND fecha = ? AND sentido = ?
              AND EXISTS (SELECT 1 FROM viajes_programados WHERE id = ? AND estado = 'cancelado')`,
        )
        .bind(rutinaId, s.fecha, s.sentido, s.programado_id),
    ]);
    if (r[0]?.meta.changes) soltadas++;
    else quedan++;
  }
  return { soltadas, quedan };
}

viajesFijos.put('/rutinas/:id', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const actual = await miRutina(db, c.req.param('id'), u.id);
  const d = await leerCuerpo(c, esquemaRutina);
  const zona = await validarRutina(c.env, db, u.id, d);
  await db
    .prepare(
      `UPDATE rutinas_viaje SET nombre = ?2, servicio_id = ?3, zona_id = ?4, categoria = ?5, origen_lat = ?6,
         origen_lng = ?7, origen_direccion = ?8, destino_lat = ?9, destino_lng = ?10, destino_direccion = ?11,
         dias = ?12, hora_ida = ?13, hora_vuelta = ?14, metodo_pago = ?15, conductor_id = ?16,
         menor_nombre = ?17, pin_menor = ?18, paquete_json = ?19, proxima_revision_en = datetime('now'),
         actualizado_en = datetime('now')
        WHERE id = ?1`,
    )
    .bind(
      actual.id,
      d.nombre,
      d.servicio,
      zona.id,
      d.categoria,
      d.origen.lat,
      d.origen.lng,
      d.origen.direccion,
      d.destino.lat,
      d.destino.lng,
      d.destino.direccion,
      d.dias.join(','),
      d.horaIda,
      d.horaVuelta,
      d.metodoPago,
      d.conductorId,
      d.menor?.nombre ?? null,
      d.menor?.pin ?? null,
      d.paquete ? JSON.stringify(d.paquete) : null,
    )
    .run();
  const { quedan } = await soltarSalidas(db, actual.id);
  if (d.conductorId && d.conductorId !== actual.conductor_id)
    await avisarConductorNuevaRutina(c.env, db, d.conductorId, u.nombre, d);
  const f = await db.prepare(`${SELECT_RUTINA} WHERE r.id = ?`).bind(actual.id).first<FilaRutina>();
  const salidas = await salidasDe(db, [actual.id]);
  return c.json({
    rutina: f ? rutinaPublica(f, salidas.get(actual.id) ?? [], true) : null,
    sinCambiar: quedan,
  });
});

viajesFijos.post('/rutinas/:id/pausar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await miRutina(db, c.req.param('id'), u.id);
  const { hasta } = await leerCuerpo(
    c,
    z.object({
      hasta: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .default(null),
    }),
  );
  const hoy = fechaLocalRutina(new Date(), f.zona_horaria ?? 'UTC');
  if (
    hasta &&
    (hasta < hoy || (Date.parse(hasta) - Date.parse(hoy)) / 86_400_000 > RUTINA.pausaMaxDias)
  )
    throw new ErrorDatos(`Elige una fecha de hoy hasta ${RUTINA.pausaMaxDias} días.`, 'hasta', 422);
  await db
    .prepare(
      `UPDATE rutinas_viaje SET estado = 'pausada', pausada_hasta = ?, actualizado_en = datetime('now'),
         proxima_revision_en = CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END WHERE id = ?`,
    )
    .bind(hasta, hasta, f.id)
    .run();
  const { quedan } = await soltarSalidas(db, f.id);
  return c.json({ ok: true, sinCambiar: quedan });
});

viajesFijos.post('/rutinas/:id/reanudar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await miRutina(db, c.req.param('id'), u.id);
  await db
    .prepare(
      `UPDATE rutinas_viaje SET estado = 'activa', pausada_hasta = NULL, proxima_revision_en = datetime('now'),
         actualizado_en = datetime('now') WHERE id = ?`,
    )
    .bind(f.id)
    .run();
  return c.json({ ok: true });
});

/** Saltar un día (ida, vuelta o los dos): gratis hasta 60 minutos antes. */
viajesFijos.post('/rutinas/:id/saltar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await miRutina(db, c.req.param('id'), u.id);
  const d = await leerCuerpo(
    c,
    z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sentido: z.enum(['ida', 'vuelta', 'ambos']).default('ambos'),
    }),
  );
  const { quedan } = await soltarSalidas(db, f.id, d);
  if (quedan)
    throw new ErrorDatos(
      'Falta menos de una hora para ese viaje: cancélalo desde la pantalla del viaje.',
      'fecha',
      409,
    );
  const tz = f.zona_horaria ?? 'UTC';
  const sentidos = d.sentido === 'ambos' ? (['ida', 'vuelta'] as const) : [d.sentido];
  for (const sentido of sentidos) {
    const h = sentido === 'ida' ? f.hora_ida : f.hora_vuelta;
    if (!h) continue;
    const salida = proximasSalidas(
      reglas(f),
      tz,
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 10 * 86_400_000),
    ).find((s) => s.fecha === d.fecha && s.sentido === sentido);
    if (!salida) continue;
    await db
      .prepare(
        `INSERT INTO rutina_salidas (rutina_id, fecha, sentido, hora, estado, motivo)
         VALUES (?, ?, ?, ?, 'saltada', 'saltada_por_cliente')
         ON CONFLICT(rutina_id, fecha, sentido) DO UPDATE SET estado = 'saltada', motivo = 'saltada_por_cliente'
           WHERE rutina_salidas.estado != 'creada'`,
      )
      .bind(f.id, d.fecha, sentido, fechaSql(salida.hora))
      .run();
  }
  return c.json({ ok: true });
});

/** Volver a poner un día saltado (si todavía no pasó). */
viajesFijos.post('/rutinas/:id/no-saltar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await miRutina(db, c.req.param('id'), u.id);
  const d = await leerCuerpo(c, z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }));
  await db.batch([
    db
      .prepare(
        "DELETE FROM rutina_salidas WHERE rutina_id = ? AND fecha = ? AND estado = 'saltada' AND hora > datetime('now')",
      )
      .bind(f.id, d.fecha),
    db
      .prepare("UPDATE rutinas_viaje SET proxima_revision_en = datetime('now') WHERE id = ?")
      .bind(f.id),
  ]);
  return c.json({ ok: true });
});

viajesFijos.delete('/rutinas/:id', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await miRutina(db, c.req.param('id'), u.id);
  await db
    .prepare(
      `UPDATE rutinas_viaje SET estado = 'borrada', proxima_revision_en = NULL, actualizado_en = datetime('now')
        WHERE id = ?`,
    )
    .bind(f.id)
    .run();
  const { quedan } = await soltarSalidas(db, f.id);
  return c.json({ ok: true, sinCambiar: quedan });
});

/** Cambiar el PIN del menor (el responsable lo cambia cuando quiera). */
viajesFijos.put('/rutinas/:id/pin', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await miRutina(db, c.req.param('id'), u.id);
  if (!f.menor_nombre) throw new ErrorDatos('Este viaje fijo no lleva a un menor.', undefined, 409);
  const { pin } = await leerCuerpo(c, z.object({ pin: esquemaPinMenor }));
  await db
    .prepare(
      "UPDATE rutinas_viaje SET pin_menor = ?, actualizado_en = datetime('now') WHERE id = ?",
    )
    .bind(pin, f.id)
    .run();
  // Los viajes que ya nacieron y no empezaron toman el PIN nuevo.
  await db
    .prepare(
      `UPDATE viajes SET pin_recogida = ? WHERE rutina_id = ? AND estado IN ('buscando', 'asignado', 'conductor_llego', 'pago_pendiente')`,
    )
    .bind(pin, f.id)
    .run();
  return c.json({ ok: true });
});

// ======================================================================= conductor

/** Los clientes fijos del conductor (lo eligieron de confianza) y su agenda de los próximos 7 días. */
viajesFijos.get('/conductor/clientes-fijos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const [clientes, rutinas] = await Promise.all([
    db
      .prepare(
        `SELECT k.cliente_id, k.creado_en, us.nombre,
                (SELECT COUNT(*) FROM rutinas_viaje r WHERE r.cliente_id = k.cliente_id AND r.conductor_id = k.conductor_id
                    AND r.estado != 'borrada') AS fijos
           FROM conductores_confianza k JOIN usuarios us ON us.id = k.cliente_id
          WHERE k.conductor_id = ? ORDER BY k.creado_en DESC LIMIT 100`,
      )
      .bind(u.id)
      .all<{ cliente_id: string; creado_en: string; nombre: string; fijos: number }>(),
    db
      .prepare(
        `${SELECT_RUTINA} WHERE r.conductor_id = ? AND r.estado != 'borrada' ORDER BY r.hora_ida LIMIT 50`,
      )
      .bind(u.id)
      .all<FilaRutina>(),
  ]);
  const salidas = await salidasDe(
    db,
    rutinas.results.map((r) => r.id),
  );
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + 7 * 86_400_000);
  const agenda = rutinas.results.flatMap((r) => {
    const tz = r.zona_horaria ?? 'UTC';
    const creadas = salidas.get(r.id) ?? [];
    return proximasSalidas(reglas(r), tz, new Date(ahora.getTime() - 60 * 60_000), hasta)
      .filter((s) => !enPausa(r.estado, r.pausada_hasta, s.fecha))
      .flatMap((s) => {
        const x = creadas.find((y) => y.fecha === s.fecha && y.sentido === s.sentido);
        if (x && x.estado !== 'creada') return [];
        if (x?.viaje === 'terminado' || x?.reserva === 'cancelado') return [];
        const ida = s.sentido === 'ida';
        return [
          {
            rutinaId: r.id,
            fecha: s.fecha,
            sentido: s.sentido,
            hora: s.hora.toISOString(),
            zonaHoraria: tz,
            servicio: r.servicio_id,
            cliente: nombrePila(r.cliente_nombre),
            menor: r.menor_nombre,
            origen: ida ? r.origen_direccion : r.destino_direccion,
            destino: ida ? r.destino_direccion : r.origen_direccion,
            metodoPago: r.metodo_pago,
            // Solo una salida ya creada (las próximas 24 horas) se puede marcar «no puedo».
            creada: Boolean(x),
            noPuedo: x?.conductor_no_puede_en != null,
          },
        ];
      });
  });
  agenda.sort((a, b) => a.hora.localeCompare(b.hora));
  return c.json({
    clientes: clientes.results.map((k) => ({
      nombre: nombrePila(k.nombre),
      desde: k.creado_en,
      fijos: Number(k.fijos),
    })),
    rutinas: rutinas.results.map((r) => ({
      id: r.id,
      cliente: nombrePila(r.cliente_nombre),
      servicio: r.servicio_id,
      dias: diasDe(r.dias),
      horaIda: r.hora_ida,
      horaVuelta: r.hora_vuelta,
      origen: r.origen_direccion,
      destino: r.destino_direccion,
      menor: r.menor_nombre,
      estado: r.estado,
      pausadaHasta: r.pausada_hasta,
    })),
    agenda,
  });
});

async function rutinaDelConductor(db: D1Database, id: string, conductorId: string) {
  const f = await db
    .prepare(`${SELECT_RUTINA} WHERE r.id = ? AND r.conductor_id = ? AND r.estado != 'borrada'`)
    .bind(id, conductorId)
    .first<FilaRutina>();
  if (!f) throw new ErrorDatos('Ese viaje fijo ya no es tuyo.', undefined, 404);
  return f;
}

/**
 * «No puedo» en una salida: ese viaje va a cualquier conductor (como si no tuviera de confianza) y
 * el cliente recibe un aviso. Solo para las salidas que ya nacieron (las próximas 24 horas).
 */
viajesFijos.post('/conductor/rutinas/:id/no-puedo', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const f = await rutinaDelConductor(db, c.req.param('id'), u.id);
  const d = await leerCuerpo(
    c,
    z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sentido: z.enum(['ida', 'vuelta']),
    }),
  );
  const s = await db
    .prepare(
      `SELECT programado_id, hora, conductor_no_puede_en FROM rutina_salidas
        WHERE rutina_id = ? AND fecha = ? AND sentido = ? AND estado = 'creada' AND conductor_id = ?`,
    )
    .bind(f.id, d.fecha, d.sentido, u.id)
    .first<{ programado_id: string | null; hora: string; conductor_no_puede_en: string | null }>();
  if (!s)
    throw new ErrorDatos('Ese viaje todavía no está en tu agenda de hoy y mañana.', undefined, 404);
  if (s.conductor_no_puede_en) return c.json({ ok: true });
  await db.batch([
    db
      .prepare(
        `UPDATE rutina_salidas SET conductor_no_puede_en = datetime('now')
          WHERE rutina_id = ? AND fecha = ? AND sentido = ?`,
      )
      .bind(f.id, d.fecha, d.sentido),
    db
      .prepare('UPDATE viajes_programados SET conductor_preferido_id = NULL WHERE id = ?')
      .bind(s.programado_id),
    db
      .prepare(
        `UPDATE viajes SET conductor_preferido_id = NULL WHERE operacion_id = ? AND estado IN ('buscando', 'pago_pendiente')`,
      )
      .bind(s.programado_id),
    db
      .prepare(
        "UPDATE ofertas_operacion SET estado = 'rechazada', respondida_en = datetime('now') WHERE operacion_id = ? AND conductor_id = ? AND estado = 'ofrecida'",
      )
      .bind(s.programado_id, u.id),
  ]);
  const hora = deSql(s.hora);
  const yo = await db
    .prepare('SELECT nombre FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ nombre: string }>();
  await notificar(c.env, db, { id: f.cliente_id, app: 'cliente' }, (i) => ({
    ...(i === 'en'
      ? {
          titulo: `${nombrePila(yo?.nombre)} can’t make it`,
          cuerpo: `Your regular ride “${f.nombre}” (${horaLocal(hora, f.zona_horaria, i)}) will go to another driver.`,
        }
      : {
          titulo: `${nombrePila(yo?.nombre)} no puede ir`,
          cuerpo: `Tu viaje fijo «${f.nombre}» (${horaLocal(hora, f.zona_horaria, i)}) lo hará otro conductor.`,
        }),
    datos: { tipo: 'rutinas' },
  })).catch((e: unknown) => console.error('viajes fijos: aviso no puedo', e));
  return c.json({ ok: true });
});

/** Dejar de hacer un viaje fijo: pasa a cualquier conductor y el cliente lo sabe. */
viajesFijos.post('/conductor/rutinas/:id/dejar', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const f = await rutinaDelConductor(db, c.req.param('id'), u.id);
  await db.batch([
    db
      .prepare(
        "UPDATE rutinas_viaje SET conductor_id = NULL, actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(f.id),
    db
      .prepare(
        "UPDATE viajes_programados SET conductor_preferido_id = NULL WHERE rutina_id = ? AND estado = 'programado'",
      )
      .bind(f.id),
    db
      .prepare(
        "UPDATE rutina_salidas SET conductor_id = NULL WHERE rutina_id = ? AND hora > datetime('now')",
      )
      .bind(f.id),
  ]);
  const yo = await db
    .prepare('SELECT nombre FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ nombre: string }>();
  await notificar(c.env, db, { id: f.cliente_id, app: 'cliente' }, (i) => ({
    ...(i === 'en'
      ? {
          titulo: 'Your regular ride changed',
          cuerpo: `${nombrePila(yo?.nombre)} will no longer do “${f.nombre}”. It will go to any available driver.`,
        }
      : {
          titulo: 'Tu viaje fijo cambió',
          cuerpo: `${nombrePila(yo?.nombre)} ya no hará «${f.nombre}». Lo hará cualquier conductor disponible.`,
        }),
    datos: { tipo: 'rutinas' },
  })).catch((e: unknown) => console.error('viajes fijos: aviso dejar', e));
  return c.json({ ok: true });
});

// ======================================================================= avisos al responsable del menor

export type MomentoMenor =
  'aceptado' | 'llego' | 'recogido' | 'dejado' | 'no_se_presento' | 'cancelado';

/**
 * C-VIAJES-FIJOS: el responsable (dueño de la cuenta) recibe un aviso en cada paso del viaje de su
 * menor, con la hora local, como el aviso de recogida y entrega de HopSkipDrive y el seguimiento de
 * Uber for Teens [DOC]. Nunca frena el viaje: si falla, queda en el registro.
 */
export async function avisarResponsableMenor(
  env: Env,
  db: D1Database,
  operacionId: string,
  momento: MomentoMenor,
) {
  const f = await db
    .prepare(
      `SELECT o.cliente_id, v.menor_nombre, v.origen_direccion, v.destino_direccion, u.nombre AS conductor,
              h.placa, z.zona_horaria
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN usuarios u ON u.id = o.conductor_id LEFT JOIN vehiculos h ON h.id = o.vehiculo_id
         LEFT JOIN zonas z ON z.id = o.zona_id
        WHERE o.id = ? AND v.menor_nombre IS NOT NULL`,
    )
    .bind(operacionId)
    .first<{
      cliente_id: string;
      menor_nombre: string;
      origen_direccion: string;
      destino_direccion: string;
      conductor: string | null;
      placa: string | null;
      zona_horaria: string | null;
    }>();
  if (!f) return;
  const menor = f.menor_nombre;
  const quien = nombrePila(f.conductor);
  const placa = f.placa ? ` (${f.placa})` : '';
  await notificar(env, db, { id: f.cliente_id, app: 'cliente' }, (i) => {
    const h = horaLocal(new Date(), f.zona_horaria, i, false);
    const textos: Record<MomentoMenor, [string, string]> =
      i === 'en'
        ? {
            aceptado: [
              `${quien} is on the way for ${menor}`,
              `Driver ${quien}${placa} accepted the ride.`,
            ],
            llego: [`${quien} arrived for ${menor}`, `Waiting at ${f.origen_direccion}.`],
            recogido: [
              `${menor} was picked up`,
              `At ${h} with ${quien}${placa}. Follow the ride live in the app.`,
            ],
            dejado: [`${menor} arrived`, `At ${h} at ${f.destino_direccion}.`],
            no_se_presento: [
              `${menor} didn’t show up`,
              `${quien} waited at ${f.origen_direccion} and closed the ride.`,
            ],
            cancelado: [`${menor}’s ride was canceled`, 'Open the app to see what happened.'],
          }
        : {
            aceptado: [
              `${quien} va por ${menor}`,
              `El conductor ${quien}${placa} aceptó el viaje.`,
            ],
            llego: [`${quien} llegó por ${menor}`, `Está esperando en ${f.origen_direccion}.`],
            recogido: [
              `${menor} ya va en camino`,
              `A las ${h} con ${quien}${placa}. Sigue el viaje en vivo en la app.`,
            ],
            dejado: [`${menor} llegó`, `A las ${h} a ${f.destino_direccion}.`],
            no_se_presento: [
              `${menor} no salió`,
              `${quien} esperó en ${f.origen_direccion} y cerró el viaje.`,
            ],
            cancelado: [`Se canceló el viaje de ${menor}`, 'Abre la app para ver qué pasó.'],
          };
    const t = new Map(Object.entries(textos)).get(momento) ?? ['', ''];
    return { titulo: t[0], cuerpo: t[1], datos: { tipo: 'viaje', viajeId: operacionId } };
  }).catch((e: unknown) => console.error('viajes fijos: aviso al responsable', operacionId, e));
}

// ======================================================================= reloj

/** Hace nacer UNA salida: la toma en rutina_salidas (llave única) y crea su viaje programado. */
async function crearSalida(env: Env, db: D1Database, f: FilaRutina, s: Salida) {
  const op = nuevoId();
  const conductor = f.conductor_id;
  const tomada = await db
    .prepare(
      `INSERT OR IGNORE INTO rutina_salidas (rutina_id, fecha, sentido, hora, estado, programado_id, conductor_id)
       VALUES (?, ?, ?, ?, 'creada', ?, ?)`,
    )
    .bind(f.id, s.fecha, s.sentido, fechaSql(s.hora), op, conductor)
    .run();
  if (!tomada.meta.changes) return 'ya';
  const ida = s.sentido === 'ida';
  const origen = { lat: f.origen_lat, lng: f.origen_lng, direccion: f.origen_direccion };
  const destino = { lat: f.destino_lat, lng: f.destino_lng, direccion: f.destino_direccion };
  try {
    const cot = await cotizarParaCliente(env, db, f.cliente_id, {
      servicio: f.servicio_id as 'moto' | 'carro' | 'envios',
      categoria: f.categoria as 'estandar',
      origen: ida ? origen : destino,
      destino: ida ? destino : origen,
      paradas: [],
    });
    await programarViaje(
      env,
      db,
      { id: f.cliente_id },
      {
        op,
        cotizacionId: cot.id,
        servicioId: f.servicio_id,
        zonaId: f.zona_id,
        metodoPago: f.metodo_pago,
        paquete: f.paquete_json ? JSON.parse(f.paquete_json) : null,
        programadoPara: s.hora,
        rutinaId: f.id,
        conductorPreferidoId: conductor,
      },
    );
  } catch (e) {
    const motivo = e instanceof ErrorDatos ? e.message : 'error';
    if (!(e instanceof ErrorDatos))
      console.error('viajes fijos: no nació la salida', f.id, s.fecha, e);
    await db
      .prepare(
        `UPDATE rutina_salidas SET estado = 'fallida', motivo = ?, programado_id = NULL
          WHERE rutina_id = ? AND fecha = ? AND sentido = ?`,
      )
      .bind(motivo.slice(0, 200), f.id, s.fecha, s.sentido)
      .run();
    await notificar(env, db, { id: f.cliente_id, app: 'cliente' }, (i) => ({
      ...(i === 'en'
        ? {
            titulo: 'We couldn’t book your regular ride',
            cuerpo: `“${f.nombre}” (${horaLocal(s.hora, f.zona_horaria, i)}) wasn’t booked. Open the app to fix it.`,
          }
        : {
            titulo: 'No pudimos reservar tu viaje fijo',
            cuerpo: `«${f.nombre}» (${horaLocal(s.hora, f.zona_horaria, i)}) no quedó reservado. Abre la app para arreglarlo.`,
          }),
      datos: { tipo: 'rutinas' },
    })).catch((x: unknown) => console.error('viajes fijos: aviso fallida', x));
    return 'fallida';
  }
  return 'creada';
}

/**
 * La tarea del reloj. (1) Hace nacer las salidas de las próximas 24 horas de los viajes fijos que
 * vencen (índice parcial por proxima_revision_en: sin ninguno, no escribe nada). (2) Manda el aviso
 * previo al conductor de confianza 30 minutos antes de cada salida.
 */
export async function correrViajesFijos(env: Env, db: D1Database, ahora: Date = new Date()) {
  const { results } = await db
    .prepare(
      `${SELECT_RUTINA} WHERE r.estado != 'borrada' AND r.proxima_revision_en IS NOT NULL
          AND r.proxima_revision_en <= datetime('now') ORDER BY r.proxima_revision_en LIMIT ${RUTINA.porVuelta}`,
    )
    .all<FilaRutina>();
  let creadas = 0;
  let fallidas = 0;
  for (const f of results) {
    const tz = f.zona_horaria ?? 'UTC';
    const desde = new Date(ahora.getTime() + RUTINA.minAnticipoMin * 60_000);
    const hasta = new Date(ahora.getTime() + RUTINA.horizonteHoras * 3_600_000);
    try {
      for (const s of proximasSalidas(reglas(f), tz, desde, hasta)) {
        if (enPausa(f.estado, f.pausada_hasta, s.fecha)) continue;
        const r = await crearSalida(env, db, f, s);
        if (r === 'creada') creadas++;
        if (r === 'fallida') fallidas++;
      }
    } catch (e) {
      console.error('viajes fijos: revisión', f.id, e);
    }
    // La próxima vez que hay que mirarla: cuando su siguiente salida entre en las 24 horas.
    const pausaSinFecha = f.estado === 'pausada' && !f.pausada_hasta;
    const sig = siguienteSalida(reglas(f), tz, hasta);
    const proxima = pausaSinFecha
      ? null
      : fechaSql(
          new Date(
            Math.max(
              ahora.getTime() + 5 * 60_000,
              (sig?.hora.getTime() ?? ahora.getTime() + 86_400_000) -
                RUTINA.horizonteHoras * 3_600_000,
            ),
          ),
        );
    // Una pausa con fecha que ya pasó vuelve sola a activa.
    const hoy = fechaLocalRutina(ahora, tz);
    const vuelve = f.estado === 'pausada' && f.pausada_hasta != null && f.pausada_hasta < hoy;
    await db
      .prepare(
        `UPDATE rutinas_viaje SET proxima_revision_en = ?,
           estado = CASE WHEN ? THEN 'activa' ELSE estado END,
           pausada_hasta = CASE WHEN ? THEN NULL ELSE pausada_hasta END
          WHERE id = ? AND estado != 'borrada'`,
      )
      .bind(proxima, vuelve ? 1 : 0, vuelve ? 1 : 0, f.id)
      .run();
  }
  const avisos = await avisarConductores(env, db);
  return { revisadas: results.length, creadas, fallidas, avisos };
}

/** El aviso previo al conductor de confianza (30 minutos antes), una vez por salida. */
async function avisarConductores(env: Env, db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT s.rutina_id, s.fecha, s.sentido, s.hora, s.conductor_id, r.nombre, r.menor_nombre,
              r.origen_direccion, r.destino_direccion, cl.nombre AS cliente, z.zona_horaria
         FROM rutina_salidas s JOIN rutinas_viaje r ON r.id = s.rutina_id
         JOIN usuarios cl ON cl.id = r.cliente_id JOIN zonas z ON z.id = r.zona_id
        WHERE s.estado = 'creada' AND s.aviso_conductor_en IS NULL AND s.conductor_id IS NOT NULL
          AND s.hora <= datetime('now', '+${RUTINA.avisoConductorMin} minutes') LIMIT 50`,
    )
    .all<{
      rutina_id: string;
      fecha: string;
      sentido: string;
      hora: string;
      conductor_id: string;
      nombre: string;
      menor_nombre: string | null;
      origen_direccion: string;
      destino_direccion: string;
      cliente: string;
      zona_horaria: string | null;
    }>();
  let avisos = 0;
  for (const s of results) {
    const r = await db
      .prepare(
        `UPDATE rutina_salidas SET aviso_conductor_en = datetime('now')
          WHERE rutina_id = ? AND fecha = ? AND sentido = ? AND aviso_conductor_en IS NULL`,
      )
      .bind(s.rutina_id, s.fecha, s.sentido)
      .run();
    if (!r.meta.changes) continue;
    // Si ya pasó la hora (el reloj estuvo parado), no se avisa tarde: solo se marca.
    const hora = deSql(s.hora);
    if (hora.getTime() < Date.now()) continue;
    const quien = s.menor_nombre ?? nombrePila(s.cliente);
    const ida = s.sentido === 'ida';
    const desde = ida ? s.origen_direccion : s.destino_direccion;
    avisos++;
    await notificar(env, db, { id: s.conductor_id, app: 'repartidor' }, (i) => ({
      ...(i === 'en'
        ? {
            titulo: `Regular ride at ${horaLocal(hora, s.zona_horaria, i, false)}`,
            cuerpo: `${quien} — pickup at ${desde}. Go online so the ride reaches you first.`,
          }
        : {
            titulo: `Viaje fijo a las ${horaLocal(hora, s.zona_horaria, i, false)}`,
            cuerpo: `${quien}: recoges en ${desde}. Conéctate para que te llegue primero a ti.`,
          }),
      datos: { tipo: 'clientes_fijos' },
    })).catch((e: unknown) => console.error('viajes fijos: aviso previo', e));
  }
  return avisos;
}

/** Cada salida: unas 6 escrituras (salida, cotización, reserva, cotización usada, revisión, aviso). */
export const TAREA_VIAJES_FIJOS: TareaReloj = {
  nombre: 'viajes_fijos',
  critica: true,
  escriturasEsperadas: RUTINA.porVuelta * 2 * 6 + 50,
  correr: (env, db) => correrViajesFijos(env, db),
};

// ======================================================================= monitoreo (equipo)

/** Los viajes fijos de la ciudad para el monitoreo del superadmin, con lo que pasó en las salidas. */
viajesFijos.get('/admin/viajes-fijos', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const zona = (c.req.query('zona') ?? '').slice(0, 60);
  const estado = c.req.query('estado') ?? 'vigentes';
  const filtros: string[] = [];
  const valores: unknown[] = [];
  const alc = filtroAlcance(accesoDe(c), {
    zona: 'r.zona_id',
    servicio: servicioOperacionSql('r.servicio_id'),
  });
  if (alc.sql) {
    filtros.push(alc.sql.replace(/^ AND /, ''));
    valores.push(...alc.valores);
  }
  if (zona) {
    filtros.push('r.zona_id = ?');
    valores.push(zona);
  }
  if (estado === 'vigentes') filtros.push("r.estado != 'borrada'");
  else if (['activa', 'pausada', 'borrada'].includes(estado)) {
    filtros.push('r.estado = ?');
    valores.push(estado);
  }
  if (c.req.query('menores') === '1') filtros.push('r.menor_nombre IS NOT NULL');
  const [lista, resumen, confianza] = await Promise.all([
    db
      .prepare(
        `${SELECT_RUTINA.replace('SELECT r.*', 'SELECT r.*, z.nombre AS ciudad')}
          ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''} ORDER BY r.actualizado_en DESC LIMIT 100`,
      )
      .bind(...valores)
      .all<FilaRutina & { ciudad: string }>(),
    db
      .prepare(
        `SELECT s.estado, COUNT(*) AS n, SUM(s.conductor_no_puede_en IS NOT NULL) AS no_puede
           FROM rutina_salidas s JOIN rutinas_viaje r ON r.id = s.rutina_id
          WHERE s.hora >= datetime('now', '-7 days')${zona ? ' AND r.zona_id = ?' : ''}${alc.sql}
          GROUP BY s.estado`,
      )
      .bind(...(zona ? [zona] : []), ...alc.valores)
      .all<{ estado: string; n: number; no_puede: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n, COUNT(DISTINCT k.conductor_id) AS conductores FROM conductores_confianza k`,
      )
      .first<{ n: number; conductores: number }>(),
  ]);
  const salidas = await salidasDe(
    db,
    lista.results.map((r) => r.id),
  );
  return c.json({
    resumen: {
      parejasConfianza: Number(confianza?.n ?? 0),
      conductoresConfianza: Number(confianza?.conductores ?? 0),
      salidas7d: Object.fromEntries(resumen.results.map((r) => [r.estado, Number(r.n)])),
      noPuede7d: resumen.results.reduce((a, r) => a + Number(r.no_puede ?? 0), 0),
    },
    rutinas: lista.results.map((r) => ({
      ...rutinaPublica(r, salidas.get(r.id) ?? [], false),
      cliente: r.cliente_nombre ?? '',
      clienteId: r.cliente_id,
      ciudad: r.ciudad,
      creadoEn: r.creado_en,
    })),
  });
});
