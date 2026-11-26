import {
  PASOS_REVERSO,
  type PoliticaPlazoPapeles,
  diasRestantes,
  hitoQueToca,
  politicaPlazoDeFabrica,
  requisitosParaEmpezar,
} from '@tumbite/compartido';
import { z } from 'zod';
import type { Env } from './env';
import { enviarCorreo } from './correo';
import { type Idioma, notificar } from './notificaciones';
import { ZONA_REAL_SQL, paisConLugarSql } from './cuentaPais';

/**
 * C-PLAZO-PAPELES (19 nov 2026, decisión de Richard) — por país, por configuración.
 *
 * El conductor de un país con plazo (Venezuela: 30 días) trabaja desde que crea la cuenta. Mientras
 * su plazo corre («gracia»), la regla de siempre (`evaluarServicio`) no le exige la habilitación
 * aprobada, ni el vehículo aprobado, ni los requisitos que no sean «para empezar». Al vencer, la
 * gracia se apaga sola (es una fecha): vuelve la regla completa, deja de recibir viajes y se
 * reactiva solo cuando el equipo aprueba lo que faltaba. Nada se borra.
 *
 * - La gracia se LEE (una consulta por conductor, o una por lote en el despacho); nunca escribe.
 * - Los que ya existían conservan su estado: sin fila en `plazo_papeles` no hay gracia. La fila nace
 *   sola para las cuentas creadas desde PLAZO_DESDE, o cuando el equipo le da el plazo a mano.
 * - Los recordatorios (15, 10, 5 y 1 día, y el del vencimiento) salen de UNA tarea diaria que solo
 *   lee a quienes les falta poco y solo escribe a quien le toca aviso.
 */

/** Las cuentas creadas desde este día nacen con plazo. Las anteriores conservan su estado. */
export const PLAZO_DESDE = '2026-11-19 00:00:00';

export type EstadoPlazo = 'sin_plazo' | 'en_plazo' | 'completo' | 'vencido';

export type Gracia = {
  pais: string;
  politica: PoliticaPlazoPapeles;
  estado: EstadoPlazo;
  venceEn: string | null;
  /** Está dentro de su plazo: se le deja trabajar con lo mínimo. */
  activa: boolean;
  /** Requisitos que se exigen aunque esté en plazo. */
  exigidos: ReadonlySet<string>;
  /** Requisitos que su país no exige nunca. */
  exentos: ReadonlySet<string>;
};

const esquemaGuardado = z
  .object({
    plazoPapeles: z
      .object({
        dias: z.number().int().min(0),
        paraEmpezar: z.array(z.enum(['cara', 'identidad', 'licencia', 'seguro'])),
        exentos: z.array(z.string()),
        asistente: z.boolean(),
        aprobacionAutomatica: z.boolean(),
        sinReverso: z.array(z.enum(PASOS_REVERSO)),
        reversoOpcional: z.array(z.enum(PASOS_REVERSO)),
      })
      .partial()
      .optional(),
  })
  .passthrough();

/** La política de un país: la de fábrica con lo que el equipo haya escrito encima. */
export function politicaDesdeConfig(pais: string, valor: string | null): PoliticaPlazoPapeles {
  const fabrica = politicaPlazoDeFabrica(pais);
  if (!valor) return fabrica;
  try {
    const r = esquemaGuardado.safeParse(JSON.parse(valor));
    return r.success && r.data.plazoPapeles ? { ...fabrica, ...r.data.plazoPapeles } : fabrica;
  } catch {
    return fabrica;
  }
}

export async function politicaPlazo(db: D1Database, pais: string): Promise<PoliticaPlazoPapeles> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(`pais:${pais}`)
    .first<{ valor: string }>();
  return politicaDesdeConfig(pais, f?.valor ?? null);
}

type FilaGracia = {
  id: string;
  pais: string | null;
  estado: string | null;
  vence_en: string | null;
  cfg: string | null;
};

const SQL_GRACIA = `SELECT u.id, ${paisConLugarSql()} AS pais, p.estado, p.vence_en,
        (SELECT valor FROM config WHERE clave = 'pais:' || ${paisConLugarSql()}) AS cfg
   FROM usuarios u
   LEFT JOIN repartidores r ON r.usuario_id = u.id
   LEFT JOIN zonas z ON z.id = COALESCE(${ZONA_REAL_SQL}, r.zona_id, 'US-FL-MIAMI')
   LEFT JOIN plazo_papeles p ON p.conductor_id = u.id
  WHERE u.id`;

export function graciaDeFila(f: FilaGracia | null, ahora: string): Gracia {
  const pais = (f?.pais ?? 'US').toUpperCase();
  const politica = politicaDesdeConfig(pais, f?.cfg ?? null);
  const enPlazo = f?.estado === 'en_plazo' && Boolean(f.vence_en);
  const vencida = enPlazo && String(f?.vence_en) <= ahora;
  const estado: EstadoPlazo = !f?.estado
    ? 'sin_plazo'
    : f.estado === 'completo'
      ? 'completo'
      : f.estado === 'vencido' || vencida
        ? 'vencido'
        : 'en_plazo';
  return {
    pais,
    politica,
    estado,
    venceEn: f?.vence_en ?? null,
    activa: estado === 'en_plazo',
    exigidos: requisitosParaEmpezar(politica),
    exentos: new Set(politica.exentos),
  };
}

export const ahoraPlazo = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export async function graciaDe(db: D1Database, conductorId: string): Promise<Gracia> {
  const f = await db.prepare(`${SQL_GRACIA} = ?`).bind(conductorId).first<FilaGracia>();
  return graciaDeFila(f, ahoraPlazo());
}

/** La gracia de muchos, en una sola consulta por lote (el despacho). */
export async function graciasDe(db: D1Database, ids: string[]): Promise<Map<string, Gracia>> {
  const m = new Map<string, Gracia>();
  if (!ids.length) return m;
  const { results } = await db
    .prepare(`${SQL_GRACIA} IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .all<FilaGracia>();
  const ahora = ahoraPlazo();
  for (const f of results) m.set(f.id, graciaDeFila(f, ahora));
  return m;
}

/** Lo que le falta de verdad a un conductor, con la política de su país y su plazo aplicados. */
/**
 * C-SEGURO-EN-PLAZO (23 nov 2026, Richard: «el seguro vamos a dejarlo dentro de los 30 días… no le
 * podemos exigir a la gente dame póliza»). Dentro de su plazo vigente, y si su país no pide el seguro
 * para empezar (Perú sí lo pide), la póliza del vehículo es un papel más del plazo: la moto se envía a
 * revisión y se aprueba con el registro, y la póliza queda pendiente hasta que el plazo venza. Al
 * vencer, lo de siempre: sin la póliza aprobada no se conecta (requisito `seguro_vehiculo` y la vista
 * `conductores_elegibles`). La base dice lo mismo en `vehiculos_aprobar_exige_documentos`.
 */
export const seguroEnPlazo = (g: Pick<Gracia, 'activa' | 'politica'> | undefined) =>
  Boolean(g?.activa && !g.politica.paraEmpezar.includes('seguro'));

export function requisitosConGracia(faltan: readonly string[], g: Gracia | undefined): string[] {
  if (!g) return [...faltan];
  return faltan.filter((r) => !g.exentos.has(r) && (!g.activa || g.exigidos.has(r)));
}

// ───────────────────────── Textos ─────────────────────────

const T = {
  bienvenida: (i: Idioma, dias: number) =>
    i === 'en'
      ? {
          titulo: 'You can start working',
          cuerpo: `You have ${dias} days to upload your documents. Meanwhile you can go online and take trips.`,
        }
      : {
          titulo: 'Ya puedes trabajar',
          cuerpo: `Tienes ${dias} días para subir tus papeles. Mientras tanto ya puedes conectarte y recibir viajes.`,
        },
  recordatorio: (i: Idioma, dias: number) =>
    i === 'en'
      ? {
          titulo: dias === 1 ? '1 day left to upload your documents' : `${dias} days left`,
          cuerpo:
            'Open Driver, tap “Your documents” and finish the photos that are missing so your account keeps receiving trips.',
        }
      : {
          titulo: dias === 1 ? 'Te queda 1 día para subir tus papeles' : `Te quedan ${dias} días`,
          cuerpo:
            'Abre Driver, toca «Tus papeles» y termina las fotos que faltan para que tu cuenta siga recibiendo viajes.',
        },
  vencido: (i: Idioma) =>
    i === 'en'
      ? {
          titulo: 'Your account is paused',
          cuerpo:
            'The time to upload your documents ended. Nothing was deleted: upload what is missing in “Your documents” and your account comes back on its own once approved.',
        }
      : {
          titulo: 'Tu cuenta quedó en pausa',
          cuerpo:
            'Se acabó el plazo para subir tus papeles. No se borró nada: sube lo que falta en «Tus papeles» y tu cuenta vuelve sola cuando queden aprobados.',
        },
};

async function avisar(
  env: Env,
  db: D1Database,
  conductorId: string,
  texto: (i: Idioma) => { titulo: string; cuerpo: string },
) {
  await notificar(env, db, { id: conductorId, app: 'repartidor' }, (i) => ({
    ...texto(i),
    datos: { tipo: 'papeles' },
  })).catch((e: unknown) => console.error('plazo de papeles: aviso', e));
  const u = await db
    .prepare('SELECT correo, idioma FROM usuarios WHERE id = ?')
    .bind(conductorId)
    .first<{ correo: string; idioma: string }>();
  if (!u?.correo) return;
  const i: Idioma = u.idioma === 'en' ? 'en' : 'es';
  const t = texto(i);
  await enviarCorreo(env, {
    de: 'avisos',
    para: u.correo,
    asunto: t.titulo,
    texto: t.cuerpo,
    idioma: i,
  }).catch((e: unknown) => console.error('plazo de papeles: correo', e));
}

// ───────────────────────── Nacer, extender ─────────────────────────

/**
 * Le da su plazo a un conductor si su país lo tiene y todavía no lo tiene. `registro`: solo cuentas
 * creadas desde PLAZO_DESDE (los que ya existían conservan su estado). `equipo`: a quien sea, y si ya
 * tenía uno lo vuelve a contar desde hoy. Devuelve si nació o cambió algo.
 */
export async function empezarPlazo(
  env: Env,
  db: D1Database,
  conductorId: string,
  origen: 'registro' | 'equipo',
  dias?: number,
): Promise<boolean> {
  const f = await db
    .prepare(
      `${SQL_GRACIA.replace('p.vence_en,', `p.vence_en, u.creado_en, u.rol, ${ZONA_REAL_SQL} AS zona_real,`)} = ?`,
    )
    .bind(conductorId)
    .first<FilaGracia & { creado_en: string; rol: string; zona_real: string | null }>();
  if (!f || f.rol !== 'repartidor') return false;
  // C-PAIS-DE-LA-CUENTA (21 nov 2026): al registrarse, el plazo se decide con el país REAL. Sin ciudad
  // real todavía (ni invitación, ni elección, ni ubicación) no se decide nada: antes caía en Miami,
  // Estados Unidos no tiene plazo y el venezolano se quedaba sin el suyo. Se vuelve a llamar en cuanto
  // se sabe su ciudad (al conectarse, al abrir Driver con su ubicación o al elegir ciudad).
  if (origen === 'registro' && !f.zona_real) return false;
  const g = graciaDeFila(f, ahoraPlazo());
  const plazo = Math.floor(dias ?? g.politica.dias);
  if (plazo <= 0) return false;
  if (origen === 'registro') {
    if (f.estado || f.creado_en < PLAZO_DESDE) return false;
    const r = await db
      .prepare(
        `INSERT OR IGNORE INTO plazo_papeles (conductor_id, pais, vence_en, origen)
         VALUES (?, ?, datetime('now', ?), 'registro')`,
      )
      .bind(conductorId, g.pais, `+${plazo} days`)
      .run();
    if (!r.meta.changes) return false;
  } else {
    await db
      .prepare(
        `INSERT INTO plazo_papeles (conductor_id, pais, vence_en, origen)
         VALUES (?1, ?2, datetime('now', ?3), 'equipo')
         ON CONFLICT(conductor_id) DO UPDATE SET estado = 'en_plazo', vence_en = excluded.vence_en,
           origen = 'equipo', ultimo_aviso = NULL, actualizado_en = datetime('now')`,
      )
      .bind(conductorId, g.pais, `+${plazo} days`)
      .run();
  }
  await avisar(env, db, conductorId, (i) => T.bienvenida(i, plazo));
  return true;
}

/** Sus papeles quedaron todos aprobados: el plazo se cierra (una sola escritura, una sola vez). */
export async function cerrarPlazoCompleto(db: D1Database, conductorId: string) {
  await db
    .prepare(
      "UPDATE plazo_papeles SET estado = 'completo', actualizado_en = datetime('now') WHERE conductor_id = ? AND estado != 'completo'",
    )
    .bind(conductorId)
    .run();
}

// ───────────────────────── La tarea diaria ─────────────────────────

/**
 * completo = ya puede trabajar con la regla entera; subio_todo = solo falta que el equipo revise.
 * faltan_pedidos (C-PAPELES-POR-PAIS) = la regla entera ya se cumple, pero le faltan papeles de su país
 * que «solo se piden»: se le sigue recordando y, al vencer, el plazo se cierra sin pausar a nadie
 * (esos papeles no frenan el reparto, así que decirle «tu cuenta quedó en pausa» sería mentira).
 */
export type SituacionPlazo = 'completo' | 'subio_todo' | 'faltan_pedidos' | 'falta';
/** Días que se suman al plazo si venció con todo enviado y todavía sin revisar por el equipo. */
export const DIAS_SI_FALTA_REVISAR = 7;

/** Como mucho, cuántos conductores mira una vuelta (y por tanto cuántas filas puede escribir). */
export const LOTE_RECORDATORIOS = 150;
/** La hora (UTC) de la vuelta diaria: las 9 de la mañana de Venezuela, las 8 de Perú. */
export const HORA_RECORDATORIOS_UTC = 13;

/**
 * Recordatorios y vencimientos. Lee solo a quienes les quedan 15 días o menos (por índice) y escribe
 * UNA fila por cada conductor al que hoy le toca aviso; a los demás no los toca.
 * `situacion(id)` dice si ya puede trabajar con la regla entera (el plazo se cierra y no se le
 * avisa), si ya envió todo y solo falta nuestra revisión, o si le falta subir algo.
 */
export async function recordarPlazos(
  env: Env,
  db: D1Database,
  situacion: (conductorId: string) => Promise<SituacionPlazo>,
  ahora: Date = new Date(),
): Promise<{
  vistos: number;
  avisados: number;
  vencidos: number;
  completos: number;
  extendidos: number;
}> {
  const { results } = await db
    .prepare(
      `SELECT conductor_id, vence_en, ultimo_aviso FROM plazo_papeles
        WHERE estado = 'en_plazo' AND vence_en <= datetime(?, '+15 days')
        ORDER BY vence_en LIMIT ?`,
    )
    .bind(ahora.toISOString().slice(0, 19).replace('T', ' '), LOTE_RECORDATORIOS)
    .all<{ conductor_id: string; vence_en: string; ultimo_aviso: number | null }>();
  const cuenta = { vistos: results.length, avisados: 0, vencidos: 0, completos: 0, extendidos: 0 };
  for (const f of results) {
    const dias = diasRestantes(f.vence_en, ahora);
    const hito = hitoQueToca(dias, f.ultimo_aviso);
    if (hito === null) continue;
    const s = await situacion(f.conductor_id);
    if (s === 'completo') {
      await cerrarPlazoCompleto(db, f.conductor_id);
      cuenta.completos++;
      continue;
    }
    if (s === 'faltan_pedidos') {
      if (hito === 0) {
        await cerrarPlazoCompleto(db, f.conductor_id);
        cuenta.completos++;
        continue;
      }
      await db
        .prepare(
          "UPDATE plazo_papeles SET ultimo_aviso = ?, actualizado_en = datetime('now') WHERE conductor_id = ? AND estado = 'en_plazo'",
        )
        .bind(hito, f.conductor_id)
        .run();
      cuenta.avisados++;
      await avisar(env, db, f.conductor_id, (i) => T.recordatorio(i, dias));
      continue;
    }
    // Ya subió y envió todo: lo que falta es nuestra revisión. No se le avisa ni se le pausa por
    // una demora del equipo: al vencer se le dan DIAS_SI_FALTA_REVISAR más y queda escrito.
    if (s === 'subio_todo') {
      if (hito === 0) {
        await db
          .prepare(
            "UPDATE plazo_papeles SET vence_en = datetime(vence_en, ?), actualizado_en = datetime('now') WHERE conductor_id = ? AND estado = 'en_plazo'",
          )
          .bind(`+${DIAS_SI_FALTA_REVISAR} days`, f.conductor_id)
          .run();
        console.error(
          'plazo de papeles: venció con todo enviado y sin revisar; se extiende',
          f.conductor_id,
        );
        cuenta.extendidos++;
      }
      continue;
    }
    await db
      .prepare(
        "UPDATE plazo_papeles SET ultimo_aviso = ?, estado = ?, actualizado_en = datetime('now') WHERE conductor_id = ? AND estado = 'en_plazo'",
      )
      .bind(hito, hito === 0 ? 'vencido' : 'en_plazo', f.conductor_id)
      .run();
    if (hito === 0) {
      cuenta.vencidos++;
      await avisar(env, db, f.conductor_id, T.vencido);
    } else {
      cuenta.avisados++;
      await avisar(env, db, f.conductor_id, (i) => T.recordatorio(i, dias));
    }
  }
  return cuenta;
}
