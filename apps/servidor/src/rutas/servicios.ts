import {
  COMERCIOS_DE_SERVICIO,
  SERVICIOS_CON_CONDUCTOR,
  hayComerciosEnZona,
  hayQuienLoTome,
} from '../servicioSinOferta';
import { avisarSiQuedoActivo } from '../activacion';
import { ZONA_CONDUCTOR_SQL } from '../cuentaPais';
import { cuantosHay } from '../canarioLecturas';
import { ALTA_REPARTIDOR } from '../zonaConductor';
import {
  type RequisitoServicio,
  type VehiculoConductor,
  nombreVehiculo,
  vehiculoQueSirve,
} from '../vehiculoQueSirve';
import { darRegaloConductorNuevo } from '../saldoConductores';
import { alActivarseConductor } from '../camila/bienvenida';
import { guardarFoto } from '../fotoLimpia';
import { Hono } from 'hono';
import { esConductorOcupado } from '../operaciones';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { SERVICIOS_EN_PRUEBA, SERVICIOS_PILOTO, serviciosImplementados } from '../esquema';
import { esParticipante } from './piloto';
import { esCuentaPrueba } from './cuentaPrueba';
import { entornoDe } from '../entorno';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { type Entorno, faltaParaAprobarSinEnviar, textoPlano } from '@tumbite/compartido';
import {
  REQUISITO_EDAD,
  edadPorServicio,
  serviciosQuePidenEdad,
  sincronizarEdad,
} from '../edadYDocumento';
import { ErrorDatos, leerCuerpo } from '../validar';
import { ZONA_INICIAL, sinZonasDePrueba, zonaPara } from './zonas';
import { exigirComisionEnMoneda } from '../finanzas/conductor';
import {
  CATEGORIAS_CARRO,
  type CategoriaCarro,
  SERVICIOS_VIAJE,
  carroCumpleCategoria,
  perfilPasajeros,
} from '@tumbite/compartido';
import { paisDelConductor } from '../paisConductor';
import { listaEncendidaDelConductor } from '../papelesPais';
import {
  PAISES_PASAJEROS_ABRIBLES,
  SOLICITUD_MARCA_EEUU,
  abrible,
  aperturaPais,
  aperturasVigentes,
  clavePasajerosPais,
  paisAbiertoPara,
} from '../pasajerosPais';
import { accesoDe, alcanceObjetoSql, alcanceHabilitacionSql } from '../accesoInterno';
import { sqlPlano } from '../buscadorSql';

const SERVICIOS_VIAJE_SET = new Set<string>(SERVICIOS_VIAJE);

/**
 * Multiservicio, Fase 1 (15 oct 2026). Catálogo de servicios, vehículos, habilitaciones y
 * preferencias del conductor (docs/ARQUITECTURA-MULTISERVICIO-V1.md §11, §13, §14 y V1.1).
 * Comida no lee nada de esto todavía: el despacho de Comida sigue igual (migración M6 aparte).
 * Moto y Carro NO se pueden encender: no están en SERVICIOS_IMPLEMENTADOS, los disparadores de
 * schema.sql lo exigen y, además, esta fase rechaza encender un servicio que lleva personas.
 */
import {
  type Gracia,
  graciaDe,
  graciasDe,
  requisitosConGracia,
  seguroEnPlazo,
} from '../plazoPapeles';
import { anotarDecisionHumana } from './verificacionConductor';
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
  /** C-CUENTA-PRUEBA: encendido en esta zona solo para las cuentas marcadas de prueba. */
  solo_prueba: number;
  /** C-SERVICIO-SIN-TARIFA: hay tarifa activa de este servicio en la zona. */
  con_tarifa: number;
};

/**
 * C-SERVICIO-SIN-TARIFA (18 nov 2026, todos los países): los servicios que se cobran con la tarifa
 * por ciudad (tarifas_viaje). Sin tarifa activa en la zona no se ofrecen («no disponible en tu
 * zona»), aunque estén encendidos: antes el cliente veía Envíos y al pedir le salía «todavía no
 * tiene precio en tu ciudad», con el botón de solicitar activo.
 */
export const SERVICIOS_CON_TARIFA = new Set(['moto', 'carro', 'envios']);

export async function catalogo(db: Db, zonaId: string | null): Promise<Servicio[]> {
  const { results } = await db
    .prepare(
      `SELECT s.*, sz.estado AS zona_estado, sz.activo_desde, sz.activo_hasta,
              EXISTS (SELECT 1 FROM servicios_implementados si WHERE si.servicio_id = s.id) AS implementado,
              EXISTS (SELECT 1 FROM servicios_piloto sp WHERE sp.servicio_id = s.id AND sp.zona_id = ?) AS piloto,
              EXISTS (SELECT 1 FROM servicios_prueba sx WHERE sx.servicio_id = s.id AND sx.zona_id = ?) AS solo_prueba,
              EXISTS (SELECT 1 FROM tarifas_viaje t WHERE t.servicio_id = s.id AND t.zona_id = ? AND t.activa = 1) AS con_tarifa
         FROM servicios s
         LEFT JOIN servicios_zona sz ON sz.servicio_id = s.id AND sz.zona_id = ?
        WHERE s.estado != 'oculto'
        ORDER BY s.orden, s.id`,
    )
    .bind(zonaId ?? '', zonaId ?? '', zonaId ?? '', zonaId ?? '')
    .all<Servicio>();
  return results;
}

/** Estado efectivo de un servicio en una zona, sin mirar la versión de la app. */
function estadoEfectivo(
  s: Servicio,
  ahora: string,
  participante = false,
  prueba = false,
): 'disponible' | 'proximamente' | 'suspendido' | 'no_disponible_zona' {
  const e = estadoSinTarifa(s, ahora, participante, prueba);
  // C-SERVICIO-SIN-TARIFA: encendido pero sin precio en la ciudad = no se ofrece.
  if (e === 'disponible' && SERVICIOS_CON_TARIFA.has(s.id) && !s.con_tarifa)
    return 'no_disponible_zona';
  return e;
}
function estadoSinTarifa(
  s: Servicio,
  ahora: string,
  participante: boolean,
  prueba = false,
): 'disponible' | 'proximamente' | 'suspendido' | 'no_disponible_zona' {
  if (s.estado === 'suspendido') return 'suspendido';
  // C-CUENTA-PRUEBA: encendido en esta ciudad solo para cuentas de prueba (y ya construido).
  if (prueba && s.solo_prueba && s.implementado && s.zona_estado !== 'suspendido')
    return 'disponible';
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

export type ServicioAbierto = { id: string; es: string; en: string };

/**
 * C-PAIS-ABIERTO-SIN-PRONTO (25 nov 2026, todos los países): qué servicios están abiertos HOY al
 * público en cada país, con la misma regla que ve un cliente sin sesión en el catálogo
 * (`estadoEfectivo`): servicio encendido y construido, encendido en una ciudad activa que no es de
 * pruebas, dentro de su horario y con tarifa si se cobra por ciudad. En producción, un servicio de
 * pasajeros cuenta solo en un país abierto por el superadmin (C-MOTO-POR-PAIS). De aquí sale que
 * la web diga «Ya estamos en Venezuela» y nunca «muy pronto» para un país abierto. Solo lee: una
 * consulta y la de las aperturas; la ruta pública va con caché.
 */
export async function paisesAbiertos(
  db: Db,
  entorno: Entorno | null,
): Promise<Record<string, ServicioAbierto[]>> {
  return (await abiertosParaLaWeb(db, entorno)).paises;
}

/**
 * C-CIUDAD-ABIERTA-SIN-PRONTO (25 nov 2026, orden de Richard: la web pública sí tiene páginas de
 * ciudad) — Venezuela y todos los países. La clave pública de una ciudad: el nombre de su zona sin
 * acentos, en minúsculas y con guiones («El Vigía» → «el-vigia»). Nunca el id interno de la zona.
 */
export const claveCiudadPublica = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export type AbiertosWeb = {
  paises: Record<string, ServicioAbierto[]>;
  /** Por país, cada ciudad pública (por su clave) con lo que tiene abierto HOY. */
  ciudades: Record<string, Record<string, ServicioAbierto[]>>;
};

/**
 * Los países y las ciudades con al menos un servicio abierto al público, con la misma regla del
 * catálogo sin sesión. Una consulta, la de las aperturas y, por servicio con conductor o comercio y
 * ciudad, la de si hay quien lo tome. Sin zonas de pruebas ni ids internos.
 */
export async function abiertosParaLaWeb(db: Db, entorno: Entorno | null): Promise<AbiertosWeb> {
  const [{ results }, aperturas] = await Promise.all([
    db
      .prepare(
        `SELECT s.*, z.pais AS pais, z.id AS zona_id, z.nombre AS zona_nombre, sz.estado AS zona_estado, sz.activo_desde, sz.activo_hasta,
                EXISTS (SELECT 1 FROM servicios_implementados si WHERE si.servicio_id = s.id) AS implementado,
                0 AS piloto, 0 AS solo_prueba,
                EXISTS (SELECT 1 FROM tarifas_viaje t WHERE t.servicio_id = s.id AND t.zona_id = z.id AND t.activa = 1) AS con_tarifa
           FROM servicios_zona sz
           JOIN servicios s ON s.id = sz.servicio_id
           JOIN zonas z ON z.id = sz.zona_id
          WHERE sz.estado = 'disponible' AND s.estado = 'disponible' AND z.activa = 1
            AND ${sinZonasDePrueba('z.nombre')}
          ORDER BY z.pais, s.orden, s.id`,
      )
      .all<Servicio & { pais: string; zona_id: string; zona_nombre: string }>(),
    entorno === 'pruebas' ? Promise.resolve(null) : aperturasVigentes(db),
  ]);
  const ahora = ahoraSql();
  const porPais: Record<string, ServicioAbierto[]> = {};
  const porCiudad: Record<string, Record<string, ServicioAbierto[]>> = {};
  for (const s of results) {
    if (estadoEfectivo(s, ahora) !== 'disponible') continue;
    if (
      s.transporta_personas === 1 &&
      aperturas &&
      !aperturas.some(([sv, p]) => sv === s.id && p === s.pais)
    )
      continue;
    const clave = claveCiudadPublica(s.zona_nombre ?? '');
    let enCiudad: ServicioAbierto[] | null = null;
    if (clave) {
      const delPais = (porCiudad[s.pais] ??= {});
      enCiudad = new Map(Object.entries(delPais)).get(clave) ?? [];
      Object.assign(delPais, { [clave]: enCiudad });
    }
    if (enCiudad?.some((x) => x.id === s.id)) continue;
    // C-SERVICIO-SIN-OFERTA: encendido pero sin quien lo tome (Envíos sin conductores, Comida sin
    // restaurantes aprobados) no cuenta como abierto: el cliente tampoco lo puede pedir.
    if (SERVICIOS_CON_CONDUCTOR.has(s.id) && !(await hayQuienLoTome(db, s.zona_id, s.id))) continue;
    if (COMERCIOS_DE_SERVICIO.has(s.id) && !(await hayComerciosEnZona(db, s.zona_id, s.id)))
      continue;
    const item = { id: s.id, es: s.nombre_es, en: s.nombre_en };
    enCiudad?.push(item);
    const lista = (porPais[s.pais] ??= []);
    if (!lista.some((x) => x.id === s.id)) lista.push(item);
  }
  const conAlgo = <T extends unknown[]>(o: Record<string, T>) =>
    Object.fromEntries(Object.entries(o).filter(([, xs]) => xs.length > 0));
  const ciudades = Object.fromEntries(
    Object.entries(porCiudad)
      .map(([pais, cs]) => [pais, conAlgo(cs)] as const)
      .filter(([, cs]) => Object.keys(cs).length > 0),
  );
  return { paises: conAlgo(porPais), ciudades };
}

/** El estado efectivo de UN servicio en una zona (lo usan las cotizaciones de viaje). */
export async function estadoServicioEnZona(
  db: Db,
  servicioId: string,
  zonaId: string,
  usuarioId: string | null = null,
) {
  const s = (await catalogo(db, zonaId)).find((x) => x.id === servicioId);
  const participante = usuarioId ? await esParticipante(db, usuarioId) : false;
  const prueba = usuarioId ? await esCuentaPrueba(db, usuarioId) : false;
  // La cotización mira la tarifa aparte, con su propio mensaje («todavía no tiene precio»).
  return s ? estadoSinTarifa(s, ahoraSql(), participante, prueba) : 'no_disponible_zona';
}
/**
 * C-BANNER-SEGUN-SERVICIO (22 nov 2026) — todos los países. Los servicios que el PÚBLICO puede abrir
 * en una zona (sin piloto ni cuentas de prueba, con tarifa cuando la necesita). Lo usa la ruta pública
 * de banners para no anunciar un servicio donde no funciona. Sin zona: ninguno.
 */
export async function serviciosPublicosEnZona(db: Db, zonaId: string | null): Promise<Set<string>> {
  if (!zonaId) return new Set();
  const ahora = ahoraSql();
  const filas = await catalogo(db, zonaId);
  const sinQuien = await sinQuienLoTome(db, zonaId, filas, ahora);
  return new Set(
    filas
      .filter((s) => estadoEfectivo(s, ahora) === 'disponible' && !sinQuien.has(s.id))
      .map((s) => s.id),
  );
}

/**
 * C-SERVICIO-SIN-OFERTA (lado del cliente): de los servicios abiertos AL PÚBLICO en la zona, los que
 * necesitan un conductor y nadie de la zona tomaría (`SERVICIOS_CON_CONDUCTOR`), y Comida y tiendas
 * sin un comercio aprobado de su tipo (`COMERCIOS_DE_SERVICIO`). El piloto y
 * lo encendido solo para pruebas no se tocan. Una lectura por servicio abierto, y solo si lo está.
 */
async function sinQuienLoTome(db: Db, zonaId: string | null, filas: Servicio[], ahora: string) {
  const fuera = new Set<string>();
  if (!zonaId) return fuera;
  for (const s of filas) {
    if (s.zona_estado !== 'disponible' || estadoEfectivo(s, ahora) !== 'disponible') continue;
    if (SERVICIOS_CON_CONDUCTOR.has(s.id) && !(await hayQuienLoTome(db, zonaId, s.id)))
      fuera.add(s.id);
    // Comida y tiendas: solo donde hay un comercio aprobado de su tipo.
    else if (COMERCIOS_DE_SERVICIO.has(s.id) && !(await hayComerciosEnZona(db, zonaId, s.id)))
      fuera.add(s.id);
  }
  return fuera;
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
  const prueba = u ? await esCuentaPrueba(db, u.id) : false;
  const filas = await catalogo(db, zona?.id ?? null);
  const sinQuien = await sinQuienLoTome(db, zona?.id ?? null, filas, ahora);
  const lista = filas.map((s) => {
    let estado: string = estadoEfectivo(s, ahora, participante, prueba);
    // C-SERVICIO-SIN-OFERTA: abierto en la zona, pero nadie lo toma: no se ofrece (la app de la
    // tienda pinta la baldosa con la hoja «aún no hay» y no deja pedir).
    if (estado === 'disponible' && sinQuien.has(s.id)) estado = 'no_disponible_zona';
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
  /** C-CAMBIAR-VEHICULO: otro vehículo aprobado suyo que cumple todo lo de este servicio. */
  cambiarA?: { id: string; nombre: string; tipo: string } | null;
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
  /** C-PLAZO-PAPELES: la política de su país y, si corre, su plazo para subir papeles. */
  gracia?: Gracia;
  /** C-CUENTA-PRUEBA: el conductor es cuenta de prueba (ve lo encendido solo para pruebas). */
  prueba?: boolean;
}): EstadoConductor {
  const { s, ahora, vehiculo } = e;
  const enPlazo = Boolean(e.gracia?.activa);
  // Lo que su país no exige nunca no cuenta; dentro del plazo, solo lo que se pide para empezar.
  const requisitosFaltantes = requisitosConGracia(e.requisitosFaltantes, e.gracia);
  // El conductor puede conectarse aunque la ciudad aún no tenga tarifa (no le llegará nada hasta
  // que la tenga): C-SERVICIO-SIN-TARIFA solo cambia lo que se le ofrece al cliente.
  const estadoServicio = estadoSinTarifa(s, ahora, false, e.prueba === true);
  const h = e.habilitacion;
  // Comida, compatibilidad: quien ya reparte hoy no tiene fila y sigue habilitado («legado»).
  let habilitacion = h?.estado ?? (s.id === 'comida' ? 'aprobada' : 'sin_solicitar');
  if (habilitacion === 'aprobada' && h?.vence_en && h.vence_en <= ahora) habilitacion = 'vencida';
  // C-PLAZO-PAPELES: dentro de su plazo trabaja sin esperar la aprobación del equipo. Lo que el
  // equipo ya le negó o le suspendió sigue negado.
  if (enPlazo && (habilitacion === 'sin_solicitar' || habilitacion === 'pendiente'))
    habilitacion = 'aprobada';
  const vehiculoCompatible =
    s.id === 'comida' && !vehiculo
      ? true // Comida hoy no exige vehículo registrado en esta tabla
      : Boolean(
          vehiculo &&
          (vehiculo.estado === 'aprobado' || (enPlazo && vehiculoEnPlazo(vehiculo.estado))) &&
          e.tiposCompatibles.includes(vehiculo.tipo),
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

/** C-PLAZO-PAPELES: dentro del plazo sirve el vehículo declarado, salvo el que el equipo rechazó. */
export const vehiculoEnPlazo = (estado: string) =>
  estado !== 'rechazado' && estado !== 'suspendido' && estado !== 'retirado';

export async function estadoDelConductor(
  db: Db,
  conductorId: string,
  ingles: boolean,
  versionDriver: number,
  /** C-PLAZO-PAPELES: `sinPlazo` = la regla entera, como si su plazo ya hubiera vencido. */
  op: { sinPlazo?: boolean } = {},
): Promise<{
  vehiculoActivo: {
    id: string;
    tipo: string;
    estado: string;
    categoria?: string;
    anio?: number | null;
    plazas?: number | null;
  } | null;
  servicios: EstadoConductor[];
}> {
  // La fila de repartidores nace la primera vez que usa la app; antes, su zona es la de su cuenta
  // (y si no tiene, la misma de fábrica que usa la tabla de repartidores).
  const rep = await db
    .prepare(
      `SELECT ${ZONA_CONDUCTOR_SQL} AS zona_id, r.vehiculo_activo_id
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?`,
    )
    .bind(conductorId)
    .first<{ zona_id: string; vehiculo_activo_id: string | null }>();
  const vehiculo = rep?.vehiculo_activo_id
    ? await db
        .prepare(
          'SELECT id, tipo, estado, categoria, anio, plazas FROM vehiculos WHERE id = ? AND conductor_id = ?',
        )
        .bind(rep.vehiculo_activo_id, conductorId)
        .first<{
          id: string;
          tipo: string;
          estado: string;
          categoria: string;
          anio: number | null;
          plazas: number | null;
        }>()
    : null;
  // C-PLAZO-PAPELES: una lectura más (política del país y su plazo).
  const leida = await graciaDe(db, conductorId);
  const gracia: Gracia = op.sinPlazo ? { ...leida, activa: false } : leida;
  const vale = (v: { estado: string } | null) =>
    Boolean(v && (v.estado === 'aprobado' || (gracia.activa && vehiculoEnPlazo(v.estado))));
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
        vehiculo && vale(vehiculo) ? vehiculo.id : '-',
        vehiculo && vale(vehiculo) ? vehiculo.tipo : '-',
        conductorId,
        vehiculo && vale(vehiculo) ? vehiculo.id : '-',
      )
      .all<{ servicio_id: string; requisito: string }>(),
  ]);
  // C-EDAD-POR-PAIS: la edad de CADA servicio se mira con la fecha guardada y la edad de su país (no con
  // el requisito suelto, que es uno para todos): falta si no hay fecha o no llega a la de ese servicio.
  const pidenEdad = await serviciosQuePidenEdad(db);
  const edades = pidenEdad.length
    ? await edadPorServicio(db, conductorId, pidenEdad)
    : new Map<string, { falta: string | null }>();
  const faltanConEdad = [
    ...faltan.results.filter((f) => f.requisito !== REQUISITO_EDAD),
    ...pidenEdad
      .filter((sv) => edades.get(sv)?.falta)
      .map((sv) => ({ servicio_id: sv, requisito: REQUISITO_EDAD })),
  ];
  const hab = new Map(habs.results.map((h) => [h.servicio_id, h]));
  const pref = new Map(prefs.results.map((p) => [p.servicio_id, p.activa === 1]));
  const ahora = ahoraSql();
  const prueba = await esCuentaPrueba(db, conductorId);
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
      requisitosFaltantes: faltanConEdad
        .filter((f) => f.servicio_id === s.id)
        .map((f) => f.requisito),
      versionDriver,
      ingles,
      gracia,
      prueba,
    }),
  );
  // C-CAMBIAR-VEHICULO (robot, 18 nov 2026): si un servicio no se puede activar con el vehículo
  // activo pero SÍ con otro vehículo aprobado del conductor, se dice cuál (como «Vehicles» de Uber
  // Driver). Solo se consulta con un servicio aprobado que no se puede activar (lecturas pequeñas).
  const pendientes = serviciosConductor.filter(
    (x) =>
      !x.puedeActivar &&
      x.habilitacion === 'aprobada' &&
      x.estadoServicio === 'disponible' &&
      (x.motivo === 'requisitos_faltantes' || x.motivo === 'vehiculo_incompatible'),
  );
  if (pendientes.length) {
    const [vehs, reqs, cumplidos] = await Promise.all([
      db
        .prepare(
          "SELECT id, tipo, marca, modelo, anio FROM vehiculos WHERE conductor_id = ? AND estado = 'aprobado'",
        )
        .bind(conductorId)
        .all<VehiculoConductor>(),
      db
        .prepare(
          `SELECT sr.servicio_id, sr.requisito, rd.nivel, NULL AS vehiculo_tipo FROM servicio_requisitos sr
             JOIN requisitos_def rd ON rd.requisito = sr.requisito WHERE sr.obligatorio = 1
           UNION ALL
           SELECT svr.servicio_id, svr.requisito, rd.nivel, svr.vehiculo_tipo FROM servicio_vehiculo_requisitos svr
             JOIN requisitos_def rd ON rd.requisito = svr.requisito`,
        )
        .all<RequisitoServicio>(),
      db
        .prepare(
          `SELECT requisito, vehiculo_id FROM cumplimientos WHERE conductor_id = ? AND estado = 'aprobado'
             AND (vence_en IS NULL OR vence_en > datetime('now'))`,
        )
        .bind(conductorId)
        .all<{ requisito: string; vehiculo_id: string }>(),
    ]);
    const hechos = new Set(cumplidos.results.map((x) => `${x.requisito}|${x.vehiculo_id}`));
    for (const x of pendientes) {
      const otro = vehiculoQueSirve({
        servicioId: x.servicioId,
        activoId: vehiculo?.id ?? null,
        vehiculos: vehs.results,
        tiposCompatibles: compat.results
          .filter((c) => c.servicio_id === x.servicioId)
          .map((c) => c.vehiculo_tipo),
        anioMinimo: new Map(
          compat.results
            .filter((c) => c.servicio_id === x.servicioId)
            .map((c) => [c.vehiculo_tipo, c.anio_minimo]),
        ),
        requisitos: reqs.results,
        cumplidos: hechos,
      });
      if (otro) {
        x.cambiarA = { id: otro.id, nombre: nombreVehiculo(otro), tipo: otro.tipo };
        // Revisor (18 nov 2026): `motivo` NO cambia: la Driver 25 publicada espera los de siempre
        // («vehiculo_incompatible» trae su botón «Usar este vehículo»). La app nueva mira `cambiarA`.
      }
    }
  }
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

/**
 * C-QUE-TE-FALTA (23 nov 2026): un vehículo con motor se guarda CON su placa (y el estado que la emitió,
 * donde aplica). Antes se guardaba sin placa y «Enviar a revisión» fallaba después; un conductor de
 * Venezuela quedó con su moto sin placa y sin poder corregirla.
 */
function exigirPlaca(d: { tipo: string; placa: string; placaEstado: string }, pais: string) {
  if (!MOTORIZADOS.has(d.tipo)) return;
  if (!d.placa) throw new ErrorDatos('Escribe la placa de tu vehículo.', 'placa', 422);
  if (!d.placaEstado && !perfilPasajeros(pais).placaNacional)
    throw new ErrorDatos(
      'Escribe el estado que emitió la placa (dos letras, por ejemplo, FL).',
      'placaEstado',
      422,
    );
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
        "SELECT id, tipo, marca, modelo, anio, color, placa, placa_estado AS placaEstado, plazas, estado, motivo, categoria, acepta_menores AS aceptaMenores, lleva_menores AS llevaMenores FROM vehiculos WHERE conductor_id = ? AND estado != 'retirado' ORDER BY creado_en",
      )
      .bind(u.id)
      .all<{
        id: string;
        tipo: string;
        anio: number | null;
        plazas: number | null;
        aceptaMenores: number;
      }>(),
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
  // C-CARRO-CATEGORIAS: qué pide cada categoría en el país del conductor (para decírselo en su app).
  const requisitos = perfilPasajeros((await paisDelConductor(db, u.id)).pais).carro.categorias;
  return c.json({
    vehiculoActivoId: rep?.id ?? null,
    requisitosCategoria: requisitos,
    // C-SEGURO-EN-PLAZO y C-PAPEL-DICE-LA-VERDAD: dentro del plazo la póliza no frena la revisión; la
    // app lo usa para decir exactamente qué falta (la misma regla de `faltaAlVehiculo`).
    seguroEnPlazo: seguroEnPlazo(await graciaDe(db, u.id)),
    vehiculos: vehiculos.map((v) => ({
      ...v,
      aceptaMenores: Boolean(v.aceptaMenores),
      documentos: docs.filter((d) => d.vehiculoId === v.id),
    })),
  });
});

/**
 * C-CARRO-CATEGORIAS (14 nov 2026, todos los países): la categoría de un carro (económico, Comfort o
 * Premium), como Uber Comfort y Uber Black. Los requisitos (antigüedad y plazas) viven en el perfil
 * del país; Premium además lo aprueba una persona del equipo. Ficha:
 * docs/investigaciones-rea/2026-11-14-carro-paradas-categorias-dinamica.md.
 */
export function categoriaAlAprobar(
  pais: string,
  carro: { tipo: string; anio: number | null; plazas: number | null },
  pedida: CategoriaCarro | undefined,
  hoy = new Date(),
): CategoriaCarro {
  if (carro.tipo !== 'carro') {
    if (pedida && pedida !== 'estandar')
      throw new ErrorDatos('Solo un carro puede ser Comfort o Premium.', 'categoria', 422);
    return 'estandar';
  }
  const req = perfilPasajeros(pais).carro.categorias;
  const anio = hoy.getUTCFullYear();
  if (pedida && pedida !== 'estandar') {
    const r = pedida === 'comfort' ? req.comfort : req.premium;
    if (!carroCumpleCategoria(r, carro, anio))
      throw new ErrorDatos(
        `Este carro no cumple lo que pide esa categoría: ${r.antiguedadMaxima} años como máximo y ${r.plazasMinimas} plazas o más.`,
        'categoria',
        422,
      );
    return pedida;
  }
  if (pedida === 'estandar') return 'estandar';
  // Sin decirlo: Comfort se da solo si el carro cumple; Premium siempre lo decide una persona.
  return !req.comfort.revisionManual && carroCumpleCategoria(req.comfort, carro, anio)
    ? 'comfort'
    : 'estandar';
}

/**
 * Al volver a aprobar un carro (después de una suspensión, por ejemplo) sin decir la categoría, se
 * conserva la que ya tenía si todavía la cumple: un Premium decidido por una persona no se pierde.
 */
export function categoriaQueConserva(
  pais: string,
  carro: { tipo: string; anio: number | null; plazas: number | null; categoria: string },
  hoy = new Date(),
): CategoriaCarro | undefined {
  if (carro.tipo !== 'carro' || (carro.categoria !== 'comfort' && carro.categoria !== 'premium'))
    return undefined;
  const r = perfilPasajeros(pais).carro.categorias;
  return carroCumpleCategoria(
    carro.categoria === 'comfort' ? r.comfort : r.premium,
    carro,
    hoy.getUTCFullYear(),
  )
    ? carro.categoria
    : undefined;
}

/** El conductor de un carro Comfort o Premium decide si también recibe los viajes de abajo. */
servicios.put('/conductor/vehiculos/:id/categorias-menores', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await miVehiculo(db, u.id, c.req.param('id'));
  const { acepta } = await leerCuerpo(c, z.object({ acepta: z.boolean() }));
  await db
    .prepare(
      "UPDATE vehiculos SET acepta_menores = ?, actualizado_en = datetime('now') WHERE id = ? AND acepta_menores != ?",
    )
    .bind(acepta ? 1 : 0, v.id, acepta ? 1 : 0)
    .run();
  return c.json({ aceptaMenores: acepta });
});

/**
 * C-VIAJES-FIJOS: el conductor decide si lleva menores en este vehículo (viajes fijos de un menor,
 * con PIN). Nace apagado; sin encenderlo, nunca recibe el viaje de un menor.
 */
servicios.put('/conductor/vehiculos/:id/lleva-menores', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await miVehiculo(db, u.id, c.req.param('id'));
  const { acepta } = await leerCuerpo(c, z.object({ acepta: z.boolean() }));
  await db
    .prepare(
      "UPDATE vehiculos SET lleva_menores = ?, actualizado_en = datetime('now') WHERE id = ? AND lleva_menores != ?",
    )
    .bind(acepta ? 1 : 0, v.id, acepta ? 1 : 0)
    .run();
  return c.json({ llevaMenores: acepta });
});

/** El equipo cambia la categoría de un carro ya aprobado (sube a Premium, baja a económico). */
servicios.put('/admin/vehiculos/:id/categoria', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      categoria: z.enum(CATEGORIAS_CARRO),
      motivo: z.string().trim().min(3).max(200),
    }),
  );
  const antes = await db.prepare('SELECT * FROM vehiculos WHERE id = ?').bind(id).first<{
    conductor_id: string;
    tipo: string;
    anio: number | null;
    plazas: number | null;
    categoria: string;
  }>();
  if (!antes) throw new ErrorDatos('No encontramos ese vehículo.', undefined, 404);
  const categoria = categoriaAlAprobar(
    (await paisDelConductor(db, antes.conductor_id)).pais,
    antes,
    d.categoria,
  );
  await db
    .prepare("UPDATE vehiculos SET categoria = ?, actualizado_en = datetime('now') WHERE id = ?")
    .bind(categoria, id)
    .run();
  await auditar(db, admin.id, 'vehiculo.categoria', `vehiculo:${id}`, antes, d);
  return c.json({ categoria });
});

servicios.post('/conductor/vehiculos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const donde = await paisDelConductor(db, u.id);
  const d = conPlacaDelPais(await leerCuerpo(c, datosVehiculo), donde);
  exigirPlaca(d, donde.pais);
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
  const donde = await paisDelConductor(db, u.id);
  const d = conPlacaDelPais(await leerCuerpo(c, datosVehiculo), donde);
  exigirPlaca(d, donde.pais);
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
  // C-LLEGA-SOLO-A-REVISION: si lo que faltaba era la placa, con esto ya va a revisión.
  await vehiculosSoloARevision(db, u.id);
  return c.json({ ok: true });
});

export const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** C-PAPELES-POR-PAIS: los papeles que se guardan con el mismo archivo (solo con la lista encendida). */
async function papelesQueTambien(
  db: Db,
  conductorId: string,
  tipoVehiculo: string,
  tipoPapel: string,
): Promise<string[]> {
  if (tipoVehiculo !== 'moto' && tipoVehiculo !== 'carro') return [];
  const enc = await listaEncendidaDelConductor(db, conductorId);
  if (!enc) return [];
  const p = enc.lista.papeles.find(
    (x) => x.donde === 'vehiculo' && x.tipo === tipoPapel && x.servicios.includes(tipoVehiculo),
  );
  return p?.tambien ?? [];
}
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
  // C-PAPELES-POR-PAIS: con la lista del país encendida, un papel que «también» vale por otro (en
  // Venezuela, la póliza RCV es también la póliza de pasajeros) se guarda en las dos casillas con el
  // mismo archivo, como ya hace el asistente de fotos. Apagada, nada cambia.
  const tambien = await papelesQueTambien(db, u.id, v.tipo, q.data.tipo);
  if (tambien.length)
    await db.batch(
      tambien.flatMap((t) => [
        db
          .prepare(
            "UPDATE vehiculo_documentos SET estado = 'reemplazado' WHERE vehiculo_id = ? AND tipo = ? AND estado IN ('pendiente', 'rechazado')",
          )
          .bind(v.id, t),
        db
          .prepare(
            'INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, vence_en) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(nuevoId(), v.id, t, clave, q.data.vence ?? null),
      ]),
    );
  // C-LLEGA-SOLO-A-REVISION: si con este papel el vehículo quedó completo, va a revisión solo. Lo que
  // suba estando ya en revisión se suma a la misma revisión (el equipo ve todos sus papeles).
  await vehiculosSoloARevision(db, u.id);
  return c.json({ id, estado: 'pendiente' }, 201);
});

/**
 * Lo que le falta a un vehículo para ir a revisión, o null si ya puede ir. La misma regla para el
 * botón «Enviar mi moto a revisión» y para el envío solo (C-LLEGA-SOLO-A-REVISION).
 */
async function faltaAlVehiculo(
  db: Db,
  conductorId: string,
  v: { id: string; tipo: string; placa: string | null; placa_estado: string | null },
): Promise<{ mensaje: string; campo?: string } | null> {
  if (!MOTORIZADOS.has(v.tipo)) return null;
  if (!v.placa || !v.placa_estado)
    return { mensaje: 'Escribe la placa y el estado que la emitió.', campo: 'placa' };
  // C-SEGURO-EN-PLAZO: dentro de su plazo (y si su país no pide el seguro para empezar) basta el
  // registro; la póliza queda pendiente dentro del plazo. Fuera de plazo, los dos como siempre.
  const pide = seguroEnPlazo(await graciaDe(db, conductorId))
    ? ['registro']
    : ['registro', 'seguro'];
  const docs = await db
    .prepare(
      `SELECT COUNT(DISTINCT tipo) AS n FROM vehiculo_documentos WHERE vehiculo_id = ? AND tipo IN (${pide.map(() => '?').join(',')}) AND estado IN ('pendiente', 'aprobado')`,
    )
    .bind(v.id, ...pide)
    .first<{ n: number }>();
  if (Number(docs?.n) < pide.length)
    return {
      mensaje:
        pide.length === 1
          ? 'Sube el registro del vehículo antes de enviarlo.'
          : 'Sube el registro y el seguro del vehículo antes de enviarlo.',
    };
  return null;
}

const A_REVISION =
  "UPDATE vehiculos SET estado = 'en_revision', motivo = '', aprobado_por = NULL, actualizado_en = datetime('now') WHERE id = ?";

/**
 * C-LLEGA-SOLO-A-REVISION (23 nov 2026, Richard): la moto o el carro «registrado» que ya tiene lo que
 * pide la revisión (placa y registro; el seguro solo fuera de plazo) pasa solo a «en revisión», con
 * el mismo efecto que el botón. Solo los motorizados (los que llevan papeles). Devuelve cuántos pasó.
 */
export async function vehiculosSoloARevision(db: Db, conductorId: string): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT id, tipo, placa, placa_estado FROM vehiculos
        WHERE conductor_id = ? AND estado = 'registrado' AND tipo IN (${[...MOTORIZADOS].map(() => '?').join(',')})`,
    )
    .bind(conductorId, ...MOTORIZADOS)
    .all<{ id: string; tipo: string; placa: string | null; placa_estado: string | null }>();
  let n = 0;
  for (const v of results) {
    if (await faltaAlVehiculo(db, conductorId, v)) continue;
    const r = await conRestricciones(
      db.prepare(`${A_REVISION} AND estado = 'registrado'`).bind(v.id).run(),
    );
    n += Number(r.meta?.changes ?? 0);
  }
  return n;
}

servicios.post('/conductor/vehiculos/:id/enviar', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await miVehiculo(db, u.id, c.req.param('id'));
  // C-LLEGA-SOLO-A-REVISION: si ya llegó solo, el botón responde bien sin hacer nada más.
  if (v.estado === 'en_revision') return c.json({ estado: 'en_revision' });
  const falta = await faltaAlVehiculo(db, u.id, v);
  if (falta) throw new ErrorDatos(falta.mensaje, falta.campo, 422);
  await conRestricciones(db.prepare(A_REVISION).bind(v.id).run());
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

/**
 * C-VEHICULO-ACTIVO-SOLO (23 nov 2026, Gerencia por Richard: «la moto aprobada y única debe quedar
 * activa sola, para todos»). El equipo aprueba un vehículo y el conductor no tiene ninguno activo (o
 * el que tenía está retirado, rechazado o suspendido): ese vehículo queda activo solo, con las
 * mismas puertas que «Usar este vehículo» (`PUT /conductor/vehiculo-activo`): solo un vehículo suyo y
 * aprobado, nunca con un pedido u operación en curso (la base lo frena también, C-FLEX-OCUPACION), y si
 * reemplaza a otro que tenía, solo desconectado. Si ya tiene otro activo y válido, no se toca.
 *
 * Y el servicio de pasajeros de ese vehículo (Moto con la moto, Carro con el carro) queda elegido si
 * él nunca lo eligió ni lo apagó y hoy ya lo puede activar (mismas reglas que el panel: ciudad,
 * habilitación, papeles, plazo). Como en Uber, los tipos de viaje para los que estás aprobado vienen
 * encendidos; él lo apaga cuando quiera. Si le falta algo, no se enciende nada.
 *
 * Devuelve qué hizo (para la reparación y las pruebas).
 */
const SERVICIO_PASAJEROS_DE = new Map([
  ['moto', 'moto'],
  ['carro', 'carro'],
]);

export async function activarVehiculoAprobadoSolo(
  db: Db,
  conductorId: string,
  vehiculoId: string,
): Promise<{ activo: boolean; servicio: string | null }> {
  if (await conPedidoEnCurso(db, conductorId)) return { activo: false, servicio: null };
  await db.prepare(ALTA_REPARTIDOR).bind(conductorId).run();
  let r: D1Result;
  try {
    r = await db
      .prepare(
        `UPDATE repartidores SET vehiculo_activo_id = ?1
          WHERE usuario_id = ?2
            AND EXISTS (SELECT 1 FROM vehiculos WHERE id = ?1 AND conductor_id = ?2 AND estado = 'aprobado')
            AND (vehiculo_activo_id IS NULL
                 OR (conectado = 0 AND NOT EXISTS (
                       SELECT 1 FROM vehiculos x WHERE x.id = repartidores.vehiculo_activo_id
                          AND x.estado NOT IN ('retirado', 'rechazado', 'suspendido'))))`,
      )
      .bind(vehiculoId, conductorId)
      .run();
  } catch (e) {
    if (esConductorOcupado(e)) return { activo: false, servicio: null };
    throw e;
  }
  if (!Number(r.meta?.changes ?? 0)) return { activo: false, servicio: null };
  const v = await db
    .prepare('SELECT tipo FROM vehiculos WHERE id = ?')
    .bind(vehiculoId)
    .first<{ tipo: string }>();
  const servicio = SERVICIO_PASAJEROS_DE.get(v?.tipo ?? '') ?? null;
  const encendidos = await encenderServiciosDelVehiculo(db, conductorId, [
    ...(servicio ? [servicio] : []),
    ...SERVICIOS_SIN_SEGUNDO_REGISTRO,
  ]);
  return { activo: true, servicio: servicio && encendidos.includes(servicio) ? servicio : null };
}

/**
 * C-SERVICIOS-DEL-VEHICULO (23 nov 2026, Tucaní) — todos los países. Los servicios que el vehículo
 * en uso ya permite sin un segundo registro: hoy Envíos (con Moto o Carro, según su vehículo). Un
 * conductor de Tucaní con la moto aprobada no recibió un envío porque solo tenía encendido «moto».
 */
export const SERVICIOS_SIN_SEGUNDO_REGISTRO = ['envios'] as const;

/**
 * Deja encendidos (preferencia activa) los `candidatos` que el conductor puede activar YA con la
 * misma regla de Driver (`puedeActivar`: servicio abierto en su zona, habilitación o plazo, vehículo
 * compatible y requisitos de su país). Solo CREA la fila si no existe: quien lo apagó a propósito
 * sigue apagado. Devuelve los que encendió. Lecturas por índice; una escritura por servicio nuevo.
 */
export async function encenderServiciosDelVehiculo(
  db: Db,
  conductorId: string,
  candidatos: readonly string[],
): Promise<string[]> {
  if (!candidatos.length) return [];
  const { results: ya } = await db
    .prepare(
      `SELECT servicio_id FROM preferencias_servicio WHERE conductor_id = ? AND servicio_id IN (${candidatos.map(() => '?').join(', ')})`,
    )
    .bind(conductorId, ...candidatos)
    .all<{ servicio_id: string }>();
  const tiene = new Set(ya.map((f) => f.servicio_id));
  const faltan = candidatos.filter((x) => !tiene.has(x));
  if (!faltan.length) return [];
  const estado = await estadoDelConductor(db, conductorId, false, Number.MAX_SAFE_INTEGER);
  const encender = faltan.filter(
    (x) => estado.servicios.find((s) => s.servicioId === x)?.puedeActivar,
  );
  for (const x of encender)
    await db
      .prepare(
        'INSERT OR IGNORE INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, ?, 1)',
      )
      .bind(conductorId, x)
      .run();
  return encender;
}

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
  // Revisor (18 nov 2026): conectado con la moto, pasar al carro dejaba encendidos servicios que el
  // carro no cubre y podían llegarle ofertas del servicio equivocado. Como en Uber Driver: el
  // vehículo se cambia desconectado.
  const conectado = await db
    .prepare('SELECT conectado FROM repartidores WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ conectado: number }>();
  if (Number(conectado?.conectado) === 1)
    throw new ErrorDatos('Desconéctate antes de cambiar de vehículo.', undefined, 409);
  let enPlazo = false;
  if (vehiculoId) {
    const v = await miVehiculo(db, u.id, vehiculoId);
    // C-PLAZO-PAPELES: dentro de su plazo usa el vehículo que declaró, sin esperar la aprobación.
    enPlazo = (await graciaDe(db, u.id)).activa && vehiculoEnPlazo(v.estado);
    if (v.estado !== 'aprobado' && !enPlazo)
      throw new ErrorDatos('Ese vehículo todavía no está aprobado.', 'vehiculoId', 409);
  }
  await db.prepare(ALTA_REPARTIDOR).bind(u.id).run();
  // Una sola sentencia: solo cambia si el vehículo sigue aprobado y es suyo en ese instante.
  // Fase 3: la base además lo impide con un pedido u operación en curso (aunque llegue a la vez).
  let r: D1Result;
  try {
    r = await db
      .prepare(
        `UPDATE repartidores SET vehiculo_activo_id = ?
          WHERE usuario_id = ? AND (? IS NULL OR EXISTS (
            SELECT 1 FROM vehiculos WHERE id = ? AND conductor_id = ?
               AND (estado = 'aprobado' OR (? = 1 AND estado NOT IN ('rechazado', 'suspendido', 'retirado')))))`,
      )
      .bind(vehiculoId, u.id, vehiculoId, vehiculoId, u.id, enPlazo ? 1 : 0)
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
  const estadoPedido = z
    .enum([
      'todos',
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
  const conductor = (c.req.query('conductor') ?? '').slice(0, 64);
  // C-FICHA-VEHICULO-SIEMPRE (27 nov 2026, Richard: «no encuentro la moto»): en la ficha de UN
  // conductor se piden todos sus vehículos, en cualquier estado (aprobado incluido). Sin conductor,
  // «todos» no existe: la cola sigue con lo que espera revisión.
  const estado = estadoPedido === 'todos' && !conductor ? 'en_revision' : estadoPedido;
  // C-VERIFICACIONES-VEHICULOS (25 nov 2026, Richard: «Verificaciones verifica TODO») — todos los
  // países. La pestaña «Vehículos» de Verificaciones: cuentas reales o de prueba, ciudad y buscador
  // (nombre, ID, placa, marca o modelo, desde la primera letra), con los totales de cada lista.
  const cuentas = z
    .enum(['reales', 'prueba', 'todas'])
    .catch('todas')
    .parse(c.req.query('cuentas') ?? 'todas');
  const zona = (c.req.query('zona') ?? '').slice(0, 60);
  const q = textoPlano((c.req.query('q') ?? '').slice(0, 60)).replace(/^#/, '');
  const db = base(c);
  // C-PERMISOS-FINOS: los vehículos de los conductores de su alcance.
  const alc = alcanceObjetoSql(accesoDe(c), 'repartidor', 'v.conductor_id');
  const filtros = `(? = '' OR v.conductor_id = ?)
          AND (? = 'todas' OR COALESCE(u.es_prueba, 0) = (? = 'prueba'))
          AND (? = '' OR EXISTS (SELECT 1 FROM repartidores rz WHERE rz.usuario_id = v.conductor_id AND rz.zona_id = ?))
          AND (? = '' OR ${sqlPlano('u.nombre')} LIKE '%' || ? || '%' OR lower(v.placa) LIKE '%' || ? || '%'
               OR ${sqlPlano("v.marca || ' ' || v.modelo")} LIKE '%' || ? || '%'
               OR EXISTS (SELECT 1 FROM repartidores rc WHERE rc.usuario_id = v.conductor_id AND lower(rc.codigo) LIKE '%' || ? || '%'))${alc.sql}`;
  const valores = [
    conductor,
    conductor,
    cuentas,
    cuentas,
    zona,
    zona,
    q,
    q,
    q,
    q,
    q,
    ...alc.valores,
  ];
  const [{ results }, totales] = await Promise.all([
    db
      .prepare(
        // C-PAPELES-POR-PAIS: el país del conductor, para nombrar sus papeles como se llaman allá.
        `SELECT v.*, u.nombre AS conductor, COALESCE(u.es_prueba, 0) AS es_prueba,
                (SELECT d.codigo FROM repartidores d WHERE d.usuario_id = v.conductor_id) AS codigo,
                (SELECT z.nombre FROM repartidores r JOIN zonas z ON z.id = r.zona_id
                  WHERE r.usuario_id = v.conductor_id) AS zona,
                (SELECT z.pais FROM repartidores r JOIN zonas z ON z.id = r.zona_id
                  WHERE r.usuario_id = v.conductor_id) AS pais
           FROM vehiculos v JOIN usuarios u ON u.id = v.conductor_id
          WHERE (? = 'todos' OR v.estado = ?) AND ${filtros} ORDER BY v.actualizado_en LIMIT 100`,
      )
      // C-VERIFICACION-UNICA: con `conductor`, solo los de esa persona (su ficha en Verificaciones).
      .bind(estado, estado, ...valores)
      .all<{ id: string; conductor_id: string; estado: string }>(),
    // Los totales de las dos listas de la pestaña (lo que espera revisión y lo que quedó sin enviar).
    conductor
      ? null
      : db
          .prepare(
            `SELECT SUM(v.estado = 'en_revision') AS en_revision, SUM(v.estado = 'registrado') AS registrado
               FROM vehiculos v JOIN usuarios u ON u.id = v.conductor_id
              WHERE v.estado IN ('en_revision', 'registrado') AND ${filtros}`,
          )
          .bind(...valores)
          .first<{ en_revision: number | null; registrado: number | null }>(),
  ]);
  const ids = results.map((v) => v.id);
  // C-SEGURO-EN-PLAZO: a quién le corre la póliza dentro de su plazo (una lectura por lote).
  const gracias = await graciasDe(db, [...new Set(results.map((v) => v.conductor_id))]);
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
    vehiculos: results.map((v) => {
      const g = gracias.get(v.conductor_id);
      const documentos = docs.filter((d) => d.vehiculoId === v.id);
      return {
        ...v,
        documentos,
        // C-FICHA-VEHICULO-SIN-ENVIAR: lo que le falta a uno sin enviar para que el equipo lo apruebe.
        ...(v.estado === 'registrado'
          ? {
              faltaParaAprobar: faltaParaAprobarSinEnviar(
                v as unknown as { tipo: string; placa: string | null; placa_estado: string | null },
                documentos as unknown as { tipo: string; estado: string }[],
                seguroEnPlazo(g) ? ['registro'] : ['registro', 'seguro'],
              ),
            }
          : {}),
        /** La póliza que todavía puede llegar dentro del plazo: cuándo vence ese plazo. */
        seguroEnPlazo: seguroEnPlazo(g) ? { venceEn: g?.venceEn ?? null } : null,
      };
    }),
    totales: totales
      ? {
          en_revision: Number(totales.en_revision ?? 0),
          registrado: Number(totales.registrado ?? 0),
        }
      : null,
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
  // C-VERIFICACION-IA: la decisión de la persona queda al lado de lo que dijo la IA.
  if (antes.tipo === 'seguro')
    await anotarDecisionHumana(c.env, db, {
      conductorId: antes.conductor_id,
      papel: ['seguro'],
      decision: d.estado,
      por: admin.id,
    });
  // C-BARRA-ACTIVACION: si esta decisión lo dejó listo para recibir carreras, se le avisa (una vez).
  if (d.estado === 'aprobado') await avisarSiQuedoActivo(c.env, db, antes.conductor_id);
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
      // C-CARRO-CATEGORIAS: al aprobar un carro, su categoría (sin decirla, la que le toca sola).
      categoria: z.enum(CATEGORIAS_CARRO).optional(),
    }),
  );
  if (d.estado !== 'aprobado' && !d.motivo)
    throw new ErrorDatos('Escribe el motivo para que la persona sepa qué corregir.', 'motivo', 422);
  const antes = await db.prepare('SELECT * FROM vehiculos WHERE id = ?').bind(id).first<{
    conductor_id: string;
    tipo: string;
    anio: number | null;
    plazas: number | null;
    categoria: string;
    estado: string;
    placa: string | null;
    placa_estado: string | null;
  }>();
  if (!antes) throw new ErrorDatos('No encontramos ese vehículo.', undefined, 404);
  // C-FICHA-VEHICULO-SIN-ENVIAR: uno que el conductor no envió se aprueba solo con sus fotos y su
  // placa completas; nunca sin ellas.
  if (d.estado === 'aprobado' && antes.estado === 'registrado') {
    const { results: docsAntes } = await db
      .prepare(
        "SELECT tipo, estado FROM vehiculo_documentos WHERE vehiculo_id = ? AND estado != 'reemplazado'",
      )
      .bind(id)
      .all<{ tipo: string; estado: string }>();
    const falta = faltaParaAprobarSinEnviar(
      antes,
      docsAntes,
      seguroEnPlazo(await graciaDe(db, antes.conductor_id)) ? ['registro'] : ['registro', 'seguro'],
    );
    if (falta.length)
      return c.json(
        {
          error:
            'Este vehículo todavía no tiene completos sus fotos, su placa y sus papeles: no se puede aprobar sin ellos.',
          faltaParaAprobar: falta,
        },
        422,
      );
  }
  const pais = d.estado === 'aprobado' ? (await paisDelConductor(db, antes.conductor_id)).pais : '';
  const categoria =
    d.estado === 'aprobado'
      ? categoriaAlAprobar(pais, antes, d.categoria ?? categoriaQueConserva(pais, antes))
      : antes.categoria;
  await conRestricciones(
    db.batch([
      // C-FICHA-VEHICULO-SIN-ENVIAR: el sin enviar pasa primero por «en revisión» (la transición de
      // siempre), en el mismo lote: si la base no deja aprobarlo, tampoco queda enviado a medias.
      ...(d.estado === 'aprobado' && antes.estado === 'registrado'
        ? [db.prepare(`${A_REVISION} AND estado = 'registrado'`).bind(id)]
        : []),
      db
        .prepare(
          `UPDATE vehiculos SET estado = ?, motivo = ?, aprobado_por = ?, categoria = ?,
             aprobado_en = CASE WHEN ? = 'aprobado' THEN datetime('now') ELSE aprobado_en END,
             actualizado_en = datetime('now') WHERE id = ?`,
        )
        .bind(d.estado, d.motivo, admin.id, categoria, d.estado, id),
      // Un vehículo que deja de estar aprobado deja de ser el activo (Comida no lo lee aún).
      db
        .prepare(
          "UPDATE repartidores SET vehiculo_activo_id = NULL WHERE vehiculo_activo_id = ? AND ? != 'aprobado'",
        )
        .bind(id, d.estado),
    ]),
  );
  await auditar(db, admin.id, 'vehiculo.revision', `vehiculo:${id}`, antes, {
    ...d,
    categoria,
    ...(antes.estado === 'registrado' ? { sinEnviar: true } : {}),
  });
  // C-VEHICULO-ACTIVO-SOLO: si no tiene otro activo y válido, el aprobado queda activo solo.
  const activo =
    d.estado === 'aprobado'
      ? await activarVehiculoAprobadoSolo(db, antes.conductor_id, id)
      : { activo: false, servicio: null };
  // C-SERVICIOS-DEL-VEHICULO: aunque ya estuviera en uso (por ejemplo, en su plazo de papeles), lo
  // que su vehículo aprobado permite sin otro registro queda encendido.
  if (d.estado === 'aprobado')
    await encenderServiciosDelVehiculo(
      db,
      antes.conductor_id,
      SERVICIOS_SIN_SEGUNDO_REGISTRO,
    ).catch((e: unknown) => console.error('vehículos: encender los servicios del vehículo', e));
  // C-BARRA-ACTIVACION: si esta decisión lo dejó listo para recibir carreras, se le avisa (una vez).
  if (d.estado === 'aprobado') await avisarSiQuedoActivo(c.env, db, antes.conductor_id);
  return c.json({ estado: d.estado, categoria, activo: activo.activo });
});

servicios.get('/admin/habilitaciones', async (c) => {
  exigir(c, 'admin');
  const servicio = c.req.query('servicio') ?? '';
  const estado = c.req.query('estado') ?? 'pendiente';
  // C-PERMISOS-FINOS: conductores de su alcance, y solo las habilitaciones de sus servicios.
  const alc = alcanceHabilitacionSql(accesoDe(c), 'h');
  const { results } = await base(c)
    .prepare(
      `SELECT h.*, u.nombre AS conductor FROM habilitaciones h JOIN usuarios u ON u.id = h.conductor_id
        WHERE (? = '' OR h.servicio_id = ?) AND h.estado = ?${alc.sql} ORDER BY h.actualizado_en LIMIT 100`,
    )
    .bind(servicio, servicio, estado, ...alc.valores)
    .all();
  return c.json({ habilitaciones: results });
});

/** Lo que le falta a un conductor para que la base deje habilitarlo en un servicio (sin lo exento). */
async function faltantesParaHabilitar(db: Db, conductor: string, servicio: string) {
  const { results } = await db
    .prepare(
      `SELECT sr.requisito FROM servicio_requisitos sr JOIN requisitos_def rd ON rd.requisito = sr.requisito
        WHERE sr.servicio_id = ? AND sr.obligatorio = 1 AND rd.nivel = 'conductor' AND NOT EXISTS (
          SELECT 1 FROM cumplimientos c WHERE c.conductor_id = ? AND c.vehiculo_id = '' AND c.requisito = sr.requisito
            AND c.estado = 'aprobado' AND (c.vence_en IS NULL OR c.vence_en > datetime('now')))`,
    )
    .bind(servicio, conductor)
    .all<{ requisito: string }>();
  // C-PLAZO-PAPELES y C-HABILITAR-IGUAL-LETRERO: lo exento no cuenta, y dentro de su plazo solo lo
  // que su país pide «para empezar» (la misma regla del disparador, de la vista y del letrero).
  return requisitosConGracia(
    results.map((r) => r.requisito),
    await graciaDe(db, conductor),
  );
}

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
  // C-EDAD-POR-PAIS: la edad de ESTE servicio en su país, con la fecha guardada. Si la cumple, el
  // requisito de edad queda al día (lo pone el sistema) antes de habilitar.
  // C-PLAZO-PAPELES: si el país del conductor declara la edad exenta, no se mira (como los demás).
  if (
    d.estado === 'aprobada' &&
    (await serviciosQuePidenEdad(db)).includes(servicio) &&
    !(await graciaDe(db, conductor)).exentos.has(REQUISITO_EDAD)
  ) {
    const e = (await edadPorServicio(db, conductor, [servicio])).get(servicio);
    if (e?.falta) {
      // Lo demás que le falte sale junto con la edad (la misma lista del disparador).
      const otros = (await faltantesParaHabilitar(db, conductor, servicio)).filter(
        (r) => r !== REQUISITO_EDAD,
      );
      return c.json(
        {
          error:
            e.falta === 'sin_fecha'
              ? 'Falta la fecha de nacimiento de esta persona: escríbela en su ficha o apruébale la identidad.'
              : `Esta persona tiene ${e.edad} años y para este servicio en su país hacen falta ${e.minima}.`,
          requisitosFaltantes: [...otros, REQUISITO_EDAD],
          edad: e,
        },
        409,
      );
    }
    await sincronizarEdad(db, conductor);
  }
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
      return c.json(
        {
          error: e.message,
          requisitosFaltantes: await faltantesParaHabilitar(db, conductor, servicio),
        },
        409,
      );
    }
    throw e;
  }
  const despues = await db
    .prepare('SELECT * FROM habilitaciones WHERE conductor_id = ? AND servicio_id = ?')
    .bind(conductor, servicio)
    .first();
  // C-HABILITAR-IGUAL-LETRERO: si se habilitó dentro de su plazo con papeles pendientes, se dice
  // hasta cuándo tiene y qué le queda por subir (la regla entera, como si el plazo ya hubiera vencido).
  let porPlazo: { venceEn: string | null; pendientes: string[] } | undefined;
  if (d.estado === 'aprobada') {
    const g = await graciaDe(db, conductor);
    if (g.activa) {
      const entero = await estadoDelConductor(db, conductor, false, Number.MAX_SAFE_INTEGER, {
        sinPlazo: true,
      });
      const pendientes = (
        entero.servicios.find((s) => s.servicioId === servicio)?.requisitosFaltantes ?? []
      ).filter((r) => !g.exentos.has(r));
      if (pendientes.length) porPlazo = { venceEn: g.venceEn, pendientes };
    }
  }
  // C-SALDO-CONDUCTOR: al aprobarlo, el regalo de arranque de su ciudad (una vez en la vida).
  if (d.estado === 'aprobada')
    await darRegaloConductorNuevo(db, conductor, c.env).catch((e: unknown) =>
      console.error('saldo: regalo de arranque', e),
    );
  // C-CAMILA-LIDER: el líder de su equipo recibe el contador (una sola vez).
  if (d.estado === 'aprobada') await alActivarseConductor(c.env, db, conductor);
  await auditar(
    db,
    admin.id,
    'habilitacion',
    `habilitacion:${conductor}:${servicio}`,
    antes,
    despues,
  );
  // C-BARRA-ACTIVACION: si esta decisión lo dejó listo para recibir carreras, se le avisa (una vez).
  if (d.estado === 'aprobada') await avisarSiQuedoActivo(c.env, db, conductor);
  return c.json({ habilitacion: despues, ...(porPlazo ? { porPlazo } : {}) });
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
  // C-CUENTA-PRUEBA: en una cuenta marcada de prueba el equipo puede aprobar los antecedentes (Checkr
  // no corre sobre cuentas de prueba). La identidad sigue yendo por «Verificaciones».
  const deUnaCuentaPrueba =
    def.verifica === 'antecedentes' && (await esCuentaPrueba(db, conductor));
  if (def.verifica === 'kyc' || (def.verifica === 'antecedentes' && !deUnaCuentaPrueba))
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
    // C-EDAD-POR-PAIS: la menor edad de los servicios de su país que la piden.
    const porServicio = await edadPorServicio(db, conductor, await serviciosQuePidenEdad(db));
    const minima = Math.min(...[...porServicio.values()].map((x) => x.minima), 99);
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
 * Abre o cierra un servicio de pasajeros en un país de producción. Solo el superadmin, con su
 * sesión. Abrir exige que el código lo permita (Moto y Carro en Venezuela; EE. UU. y Colombia no) y
 * UNA confirmación de que lo legal y el seguro de pasajeros de ese país están listos.
 *
 * Cambio del 14 nov 2026 (Richard): ya no se escribe el número de la solicitud de la marca (queda
 * guardada la de Estados Unidos, `SOLICITUD_MARCA_EEUU`) ni se repite la contraseña. Sigue quedando
 * quién abrió o cerró y cuándo, en `config` y en la auditoría.
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
      confirmo: z.boolean().default(false),
      nota: z.string().trim().max(300).default(''),
    }),
  );
  const antes = await aperturaPais(db, pais);
  if (d.abierto) {
    if (!abrible(servicio, pais))
      throw new ErrorDatos('Este servicio no se puede abrir en ese país.', 'pais', 409);
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
    solicitudMarca: d.abierto ? SOLICITUD_MARCA_EEUU : (antes?.solicitudMarca ?? '----'),
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

/**
 * C-SERVICIO-SIN-TARIFA: pieza «tarifas» de /datos/salud. Un servicio con tarifa por ciudad
 * encendido (o en piloto) en una zona sin tarifa activa: el cliente no lo ve (el catálogo lo oculta)
 * pero alguien lo encendió a medias. En producción, «error» (correo al equipo); en pruebas,
 * «pendiente» (avisa sin frenar la publicación). Una sola lectura.
 */
export async function saludTarifas(
  db: D1Database,
  entorno: Entorno | null = null,
): Promise<'ok' | 'error' | 'pendiente'> {
  const lista = [...SERVICIOS_CON_TARIFA];
  const marcas = lista.map(() => '?').join(',');
  const f = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT z.servicio_id, z.zona_id FROM servicios_zona z JOIN servicios s ON s.id = z.servicio_id
          WHERE z.estado = 'disponible' AND s.estado = 'disponible' AND z.servicio_id IN (${marcas})
         UNION
         SELECT p.servicio_id, p.zona_id FROM servicios_piloto p WHERE p.servicio_id IN (${marcas})
       ) e
       WHERE NOT EXISTS (SELECT 1 FROM tarifas_viaje t
                          WHERE t.servicio_id = e.servicio_id AND t.zona_id = e.zona_id AND t.activa = 1)`,
    )
    .bind(...lista, ...lista)
    .first<{ n: number }>();
  if (!Number(f?.n)) return 'ok';
  return entorno === 'produccion' ? 'error' : 'pendiente';
}

// ---------------------------------------------------------------- C-SERVICIOS-CONECTADOS

/**
 * Los servicios «al momento» (Richard, 16 nov 2026): se conectan varios a la vez mientras espera;
 * al aceptar uno, los demás quedan en pausa solos. Divoox Flex va aparte: es exclusivo.
 */
export const SERVICIOS_AL_MOMENTO = ['comida', 'envios', 'moto', 'carro'] as const;
const AL_MOMENTO = new Set<string>(SERVICIOS_AL_MOMENTO);
export const UPSERT_PREFERENCIA = `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, ?, ?)
       ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET activa = excluded.activa, actualizado_en = datetime('now')`;

/**
 * El encendido general de una app vieja conecta todos los aprobados si ninguno está encendido.
 * Si el repartidor ya eligió (alguno encendido), no toca nada: no escribe en el caso normal.
 */
export async function encenderTodosSiNinguno(db: Db, conductorId: string) {
  const { servicios: lista } = await estadoDelConductor(
    db,
    conductorId,
    false,
    Number.MAX_SAFE_INTEGER,
  );
  const posibles = lista.filter((s) => AL_MOMENTO.has(s.servicioId) && s.puedeActivar);
  if (!posibles.length || posibles.some((s) => s.preferencia)) return;
  await db.batch(
    posibles.map((s) => db.prepare(UPSERT_PREFERENCIA).bind(conductorId, s.servicioId, 1)),
  );
}
