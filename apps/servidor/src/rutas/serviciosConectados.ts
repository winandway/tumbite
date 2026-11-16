import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  SERVICIOS_AL_MOMENTO,
  UPSERT_PREFERENCIA,
  type EstadoConductor,
  estadoDelConductor,
  versionNum,
} from './servicios';
import { MENSAJE_EN_BLOQUE_FLEX, bloqueFlexDe, conectarRepartidor, miFicha } from './operacion';

/**
 * C-SERVICIOS-CONECTADOS (Richard, 16 nov 2026, al probar Driver; diseño en DRIVER.md de Gerencia).
 *
 * El repartidor se conecta a VARIOS servicios al momento a la vez mientras espera (Comida, Envíos,
 * Moto y Carro con pasajero), como Uber y Grab. Al aceptar uno, los demás quedan EN PAUSA solos y
 * vuelven al terminar. Divoox Flex es exclusivo (C-FLEX-EXCLUSIVO, ya en la base).
 *
 * El estado de cada servicio NO se guarda: se calcula de lo que ya existe, así no hay que
 * «acordarse» de reanudar nada ni se escribe en la base por cada pedido:
 *   - conectado      repartidores.conectado = 1, preferencia encendida y aprobado.
 *   - en_pausa       lo anterior, pero lleva otro servicio (conductor_ocupacion o un pedido activo).
 *                    El despacho ya no le ofrece nada mientras lleva algo (candado de esta pieza).
 *   - haciendo       el servicio que lleva ahora.
 *   - desconectado   aprobado, pero apagado (a mano o con el encendido general apagado).
 *   - bloqueado_flex durante un bloque de Flex: no se puede conectar (409).
 *   - en_revision    pidió el servicio y le falta un papel o la aprobación (o se le rechazó uno).
 *   - agregar        el servicio funciona en su ciudad y todavía no lo pidió.
 * Lo que el servidor no da (servicio apagado en la ciudad o en el país) no aparece.
 */
export const serviciosConectados = new Hono<{ Bindings: Env; Variables: Variables }>();
type Db = D1Database;

export type EstadoTarjeta =
  | 'conectado'
  | 'en_pausa'
  | 'haciendo'
  | 'desconectado'
  | 'bloqueado_flex'
  | 'en_revision'
  | 'agregar';

/** Lo que lleva ahora (o null): el servicio y de qué tipo es (comida, envío o viaje). */
export async function queLleva(
  db: Db,
  conductorId: string,
): Promise<{ servicioId: string; tipo: 'comida' | 'envio' | 'viaje' | 'ruta_flex' } | null> {
  const r = await db
    .prepare(
      `SELECT c.tipo, o.servicio_id FROM conductor_ocupacion c
         LEFT JOIN operaciones o ON o.id = c.operacion_id WHERE c.conductor_id = ?1
       UNION ALL
       SELECT 'comida', 'comida' FROM pedidos p
        WHERE p.repartidor_id = ?1 AND p.estado IN ('aceptado','listo','en_camino')
       LIMIT 1`,
    )
    .bind(conductorId)
    .first<{ tipo: string; servicio_id: string | null }>();
  if (!r) return null;
  if (r.tipo === 'ruta_flex') return { servicioId: 'flex', tipo: 'ruta_flex' };
  if (r.tipo === 'comida') return { servicioId: 'comida', tipo: 'comida' };
  const id = r.servicio_id ?? 'envios';
  return { servicioId: id, tipo: id === 'envios' ? 'envio' : 'viaje' };
}

/** La regla de la tarjeta, sin consultas (la prueban los candados uno por uno). */
export function estadoTarjeta(e: {
  s: EstadoConductor;
  conectadoGeneral: boolean;
  enBloqueFlex: boolean;
  lleva: string | null;
}): EstadoTarjeta | null {
  const { s } = e;
  if (s.estadoServicio !== 'disponible') return null; // no funciona aquí: no se dibuja
  if (s.motivo === 'actualizar_app') return 'en_revision';
  if (s.habilitacion === 'sin_solicitar' || s.habilitacion === 'rechazada') return 'agregar';
  if (!s.puedeActivar) return 'en_revision';
  if (e.enBloqueFlex) return 'bloqueado_flex';
  if (e.lleva === s.servicioId) return 'haciendo';
  if (!e.conectadoGeneral || !s.preferencia) return 'desconectado';
  return e.lleva ? 'en_pausa' : 'conectado';
}

async function panelDe(db: Db, conductorId: string, ingles: boolean, version: number) {
  const [estado, ficha, bloque, lleva] = await Promise.all([
    estadoDelConductor(db, conductorId, ingles, version),
    db
      .prepare('SELECT conectado FROM repartidores WHERE usuario_id = ?')
      .bind(conductorId)
      .first<{ conectado: number }>(),
    bloqueFlexDe(db, conductorId),
    queLleva(db, conductorId),
  ]);
  const conectadoGeneral = Number(ficha?.conectado) === 1;
  const vehiculo = estado.vehiculoActivo?.estado === 'aprobado' ? estado.vehiculoActivo.tipo : null;
  const servicios = estado.servicios
    .filter((s) => (SERVICIOS_AL_MOMENTO as readonly string[]).includes(s.servicioId))
    .map((s) => ({
      servicioId: s.servicioId,
      nombre: s.nombre,
      // Envíos dice con qué vehículo los hace (Envíos en moto / en carro).
      vehiculo: s.servicioId === 'envios' || s.servicioId === 'comida' ? vehiculo : null,
      estado: estadoTarjeta({
        s,
        conectadoGeneral,
        enBloqueFlex: Boolean(bloque),
        lleva: lleva?.servicioId ?? null,
      }),
      motivo: s.motivo,
      requisitosFaltantes: s.requisitosFaltantes,
    }))
    .filter((s) => s.estado !== null);
  return {
    conectadoGeneral: conectadoGeneral && !bloque,
    conectados: servicios.filter((s) => s.estado === 'conectado').length,
    lleva,
    bloqueFlex: bloque,
    servicios,
  };
}

const idiomaIngles = (c: { req: { header: (n: string) => string | undefined } }) =>
  (c.req.header('x-idioma') ?? '').startsWith('en');
const versionDriver = (c: { req: { header: (n: string) => string | undefined } }) => {
  const [nombre, v] = (c.req.header('x-tumbite-app') ?? '').split('@');
  return versionNum(nombre === 'driver' ? v : undefined);
};

serviciosConectados.get('/conductor/panel-servicios', async (c) => {
  const u = exigir(c, 'repartidor');
  c.header('cache-control', 'private, no-store');
  return c.json(await panelDe(base(c), u.id, idiomaIngles(c), versionDriver(c)));
});

/**
 * Conectar (un toque) o desconectar (la app lo pide tras deslizar) UN servicio. Conectar pasa por
 * las mismas puertas que el encendido general. Desconectar el último apaga el encendido general.
 */
serviciosConectados.post('/conductor/servicios/:id/conexion', async (c) => {
  const { u, db } = await miFicha(c);
  const servicioId = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      conectado: z.boolean(),
      lat: z.number().nullable().default(null),
      lng: z.number().nullable().default(null),
    }),
  );
  if (!(SERVICIOS_AL_MOMENTO as readonly string[]).includes(servicioId))
    throw new ErrorDatos('Ese servicio no se conecta desde aquí.', 'servicioId', 404);
  const estado = await estadoDelConductor(db, u.id, false, versionDriver(c));
  const s = estado.servicios.find((x) => x.servicioId === servicioId);
  if (!s) throw new ErrorDatos('Ese servicio no existe.', 'servicioId', 404);
  if (d.conectado) {
    if (await bloqueFlexDe(db, u.id))
      throw new ErrorDatos(MENSAJE_EN_BLOQUE_FLEX, 'bloque_flex', 409);
    if (!s.puedeActivar)
      throw new ErrorDatos('Este servicio todavía no está aprobado para ti.', 'servicioId', 409);
    // Primero las puertas del encendido general (si alguna falla, no se toca la preferencia).
    const general = await conectarRepartidor(c, u, db, d);
    await db.prepare(UPSERT_PREFERENCIA).bind(u.id, servicioId, 1).run();
    return c.json({
      ...general,
      ...(await panelDe(db, u.id, idiomaIngles(c), versionDriver(c))),
    });
  }
  await db.prepare(UPSERT_PREFERENCIA).bind(u.id, servicioId, 0).run();
  const quedan = estado.servicios.some(
    (x) =>
      x.servicioId !== servicioId &&
      (SERVICIOS_AL_MOMENTO as readonly string[]).includes(x.servicioId) &&
      x.preferencia,
  );
  if (!quedan) await conectarRepartidor(c, u, db, { conectado: false, lat: null, lng: null });
  return c.json(await panelDe(db, u.id, idiomaIngles(c), versionDriver(c)));
});

/** Nombre de cada papel para la pantalla (español e inglés). */
const NOMBRE_REQUISITO: Record<string, [string, string]> = {
  identidad: ['Documento de identidad y foto', 'ID and photo'],
  antecedentes: ['Antecedentes', 'Background check'],
  antecedentes_pasajeros: ['Antecedentes para pasajeros', 'Rider background check'],
  historial_manejo: ['Récord de manejo', 'Driving record'],
  licencia: ['Licencia de conducir', "Driver's license"],
  licencia_moto: ['Licencia de moto', 'Motorcycle license'],
  edad_minima_21: ['Tener 21 años o más', 'Age 21 or older'],
  capacitacion: ['Capacitación', 'Training'],
  seguro_vehiculo: ['Seguro del vehículo', 'Vehicle insurance'],
  seguro_pasajeros: ['Seguro para pasajeros', 'Rideshare insurance'],
  inspeccion_vehiculo: ['Inspección del vehículo', 'Vehicle inspection'],
  casco_pasajero: ['Casco para el pasajero (foto)', 'Passenger helmet (photo)'],
};

/**
 * Perfil compartido: qué pide un servicio, separado en lo DEL PERFIL (sirve para todos los
 * servicios y no se vuelve a pedir) y lo DEL VEHÍCULO. Cada papel con su estado y, si se rechazó,
 * el motivo que escribió el equipo de revisión.
 */
serviciosConectados.get('/conductor/servicios/:id/requisitos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const ingles = idiomaIngles(c);
  const servicioId = c.req.param('id');
  const tipoVehiculo = servicioId === 'moto' ? 'moto' : servicioId === 'carro' ? 'carro' : null;
  const vehiculo = tipoVehiculo
    ? await db
        .prepare(
          "SELECT id, tipo FROM vehiculos WHERE conductor_id = ? AND tipo = ? AND estado NOT IN ('retirado','rechazado') ORDER BY creado_en DESC LIMIT 1",
        )
        .bind(u.id, tipoVehiculo)
        .first<{ id: string; tipo: string }>()
    : await db
        .prepare(
          'SELECT v.id, v.tipo FROM repartidores r JOIN vehiculos v ON v.id = r.vehiculo_activo_id WHERE r.usuario_id = ?',
        )
        .bind(u.id)
        .first<{ id: string; tipo: string }>();
  const { results } = await db
    .prepare(
      `SELECT sr.requisito, rd.nivel, rd.doc_tipo FROM servicio_requisitos sr
         JOIN requisitos_def rd ON rd.requisito = sr.requisito
        WHERE sr.servicio_id = ?1 AND sr.obligatorio = 1
       UNION
       SELECT svr.requisito, rd.nivel, rd.doc_tipo FROM servicio_vehiculo_requisitos svr
         JOIN requisitos_def rd ON rd.requisito = svr.requisito
        WHERE svr.servicio_id = ?1 AND svr.vehiculo_tipo = ?2`,
    )
    .bind(servicioId, vehiculo?.tipo ?? '-')
    .all<{ requisito: string; nivel: 'conductor' | 'vehiculo'; doc_tipo: string | null }>();
  if (!results.length && !['comida', 'envios', 'moto', 'carro'].includes(servicioId))
    throw new ErrorDatos('Ese servicio no existe.', 'servicioId', 404);
  const [cumple, docsVeh, docsCond, kyc] = await Promise.all([
    db
      .prepare(
        `SELECT requisito, vehiculo_id, estado FROM cumplimientos WHERE conductor_id = ?
          AND (vence_en IS NULL OR vence_en > datetime('now') OR estado != 'aprobado')`,
      )
      .bind(u.id)
      .all<{ requisito: string; vehiculo_id: string; estado: string }>(),
    vehiculo
      ? db
          .prepare(
            "SELECT tipo, estado, motivo FROM vehiculo_documentos WHERE vehiculo_id = ? AND estado != 'reemplazado'",
          )
          .bind(vehiculo.id)
          .all<{ tipo: string; estado: string; motivo: string }>()
      : Promise.resolve({ results: [] as { tipo: string; estado: string; motivo: string }[] }),
    db
      .prepare(
        "SELECT tipo, estado, motivo FROM conductor_documentos WHERE conductor_id = ? AND estado != 'reemplazado'",
      )
      .bind(u.id)
      .all<{ tipo: string; estado: string; motivo: string }>(),
    db
      .prepare('SELECT estado, motivo FROM kyc WHERE usuario_id = ?')
      .bind(u.id)
      .first<{ estado: string; motivo: string }>(),
  ]);
  const DOC_CONDUCTOR: Record<string, string> = {
    licencia: 'licencia_conducir',
    licencia_moto: 'licencia_moto',
    antecedentes_pasajeros: 'antecedentes_penales',
  };
  const papeles = results.map((r) => {
    const c1 = cumple.results.find(
      (x) =>
        x.requisito === r.requisito &&
        x.vehiculo_id === (r.nivel === 'vehiculo' ? (vehiculo?.id ?? '-') : ''),
    );
    const doc =
      r.nivel === 'vehiculo'
        ? docsVeh.results.find((x) => x.tipo === r.doc_tipo)
        : r.requisito === 'identidad'
          ? kyc
            ? { estado: kyc.estado === 'sin_enviar' ? '' : kyc.estado, motivo: kyc.motivo }
            : undefined
          : docsCond.results.find((x) => x.tipo === DOC_CONDUCTOR[r.requisito]);
    const estado: 'aprobado' | 'pendiente' | 'rechazado' | 'falta' =
      c1?.estado === 'aprobado'
        ? 'aprobado'
        : doc?.estado === 'rechazado' || c1?.estado === 'rechazado'
          ? 'rechazado'
          : doc?.estado === 'pendiente' || c1?.estado === 'pendiente'
            ? 'pendiente'
            : 'falta';
    const nombre = NOMBRE_REQUISITO[r.requisito] ?? [r.requisito, r.requisito];
    return {
      requisito: r.requisito,
      grupo: r.nivel === 'conductor' ? ('perfil' as const) : ('vehiculo' as const),
      nombre: ingles ? nombre[1] : nombre[0],
      estado,
      motivo: estado === 'rechazado' ? (doc?.motivo ?? '') : '',
    };
  });
  return c.json({
    servicioId,
    vehiculo: vehiculo ?? null,
    // Lo del perfil ya aprobado: sale en verde y no se vuelve a pedir.
    verificados: papeles.filter((p) => p.grupo === 'perfil' && p.estado === 'aprobado'),
    // Lo que falta para ESTE servicio (incluye lo del perfil pendiente o rechazado).
    faltan: papeles.filter((p) => p.estado !== 'aprobado'),
  });
});
