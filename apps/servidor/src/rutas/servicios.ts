import { cuantosHay } from '../canarioLecturas';
import { guardarFoto } from '../fotoLimpia';
import { Hono } from 'hono';
import { esConductorOcupado } from '../operaciones';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId, verificarClave } from '../cripto';
import { SERVICIOS_EN_PRUEBA, SERVICIOS_PILOTO, serviciosImplementados } from '../esquema';
import { esParticipante } from './piloto';
import { entornoDe } from '../entorno';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import type { Entorno } from '@tumbite/compartido';
import { ErrorDatos, leerCuerpo } from '../validar';
import { ZONA_INICIAL, zonaPara } from './zonas';
import { exigirComisionEnMoneda } from '../finanzas/conductor';
import { SERVICIOS_VIAJE, perfilPasajeros } from '@tumbite/compartido';
import { paisDelConductor } from '../paisConductor';
import {
  PAISES_PASAJEROS_ABRIBLES,
  abrible,
  aperturaPais,
  aperturasVigentes,
  clavePasajerosPais,
  paisAbiertoPara,
} from '../pasajerosPais';

const SERVICIOS_VIAJE_SET = new Set<string>(SERVICIOS_VIAJE);

/**
 * Multiservicio, Fase 1 (15 oct 2026). Catálogo de servicios, vehículos, habilitaciones y
 * preferencias del conductor (docs/ARQUITECTURA-MULTISERVICIO-V1.md §11, §13, §14 y V1.1).
 * Comida no lee nada de esto todavía: el despacho de Comida sigue igual (migración M6 aparte).
 * Moto y Carro NO se pueden encender: no están en SERVICIOS_IMPLEMENTADOS, los disparadores de
 * schema.sql lo exigen y, además, esta fase rechaza encender un servicio que lleva personas.
 */
export const servicios = new Hono<{ Bindings: Env; Variables: Variables }>();
type Db = D1Database;

// ---------------------------------------------------------------- ayudas comunes

/** «cliente@1.4.0» → 1004000. Sin cabecera, la versión publicada antes de este cambio (0.1.0). */
export function versionNum(v: string | undefined | null): number {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
  if (!m) return versionNum('0.1.0');
  return Number(m[1]) * 1_000_000 + Number(m[2]) * 1_000 + Number(m[3]);
}
const versionDeApp = (cabecera: string | undefined, app: 'cliente' | 'driver') => {
  const [nombre, version] = (cabecera ?? '').split('@');
  return versionNum(nombre === app ? version : undefined);
};

/** Convierte el aviso de un disparador de la base en un mensaje claro (409). */
const RESTRICCIONES = new Map<string, string>([
  ['servicio_no_implementado', 'Este servicio todavía no está programado; no se puede encender.'],
  [
    'servicio_pasajeros_sin_requisitos_minimos',
    'Un servicio de pasajeros no se puede encender sin sus requisitos mínimos de seguridad.',
  ],
  ['vehiculo_transicion_invalida', 'Ese cambio de estado no está permitido para este vehículo.'],
  [
    'vehiculo_sin_documentos_aprobados',
    'Primero aprueba el registro y el seguro vigentes del vehículo.',
  ],
  [
    'habilitacion_con_requisitos_faltantes',
    'A esta persona todavía le faltan requisitos para este servicio.',
  ],
  ['vehiculos_placa_unica', 'Esa placa ya está registrada en otra cuenta.'],
  ['UNIQUE constraint failed: index', 'Esa placa ya está registrada en otra cuenta.'],
  ['CHECK constraint failed', 'Faltan datos obligatorios para ese cambio (por ejemplo, la placa).'],
]);
async function conRestricciones<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    const texto = String(e instanceof Error ? e.message : e);
    for (const [clave, mensaje] of RESTRICCIONES)
      if (texto.includes(clave)) throw new ErrorDatos(mensaje, undefined, 409);
    throw e;
  }
}

async function auditar(
  db: Db,
  actor: string,
  accion: string,
  objeto: string,
  antes: unknown,
  despues: unknown,
) {
  await db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(actor, accion, objeto, JSON.stringify(antes ?? null), JSON.stringify(despues ?? null))
    .run();
}

export type Servicio = {
  id: string;
  tipo_operacion: string;
  nombre_es: string;
  nombre_en: string;
  descripcion_es: string;
  descripcion_en: string;
  icono: string;
  orden: number;
  estado: string;
  transporta_personas: number;
  version_min_cliente: string;
  version_min_driver: string;
  zona_estado: string | null;
  activo_desde: string | null;
  activo_hasta: string | null;
  implementado: number;
  piloto: number;
};

export async function catalogo(db: Db, zonaId: string | null): Promise<Servicio[]> {
  const { results } = await db
    .prepare(
      `SELECT s.*, sz.estado AS zona_estado, sz.activo_desde, sz.activo_hasta,
              EXISTS (SELECT 1 FROM servicios_implementados si WHERE si.servicio_id = s.id) AS implementado,
              EXISTS (SELECT 1 FROM servicios_piloto sp WHERE sp.servicio_id = s.id AND sp.zona_id = ?) AS piloto
         FROM servicios s
         LEFT JOIN servicios_zona sz ON sz.servicio_id = s.id AND sz.zona_id = ?
        WHERE s.estado != 'oculto'
        ORDER BY s.orden, s.id`,
    )
    .bind(zonaId ?? '', zonaId ?? '')
    .all<Servicio>();
  return results;
}

/** Estado efectivo de un servicio en una zona, sin mirar la versión de la app. */
function estadoEfectivo(
  s: Servicio,
  ahora: string,
  participante = false,
): 'disponible' | 'proximamente' | 'suspendido' | 'no_disponible_zona' {
  if (s.estado === 'suspendido') return 'suspendido';
  // C-PILOTO-SERVICIOS: encendido «solo piloto» en esta ciudad, para los participantes.
  if (participante && s.piloto && SERVICIOS_PILOTO.has(s.id) && s.zona_estado !== 'suspendido')
    return 'disponible';
  if (s.estado !== 'disponible' || !s.implementado) return 'proximamente';
  if (!s.zona_estado) return 'no_disponible_zona';
  if (s.zona_estado === 'proximamente') return 'proximamente';
  if (s.zona_estado === 'suspendido') return 'suspendido';
  if (s.zona_estado !== 'disponible') return 'no_disponible_zona';
  if (s.activo_desde && s.activo_desde > ahora) return 'proximamente';
  if (s.activo_hasta && s.activo_hasta <= ahora) return 'no_disponible_zona';
  return 'disponible';
}
const ahoraSql = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/** El estado efectivo de UN servicio en una zona (lo usan las cotizaciones de viaje). */
export async function estadoServicioEnZona(
  db: Db,
  servicioId: string,
  zonaId: string,
  usuarioId: string | null = null,
) {
  const s = (await catalogo(db, zonaId)).find((x) => x.id === servicioId);
  const participante = usuarioId ? await esParticipante(db, usuarioId) : false;
  return s ? estadoEfectivo(s, ahoraSql(), participante) : 'no_disponible_zona';
}
const ACCION = new Map([
  ['disponible', 'abrir'],
  ['proximamente', 'muy_pronto'],
  ['suspendido', 'en_pausa'],
  ['no_disponible_zona', 'no_disponible_zona'],
]);

// ---------------------------------------------------------------- catálogo (cliente)

const coord = z.coerce.number().finite().optional();
servicios.get('/servicios', async (c) => {
  const db = base(c);
  const q = z.object({ lat: coord, lng: coord }).safeParse(c.req.query());
  const lat = q.success ? q.data.lat : undefined;
  const lng = q.success ? q.data.lng : undefined;
  let zona: { id: string; nombre: string } | null = await zonaPara(db, lat, lng);
  const u = c.get('usuario');
  if (!zona && (lat == null || lng == null) && u) {
    const f = await db
      .prepare(
        'SELECT z.id, z.nombre FROM usuarios u JOIN zonas z ON z.id = u.zona_id WHERE u.id = ?',
      )
      .bind(u.id)
      .first<{ id: string; nombre: string }>();
    if (f) zona = f;
  }
  // Sin ubicación (la web sin permiso de GPS), la ciudad inicial: lo mismo que /datos/restaurantes,
  // así el inicio no marca «Pronto» a Comida mientras la lista de restaurantes sí carga.
  if (!zona && lat == null && lng == null) {
    const f = await db
      .prepare('SELECT id, nombre FROM zonas WHERE id = ?')
      .bind(ZONA_INICIAL)
      .first<{ id: string; nombre: string }>();
    if (f) zona = f;
  }
  const version = versionDeApp(c.req.header('x-tumbite-app'), 'cliente');
  const ingles = (c.req.header('x-idioma') ?? '').startsWith('en');
  const ahora = ahoraSql();
  const participante = u ? await esParticipante(db, u.id) : false;
  const lista = (await catalogo(db, zona?.id ?? null)).map((s) => {
    let estado: string = estadoEfectivo(s, ahora, participante);
    let accion = ACCION.get(estado) ?? 'muy_pronto';
    if (estado === 'disponible' && version < versionNum(s.version_min_cliente))
      accion = 'actualizar_app';
    if (!zona && estado === 'disponible') {
      estado = 'no_disponible_zona';
      accion = 'no_disponible_zona';
    }
    return {
      id: s.id,
      nombre: ingles ? s.nombre_en : s.nombre_es,
      descripcion: ingles ? s.descripcion_en : s.descripcion_es,
      icono: s.icono,
      orden: s.orden,
      estado,
      accion,
    };
  });
  // Con sesión la lista es de esa persona (el piloto cambia lo que ve): nunca en la caché compartida.
  c.header('cache-control', u ? 'private, no-store' : 'public, max-age=60');
  return c.json({ zona: zona ? { id: zona.id, nombre: zona.nombre } : null, servicios: lista });
});

// ---------------------------------------------------------------- conductor

export type EstadoConductor = {
  servicioId: string;
  nombre: string;
  estadoServicio: string;
  habilitacion: string;
  vehiculoCompatible: boolean;
  requisitosFaltantes: string[];
  preferencia: boolean;
  puedeActivar: boolean;
  motivo: string;
};

/**
 * La regla de un servicio para un conductor, sin consultas (ETP-5): la usan `estadoDelConductor`
 * (uno a uno, lo que ve el conductor) y el despacho por lotes (`motivosServicio`). Una sola regla.
 */
export function evaluarServicio(e: {
  s: Servicio;
  ahora: string;
  habilitacion: { estado: string; vence_en: string | null } | undefined;
  preferencia: boolean | undefined;
  vehiculo: { tipo: string; estado: string } | null;
  tiposCompatibles: string[];
  requisitosFaltantes: string[];
  versionDriver: number;
  ingles: boolean;
}): EstadoConductor {
  const { s, ahora, vehiculo, requisitosFaltantes } = e;
  const estadoServicio = estadoEfectivo(s, ahora);
  const h = e.habilitacion;
  // Comida, compatibilidad: quien ya reparte hoy no tiene fila y sigue habilitado («legado»).
  let habilitacion = h?.estado ?? (s.id === 'comida' ? 'aprobada' : 'sin_solicitar');
  if (habilitacion === 'aprobada' && h?.vence_en && h.vence_en <= ahora) habilitacion = 'vencida';
  const vehiculoCompatible =
    s.id === 'comida' && !vehiculo
      ? true // Comida hoy no exige vehículo registrado en esta tabla
      : Boolean(
          vehiculo && vehiculo.estado === 'aprobado' && e.tiposCompatibles.includes(vehiculo.tipo),
        );
  const versionOk = e.versionDriver >= versionNum(s.version_min_driver);
  const puedeActivar =
    estadoServicio === 'disponible' &&
    habilitacion === 'aprobada' &&
    vehiculoCompatible &&
    requisitosFaltantes.length === 0 &&
    versionOk;
  const motivo =
    estadoServicio === 'proximamente'
      ? 'proximamente'
      : estadoServicio === 'suspendido'
        ? 'en_pausa'
        : estadoServicio === 'no_disponible_zona'
          ? 'no_disponible_zona'
          : !versionOk
            ? 'actualizar_app'
            : habilitacion === 'pendiente'
              ? 'pendiente_aprobacion'
              : habilitacion !== 'aprobada'
                ? 'sin_habilitacion'
                : requisitosFaltantes.length
                  ? 'requisitos_faltantes'
                  : !vehiculoCompatible
                    ? 'vehiculo_incompatible'
                    : 'habilitado';
  return {
    servicioId: s.id,
    nombre: e.ingles ? s.nombre_en : s.nombre_es,
    estadoServicio,
    habilitacion,
    vehiculoCompatible,
    requisitosFaltantes,
    preferencia: (e.preferencia ?? s.id === 'comida') && puedeActivar,
    puedeActivar,
    motivo,
  };
}

export const ahoraServicios = () => ahoraSql();

export async function estadoDelConductor(
  db: Db,
  conductorId: string,
  ingles: boolean,
  versionDriver: number,
): Promise<{
  vehiculoActivo: { id: string; tipo: string; estado: string } | null;
  servicios: EstadoConductor[];
}> {
  // La fila de repartidores nace la primera vez que usa la app; antes, su zona es la de su cuenta
  // (y si no tiene, la misma de fábrica que usa la tabla de repartidores).
  const rep = await db
    .prepare(
      `SELECT COALESCE(r.zona_id, u.zona_id, 'US-FL-MIAMI') AS zona_id, r.vehiculo_activo_id
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?`,
    )
    .bind(conductorId)
    .first<{ zona_id: string; vehiculo_activo_id: string | null }>();
  const vehiculo = rep?.vehiculo_activo_id
    ? await db
        .prepare('SELECT id, tipo, estado FROM vehiculos WHERE id = ? AND conductor_id = ?')
        .bind(rep.vehiculo_activo_id, conductorId)
        .first<{ id: string; tipo: string; estado: string }>()
    : null;
  const [lista, habs, prefs, compat, faltan] = await Promise.all([
    catalogo(db, rep?.zona_id ?? null),
    db
      .prepare('SELECT servicio_id, estado, vence_en FROM habilitaciones WHERE conductor_id = ?')
      .bind(conductorId)
      .all<{ servicio_id: string; estado: string; vence_en: string | null }>(),
    db
      .prepare('SELECT servicio_id, activa FROM preferencias_servicio WHERE conductor_id = ?')
      .bind(conductorId)
      .all<{ servicio_id: string; activa: number }>(),
    db
      .prepare('SELECT servicio_id, vehiculo_tipo, anio_minimo FROM servicio_vehiculos')
      .all<{ servicio_id: string; vehiculo_tipo: string; anio_minimo: number | null }>(),
    db
      .prepare(
        `SELECT sr.servicio_id, sr.requisito FROM servicio_requisitos sr
           JOIN requisitos_def rd ON rd.requisito = sr.requisito
          WHERE sr.obligatorio = 1 AND NOT EXISTS (
                SELECT 1 FROM cumplimientos c
                 WHERE c.conductor_id = ? AND c.requisito = sr.requisito AND c.estado = 'aprobado'
                   AND c.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN ? ELSE '' END
                   AND (c.vence_en IS NULL OR c.vence_en > datetime('now')))
         UNION
         -- G4: lo que pide el vehículo activo (licencia y seguro en carro o moto).
         SELECT svr.servicio_id, svr.requisito FROM servicio_vehiculo_requisitos svr
           JOIN requisitos_def rd ON rd.requisito = svr.requisito
          WHERE svr.vehiculo_tipo = ? AND NOT EXISTS (
                SELECT 1 FROM cumplimientos c
                 WHERE c.conductor_id = ? AND c.requisito = svr.requisito AND c.estado = 'aprobado'
                   AND c.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN ? ELSE '' END
                   AND (c.vence_en IS NULL OR c.vence_en > datetime('now')))
          ORDER BY 1, 2`,
      )
      .bind(
        conductorId,
        vehiculo?.estado === 'aprobado' ? vehiculo.id : '-',
        vehiculo?.estado === 'aprobado' ? vehiculo.tipo : '-',
        conductorId,
        vehiculo?.estado === 'aprobado' ? vehiculo.id : '-',
      )
      .all<{ servicio_id: string; requisito: string }>(),
  ]);
  const hab = new Map(habs.results.map((h) => [h.servicio_id, h]));
  const pref = new Map(prefs.results.map((p) => [p.servicio_id, p.activa === 1]));
  const ahora = ahoraSql();
  const serviciosConductor = lista.map((s) =>
    evaluarServicio({
      s,
      ahora,
      habilitacion: hab.get(s.id),
      preferencia: pref.get(s.id),
      vehiculo,
      tiposCompatibles: compat.results
        .filter((x) => x.servicio_id === s.id)
        .map((x) => x.vehiculo_tipo),
      requisitosFaltantes: faltan.results
        .filter((f) => f.servicio_id === s.id)
        .map((f) => f.requisito),
      versionDriver,
      ingles,
    }),
  );
  return { vehiculoActivo: vehiculo ?? null, servicios: serviciosConductor };
}

servicios.get('/conductor/servicios', async (c) => {
  const u = exigir(c, 'repartidor');
  return c.json(
    await estadoDelConductor(
      base(c),
      u.id,
      (c.req.header('x-idioma') ?? '').startsWith('en'),
      versionDeApp(c.req.header('x-tumbite-app'), 'driver'),
    ),
  );
});

servicios.put('/conductor/preferencias', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const { servicioId, activa } = await leerCuerpo(
    c,
    z.object({ servicioId: z.string().min(2).max(32), activa: z.boolean() }),
  );
  const estado = await estadoDelConductor(
    db,
    u.id,
    false,
    versionDeApp(c.req.header('x-tumbite-app'), 'driver'),
  );
  const s = estado.servicios.find((x) => x.servicioId === servicioId);
  if (!s) throw new ErrorDatos('Ese servicio no existe.', 'servicioId', 404);
  if (activa && !s.puedeActivar)
    throw new ErrorDatos('Este servicio todavía no está disponible para ti.', 'servicioId', 409);
  await db
    .prepare(
      `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, ?, ?)
       ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET activa = excluded.activa, actualizado_en = datetime('now')`,
    )
    .bind(u.id, servicioId, activa ? 1 : 0)
    .run();
  return c.json({ servicioId, activa });
});

// ---------------------------------------------------------------- vehículos (conductor)

const MOTORIZADOS = new Set(['carro', 'moto', 'scooter']);
const datosVehiculo = z.object({
  tipo: z.enum(['carro', 'moto', 'scooter', 'bicicleta', 'a_pie']),
  marca: z.string().trim().max(40).default(''),
  modelo: z.string().trim().max(40).default(''),
  anio: z.number().int().min(1980).max(2100).nullable().optional(),
  color: z.string().trim().max(30).default(''),
  placa: z
    .string()
    .trim()
    .max(12)
    .regex(/^[A-Za-z0-9 -]*$/, 'La placa solo lleva letras, números, espacios o guiones.')
    .default(''),
  placaEstado: z
    .string()
    .trim()
    .max(2)
    .regex(/^[A-Za-z]{0,2}$/, 'El estado de la placa son dos letras (por ejemplo, FL).')
    .default(''),
  plazas: z.number().int().min(1).max(8).nullable().optional(),
  // C-ENVIO-TAMANO: una moto con cajón lleva paquetes medianos (hasta 15 kg).
  conCajon: z.boolean().optional(),
});

/**
 * C-PAPELES-CONDUCTOR: donde la placa es nacional (Venezuela) no hay «estado que la emitió»: se
 * guarda con el código del país, así la placa sigue siendo única y el envío no la pide.
 */
function conPlacaDelPais<T extends { placaEstado: string }>(d: T, donde: { pais: string }): T {
  return perfilPasajeros(donde.pais).placaNacional ? { ...d, placaEstado: donde.pais } : d;
}

async function miVehiculo(db: Db, conductorId: string, id: string) {
  const v = await db
    .prepare('SELECT * FROM vehiculos WHERE id = ? AND conductor_id = ?')
    .bind(id, conductorId)
    .first<{ id: string; tipo: string; estado: string; placa: string; placa_estado: string }>();
  if (!v) throw new ErrorDatos('No encontramos ese vehículo.', undefined, 404);
  return v;
}

servicios.get('/conductor/vehiculos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const [{ results: vehiculos }, { results: docs }, rep] = await Promise.all([
    db
      .prepare(
        "SELECT id, tipo, marca, modelo, anio, color, placa, placa_estado AS placaEstado, plazas, estado, motivo FROM vehiculos WHERE conductor_id = ? AND estado != 'retirado' ORDER BY creado_en",
      )
      .bind(u.id)
      .all<{ id: string }>(),
    db
      .prepare(
        "SELECT d.id, d.vehiculo_id AS vehiculoId, d.tipo, d.estado, d.motivo, d.vence_en AS venceEn FROM vehiculo_documentos d JOIN vehiculos v ON v.id = d.vehiculo_id WHERE v.conductor_id = ? AND d.estado != 'reemplazado'",
      )
      .bind(u.id)
      .all<{ vehiculoId: string }>(),
    db
      .prepare('SELECT vehiculo_activo_id AS id FROM repartidores WHERE usuario_id = ?')
      .bind(u.id)
      .first<{ id: string | null }>(),
  ]);
  return c.json({
    vehiculoActivoId: rep?.id ?? null,
    vehiculos: vehiculos.map((v) => ({
      ...v,
      documentos: docs.filter((d) => d.vehiculoId === v.id),
    })),
  });
});

servicios.post('/conductor/vehiculos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const d = conPlacaDelPais(await leerCuerpo(c, datosVehiculo), await paisDelConductor(db, u.id));
  const vivos = await db
    .prepare("SELECT COUNT(*) AS n FROM vehiculos WHERE conductor_id = ? AND estado != 'retirado'")
    .bind(u.id)
    .first<{ n: number }>();
  if (Number(vivos?.n) >= 5)
    throw new ErrorDatos('Puedes tener hasta 5 vehículos registrados.', undefined, 409);
  const id = nuevoId();
  await conRestricciones(
    db
      .prepare(
        'INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, anio, color, placa, placa_estado, plazas, con_cajon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        u.id,
        d.tipo,
        d.marca,
        d.modelo,
        d.anio ?? null,
        d.color,
        d.placa.toUpperCase(),
        d.placaEstado.toUpperCase(),
        d.plazas ?? null,
        d.tipo === 'moto' && d.conCajon ? 1 : 0,
      )
      .run(),
  );
  return c.json({ id, estado: 'registrado' }, 201);
});

servicios.put('/conductor/vehiculos/:id', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await miVehiculo(db, u.id, c.req.param('id'));
  if (!['registrado', 'rechazado'].includes(v.estado))
    throw new ErrorDatos(
      'Este vehículo ya está en revisión o aprobado; no se puede editar.',
      undefined,
      409,
    );
  const d = conPlacaDelPais(await leerCuerpo(c, datosVehiculo), await paisDelConductor(db, u.id));
  await conRestricciones(
    db
      .prepare(
        "UPDATE vehiculos SET tipo = ?, marca = ?, modelo = ?, anio = ?, color = ?, placa = ?, placa_estado = ?, plazas = ?, actualizado_en = datetime('now') WHERE id = ? AND estado IN ('registrado', 'rechazado')",
      )
      .bind(
        d.tipo,
        d.marca,
        d.modelo,
        d.anio ?? null,
        d.color,
        d.placa.toUpperCase(),
        d.placaEstado.toUpperCase(),
        d.plazas ?? null,
        v.id,
      )
      .run(),
  );
  return c.json({ ok: true });
});

export const MAX_DOC_BYTES = 5 * 1024 * 1024;
const TIPOS_DOC = z.enum([
  'registro',
  'seguro',
  'seguro_pasajeros',
  'inspeccion',
  'foto_frente',
  'foto_lado',
  'foto_placa',
  'foto_interior',
]);
/** Mira los primeros bytes: JPG, PNG, WebP o PDF. */
function tipoDeArchivo(b: Uint8Array): [string, string] | null {
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ['image/jpeg', 'jpg'];
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return ['image/png', 'png'];
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return ['image/webp', 'webp'];
  if (ascii(0, 5) === '%PDF-') return ['application/pdf', 'pdf'];
  return null;
}

servicios.post('/conductor/vehiculos/:id/documentos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await miVehiculo(db, u.id, c.req.param('id'));
  if (['retirado', 'suspendido'].includes(v.estado))
    throw new ErrorDatos('Este vehículo no acepta documentos nuevos.', undefined, 409);
  const q = z
    .object({
      tipo: TIPOS_DOC,
      vence: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .safeParse(c.req.query());
  if (!q.success) throw new ErrorDatos('Elige qué documento estás subiendo.', 'tipo', 400);
  if (Number(c.req.header('content-length') ?? 0) > MAX_DOC_BYTES)
    throw new ErrorDatos('El archivo pesa demasiado. El máximo es 5 MB.', 'archivo', 413);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (!bytes.byteLength) throw new ErrorDatos('No llegó ningún archivo.', 'archivo', 400);
  if (bytes.byteLength > MAX_DOC_BYTES)
    throw new ErrorDatos('El archivo pesa demasiado. El máximo es 5 MB.', 'archivo', 413);
  const tipo = tipoDeArchivo(bytes);
  if (!tipo) throw new ErrorDatos('Sube el documento en JPG, PNG, WebP o PDF.', 'archivo', 415);
  if (!c.env.BUCKET)
    throw new ErrorDatos(
      'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  const id = nuevoId();
  // Privado: no hay ruta pública que lo sirva; solo el panel de administración lo abre.
  const clave = `vehiculos/${u.id}/${v.id}/${id}.${tipo[1]}`;
  // Documento del vehículo: es evidencia que se revisa; conserva el original (carpeta privada).
  await guardarFoto(c.env.BUCKET, clave, bytes, tipo[0], { conservarOriginal: 'evidencia' });
  await db
    .prepare(
      'INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, vence_en) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, v.id, q.data.tipo, clave, q.data.vence ?? null)
    .run();
  return c.json({ id, estado: 'pendiente' }, 201);
});

servicios.post('/conductor/vehiculos/:id/enviar', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await miVehiculo(db, u.id, c.req.param('id'));
  if (MOTORIZADOS.has(v.tipo)) {
    if (!v.placa || !v.placa_estado)
      throw new ErrorDatos('Escribe la placa y el estado que la emitió.', 'placa', 422);
    const docs = await db
      .prepare(
        "SELECT COUNT(DISTINCT tipo) AS n FROM vehiculo_documentos WHERE vehiculo_id = ? AND tipo IN ('registro', 'seguro') AND estado IN ('pendiente', 'aprobado')",
      )
      .bind(v.id)
      .first<{ n: number }>();
    if (Number(docs?.n) < 2)
      throw new ErrorDatos(
        'Sube el registro y el seguro del vehículo antes de enviarlo.',
        undefined,
        422,
      );
  }
  await conRestricciones(
    db
      .prepare(
        "UPDATE vehiculos SET estado = 'en_revision', motivo = '', aprobado_por = NULL, actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(v.id)
      .run(),
  );
  return c.json({ estado: 'en_revision' });
});

/** ¿Tiene el conductor un pedido de Comida en curso? (no se cambia de vehículo a mitad). */
async function conPedidoEnCurso(db: Db, conductorId: string) {
  return Boolean(
    await db
      .prepare(
        `SELECT 1 FROM pedidos WHERE repartidor_id = ?1 AND estado IN ('aceptado', 'listo', 'en_camino')
          UNION ALL SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?1 LIMIT 1`,
      )
      .bind(conductorId)
      .first(),
  );
}

servicios.post('/conductor/vehiculos/:id/retirar', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await miVehiculo(db, u.id, c.req.param('id'));
  const activo = await db
    .prepare('SELECT 1 FROM repartidores WHERE usuario_id = ? AND vehiculo_activo_id = ?')
    .bind(u.id, v.id)
    .first();
  if (activo && (await conPedidoEnCurso(db, u.id)))
    throw new ErrorDatos(
      'Termina tu entrega en curso antes de cambiar de vehículo.',
      undefined,
      409,
    );
  await conRestricciones(
    db.batch([
      db
        .prepare(
          "UPDATE vehiculos SET estado = 'retirado', actualizado_en = datetime('now') WHERE id = ?",
        )
        .bind(v.id),
      db
        .prepare(
          'UPDATE repartidores SET vehiculo_activo_id = NULL WHERE usuario_id = ? AND vehiculo_activo_id = ?',
        )
        .bind(u.id, v.id),
    ]),
  );
  return c.json({ estado: 'retirado' });
});

servicios.put('/conductor/vehiculo-activo', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const { vehiculoId } = await leerCuerpo(
    c,
    z.object({ vehiculoId: z.string().max(64).nullable() }),
  );
  if (await conPedidoEnCurso(db, u.id))
    throw new ErrorDatos(
      'Termina tu entrega en curso antes de cambiar de vehículo.',
      undefined,
      409,
    );
  if (vehiculoId) {
    const v = await miVehiculo(db, u.id, vehiculoId);
    if (v.estado !== 'aprobado')
      throw new ErrorDatos('Ese vehículo todavía no está aprobado.', 'vehiculoId', 409);
  }
  await db.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)').bind(u.id).run();
  // Una sola sentencia: solo cambia si el vehículo sigue aprobado y es suyo en ese instante.
  // Fase 3: la base además lo impide con un pedido u operación en curso (aunque llegue a la vez).
  let r: D1Result;
  try {
    r = await db
      .prepare(
        `UPDATE repartidores SET vehiculo_activo_id = ?
          WHERE usuario_id = ? AND (? IS NULL OR EXISTS (
            SELECT 1 FROM vehiculos WHERE id = ? AND conductor_id = ? AND estado = 'aprobado'))`,
      )
      .bind(vehiculoId, u.id, vehiculoId, vehiculoId, u.id)
      .run();
  } catch (e) {
    if (esConductorOcupado(e))
      throw new ErrorDatos(
        'Termina tu entrega en curso antes de cambiar de vehículo.',
        undefined,
        409,
      );
    throw e;
  }
  if (!r.meta.changes)
    throw new ErrorDatos('No se pudo cambiar el vehículo. Intenta otra vez.', undefined, 409);
  return c.json({ vehiculoActivoId: vehiculoId });
});

// ---------------------------------------------------------------- administración

const ESTADOS_SERVICIO = z.enum(['disponible', 'proximamente', 'suspendido', 'oculto']);
const FECHA = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  ])
  .nullable()
  .optional();
const VERSION = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/)
  .optional();

/** Antes de escribir nada: ¿se puede encender este servicio en ese país? (lo usa «abrir ciudad»). */
export async function exigirPuedeEncender(c: Ctx, id: string, pais: string | null = null) {
  const s = await base(c)
    .prepare('SELECT transporta_personas FROM servicios WHERE id = ?')
    .bind(id)
    .first<{ transporta_personas: number }>();
  if (!s) throw new ErrorDatos('Ese servicio no existe.', undefined, 404);
  await bloquearPasajeros(c, id, s.transporta_personas, 'disponible', pais);
}

/**
 * Un servicio de pasajeros no se enciende salvo en dos casos: en el sitio de pruebas el que se está
 * construyendo (C-MOTO-SOLO-PRUEBAS), y en producción solo en un país que el superadmin abrió con la
 * marca en registro (C-MOTO-POR-PAIS; hoy ninguno). `pais` null = el servicio en general: basta con
 * que esté abierto en algún país.
 */
async function bloquearPasajeros(
  c: Ctx,
  id: string,
  transporta: number,
  estado: string | undefined,
  pais: string | null = null,
) {
  if (entornoDe(c.req.url) === 'pruebas' && SERVICIOS_EN_PRUEBA.has(id)) return;
  if (transporta !== 1 || estado !== 'disponible') return;
  const db = base(c);
  const abierto = pais
    ? await paisAbiertoPara(db, id, pais)
    : (await aperturasVigentes(db)).some(([s]) => s === id);
  if (abierto) return;
  throw new ErrorDatos(
    'Los servicios de pasajeros (Moto y Carro) no se pueden encender todavía.',
    'estado',
    409,
  );
}

servicios.get('/admin/servicios', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const [{ results: lista }, { results: zonas }, { results: habs }] = await Promise.all([
    db
      .prepare(
        'SELECT s.*, EXISTS (SELECT 1 FROM servicios_implementados si WHERE si.servicio_id = s.id) AS implementado FROM servicios s ORDER BY s.orden',
      )
      .all<{ id: string }>(),
    db.prepare('SELECT * FROM servicios_zona ORDER BY zona_id').all<{ servicio_id: string }>(),
    db
      .prepare(
        'SELECT servicio_id, estado, COUNT(*) AS n FROM habilitaciones GROUP BY servicio_id, estado',
      )
      .all<{ servicio_id: string }>(),
  ]);
  return c.json({
    implementadosEnEsteCodigo: [...serviciosImplementados(entornoDe(c.req.url)).keys()],
    servicios: lista.map((s) => ({
      ...s,
      zonas: zonas.filter((z) => z.servicio_id === s.id),
      habilitaciones: habs.filter((h) => h.servicio_id === s.id),
    })),
  });
});

servicios.put('/admin/servicios/:id', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const antes = await db
    .prepare('SELECT * FROM servicios WHERE id = ?')
    .bind(id)
    .first<{ transporta_personas: number }>();
  if (!antes) throw new ErrorDatos('Ese servicio no existe.', undefined, 404);
  const d = await leerCuerpo(
    c,
    z.object({
      nombreEs: z.string().trim().min(2).max(40).optional(),
      nombreEn: z.string().trim().min(2).max(40).optional(),
      descripcionEs: z.string().trim().max(200).optional(),
      descripcionEn: z.string().trim().max(200).optional(),
      orden: z.number().int().min(0).max(1000).optional(),
      estado: ESTADOS_SERVICIO.optional(),
      versionMinCliente: VERSION,
      versionMinDriver: VERSION,
    }),
  );
  await bloquearPasajeros(c, id, antes.transporta_personas, d.estado);
  await conRestricciones(
    db
      .prepare(
        `UPDATE servicios SET nombre_es = COALESCE(?, nombre_es), nombre_en = COALESCE(?, nombre_en),
           descripcion_es = COALESCE(?, descripcion_es), descripcion_en = COALESCE(?, descripcion_en),
           orden = COALESCE(?, orden), estado = COALESCE(?, estado),
           version_min_cliente = COALESCE(?, version_min_cliente), version_min_driver = COALESCE(?, version_min_driver),
           actualizado_en = datetime('now'), actualizado_por = ?
         WHERE id = ?`,
      )
      .bind(
        d.nombreEs ?? null,
        d.nombreEn ?? null,
        d.descripcionEs ?? null,
        d.descripcionEn ?? null,
        d.orden ?? null,
        d.estado ?? null,
        d.versionMinCliente ?? null,
        d.versionMinDriver ?? null,
        admin.id,
        id,
      )
      .run(),
  );
  const despues = await db.prepare('SELECT * FROM servicios WHERE id = ?').bind(id).first();
  await auditar(db, admin.id, 'servicio.editar', `servicio:${id}`, antes, despues);
  return c.json({ servicio: despues });
});

servicios.put('/admin/servicios/:id/zonas/:zona', async (c) => {
  const admin = exigir(c, 'admin');
  const { id, zona } = c.req.param();
  const d = await leerCuerpo(
    c,
    z.object({
      estado: z.enum(['disponible', 'proximamente', 'suspendido', 'no_disponible']),
      activoDesde: FECHA,
      activoHasta: FECHA,
      motivo: z.string().trim().max(200).default(''),
    }),
  );
  return c.json({ zona: await cambiarServicioEnZona(c, admin.id, id, zona, d) });
});

/** Cambia el estado de un servicio en una zona con todas sus compuertas (panel y «abrir ciudad»). */
export async function cambiarServicioEnZona(
  c: Ctx,
  adminId: string,
  id: string,
  zona: string,
  d: {
    estado: 'disponible' | 'proximamente' | 'suspendido' | 'no_disponible';
    activoDesde?: string | null;
    activoHasta?: string | null;
    motivo: string;
  },
) {
  const db = base(c);
  const s = await db
    .prepare('SELECT transporta_personas FROM servicios WHERE id = ?')
    .bind(id)
    .first<{ transporta_personas: number }>();
  if (!s) throw new ErrorDatos('Ese servicio no existe.', undefined, 404);
  const laZona = await db
    .prepare('SELECT pais, moneda FROM zonas WHERE id = ?')
    .bind(zona)
    .first<{ pais: string; moneda: string }>();
  if (!laZona) throw new ErrorDatos('Esa zona no existe.', undefined, 404);
  await bloquearPasajeros(c, id, s.transporta_personas, d.estado, laZona.pais);
  // C-COMISION-MONEDA: un viaje no se enciende en una ciudad cuya moneda la comisión no cubre.
  if (d.estado === 'disponible' && SERVICIOS_VIAJE_SET.has(id))
    await exigirComisionEnMoneda(db, id, laZona);
  const antes = await db
    .prepare('SELECT * FROM servicios_zona WHERE servicio_id = ? AND zona_id = ?')
    .bind(id, zona)
    .first();
  await conRestricciones(
    db
      .prepare(
        `INSERT INTO servicios_zona (servicio_id, zona_id, estado, activo_desde, activo_hasta, motivo, actualizado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(servicio_id, zona_id) DO UPDATE SET estado = excluded.estado, activo_desde = excluded.activo_desde,
           activo_hasta = excluded.activo_hasta, motivo = excluded.motivo, actualizado_por = excluded.actualizado_por,
           actualizado_en = datetime('now')`,
      )
      .bind(id, zona, d.estado, d.activoDesde ?? null, d.activoHasta ?? null, d.motivo, adminId)
      .run(),
  );
  const despues = await db
    .prepare('SELECT * FROM servicios_zona WHERE servicio_id = ? AND zona_id = ?')
    .bind(id, zona)
    .first();
  await auditar(db, adminId, 'servicio.zona', `servicio:${id}:${zona}`, antes, despues);
  return despues;
}

/**
 * Encender un servicio de viajes en una zona, también el servicio en general si estaba apagado
 * (el estado efectivo exige los dos). Devuelve el estado que queda en la zona.
 */
export async function encenderServicioEnZona(
  c: Ctx,
  adminId: string,
  id: string,
  zona: string,
  motivo: string,
): Promise<string> {
  const db = base(c);
  const s = await db
    .prepare('SELECT estado, transporta_personas FROM servicios WHERE id = ?')
    .bind(id)
    .first<{ estado: string; transporta_personas: number }>();
  if (!s) throw new ErrorDatos('Ese servicio no existe.', undefined, 404);
  if (s.estado !== 'disponible') {
    await bloquearPasajeros(c, id, s.transporta_personas, 'disponible');
    await conRestricciones(
      db
        .prepare(
          "UPDATE servicios SET estado = 'disponible', actualizado_en = datetime('now'), actualizado_por = ? WHERE id = ?",
        )
        .bind(adminId, id)
        .run(),
    );
    await auditar(db, adminId, 'servicio.editar', `servicio:${id}`, s, { estado: 'disponible' });
  }
  const r = await cambiarServicioEnZona(c, adminId, id, zona, {
    estado: 'disponible',
    motivo: motivo.slice(0, 200),
  });
  return String((r as { estado?: string } | null)?.estado ?? 'disponible');
}

// C-DESPACHO-CATALOGO (NXT-6): el interruptor por zona del reparto de Comida por catálogo.
servicios.get('/admin/despacho-catalogo', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT z.id, z.nombre, COALESCE(d.activo, 0) AS activo, d.actualizado_en
         FROM zonas z LEFT JOIN despacho_catalogo_zonas d ON d.zona_id = z.id
        WHERE z.activa = 1 ORDER BY z.nombre`,
    )
    .all<{ id: string; nombre: string; activo: number; actualizado_en: string | null }>();
  return c.json({
    zonas: results.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      activo: Number(r.activo) === 1,
      actualizadoEn: r.actualizado_en,
    })),
  });
});

servicios.put('/admin/despacho-catalogo/:zona', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const zona = c.req.param('zona');
  const { activo } = await leerCuerpo(c, z.object({ activo: z.boolean() }));
  if (!(await db.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(zona).first()))
    throw new ErrorDatos('Esa zona no existe.', undefined, 404);
  // Encenderlo donde Comida no está disponible dejaría la zona sin repartidores.
  if (activo && (await estadoServicioEnZona(db, 'comida', zona)) !== 'disponible')
    throw new ErrorDatos(
      'Comida no está disponible en esa zona: enciéndela antes de usar el catálogo para repartir.',
      'activo',
      409,
    );
  const antes = await db
    .prepare('SELECT activo FROM despacho_catalogo_zonas WHERE zona_id = ?')
    .bind(zona)
    .first<{ activo: number }>();
  await db
    .prepare(
      `INSERT INTO despacho_catalogo_zonas (zona_id, activo, actualizado_por) VALUES (?, ?, ?)
       ON CONFLICT(zona_id) DO UPDATE SET activo = excluded.activo,
         actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
    )
    .bind(zona, activo ? 1 : 0, admin.id)
    .run();
  await auditar(
    db,
    admin.id,
    'despacho_catalogo.cambiar',
    `zona:${zona}`,
    { activo: Number(antes?.activo ?? 0) === 1 },
    { activo },
  );
  return c.json({ zonaId: zona, activo });
});

servicios.get('/admin/vehiculos', async (c) => {
  exigir(c, 'admin');
  const estado = z
    .enum([
      'registrado',
      'en_revision',
      'aprobado',
      'rechazado',
      'suspendido',
      'vencido',
      'retirado',
    ])
    .catch('en_revision')
    .parse(c.req.query('estado') ?? 'en_revision');
  const db = base(c);
  const { results } = await db
    .prepare(
      `SELECT v.*, u.nombre AS conductor FROM vehiculos v JOIN usuarios u ON u.id = v.conductor_id
        WHERE v.estado = ? ORDER BY v.actualizado_en LIMIT 100`,
    )
    .bind(estado)
    .all<{ id: string }>();
  const ids = results.map((v) => v.id);
  const docs = ids.length
    ? (
        await db
          .prepare(
            `SELECT id, vehiculo_id AS vehiculoId, tipo, estado, motivo, vence_en AS venceEn FROM vehiculo_documentos
              WHERE estado != 'reemplazado' AND vehiculo_id IN (${ids.map(() => '?').join(',')})`,
          )
          .bind(...ids)
          .all<{ vehiculoId: string }>()
      ).results
    : [];
  return c.json({
    vehiculos: results.map((v) => ({
      ...v,
      documentos: docs.filter((d) => d.vehiculoId === v.id),
    })),
  });
});

servicios.get('/admin/vehiculos/:id/documentos/:doc/archivo', async (c) => {
  exigir(c, 'admin');
  const d = await base(c)
    .prepare('SELECT clave FROM vehiculo_documentos WHERE id = ? AND vehiculo_id = ?')
    .bind(c.req.param('doc'), c.req.param('id'))
    .first<{ clave: string }>();
  const obj = d && c.env.BUCKET ? await c.env.BUCKET.get(d.clave) : null;
  if (!obj) throw new ErrorDatos('No encontramos ese documento.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, no-store',
    },
  });
});

/** Documento del vehículo → requisito que cumple (si lo hay). */
const DOC_A_REQUISITO = new Map([
  ['seguro', 'seguro_vehiculo'],
  ['seguro_pasajeros', 'seguro_pasajeros'],
  ['inspeccion', 'inspeccion_vehiculo'],
]);

servicios.put('/admin/vehiculos/:id/documentos/:doc', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const { id, doc } = c.req.param();
  const d = await leerCuerpo(
    c,
    z.object({
      estado: z.enum(['aprobado', 'rechazado']),
      motivo: z.string().trim().max(200).default(''),
      venceEn: FECHA,
    }),
  );
  const antes = await db
    .prepare(
      `SELECT d.*, v.conductor_id FROM vehiculo_documentos d JOIN vehiculos v ON v.id = d.vehiculo_id
        WHERE d.id = ? AND d.vehiculo_id = ? AND d.estado IN ('pendiente', 'aprobado', 'rechazado')`,
    )
    .bind(doc, id)
    .first<{ tipo: string; conductor_id: string; vence_en: string | null }>();
  if (!antes) throw new ErrorDatos('No encontramos ese documento.', undefined, 404);
  const vence = d.venceEn ?? antes.vence_en;
  const requisito = DOC_A_REQUISITO.get(antes.tipo);
  await db.batch([
    db
      .prepare(
        "UPDATE vehiculo_documentos SET estado = ?, motivo = ?, vence_en = ?, revisado_por = ?, revisado_en = datetime('now') WHERE id = ?",
      )
      .bind(d.estado, d.motivo, vence, admin.id, doc),
    ...(requisito
      ? [
          db
            .prepare(
              `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, fuente_id, vence_en, aprobado_por)
               VALUES (?, ?, ?, ?, 'documento_vehiculo', ?, ?, ?)
               ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = excluded.estado,
                 fuente = excluded.fuente, fuente_id = excluded.fuente_id, vence_en = excluded.vence_en,
                 aprobado_por = excluded.aprobado_por, actualizado_en = datetime('now')`,
            )
            .bind(antes.conductor_id, id, requisito, d.estado, doc, vence, admin.id),
        ]
      : []),
  ]);
  await auditar(db, admin.id, 'vehiculo.documento', `vehiculo:${id}:${doc}`, antes, {
    ...d,
    venceEn: vence,
  });
  return c.json({ estado: d.estado });
});

servicios.put('/admin/vehiculos/:id', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      estado: z.enum(['aprobado', 'rechazado', 'suspendido']),
      motivo: z.string().trim().max(200).default(''),
    }),
  );
  if (d.estado !== 'aprobado' && !d.motivo)
    throw new ErrorDatos('Escribe el motivo para que la persona sepa qué corregir.', 'motivo', 422);
  const antes = await db
    .prepare('SELECT * FROM vehiculos WHERE id = ?')
    .bind(id)
    .first<{ conductor_id: string }>();
  if (!antes) throw new ErrorDatos('No encontramos ese vehículo.', undefined, 404);
  await conRestricciones(
    db.batch([
      db
        .prepare(
          `UPDATE vehiculos SET estado = ?, motivo = ?, aprobado_por = ?,
             aprobado_en = CASE WHEN ? = 'aprobado' THEN datetime('now') ELSE aprobado_en END,
             actualizado_en = datetime('now') WHERE id = ?`,
        )
        .bind(d.estado, d.motivo, admin.id, d.estado, id),
      // Un vehículo que deja de estar aprobado deja de ser el activo (Comida no lo lee aún).
      db
        .prepare(
          "UPDATE repartidores SET vehiculo_activo_id = NULL WHERE vehiculo_activo_id = ? AND ? != 'aprobado'",
        )
        .bind(id, d.estado),
    ]),
  );
  await auditar(db, admin.id, 'vehiculo.revision', `vehiculo:${id}`, antes, d);
  return c.json({ estado: d.estado });
});

servicios.get('/admin/habilitaciones', async (c) => {
  exigir(c, 'admin');
  const servicio = c.req.query('servicio') ?? '';
  const estado = c.req.query('estado') ?? 'pendiente';
  const { results } = await base(c)
    .prepare(
      `SELECT h.*, u.nombre AS conductor FROM habilitaciones h JOIN usuarios u ON u.id = h.conductor_id
        WHERE (? = '' OR h.servicio_id = ?) AND h.estado = ? ORDER BY h.actualizado_en LIMIT 100`,
    )
    .bind(servicio, servicio, estado)
    .all();
  return c.json({ habilitaciones: results });
});

servicios.put('/admin/habilitaciones/:conductor/:servicio', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const { conductor, servicio } = c.req.param();
  const d = await leerCuerpo(
    c,
    z.object({
      estado: z.enum(['pendiente', 'aprobada', 'rechazada', 'suspendida']),
      motivo: z.string().trim().max(200).default(''),
      venceEn: FECHA,
    }),
  );
  const existe = await db
    .prepare(
      "SELECT (SELECT 1 FROM usuarios WHERE id = ? AND rol = 'repartidor') AS persona, (SELECT 1 FROM servicios WHERE id = ?) AS servicio",
    )
    .bind(conductor, servicio)
    .first<{ persona: number | null; servicio: number | null }>();
  if (!existe?.persona || !existe.servicio)
    throw new ErrorDatos('No encontramos esa persona o ese servicio.', undefined, 404);
  const antes = await db
    .prepare('SELECT * FROM habilitaciones WHERE conductor_id = ? AND servicio_id = ?')
    .bind(conductor, servicio)
    .first();
  try {
    await conRestricciones(
      db
        .prepare(
          `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, motivo, aprobado_por, aprobado_en, vence_en)
           VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'aprobada' THEN datetime('now') END, ?)
           ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET estado = excluded.estado, motivo = excluded.motivo,
             aprobado_por = excluded.aprobado_por, aprobado_en = COALESCE(excluded.aprobado_en, habilitaciones.aprobado_en),
             vence_en = excluded.vence_en, actualizado_en = datetime('now')`,
        )
        .bind(conductor, servicio, d.estado, d.motivo, admin.id, d.estado, d.venceEn ?? null)
        .run(),
    );
  } catch (e) {
    if (e instanceof ErrorDatos && e.estado === 409 && d.estado === 'aprobada') {
      const { results } = await db
        .prepare(
          `SELECT sr.requisito FROM servicio_requisitos sr JOIN requisitos_def rd ON rd.requisito = sr.requisito
            WHERE sr.servicio_id = ? AND sr.obligatorio = 1 AND rd.nivel = 'conductor' AND NOT EXISTS (
              SELECT 1 FROM cumplimientos c WHERE c.conductor_id = ? AND c.vehiculo_id = '' AND c.requisito = sr.requisito
                AND c.estado = 'aprobado' AND (c.vence_en IS NULL OR c.vence_en > datetime('now')))`,
        )
        .bind(servicio, conductor)
        .all<{ requisito: string }>();
      return c.json(
        { error: e.message, requisitosFaltantes: results.map((r) => r.requisito) },
        409,
      );
    }
    throw e;
  }
  const despues = await db
    .prepare('SELECT * FROM habilitaciones WHERE conductor_id = ? AND servicio_id = ?')
    .bind(conductor, servicio)
    .first();
  await auditar(
    db,
    admin.id,
    'habilitacion',
    `habilitacion:${conductor}:${servicio}`,
    antes,
    despues,
  );
  return c.json({ habilitacion: despues });
});

/** Requisitos que revisa una persona del equipo (licencia, edad, capacitación, casco…). */
servicios.put('/admin/cumplimientos/:conductor/:requisito', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const { conductor, requisito } = c.req.param();
  const d = await leerCuerpo(
    c,
    z.object({
      estado: z.enum(['aprobado', 'rechazado', 'revocado']),
      venceEn: FECHA,
      vehiculoId: z.string().max(64).optional(),
    }),
  );
  const def = await db
    .prepare('SELECT nivel, verifica FROM requisitos_def WHERE requisito = ?')
    .bind(requisito)
    .first<{ nivel: string; verifica: string }>();
  if (!def) throw new ErrorDatos('Ese requisito no existe.', undefined, 404);
  // La identidad y los antecedentes los aprueban sus proveedores (KYC y Checkr), no una persona.
  if (def.verifica === 'kyc' || def.verifica === 'antecedentes')
    throw new ErrorDatos(
      'Este requisito lo aprueba la verificación automática, no el panel.',
      undefined,
      409,
    );
  // C-PAPELES-CONDUCTOR: la edad se aprueba solo si la fecha de nacimiento la cumple (piso del país).
  if (def.verifica === 'edad' && d.estado === 'aprobado') {
    const p = await db
      .prepare('SELECT fecha_nacimiento FROM usuarios WHERE id = ?')
      .bind(conductor)
      .first<{ fecha_nacimiento: string | null }>();
    const minima = perfilPasajeros((await paisDelConductor(db, conductor)).pais).edadMinima;
    const nacio = p?.fecha_nacimiento ? new Date(`${p.fecha_nacimiento}T00:00:00Z`) : null;
    const limite = new Date();
    limite.setUTCFullYear(limite.getUTCFullYear() - minima);
    if (!nacio || Number.isNaN(nacio.getTime()))
      throw new ErrorDatos(
        'Falta la fecha de nacimiento de esta persona para aprobar la edad.',
        'edad',
        422,
      );
    if (nacio > limite)
      throw new ErrorDatos(
        `Esta persona todavía no tiene ${minima} años: no se puede aprobar.`,
        'edad',
        409,
      );
  }
  const vehiculoId = def.nivel === 'vehiculo' ? (d.vehiculoId ?? '') : '';
  if (def.nivel === 'vehiculo') {
    const v = await db
      .prepare('SELECT 1 FROM vehiculos WHERE id = ? AND conductor_id = ?')
      .bind(vehiculoId, conductor)
      .first();
    if (!v) throw new ErrorDatos('Elige el vehículo de esta persona.', 'vehiculoId', 422);
  }
  const antes = await db
    .prepare(
      'SELECT * FROM cumplimientos WHERE conductor_id = ? AND vehiculo_id = ? AND requisito = ?',
    )
    .bind(conductor, vehiculoId, requisito)
    .first();
  await db
    .prepare(
      `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, vence_en, aprobado_por)
       VALUES (?, ?, ?, ?, 'revision_manual', ?, ?)
       ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = excluded.estado, fuente = excluded.fuente,
         vence_en = excluded.vence_en, aprobado_por = excluded.aprobado_por, actualizado_en = datetime('now')`,
    )
    .bind(conductor, vehiculoId, requisito, d.estado, d.venceEn ?? null, admin.id)
    .run();
  await auditar(
    db,
    admin.id,
    'cumplimiento',
    `cumplimiento:${conductor}:${vehiculoId}:${requisito}`,
    antes,
    d,
  );
  return c.json({ requisito, estado: d.estado });
});

servicios.get('/admin/auditoria', async (c) => {
  exigir(c, 'admin');
  const objeto = (c.req.query('objeto') ?? '').slice(0, 120);
  const { results } = await base(c)
    .prepare(
      "SELECT * FROM auditoria_admin WHERE (? = '' OR objeto LIKE ? || '%') ORDER BY id DESC LIMIT 100",
    )
    .bind(objeto, objeto)
    .all();
  return c.json({ auditoria: results });
});

// ---------------------------------------------------------------- C-MOTO-POR-PAIS

/** Qué países se pueden abrir para pasajeros y cuáles están abiertos hoy (superadmin). */
servicios.get('/admin/pasajeros-pais', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const lista = await Promise.all(
    [...PAISES_PASAJEROS_ABRIBLES].flatMap(([servicio, paises]) =>
      [...paises].map(async (pais) => ({
        servicio,
        pais,
        apertura: await aperturaPais(db, pais),
      })),
    ),
  );
  return c.json({
    paises: lista.map((x) => ({
      servicio: x.servicio,
      pais: x.pais,
      abierto: x.apertura?.servicios.includes(x.servicio) ?? false,
      solicitudMarca: x.apertura?.solicitudMarca ?? null,
      abiertoEn: x.apertura?.abiertoEn ?? null,
    })),
  });
});

/**
 * Abre o cierra un servicio de pasajeros en un país de producción. Abrir exige: que el código lo
 * permita (Moto en Venezuela; EE. UU. y Colombia no), el número de la solicitud de registro de la
 * marca Divoox en ese país y la confirmación escrita, además de la contraseña de quien lo hace.
 */
servicios.put('/admin/pasajeros-pais/:pais/:servicio', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const pais = c.req.param('pais').toUpperCase();
  const servicio = c.req.param('servicio');
  const d = await leerCuerpo(
    c,
    z.object({
      abierto: z.boolean(),
      solicitudMarca: z.string().trim().max(60).default(''),
      confirmo: z.boolean().default(false),
      clave: z.string().min(1, { error: 'Escribe tu contraseña.' }),
      nota: z.string().trim().max(300).default(''),
    }),
  );
  const f = await db
    .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(admin.id)
    .first<{ clave_hash: string }>();
  if (!f || !(await verificarClave(d.clave, f.clave_hash)))
    throw new ErrorDatos('La contraseña no es correcta.', 'clave', 403);
  const antes = await aperturaPais(db, pais);
  if (d.abierto) {
    if (!abrible(servicio, pais))
      throw new ErrorDatos('Este servicio no se puede abrir en ese país.', 'pais', 409);
    if (d.solicitudMarca.length < 4)
      throw new ErrorDatos(
        'Escribe el número de la solicitud de registro de la marca Divoox en ese país.',
        'solicitudMarca',
        422,
      );
    if (!d.confirmo)
      throw new ErrorDatos(
        'Confirma que lo legal y el seguro de pasajeros de ese país están listos.',
        'confirmo',
        422,
      );
  }
  const servicios_ = new Set(antes?.servicios ?? []);
  if (d.abierto) servicios_.add(servicio);
  else servicios_.delete(servicio);
  const despues = {
    servicios: [...servicios_],
    solicitudMarca: d.abierto ? d.solicitudMarca : (antes?.solicitudMarca ?? '----'),
    abiertoPor: admin.id,
    abiertoEn: new Date().toISOString().slice(0, 19).replace('T', ' '),
    nota: d.nota,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO config (clave, valor) VALUES (?, ?)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
      )
      .bind(clavePasajerosPais(pais), JSON.stringify(despues)),
    // Abrir declara el servicio como atendido por este código (los disparadores lo exigen); cerrarlo
    // en el último país lo suspende en todas las ciudades de ese país.
    ...(d.abierto
      ? [
          db
            .prepare(
              'INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES (?, 1)',
            )
            .bind(servicio),
        ]
      : [
          db
            .prepare(
              `UPDATE servicios_zona SET estado = 'suspendido', motivo = 'país cerrado para pasajeros', actualizado_por = ?,
                 actualizado_en = datetime('now')
               WHERE servicio_id = ? AND estado = 'disponible' AND zona_id IN (SELECT id FROM zonas WHERE pais = ?)`,
            )
            .bind(admin.id, servicio, pais),
        ]),
  ]);
  // Si ya no queda ningún país abierto para ese servicio, el servicio en general se suspende (en
  // producción; en el sitio de pruebas manda C-MOTO-SOLO-PRUEBAS).
  if (
    !d.abierto &&
    entornoDe(c.req.url) !== 'pruebas' &&
    !(await aperturasVigentes(db)).some(([s]) => s === servicio)
  )
    await db
      .prepare(
        "UPDATE servicios SET estado = 'suspendido', actualizado_en = datetime('now') WHERE id = ? AND estado = 'disponible'",
      )
      .bind(servicio)
      .run();
  await auditar(db, admin.id, 'pasajeros.pais', `pais:${pais}:${servicio}`, antes, despues);
  return c.json({ pais, servicio, abierto: d.abierto });
});

// ---------------------------------------------------------------- salud (canario)

export const DISPARADORES_SERVICIOS = [
  'servicios_exige_implementado',
  'servicios_exige_implementado_alta',
  'servicios_zona_exige_implementado',
  'servicios_zona_exige_implementado_alta',
  'servicios_zona_piso_pasajeros',
  'habilitaciones_exigen_requisitos',
  'habilitaciones_exigen_requisitos_alta',
  'vehiculos_aprobar_exige_documentos',
  'vehiculos_transicion_valida',
];

/**
 * Pieza «servicios» de /datos/salud: «error» si falta un disparador del catálogo, si un servicio
 * de pasajeros quedó encendido en esta fase, o si algo encendido no está implementado.
 */
export async function saludServicios(
  db: D1Database,
  entorno: Entorno | null = null,
  /** C-LECTURAS-SALUD: los disparadores ya leídos por el canario (una sola lectura de sqlite_master). */
  presentes?: Set<string>,
): Promise<'ok' | 'error'> {
  // En pruebas, el servicio de pasajeros en construcción puede estar encendido. En producción, solo
  // en las ciudades de un país abierto por el superadmin (C-MOTO-POR-PAIS; hoy ninguno).
  const enPrueba = entorno === 'pruebas' ? new Set(SERVICIOS_EN_PRUEBA.keys()) : new Set<string>();
  const abiertos = await aperturasVigentes(db);
  const abiertoEn = (servicio: string, pais: string | null) =>
    enPrueba.has(servicio) ||
    abiertos.some(([s, p]) => s === servicio && (pais === null || p === pais));
  const [f, { results: encendidos }] = await Promise.all([
    db
      .prepare(
        `SELECT
           ${presentes ? '?' : `(SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name IN (${DISPARADORES_SERVICIOS.map(() => '?').join(',')}))`} AS disparadores,
           (SELECT COUNT(*) FROM servicios s WHERE s.estado = 'disponible'
              AND NOT EXISTS (SELECT 1 FROM servicios_implementados i WHERE i.servicio_id = s.id)) AS sin_codigo`,
      )
      .bind(
        ...(presentes ? [cuantosHay(presentes, DISPARADORES_SERVICIOS)] : DISPARADORES_SERVICIOS),
      )
      .first<{ disparadores: number; sin_codigo: number }>(),
    db
      .prepare(
        `SELECT s.id AS servicio, NULL AS pais FROM servicios s WHERE s.transporta_personas = 1 AND s.estado = 'disponible'
         UNION ALL
         SELECT z.servicio_id, zz.pais FROM servicios_zona z JOIN servicios s ON s.id = z.servicio_id
           JOIN zonas zz ON zz.id = z.zona_id
          WHERE s.transporta_personas = 1 AND z.estado = 'disponible'`,
      )
      .all<{ servicio: string; pais: string | null }>(),
  ]);
  if (Number(f?.disparadores) !== DISPARADORES_SERVICIOS.length) return 'error';
  if (Number(f?.sin_codigo) > 0) return 'error';
  if (encendidos.some((e) => !abiertoEn(e.servicio, e.pais))) return 'error';
  return 'ok';
}
