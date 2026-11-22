import {
  PASOS_ANONIMOS,
  pasosDe,
  type AppRastro,
  type PasoAnonimo,
  type PasoRegistro,
} from '@tumbite/compartido';
import { leerCabeceraApp } from './versionApp';

/**
 * C-RASTRO (22 nov 2026, Richard) — todos los países. El rastro de actividad para el equipo: quién se
 * registró desde dónde, qué pasos dio y dónde lo dejó, y el embudo del registro. Nada de esto es público.
 *
 * Presupuesto de la nube (regla global): aquí NO se escribe por mirar. Se escribe una fila por alta, una
 * por entrada y una por cada paso del registro la PRIMERA vez que la cuenta lo alcanza (unos diez en la
 * vida de la cuenta). Los pasos de antes de crear la cuenta son un contador por día. La posición del
 * conductor en cada cambio de estado viaja en la fila que ya se escribía (cero escrituras de más).
 * La dirección IP no se guarda: solo el país y la ciudad aproximados que da la red.
 */

type Cf = {
  country?: unknown;
  city?: unknown;
  region?: unknown;
  asOrganization?: unknown;
};
type Peticion = { header: (n: string) => string | undefined; raw: Request };

export type Origen = {
  app: string | null;
  version: string | null;
  plataforma: string | null;
  pais: string | null;
  region: string | null;
  ciudad: string | null;
  red: string | null;
};

const corto = (v: unknown, max = 60): string | null => {
  const t = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return t || null;
};

/** Android, iPhone o navegador, por lo que dice el aparato (o lo que manda la app nueva). */
export function plataformaDe(cabeceraApp: string | undefined, agente: string | undefined) {
  const dicha = /\s(android|ios|web)\b/.exec(cabeceraApp ?? '')?.[1];
  if (dicha) return dicha;
  const a = (agente ?? '').toLowerCase();
  if (!a) return null;
  if (a.includes('okhttp') || (a.includes('android') && !a.includes('mozilla'))) return 'android';
  if (a.includes('cfnetwork') || a.includes('darwin')) return 'ios';
  if (a.includes('mozilla')) {
    if (a.includes('android')) return 'web (android)';
    if (a.includes('iphone') || a.includes('ipad')) return 'web (iphone)';
    return 'web';
  }
  return null;
}

/** De dónde viene la petición: app, versión, plataforma y la red aproximada. No lee ni escribe la base. */
export function origenDePeticion(req: Peticion): Origen {
  const cabecera = req.header('x-tumbite-app');
  const leida = leerCabeceraApp(cabecera);
  const cf = (req.raw as { cf?: Cf }).cf ?? {};
  const pais = corto(cf.country, 2) ?? corto(req.header('cf-ipcountry'), 2);
  return {
    app: leida?.app ?? null,
    version: leida ? leida.version.join('.') : null,
    plataforma: plataformaDe(cabecera, req.header('user-agent')),
    pais: pais && /^[A-Za-z]{2}$/.test(pais) && pais !== 'XX' ? pais.toUpperCase() : null,
    region: corto(cf.region),
    ciudad: corto(cf.city),
    red: corto(cf.asOrganization),
  };
}

/** Anota el alta o una entrada de la cuenta, con su origen. Una fila. */
export function anotarRastro(
  db: D1Database,
  usuarioId: string,
  tipo: 'alta' | 'entrada',
  o: Origen,
) {
  return db
    .prepare(
      `INSERT INTO rastro_cuenta (usuario_id, tipo, app, version, plataforma, pais_red, region_red, ciudad_red, red)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(usuarioId, tipo, o.app, o.version, o.plataforma, o.pais, o.region, o.ciudad, o.red)
    .run();
}

/**
 * La cuenta alcanzó un paso del registro. Solo la PRIMERA vez deja fila (las repeticiones no escriben
 * nada nuevo). Nunca frena lo que la persona está haciendo: si falla, queda en el registro de errores.
 */
export async function anotarPaso(
  db: D1Database,
  usuarioId: string,
  paso: PasoRegistro,
  o?: Partial<Origen>,
): Promise<void> {
  try {
    await db
      .prepare(
        'INSERT OR IGNORE INTO embudo_cuenta (usuario_id, paso, app, plataforma, pais) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(usuarioId, paso, o?.app ?? null, o?.plataforma ?? null, o?.pais ?? null)
      .run();
  } catch (e) {
    console.error('rastro: no se pudo anotar el paso', paso, String(e));
  }
}

/** Tope del día para los contadores de antes de crear la cuenta (por servidor en marcha). */
export const TOPE_ANONIMO_DIA = 3000;
let contados = { dia: '', n: 0 };
/** Solo para pruebas. */
export function reiniciarTopeAnonimo() {
  contados = { dia: '', n: 0 };
}
export const topeAnonimoAlcanzado = () =>
  contados.dia === new Date().toISOString().slice(0, 10) && contados.n >= TOPE_ANONIMO_DIA;

export const esPasoAnonimo = (p: unknown): p is PasoAnonimo =>
  (PASOS_ANONIMOS as readonly unknown[]).includes(p);

/**
 * Cuenta un paso de antes de crear la cuenta. Solo suma uno a un contador: no guarda persona, aparato
 * ni dirección. Devuelve false si el tope del día ya se alcanzó (no se escribe más).
 */
export async function contarPasoAnonimo(
  db: D1Database,
  app: AppRastro,
  paso: PasoAnonimo,
  o: Origen,
): Promise<boolean> {
  const dia = new Date().toISOString().slice(0, 10);
  if (contados.dia !== dia) contados = { dia, n: 0 };
  if (contados.n >= TOPE_ANONIMO_DIA) return false;
  contados.n++;
  await db
    .prepare(
      `INSERT INTO embudo_anonimo (dia, app, plataforma, pais, paso, personas) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(dia, app, plataforma, pais, paso) DO UPDATE SET personas = personas + 1`,
    )
    .bind(dia, app, o.plataforma ?? 'desconocida', o.pais ?? '', paso)
    .run();
  return true;
}

export type PasoLineaCuenta = {
  fecha: string;
  /** alta, entrada, paso, verificacion, vehiculo, habilitacion, viaje, pedido, chat, equipo. */
  tipo: string;
  evento: string;
  detalle: string | null;
  /** Quién lo hizo, si no fue la propia persona (nombre de alguien del equipo). */
  quien: string | null;
  /** A dónde lleva en el panel (ficha del viaje o del pedido). */
  enlace: string | null;
};

const LIMITE = 40;

/**
 * La línea de tiempo de una cuenta, armada con lo que ya existe (no se guarda aparte). Solo lee, por
 * índice, como mucho `LIMITE` filas de cada fuente. `dondeQuedo` = el último paso del registro alcanzado
 * y el que sigue.
 */
export async function lineaDeCuenta(db: D1Database, usuarioId: string) {
  const u = await db
    .prepare(
      'SELECT rol, creado_en, correo_confirmado_en, telefono_verificado_en, sms_consentido_en, es_prueba FROM usuarios WHERE id = ?',
    )
    .bind(usuarioId)
    .first<{
      rol: string;
      creado_en: string;
      correo_confirmado_en: string | null;
      telefono_verificado_en: string | null;
      sms_consentido_en: string | null;
      es_prueba: number;
    }>();
  if (!u) return null;
  const consultas = [
    db
      .prepare(
        `SELECT creado_en AS fecha, tipo, app, version, plataforma, pais_red, region_red, ciudad_red, red
         FROM rastro_cuenta WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT ${LIMITE}`,
      )
      .bind(usuarioId),
    db
      .prepare(
        'SELECT creado_en AS fecha, paso, app, plataforma, pais FROM embudo_cuenta WHERE usuario_id = ?',
      )
      .bind(usuarioId),
    db
      .prepare(
        `SELECT f.creado_en AS fecha, f.paso, f.estado, f.motivo, f.ia_color, f.decision, f.decidido_en, e.nombre AS quien
         FROM verificacion_fotos f LEFT JOIN usuarios e ON e.id = f.decidido_por
         WHERE f.conductor_id = ? ORDER BY f.creado_en DESC LIMIT ${LIMITE}`,
      )
      .bind(usuarioId),
    db
      .prepare(
        `SELECT k.estado, k.motivo, k.enviado_en, k.revisado_en, e.nombre AS quien
         FROM kyc k LEFT JOIN usuarios e ON e.id = k.revisado_por WHERE k.usuario_id = ?`,
      )
      .bind(usuarioId),
    db
      .prepare(
        `SELECT creado_en AS fecha, tipo, estado, aprobado_en FROM vehiculos WHERE conductor_id = ? ORDER BY creado_en DESC LIMIT ${LIMITE}`,
      )
      .bind(usuarioId),
    db
      .prepare(
        `SELECT h.creado_en AS fecha, h.servicio_id, h.estado_anterior, h.estado_nuevo, h.motivo, e.nombre AS quien
         FROM habilitaciones_historial h LEFT JOIN usuarios e ON e.id = h.actor_id
         WHERE h.conductor_id = ? ORDER BY h.creado_en DESC LIMIT ${LIMITE}`,
      )
      .bind(usuarioId),
    db
      .prepare(
        `SELECT o.id, o.creado_en AS fecha, o.servicio_id, v.estado, v.terminado_en, v.motivo_transicion,
                CASE WHEN o.conductor_id = ?1 THEN 'conductor' ELSE 'pasajero' END AS papel
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         WHERE o.cliente_id = ?1 OR o.conductor_id = ?1 ORDER BY o.creado_en DESC LIMIT ${LIMITE}`,
      )
      .bind(usuarioId),
    db
      .prepare(
        `SELECT id, creado_en AS fecha, estado, entregado_en, cancelado_en,
                CASE WHEN repartidor_id = ?1 THEN 'repartidor' ELSE 'cliente' END AS papel
         FROM pedidos WHERE cliente_id = ?1 OR repartidor_id = ?1 ORDER BY creado_en DESC LIMIT ${LIMITE}`,
      )
      .bind(usuarioId),
    db
      .prepare(
        'SELECT canal_ultimo, mensajes, creado_en, actualizado_en FROM camila_personas WHERE usuario_id = ? LIMIT 3',
      )
      .bind(usuarioId),
    db
      .prepare(
        `SELECT a.creado_en AS fecha, a.accion, e.nombre AS quien
         FROM auditoria_admin a LEFT JOIN usuarios e ON e.id = a.actor_id
         WHERE a.objeto = ? ORDER BY a.creado_en DESC LIMIT ${LIMITE}`,
      )
      .bind(usuarioId),
  ];
  const [rastro, pasos, fotos, kyc, vehiculos, habilitaciones, viajes, pedidos, chat, equipo] = (
    await db.batch<Record<string, string | number | null>>(consultas)
  ).map((r) => r.results);
  const t = (v: unknown) => (v == null || v === '' ? null : String(v));
  const linea: PasoLineaCuenta[] = [];
  const poner = (
    fecha: unknown,
    tipo: string,
    evento: string,
    detalle: string | null = null,
    quien: unknown = null,
    enlace: string | null = null,
  ) => {
    const f = t(fecha);
    if (f) linea.push({ fecha: f, tipo, evento, detalle, quien: t(quien), enlace });
  };
  // El origen viaja en partes («app|versión|plataforma|lugar|red») y el panel lo dice en su idioma.
  const origen = (r: Record<string, string | number | null>) =>
    [
      t(r.app) ?? '',
      t(r.version) ?? '',
      t(r.plataforma) ?? '',
      [t(r.ciudad_red), t(r.region_red), t(r.pais_red)].filter(Boolean).join(', '),
      t(r.red) ?? '',
    ].join('|');
  for (const r of rastro ?? []) poner(r.fecha, String(r.tipo), String(r.tipo), origen(r));
  // Una cuenta de antes del rastro no tiene fila de alta: la fecha de creación la da igual.
  if (!(rastro ?? []).some((r) => r.tipo === 'alta')) poner(u.creado_en, 'alta', 'alta', null);
  const yaAnotados = new Set((pasos ?? []).map((p) => String(p.paso)));
  // Los pasos que ya salen con más detalle por su propia fuente (fotos, vehículo, decisión del equipo)
  // no se repiten como paso.
  const conDetalle = new Set([
    'cuenta',
    'foto_cara',
    'foto_documento',
    'foto_licencia',
    'vehiculo',
  ]);
  if ((kyc ?? []).some((k) => k.revisado_en)) conDetalle.add('aprobado');
  for (const p of pasos ?? [])
    if (!conDetalle.has(String(p.paso))) poner(p.fecha, 'paso', String(p.paso));
  // Lo que pasó antes de que existiera el rastro se lee de donde quedó guardado.
  if (!yaAnotados.has('correo')) poner(u.correo_confirmado_en, 'paso', 'correo');
  if (!yaAnotados.has('telefono')) poner(u.telefono_verificado_en, 'paso', 'telefono');
  poner(u.sms_consentido_en, 'paso', 'acepto_sms');
  for (const f of fotos ?? []) {
    poner(
      f.fecha,
      'verificacion',
      `foto:${f.paso}`,
      [t(f.ia_color), t(f.motivo)].filter(Boolean).join(' · ') || null,
    );
    if (f.decision)
      poner(f.decidido_en, 'equipo', `foto_${f.decision}:${f.paso}`, t(f.motivo), f.quien);
  }
  for (const k of kyc ?? []) {
    if (!yaAnotados.has('enviado')) poner(k.enviado_en, 'paso', 'enviado');
    if (k.revisado_en)
      poner(k.revisado_en, 'equipo', `verificacion_${k.estado}`, t(k.motivo), k.quien);
  }
  for (const v of vehiculos ?? []) {
    poner(v.fecha, 'vehiculo', `vehiculo:${v.tipo}`, t(v.estado));
    poner(v.aprobado_en, 'equipo', `vehiculo_aprobado:${v.tipo}`);
  }
  for (const h of habilitaciones ?? [])
    poner(
      h.fecha,
      'habilitacion',
      `habilitacion:${h.servicio_id}`,
      [`${h.estado_anterior ?? '—'} → ${h.estado_nuevo}`, t(h.motivo)].filter(Boolean).join(' · '),
      h.quien,
    );
  for (const v of viajes ?? [])
    poner(
      v.fecha,
      'viaje',
      `viaje_${v.papel}`,
      [t(v.servicio_id), t(v.estado), t(v.motivo_transicion)].filter(Boolean).join(' · '),
      null,
      `/rides/${v.id}`,
    );
  for (const p of pedidos ?? [])
    poner(p.fecha, 'pedido', `pedido_${p.papel}`, t(p.estado), null, `/orders/${p.id}`);
  for (const c of chat ?? [])
    if (Number(c.mensajes ?? 0) > 0)
      poner(
        c.actualizado_en ?? c.creado_en,
        'chat',
        'chat',
        `${c.mensajes}|${c.canal_ultimo ?? ''}`,
      );
  for (const a of equipo ?? []) poner(a.fecha, 'equipo', `equipo:${a.accion}`, null, a.quien);
  linea.sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Dónde lo dejó: el paso más avanzado que alcanzó y el que le sigue.
  const app: AppRastro = u.rol === 'repartidor' ? 'repartidor' : 'cliente';
  const orden = pasosDe(app).filter((p) => !esPasoAnonimo(p));
  const hechos = new Set<string>(['cuenta', ...yaAnotados]);
  if (u.correo_confirmado_en) hechos.add('correo');
  if (u.telefono_verificado_en) hechos.add('telefono');
  if ((kyc ?? []).some((k) => k.enviado_en)) hechos.add('enviado');
  if ((kyc ?? []).some((k) => k.estado === 'aprobado')) hechos.add('aprobado');
  if (
    (viajes ?? []).some((v) => v.estado === 'terminado') ||
    (pedidos ?? []).some((p) => p.estado === 'entregado')
  )
    hechos.add('primer_viaje');
  let ultimo: PasoRegistro = 'cuenta';
  for (const p of orden) if (hechos.has(p)) ultimo = p;
  const falta = orden.filter((p) => !hechos.has(p));
  const alta = (rastro ?? []).find((r) => r.tipo === 'alta');
  return {
    alta: {
      fecha: u.creado_en,
      app: t(alta?.app),
      version: t(alta?.version),
      plataforma: t(alta?.plataforma),
      pais: t(alta?.pais_red),
      region: t(alta?.region_red),
      ciudad: t(alta?.ciudad_red),
      red: t(alta?.red),
      /** Cuentas de antes del 22 nov 2026 no guardaron de dónde vino el alta. */
      conOrigen: Boolean(alta),
    },
    esPrueba: Boolean(u.es_prueba),
    dondeQuedo: {
      ultimo,
      sigue: falta[0] ?? null,
      hechos: orden.filter((p) => hechos.has(p)),
      falta,
    },
    linea,
  };
}

export type FilaEmbudo = {
  paso: PasoRegistro;
  /** Cuántas personas llegaron a este paso. */
  personas: number;
  /** Cuántas se quedaron aquí: no llegaron a ningún paso posterior. null en el último paso. */
  seQuedan: number | null;
};

/**
 * El embudo del registro de una app. Los pasos de antes de crear la cuenta salen de los contadores del
 * período; los de después, de las cuentas REALES creadas en ese período (las de prueba no cuentan) y de
 * hasta dónde llegó cada una, con filtro de país y de zona. «Se quedaron aquí» es el paso MÁS avanzado
 * de cada cuenta (algunos pasos se pueden hacer en otro orden). Solo lee.
 */
export async function embudoRegistro(
  db: D1Database,
  f: {
    app: AppRastro;
    desde: string;
    hasta: string;
    pais?: string | null;
    zona?: string | null;
    /** C-PERMISOS-FINOS: la condición de alcance de quien mira, sobre `u.id` (vacía con alcance total). */
    alcance?: { sql: string; valores: unknown[] };
  },
) {
  const al = f.alcance ?? { sql: '', valores: [] };
  // Con una zona elegida, o con alcance limitado, los pasos sin cuenta no se pueden atribuir: fuera.
  const soloCuentas = Boolean(f.zona) || al.sql !== '';
  const rol = f.app === 'repartidor' ? 'repartidor' : 'cliente';
  const orden = pasosDe(f.app);
  const deCuenta = orden.filter((p) => !esPasoAnonimo(p));
  // Las cuentas reales creadas en el período (su paso «cuenta» cae dentro), con los filtros.
  const cohorte = `SELECT c.usuario_id FROM embudo_cuenta c JOIN usuarios u ON u.id = c.usuario_id
         LEFT JOIN repartidores r ON r.usuario_id = u.id
         WHERE c.paso = 'cuenta' AND c.creado_en >= ?1 AND c.creado_en < date(?2, '+1 day')
           AND u.rol = ?3 AND u.es_prueba = 0
           AND (?4 IS NULL OR c.pais = ?4)
           AND (?5 IS NULL OR COALESCE(u.zona_id, r.zona_id) = ?5)${al.sql}`;
  const valores = [f.desde, f.hasta, rol, f.pais ?? null, f.zona ?? null, ...al.valores];
  const ordenSql = `CASE e.paso ${deCuenta.map((p, i) => `WHEN '${p}' THEN ${i}`).join(' ')} ELSE -1 END`;
  const [anon, cuentas, ultimos, porPais] = await db.batch<Record<string, string | number | null>>([
    db
      .prepare(
        `SELECT paso, SUM(personas) AS personas FROM embudo_anonimo
         WHERE dia BETWEEN ?1 AND ?2 AND app = ?3 AND (?4 IS NULL OR pais = ?4) GROUP BY paso`,
      )
      .bind(f.desde, f.hasta, f.app, f.pais ?? null),
    db
      .prepare(
        `SELECT e.paso, COUNT(*) AS personas FROM embudo_cuenta e
         WHERE e.usuario_id IN (${cohorte}) GROUP BY e.paso`,
      )
      .bind(...valores),
    db
      .prepare(
        `SELECT o AS orden, COUNT(*) AS personas FROM (
           SELECT MAX(${ordenSql}) AS o FROM embudo_cuenta e
            WHERE e.usuario_id IN (${cohorte}) GROUP BY e.usuario_id
         ) GROUP BY o`,
      )
      .bind(...valores),
    db
      .prepare(
        `SELECT COALESCE(c.pais, '') AS pais, COUNT(*) AS personas
         FROM embudo_cuenta c JOIN usuarios u ON u.id = c.usuario_id
         WHERE c.paso = 'cuenta' AND c.creado_en >= ?1 AND c.creado_en < date(?2, '+1 day') AND u.rol = ?3 AND u.es_prueba = 0${al.sql}
         GROUP BY 1 ORDER BY 2 DESC LIMIT 30`,
      )
      .bind(f.desde, f.hasta, rol, ...al.valores),
  ]);
  const cuenta = new Map<string, number>();
  if (!soloCuentas)
    for (const r of anon?.results ?? []) cuenta.set(String(r.paso), Number(r.personas ?? 0));
  for (const r of cuentas?.results ?? []) cuenta.set(String(r.paso), Number(r.personas ?? 0));
  const quedan = new Map<string, number>();
  for (const r of ultimos?.results ?? []) {
    const p = deCuenta.at(Number(r.orden));
    if (p && Number(r.orden) >= 0) quedan.set(p, Number(r.personas ?? 0));
  }
  const visibles = orden.filter((p) => !(soloCuentas && esPasoAnonimo(p)));
  const pasos: FilaEmbudo[] = visibles.map((paso, i) => {
    const personas = cuenta.get(paso) ?? 0;
    if (i === visibles.length - 1) return { paso, personas, seQuedan: null };
    // Antes de la cuenta los pasos sí van en fila: se queda quien no llegó al siguiente.
    const seQuedan = esPasoAnonimo(paso)
      ? Math.max(0, personas - (cuenta.get(visibles.at(i + 1) ?? '') ?? 0))
      : (quedan.get(paso) ?? 0);
    return { paso, personas, seQuedan };
  });
  return {
    pasos,
    porPais: (porPais?.results ?? []).map((r) => ({
      pais: String(r.pais ?? ''),
      cuentas: Number(r.personas ?? 0),
    })),
  };
}
