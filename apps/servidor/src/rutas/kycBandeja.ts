import {
  claseDePaso,
  pideReversoDocumento,
  textoPlano,
  type PasoVerificacion,
} from '@tumbite/compartido';
import { politicaDesdeConfig } from '../plazoPapeles';
import { zonaRealSql } from '../cuentaPais';
import { sqlPlano } from '../buscadorSql';
import { sqlFiltroCuentas } from './cuentaPrueba';

/**
 * C-VERIFICACIONES-BANDEJA (22 nov 2026, Gerencia: «está mal organizada… un arreglo serio,
 * profesional») — todos los países. La bandeja de Verificaciones del superadmin trae, en UNA consulta
 * por página, todo lo que la fila necesita: la miniatura, el ID del conductor, la zona, cuánto lleva
 * esperando, si la cuenta es de prueba y el resumen de la comprobación automática de CADA foto.
 *
 * Mirar no escribe. La comprobación automática nunca aprueba ni rechaza aquí: solo se muestra lo que
 * dijo, para que decida una persona.
 */

/**
 * Las pestañas de la bandeja. «sin_enviar» (C-VERIFICACIONES-SIN-ENVIAR) no sale de la tabla de
 * verificaciones: son las cuentas que se registraron y todavía no mandaron sus fotos.
 */
export const ESTADOS_BANDEJA = ['pendiente', 'aprobado', 'rechazado', 'sin_enviar'] as const;
export type EstadoBandeja = (typeof ESTADOS_BANDEJA)[number];
export const leerEstadoBandeja = (v: string | undefined | null): EstadoBandeja =>
  (ESTADOS_BANDEJA as readonly string[]).includes(v ?? '') ? (v as EstadoBandeja) : 'pendiente';

/** Filas por página. */
export const POR_PAGINA_BANDEJA = 50;

/** Las fotos de la verificación que se resumen en la fila, en el orden en que se muestran. */
export const PIEZAS_BANDEJA = ['doc_frente', 'doc_reverso', 'selfie', 'local'] as const;
export type PiezaBandeja = (typeof PIEZAS_BANDEJA)[number];

/** El tono del sistema de diseño del panel (verde hecho, ámbar pendiente, gris apagado). */
export type TonoComprobacion = 'hecho' | 'pendiente' | 'apagado';

/**
 * Por qué, en una palabra que el panel traduce: «cuadra» (verde), «otra_clase», «vencido»,
 * «ilegible», «foto_de_foto», «confianza_baja», «repetir» (el equipo la pidió de nuevo), «a_mano»
 * (no hubo comprobación automática), y para el local «cerca» o «lejos».
 */
export type MotivoComprobacion =
  | 'cuadra'
  | 'otra_clase'
  | 'vencido'
  | 'ilegible'
  | 'foto_de_foto'
  | 'confianza_baja'
  | 'repetir'
  | 'a_mano'
  | 'cerca'
  | 'lejos';

export type Comprobacion = {
  pieza: PiezaBandeja;
  tono: TonoComprobacion;
  motivo: MotivoComprobacion;
  /** Lo que la comprobación cree que se ve (solo si no coincide con lo pedido). */
  clase?: string;
};

type FilaFotoIa = {
  paso: string;
  clave: string;
  estado: string;
  color: string;
  clase: string;
  lectura: string;
};

type Lectura = {
  clase?: string;
  legible?: boolean;
  vencido?: string;
  fotoDeOtraFoto?: boolean;
};

const leer = (s: string | null | undefined): Lectura | null => {
  if (!s) return null;
  try {
    const x = JSON.parse(s) as unknown;
    return x && typeof x === 'object' ? (x as Lectura) : null;
  } catch {
    return null;
  }
};

const PASO_DE_PIEZA = new Map<PiezaBandeja, PasoVerificacion>([
  ['doc_frente', 'doc_frente'],
  ['doc_reverso', 'doc_reverso'],
  ['selfie', 'cara'],
]);

/**
 * El resumen de UNA foto, como lo ve la fila. Pura (lleva su prueba). La comprobación automática
 * adelanta: verde si todo cuadra; ámbar si hay duda (rojo de la comprobación también es duda, porque
 * nunca decide sola); gris si no hubo comprobación y la mira una persona.
 */
export function resumenComprobacion(
  pieza: PiezaBandeja,
  foto: Pick<FilaFotoIa, 'estado' | 'color' | 'clase' | 'lectura'> | null,
  local?: { distanciaM: number | null; lejos: boolean },
): Comprobacion {
  if (pieza === 'local') {
    if (local?.lejos) return { pieza, tono: 'pendiente', motivo: 'lejos' };
    if (local?.distanciaM != null) return { pieza, tono: 'hecho', motivo: 'cerca' };
    return { pieza, tono: 'apagado', motivo: 'a_mano' };
  }
  if (!foto || foto.color === 'sin_ia') return { pieza, tono: 'apagado', motivo: 'a_mano' };
  if (foto.estado === 'repetir') return { pieza, tono: 'pendiente', motivo: 'repetir' };
  if (foto.color === 'verde') return { pieza, tono: 'hecho', motivo: 'cuadra' };
  const l = leer(foto.lectura);
  const paso = PASO_DE_PIEZA.get(pieza);
  const clase = l?.clase ?? foto.clase;
  if (paso && clase && clase !== claseDePaso(paso))
    return { pieza, tono: 'pendiente', motivo: 'otra_clase', clase };
  if (l?.vencido === 'si') return { pieza, tono: 'pendiente', motivo: 'vencido' };
  if (l && l.legible === false) return { pieza, tono: 'pendiente', motivo: 'ilegible' };
  if (l?.fotoDeOtraFoto) return { pieza, tono: 'pendiente', motivo: 'foto_de_foto' };
  return { pieza, tono: 'pendiente', motivo: 'confianza_baja' };
}

/** La comparación de la cara en vivo con la foto del documento, en el mismo código de colores. */
export function resumenCara(
  resultado: string | null | undefined,
): { resultado: string; tono: TonoComprobacion } | null {
  if (!resultado) return null;
  if (resultado === 'misma') return { resultado, tono: 'hecho' };
  if (resultado === 'dudoso' || resultado === 'distinta') return { resultado, tono: 'pendiente' };
  return { resultado, tono: 'apagado' };
}

/** «%» y «_» se buscan tal cual (no como comodines). */
const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Solo los dígitos del teléfono de la cuenta (alias `u`). */
const TELEFONO_U =
  "replace(replace(replace(replace(replace(COALESCE(u.telefono, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')";

/**
 * La zona de la persona: la del restaurante si es dueña de uno; si no, la real del conductor (nunca
 * el valor por defecto de la tabla), y si no hay, la de su cuenta.
 */
export const ZONA_BANDEJA_SQL = `CASE WHEN u.rol = 'restaurante' THEN COALESCE(rs.zona_id, u.zona_id) ELSE ${zonaRealSql('d', 'u')} END`;

/**
 * La búsqueda de la bandeja: por nombre (sin acentos ni mayúsculas), ID del conductor (también uno
 * viejo, con o sin «#»), correo, teléfono (sus dígitos), zona (nombre o código), restaurante o el id
 * de la cuenta. Todo «contiene»: la tabla de verificaciones es chica (una fila por persona) y la
 * consulta ya va acotada por la pestaña.
 */
export function condicionBusqueda(
  entrada: string,
  /** La columna con el id de la persona («u.id» en la pestaña «Sin enviar»). */
  persona = 'k.usuario_id',
): { sql: string; valores: string[] } | null {
  const texto = entrada.replace(/\s+/g, ' ').trim().slice(0, 80).replace(/^#\s*/, '');
  if (!texto) return null;
  const plano = `%${escaparLike(textoPlano(texto))}%`;
  const mayus = `%${escaparLike(texto.toUpperCase())}%`;
  const partes = [
    `${sqlPlano('u.nombre')} LIKE ? ESCAPE '\\'`,
    `${sqlPlano("COALESCE(rs.nombre, '')")} LIKE ? ESCAPE '\\'`,
    `${sqlPlano("COALESCE(z.nombre, '')")} LIKE ? ESCAPE '\\'`,
    `lower(u.correo) LIKE ? ESCAPE '\\'`,
    `upper(COALESCE(d.codigo, '')) LIKE ? ESCAPE '\\'`,
    `upper(COALESCE(${ZONA_BANDEJA_SQL}, '')) LIKE ? ESCAPE '\\'`,
    `${persona} IN (SELECT usuario_id FROM codigos_repartidor_anteriores WHERE upper(codigo) LIKE ? ESCAPE '\\')`,
    `${persona} = ?`,
  ];
  const valores = [
    plano,
    plano,
    plano,
    `%${escaparLike(texto.toLowerCase())}%`,
    mayus,
    mayus,
    mayus,
    texto,
  ];
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length >= 3 && /^[\d\s().+-]+$/.test(texto)) {
    partes.push(`${TELEFONO_U} LIKE ?`);
    valores.push(`%${digitos}%`);
  }
  return { sql: `(${partes.join(' OR ')})`, valores };
}

export type FiltrosBandeja = {
  estado: EstadoBandeja;
  zona: string;
  cuentas: string | undefined;
  q: string;
  alcance: { sql: string; valores: unknown[] };
};

/** Los filtros comunes (sin la pestaña): los usan la página y los totales de cada pestaña. */
export function condicionesBandeja(f: Omit<FiltrosBandeja, 'estado'>, persona = 'k.usuario_id') {
  const sql: string[] = [];
  const valores: unknown[] = [];
  const cuentas = sqlFiltroCuentas(f.cuentas);
  if (cuentas) sql.push(cuentas);
  if (f.zona) {
    sql.push(`${ZONA_BANDEJA_SQL} = ?`);
    valores.push(f.zona);
  }
  const b = condicionBusqueda(f.q, persona);
  if (b) {
    sql.push(b.sql);
    valores.push(...b.valores);
  }
  if (f.alcance.sql) {
    sql.push(f.alcance.sql.replace(/^ AND /, ''));
    valores.push(...f.alcance.valores);
  }
  return { sql, valores };
}

export const DESDE_BANDEJA = `FROM kyc k JOIN usuarios u ON u.id = k.usuario_id
  LEFT JOIN repartidores d ON d.usuario_id = k.usuario_id
  LEFT JOIN restaurantes rs ON rs.dueno_id = k.usuario_id
  LEFT JOIN zonas z ON z.id = ${ZONA_BANDEJA_SQL}`;

/** La fecha con que se ordena cada pestaña: la de llegada (pendientes) o la de la decisión. */
const FECHA_ORDEN = "COALESCE(k.revisado_en, k.enviado_en, '')";

/**
 * El cursor de la página siguiente: «fecha|id». Un cursor viejo (solo la fecha, como lo mandaba el
 * panel antes) sigue sirviendo.
 */
export function leerCursor(despues: string): { fecha: string; id: string } | null {
  if (!despues) return null;
  const i = despues.lastIndexOf('|');
  return i < 0
    ? { fecha: despues, id: '' }
    : { fecha: despues.slice(0, i), id: despues.slice(i + 1) };
}

/** La consulta de UNA página de la bandeja. */
export function consultaPagina(f: FiltrosBandeja, despues: string) {
  const comun = condicionesBandeja(f);
  const donde = ['k.estado = ?', ...comun.sql];
  const valores: unknown[] = [f.estado, ...comun.valores];
  const cursor = leerCursor(despues);
  const pendientes = f.estado === 'pendiente';
  if (cursor) {
    if (pendientes) {
      donde.push('(k.enviado_en > ? OR (k.enviado_en = ? AND k.usuario_id > ?))');
    } else {
      donde.push(`(${FECHA_ORDEN} < ? OR (${FECHA_ORDEN} = ? AND k.usuario_id < ?))`);
    }
    valores.push(cursor.fecha, cursor.fecha, cursor.id);
  }
  const orden = pendientes
    ? 'k.enviado_en, k.usuario_id'
    : `${FECHA_ORDEN} DESC, k.usuario_id DESC`;
  const sql = `SELECT k.usuario_id AS id, k.estado, k.doc_tipo AS docTipo, k.enviado_en AS enviado,
      k.revisado_en AS revisado, k.motivo, k.local_distancia_m AS distancia, k.proxima_revision AS proxima,
      k.doc_frente IS NOT NULL AS con_doc_frente, k.doc_reverso IS NOT NULL AS con_doc_reverso,
      k.selfie IS NOT NULL AS con_selfie, k.local IS NOT NULL AS con_local,
      k.selfie_miniatura IS NOT NULL AS con_miniatura,
      u.nombre, u.correo, u.telefono, u.rol, COALESCE(u.es_prueba, 0) AS es_prueba,
      d.codigo, rs.id AS restaurante_id, rs.nombre AS restaurante, ${ZONA_BANDEJA_SQL} AS zona_id, z.nombre AS zona_nombre,
      z.pais AS pais, (SELECT valor FROM config WHERE clave = 'pais:' || z.pais) AS cfg_pais,
      vc.resultado AS cara,
      (SELECT json_group_array(json_object('paso', f.paso, 'clave', f.clave, 'estado', f.estado,
                'color', f.ia_color, 'clase', f.ia_clase, 'lectura', f.ia_json))
         FROM verificacion_fotos f
        WHERE f.conductor_id = k.usuario_id AND f.estado IN ('vigente', 'repetir')
          AND f.clave IN (k.doc_frente, k.doc_reverso, k.selfie)) AS fotos
    ${DESDE_BANDEJA}
    LEFT JOIN verificacion_caras vc ON vc.conductor_id = k.usuario_id
    WHERE ${donde.join(' AND ')}
    ORDER BY ${orden} LIMIT ${POR_PAGINA_BANDEJA + 1}`;
  return {
    sql,
    valores,
    fecha: (r: FilaBandeja) => (pendientes ? r.enviado : (r.revisado ?? r.enviado)),
  };
}

/** Cuántas hay en cada pestaña CON los mismos filtros (así la búsqueda encuentra también lo cerrado). */
export function consultaTotales(f: Omit<FiltrosBandeja, 'estado'>) {
  const comun = condicionesBandeja(f);
  return {
    sql: `SELECT k.estado, COUNT(*) AS n ${DESDE_BANDEJA}
      WHERE k.estado IN ('pendiente', 'aprobado', 'rechazado')${comun.sql.map((s) => ` AND ${s}`).join('')}
      GROUP BY k.estado`,
    valores: comun.valores,
  };
}

// ───────────────────────── «Sin enviar» (C-VERIFICACIONES-SIN-ENVIAR) ─────────────────────────

/** Los roles que pasan por verificación. */
export const ROLES_SIN_ENVIAR = ['repartidor', 'restaurante'] as const;
/** El contador de «Sin enviar» se detiene aquí (se muestra «99+»): nunca cuenta una tabla entera. */
export const TOPE_CONTADOR_SIN_ENVIAR = 100;

const DESDE_SIN_ENVIAR = `FROM usuarios u LEFT JOIN kyc k ON k.usuario_id = u.id
  LEFT JOIN repartidores d ON d.usuario_id = u.id
  LEFT JOIN restaurantes rs ON rs.dueno_id = u.id
  LEFT JOIN zonas z ON z.id = ${ZONA_BANDEJA_SQL}`;
/** Sin fila de verificación, o devuelta a «sin enviar»; nunca una cuenta borrada por su dueño. */
const ES_SIN_ENVIAR =
  "(k.usuario_id IS NULL OR k.estado = 'sin_enviar') AND NOT (u.activo = 0 AND u.nombre = 'Cuenta borrada')";

/**
 * Una página de «Sin enviar»: una consulta por rol (cada una baja por el índice `usuarios_rol_creado`
 * desde la cuenta más nueva y corta al llenar la página); la ruta las junta y ordena.
 */
export function consultasSinEnviar(f: Omit<FiltrosBandeja, 'estado'>, despues: string) {
  const comun = condicionesBandeja(f, 'u.id');
  const cursor = leerCursor(despues);
  const donde = ['u.rol = ?', ES_SIN_ENVIAR, ...comun.sql];
  const valores: unknown[] = [...comun.valores];
  if (cursor) {
    donde.push('(u.creado_en < ? OR (u.creado_en = ? AND u.id < ?))');
    valores.push(cursor.fecha, cursor.fecha, cursor.id);
  }
  const sql = `SELECT u.id, u.creado_en AS creado, u.correo_confirmado_en IS NOT NULL AS confirmado,
      (SELECT COUNT(*) FROM verificacion_fotos f WHERE f.conductor_id = u.id AND f.estado = 'vigente') AS fotos_subidas,
      k.doc_frente IS NOT NULL AS con_doc_frente, k.doc_reverso IS NOT NULL AS con_doc_reverso,
      k.selfie IS NOT NULL AS con_selfie, k.selfie_miniatura IS NOT NULL AS con_miniatura,
      k.local IS NOT NULL AS con_local, k.consentimiento_en IS NOT NULL AS con_consentimiento,
      z.pais AS pais, (SELECT valor FROM config WHERE clave = 'pais:' || z.pais) AS cfg_pais,
      u.nombre, u.correo, u.telefono, u.rol, COALESCE(u.es_prueba, 0) AS es_prueba,
      d.codigo, rs.id AS restaurante_id, rs.nombre AS restaurante, ${ZONA_BANDEJA_SQL} AS zona_id, z.nombre AS zona_nombre
    ${DESDE_SIN_ENVIAR}
    WHERE ${donde.join(' AND ')}
    ORDER BY u.creado_en DESC, u.id DESC LIMIT ${POR_PAGINA_BANDEJA + 1}`;
  return ROLES_SIN_ENVIAR.map((rol) => ({ sql, valores: [rol, ...valores] }));
}

/**
 * Cuántas cuentas hay «sin enviar» con los mismos filtros, hasta el tope: la consulta corta en cuanto
 * junta 100 (por eso el panel dice «99+»). Sin búsqueda, zona ni alcance solo mira la cuenta y su
 * verificación (por su llave), sin las demás tablas.
 */
export function consultaTotalSinEnviar(f: Omit<FiltrosBandeja, 'estado'>) {
  const comun = condicionesBandeja(f, 'u.id');
  const sencilla = !f.zona && !f.q.trim() && !f.alcance.sql;
  const desde = sencilla
    ? 'FROM usuarios u LEFT JOIN kyc k ON k.usuario_id = u.id'
    : DESDE_SIN_ENVIAR;
  return {
    sql: `SELECT COUNT(*) AS n FROM (SELECT 1 ${desde}
      WHERE u.rol IN ('repartidor', 'restaurante') AND ${ES_SIN_ENVIAR}${comun.sql.map((s) => ` AND ${s}`).join('')}
      LIMIT ${TOPE_CONTADOR_SIN_ENVIAR})`,
    valores: comun.valores,
  };
}

export type FilaSinEnviar = {
  id: string;
  creado: string;
  confirmado: number;
  fotos_subidas: number;
  con_doc_frente?: number | null;
  con_doc_reverso?: number | null;
  con_selfie?: number | null;
  con_miniatura?: number | null;
  con_local?: number | null;
  con_consentimiento?: number | null;
  pais?: string | null;
  cfg_pais?: string | null;
  nombre: string;
  correo: string;
  telefono: string | null;
  rol: string;
  es_prueba: number;
  codigo: string | null;
  restaurante: string | null;
  restaurante_id: string | null;
  zona_id: string | null;
  zona_nombre: string | null;
};

/** Junta las páginas de cada rol: lo más nuevo primero, sin repetir a nadie. */
export function juntarSinEnviar(listas: FilaSinEnviar[][]): FilaSinEnviar[] {
  const vistos = new Set<string>();
  return listas
    .flat()
    .filter((r) => (vistos.has(r.id) ? false : (vistos.add(r.id), true)))
    .sort((a, b) =>
      a.creado === b.creado ? (a.id < b.id ? 1 : -1) : a.creado < b.creado ? 1 : -1,
    );
}

/** Lo que puede faltarle a quien está en «Sin enviar» (C-LLEGA-SOLO-A-REVISION). */
export type FaltaSinEnviar = 'doc_frente' | 'doc_reverso' | 'cara' | 'consentimiento' | 'local';

/**
 * Qué le falta de verdad para que su identidad llegue a revisión, con la misma regla del servidor:
 * el documento por delante, el reverso donde su país lo pide, la cara y el consentimiento (el
 * restaurante, además, la foto del local). Sin consultas: sale de la misma fila.
 */
export function faltaSinEnviar(r: FilaSinEnviar): FaltaSinEnviar[] {
  const si = (x: number | null | undefined) => Number(x) === 1;
  const conductor = r.rol === 'repartidor';
  const pideReverso =
    !conductor ||
    !r.pais ||
    pideReversoDocumento(politicaDesdeConfig(String(r.pais).toUpperCase(), r.cfg_pais ?? null));
  const falta: FaltaSinEnviar[] = [];
  if (!si(r.con_doc_frente)) falta.push('doc_frente');
  if (pideReverso && !si(r.con_doc_reverso)) falta.push('doc_reverso');
  if (!si(r.con_selfie)) falta.push('cara');
  if (conductor && !si(r.con_consentimiento)) falta.push('consentimiento');
  if (!conductor && !si(r.con_local)) falta.push('local');
  return falta;
}

/** La fila de «Sin enviar», con la misma forma que las demás pestañas. */
export function filaSinEnviar(r: FilaSinEnviar) {
  return {
    id: r.id,
    estado: 'sin_enviar',
    docTipo: '',
    nombre: r.nombre,
    correo: r.correo,
    telefono: r.telefono ?? '',
    rol: r.rol,
    codigo: r.codigo ?? null,
    restaurante: r.restaurante ?? null,
    restauranteId: r.restaurante_id ?? null,
    enviado: '',
    revisado: null,
    motivo: '',
    distancia: null,
    lejos: false,
    zonaId: r.zona_id ?? '',
    zona: r.zona_nombre ?? '',
    esPrueba: Number(r.es_prueba) === 1,
    // C-MINIATURA-SIEMPRE (23 nov 2026, Richard): la cara que ya subió se ve aunque no haya enviado.
    miniatura:
      Number(r.con_miniatura) === 1 ? 'mini' : Number(r.con_selfie) === 1 ? 'selfie' : null,
    /** C-LLEGA-SOLO-A-REVISION: lo que le falta para que su identidad llegue sola a revisión. */
    falta: faltaSinEnviar(r),
    comprobaciones: [],
    cara: null,
    /** Cuándo creó la cuenta. */
    creado: r.creado,
    correoConfirmado: Number(r.confirmado) === 1,
    /** Fotos que ya subió en el asistente sin llegar a enviar. */
    fotosSubidas: Number(r.fotos_subidas ?? 0),
  };
}

export type FilaBandeja = {
  id: string;
  estado: string;
  docTipo: string;
  enviado: string | null;
  revisado: string | null;
  motivo: string;
  distancia: number | null;
  proxima: string | null;
  con_doc_frente: number;
  con_doc_reverso: number;
  con_selfie: number;
  con_local: number;
  con_miniatura: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  rol: string;
  es_prueba: number;
  codigo: string | null;
  restaurante: string | null;
  restaurante_id: string | null;
  zona_id: string | null;
  zona_nombre: string | null;
  cara: string | null;
  fotos: string | null;
  /** C-DOCUMENTO-SIN-REVERSO: el país de la zona y su configuración (de ahí, si pide el reverso). */
  pais?: string | null;
  cfg_pais?: string | null;
};

/** Lo que la bandeja manda de cada fila. */
export function filaDeBandeja(r: FilaBandeja, distanciaMaxima: number) {
  const fotos = ((): FilaFotoIa[] => {
    try {
      const x = JSON.parse(r.fotos ?? '[]') as unknown;
      return Array.isArray(x) ? (x as FilaFotoIa[]) : [];
    } catch {
      return [];
    }
  })();
  const porPaso = new Map(fotos.map((f) => [f.paso, f]));
  const lejos = r.distancia != null && Number(r.distancia) > distanciaMaxima;
  // C-DOCUMENTO-SIN-REVERSO: el conductor de un país sin reverso (Venezuela) no muestra un «reverso»
  // sobrante; la foto que alguien llegó a subir se queda guardada y se ignora.
  const sinReverso =
    r.rol === 'repartidor' &&
    Boolean(r.pais) &&
    !pideReversoDocumento(politicaDesdeConfig(String(r.pais).toUpperCase(), r.cfg_pais ?? null));
  const tiene = new Map<PiezaBandeja, boolean>([
    ['doc_frente', Number(r.con_doc_frente) === 1],
    ['doc_reverso', !sinReverso && Number(r.con_doc_reverso) === 1],
    ['selfie', Number(r.con_selfie) === 1],
    ['local', Number(r.con_local) === 1],
  ]);
  const comprobaciones = PIEZAS_BANDEJA.filter((p) => tiene.get(p)).map((p) =>
    resumenComprobacion(
      p,
      porPaso.get(PASO_DE_PIEZA.get(p) ?? '') ?? null,
      p === 'local' ? { distanciaM: r.distancia, lejos } : undefined,
    ),
  );
  return {
    id: r.id,
    estado: r.estado,
    docTipo: r.docTipo,
    nombre: r.nombre,
    correo: r.correo,
    telefono: r.telefono ?? '',
    rol: r.rol,
    codigo: r.codigo ?? null,
    restaurante: r.restaurante ?? null,
    /** El restaurante del dueño (para abrir su ficha completa). */
    restauranteId: r.restaurante_id ?? null,
    enviado: r.enviado ?? '',
    revisado: r.revisado ?? null,
    motivo: r.estado === 'rechazado' ? r.motivo : '',
    distancia: r.distancia,
    lejos,
    zonaId: r.zona_id ?? '',
    zona: r.zona_nombre ?? '',
    esPrueba: Number(r.es_prueba) === 1,
    /** La foto de la fila: la miniatura si ya existe (aprobada); si no, la cara; si no, ninguna. */
    miniatura:
      Number(r.con_miniatura) === 1 ? 'mini' : Number(r.con_selfie) === 1 ? 'selfie' : null,
    comprobaciones,
    cara: resumenCara(r.cara),
  };
}
