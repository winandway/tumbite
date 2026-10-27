import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { avisarConductor, avisarEmpresa } from './avisosFlex';
import { sentenciaAuditoria } from './autorizacion';
import { despacharIntegraciones } from './integraciones';
import type { FilaRuta } from './rutasComun';
import { volverABorrador } from './rutasEmpresa';

/**
 * Divoox Flex · Fase 3: lo que hace el reloj EXISTENTE (GitHub Actions → /datos/reloj →
 * TAREAS_RELOJ). No hay un segundo reloj. Cada tarea es idempotente y aislada: si falla, las demás
 * siguen y la salud del reloj lo muestra (C-RELOJ-AISLADO).
 */

// ───────────────────────────── Ofertas vencidas (C-FLEX-VENCIMIENTO) ─────────────────────────────

/**
 * Las ofertas vencidas vuelven a borrador: los paquetes reservados se sueltan, la empresa recibe el
 * aviso y queda el evento en la auditoría y en la custodia. Si el conductor la aceptó en el mismo
 * instante, gana la aceptación (la sentencia exige el estado y la clave): la oferta no se toca.
 */
export async function vencerOfertasFlex(env: Env, db: D1Database, limite = 50) {
  const { results } = await db
    .prepare(
      `SELECT * FROM rutas_flex WHERE estado = 'ofrecida' AND oferta_vence_en IS NOT NULL
         AND oferta_vence_en <= datetime('now') ORDER BY oferta_vence_en LIMIT ?`,
    )
    .bind(limite)
    .all<FilaRuta>();
  let vencidas = 0;
  let enCarrera = 0;
  for (const r of results) {
    let clave: string;
    try {
      clave = await volverABorrador(
        db,
        r,
        { actorId: 'reloj', actorTipo: 'sistema' },
        'liberada_sistema',
        'oferta vencida',
      );
    } catch (e) {
      // Otra petición la cambió (aceptada, retirada o ya vencida por otra vuelta): nada que hacer.
      if (e instanceof ErrorDatos && e.estado === 409) {
        enCarrera++;
        continue;
      }
      throw e;
    }
    vencidas++;
    await sentenciaAuditoria(
      db,
      { empresaId: r.empresa_id, actorId: null, actorTipo: 'sistema' },
      'ruta.oferta_vencida',
      r.id,
      { conductorId: r.conductor_id, vencia: r.oferta_vence_en },
    ).run();
    await avisarEmpresa(env, db, { tipo: 'oferta_vencida', rutaId: r.id, ocasion: clave }).catch(
      (e: unknown) => console.error('flex: aviso de oferta vencida', e),
    );
    if (r.conductor_id)
      await avisarConductor(env, db, {
        tipo: 'oferta_retirada',
        rutaId: r.id,
        ocasion: clave,
        conductorId: r.conductor_id,
      }).catch((e: unknown) => console.error('flex: aviso de oferta retirada', e));
  }
  return { revisadas: results.length, vencidas, enCarrera };
}

/** Aviso al conductor cuando a su oferta le quedan 10 minutos o menos (una vez por oferta). */
export async function avisarOfertasPorVencer(env: Env, db: D1Database, minutos = 10) {
  const { results } = await db
    .prepare(
      `SELECT id, conductor_id, oferta_vence_en FROM rutas_flex WHERE estado = 'ofrecida'
         AND oferta_vence_en > datetime('now') AND oferta_vence_en <= datetime('now', '+' || ? || ' minutes')
       LIMIT 100`,
    )
    .bind(minutos)
    .all<{ id: string; conductor_id: string; oferta_vence_en: string }>();
  let avisos = 0;
  for (const r of results)
    avisos += await avisarConductor(env, db, {
      tipo: 'oferta_por_vencer',
      rutaId: r.id,
      ocasion: r.oferta_vence_en,
    });
  return { ofertas: results.length, avisos };
}

// ───────────────────────────── Retención y limpieza (C-FLEX-RETENCION) ─────────────────────────────

/**
 * Categorías de datos que se pueden limpiar. Las técnicas tienen política de fábrica aprobada.
 * Las que sirven para disputas (pruebas de entrega) y la ubicación del conductor NUNCA se borran
 * sin una política aprobada por una persona para ese país y servicio.
 */
export const CATEGORIAS_RETENCION = {
  idempotencia: { dias: 7, fabricaAprobada: true, sensible: false },
  avisos: { dias: 30, fabricaAprobada: true, sensible: false },
  integraciones: { dias: 30, fabricaAprobada: true, sensible: false },
  ubicacion: { dias: 90, fabricaAprobada: false, sensible: true },
  pruebas: { dias: 365, fabricaAprobada: false, sensible: true },
} as const;
export type CategoriaRetencion = keyof typeof CATEGORIAS_RETENCION;
const CATEGORIAS = Object.keys(CATEGORIAS_RETENCION) as CategoriaRetencion[];

type Politica = {
  pais: string;
  servicio: string;
  categoria: CategoriaRetencion;
  dias: number;
  aprobada: boolean;
  origen: 'fabrica' | 'configurada';
};

async function politicas(db: D1Database): Promise<Politica[]> {
  const { results } = await db
    .prepare('SELECT pais, servicio, categoria, dias, aprobada FROM flex_retencion')
    .all<{ pais: string; servicio: string; categoria: string; dias: number; aprobada: number }>();
  return results
    .filter(
      (r): r is typeof r & { categoria: CategoriaRetencion } => r.categoria in CATEGORIAS_RETENCION,
    )
    .map((r) => ({ ...r, aprobada: Boolean(r.aprobada), origen: 'configurada' as const }));
}

/** La política que rige para (país, servicio, categoría): la más específica, o la de fábrica. */
export function politicaPara(
  lista: Politica[],
  pais: string,
  servicio: string,
  categoria: CategoriaRetencion,
): Politica {
  const busca = (p: string, s: string) =>
    lista.find((x) => x.pais === p && x.servicio === s && x.categoria === categoria);
  // eslint-disable-next-line security/detect-object-injection -- categoria es de una lista cerrada
  const f = CATEGORIAS_RETENCION[categoria];
  return (
    busca(pais, servicio) ??
    busca('*', servicio) ??
    busca(pais, '*') ??
    busca('*', '*') ?? {
      pais: '*',
      servicio: '*',
      categoria,
      dias: f.dias,
      aprobada: f.fabricaAprobada,
      origen: 'fabrica',
    }
  );
}

/** Cuántas filas tocaría cada categoría en cada país (lo usa la simulación y la ejecución). */
async function candidatas(
  db: D1Database,
  categoria: CategoriaRetencion,
  pais: string,
  dias: number,
) {
  const corte = `-${dias} days`;
  // «*» = lo que no es de ninguna empresa (la idempotencia de las acciones de los conductores).
  if (pais === '*') {
    if (categoria !== 'idempotencia') return 0;
    const f = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM idempotencia_flex WHERE empresa_id NOT IN (SELECT id FROM empresas)
           AND creado_en < datetime('now', ?)`,
      )
      .bind(corte)
      .first<{ n: number }>();
    return Number(f?.n ?? 0);
  }
  const sql: Record<CategoriaRetencion, string> = {
    idempotencia: `SELECT COUNT(*) AS n FROM idempotencia_flex i JOIN empresas e ON e.id = i.empresa_id
                    WHERE e.pais = ?1 AND i.creado_en < datetime('now', ?2)`,
    avisos: `SELECT COUNT(*) AS n FROM flex_avisos a JOIN rutas_flex r ON r.id = a.ruta_id JOIN empresas e ON e.id = r.empresa_id
              WHERE e.pais = ?1 AND a.creado_en < datetime('now', ?2)`,
    integraciones: `SELECT COUNT(*) AS n FROM flex_webhook_entregas en JOIN empresas e ON e.id = en.empresa_id
                     WHERE e.pais = ?1 AND en.creado_en < datetime('now', ?2) AND en.estado IN ('entregado', 'fallido', 'descartado')`,
    ubicacion: `SELECT COUNT(*) AS n FROM rutas_flex r JOIN empresas e ON e.id = r.empresa_id
                 WHERE e.pais = ?1 AND r.estado IN ('completada', 'con_incidencias', 'cancelada')
                   AND r.cerrada_en < datetime('now', ?2) AND r.conductor_lat IS NOT NULL`,
    pruebas: `SELECT COUNT(*) AS n FROM flex_pruebas p JOIN rutas_flex r ON r.id = p.ruta_id JOIN empresas e ON e.id = r.empresa_id
               WHERE e.pais = ?1 AND p.purgada_en IS NULL AND r.estado IN ('completada', 'con_incidencias', 'cancelada')
                 AND p.creado_en < datetime('now', ?2)
                 -- Nunca lo que está en una incidencia abierta (puede haber una disputa en curso).
                 AND NOT EXISTS (SELECT 1 FROM flex_incidencias i WHERE i.prueba_id = p.id AND i.estado = 'abierta')`,
  };
  // eslint-disable-next-line security/detect-object-injection -- categoria es de una lista cerrada
  const f = await db.prepare(sql[categoria]).bind(pais, corte).first<{ n: number }>();
  return Number(f?.n ?? 0);
}

const SERVICIO = 'flex';

export type ResultadoLimpieza = {
  modo: 'simulacion' | 'ejecucion';
  categorias: {
    categoria: CategoriaRetencion;
    pais: string;
    dias: number;
    aprobada: boolean;
    origen: 'fabrica' | 'configurada';
    candidatas: number;
    borradas: number;
  }[];
};

/**
 * Simular (no toca nada) o ejecutar. En ejecución solo actúan las categorías con política aprobada;
 * de las pruebas se borra el ARCHIVO del almacén y la fila queda marcada (purgada_en), para que el
 * historial de custodia siga completo. Máximo 500 por categoría y país en cada vuelta.
 */
export async function limpiarFlex(
  env: Env,
  db: D1Database,
  modo: 'simulacion' | 'ejecucion',
  origen = 'reloj',
): Promise<ResultadoLimpieza> {
  const lista = await politicas(db);
  const paises = (
    await db.prepare('SELECT DISTINCT pais FROM empresas').all<{ pais: string }>()
  ).results.map((x) => x.pais);
  paises.push('*');
  const salida: ResultadoLimpieza['categorias'] = [];
  for (const pais of paises)
    for (const categoria of CATEGORIAS) {
      const pol = politicaPara(lista, pais, SERVICIO, categoria);
      const n = await candidatas(db, categoria, pais, pol.dias);
      let borradas = 0;
      if (modo === 'ejecucion' && pol.aprobada && n > 0)
        borradas = await ejecutar(env, db, categoria, pais, pol.dias);
      salida.push({
        categoria,
        pais,
        dias: pol.dias,
        aprobada: pol.aprobada,
        origen: pol.origen,
        candidatas: n,
        borradas,
      });
    }
  const resultado: ResultadoLimpieza = { modo, categorias: salida };
  await db
    .prepare('INSERT INTO flex_limpiezas (modo, origen, resultado_json) VALUES (?, ?, ?)')
    .bind(modo, origen, JSON.stringify(resultado))
    .run();
  return resultado;
}

async function ejecutar(
  env: Env,
  db: D1Database,
  categoria: CategoriaRetencion,
  pais: string,
  dias: number,
): Promise<number> {
  const corte = `-${dias} days`;
  if (pais === '*')
    return categoria === 'idempotencia'
      ? (
          await db
            .prepare(
              `DELETE FROM idempotencia_flex WHERE rowid IN (SELECT rowid FROM idempotencia_flex
                 WHERE empresa_id NOT IN (SELECT id FROM empresas) AND creado_en < datetime('now', ?) LIMIT 500)`,
            )
            .bind(corte)
            .run()
        ).meta.changes
      : 0;
  const empresas = `SELECT id FROM empresas WHERE pais = ?1`;
  switch (categoria) {
    case 'idempotencia':
      return (
        await db
          .prepare(
            `DELETE FROM idempotencia_flex WHERE rowid IN (SELECT rowid FROM idempotencia_flex
               WHERE empresa_id IN (${empresas}) AND creado_en < datetime('now', ?2) LIMIT 500)`,
          )
          .bind(pais, corte)
          .run()
      ).meta.changes;
    case 'avisos':
      return (
        await db
          .prepare(
            `DELETE FROM flex_avisos WHERE clave IN (SELECT a.clave FROM flex_avisos a JOIN rutas_flex r ON r.id = a.ruta_id
               WHERE r.empresa_id IN (${empresas}) AND a.creado_en < datetime('now', ?2) LIMIT 500)`,
          )
          .bind(pais, corte)
          .run()
      ).meta.changes;
    case 'integraciones': {
      const { results } = await db
        .prepare(
          `SELECT id FROM flex_webhook_entregas WHERE empresa_id IN (${empresas}) AND creado_en < datetime('now', ?2)
             AND estado IN ('entregado', 'fallido', 'descartado') LIMIT 500`,
        )
        .bind(pais, corte)
        .all<{ id: number }>();
      if (!results.length) return 0;
      const ids = JSON.stringify(results.map((x) => x.id));
      await db.batch([
        db
          .prepare(
            'DELETE FROM flex_webhook_intentos WHERE entrega_id IN (SELECT value FROM json_each(?))',
          )
          .bind(ids),
        db
          .prepare('DELETE FROM flex_webhook_entregas WHERE id IN (SELECT value FROM json_each(?))')
          .bind(ids),
        // Los eventos ya repartidos y sin entregas pendientes también se van.
        db
          .prepare(
            `DELETE FROM flex_eventos WHERE id IN (SELECT e.id FROM flex_eventos e
               WHERE e.empresa_id IN (${empresas}) AND e.repartido_en IS NOT NULL AND e.creado_en < datetime('now', ?2)
                 AND NOT EXISTS (SELECT 1 FROM flex_webhook_entregas en WHERE en.evento_id = e.evento_id) LIMIT 500)`,
          )
          .bind(pais, corte),
      ]);
      return results.length;
    }
    case 'ubicacion':
      return (
        await db
          .prepare(
            `UPDATE rutas_flex SET conductor_lat = NULL, conductor_lng = NULL, conductor_ubicacion_en = NULL
              WHERE id IN (SELECT id FROM rutas_flex WHERE empresa_id IN (${empresas})
                AND estado IN ('completada', 'con_incidencias', 'cancelada')
                AND cerrada_en < datetime('now', ?2) AND conductor_lat IS NOT NULL LIMIT 500)`,
          )
          .bind(pais, corte)
          .run()
      ).meta.changes;
    case 'pruebas': {
      const { results } = await db
        .prepare(
          `SELECT p.id, p.clave FROM flex_pruebas p JOIN rutas_flex r ON r.id = p.ruta_id
            WHERE r.empresa_id IN (${empresas}) AND p.purgada_en IS NULL
              AND r.estado IN ('completada', 'con_incidencias', 'cancelada') AND p.creado_en < datetime('now', ?2)
              AND NOT EXISTS (SELECT 1 FROM flex_incidencias i WHERE i.prueba_id = p.id AND i.estado = 'abierta')
            LIMIT 500`,
        )
        .bind(pais, corte)
        .all<{ id: string; clave: string }>();
      let n = 0;
      for (const p of results) {
        // Primero el archivo; si no se pudo borrar, la fila NO se marca (se reintenta otro día).
        try {
          await env.BUCKET?.delete(p.clave);
        } catch (e) {
          console.error('flex: no se pudo borrar una prueba del almacén', e);
          continue;
        }
        await db
          .prepare("UPDATE flex_pruebas SET purgada_en = datetime('now') WHERE id = ?")
          .bind(p.id)
          .run();
        n++;
      }
      return n;
    }
  }
}

/** La limpieza del reloj corre una vez al día (si ya hubo una ejecución en las últimas 20 h, no). */
export async function limpiezaDiariaFlex(env: Env, db: D1Database) {
  const ya = await db
    .prepare(
      "SELECT 1 FROM flex_limpiezas WHERE modo = 'ejecucion' AND origen = 'reloj' AND creado_en > datetime('now', '-20 hours')",
    )
    .first();
  if (ya) return null;
  const r = await limpiarFlex(env, db, 'ejecucion', 'reloj');
  return { borradas: r.categorias.reduce((s, x) => s + x.borradas, 0) };
}

/** Las tareas de Flex para el reloj existente. */
export const TAREAS_FLEX = [
  {
    nombre: 'flex_ofertas',
    critica: true,
    correr: (env: Env, db: D1Database) => vencerOfertasFlex(env, db),
  },
  {
    nombre: 'flex_ofertas_por_vencer',
    critica: false,
    correr: (env: Env, db: D1Database) => avisarOfertasPorVencer(env, db),
  },
  {
    nombre: 'flex_integraciones',
    critica: false,
    correr: (env: Env, db: D1Database) =>
      despacharIntegraciones(env, db, { limite: 50, vueltasReparto: 20 }),
  },
  {
    nombre: 'flex_limpieza',
    critica: false,
    correr: (env: Env, db: D1Database) => limpiezaDiariaFlex(env, db),
  },
] as const;

// ───────────────────────────── Superadmin: políticas de retención ─────────────────────────────

export const flexRetencion = new Hono<{ Bindings: Env; Variables: Variables }>();

const esquemaPolitica = z.object({
  pais: z.string().regex(/^([A-Z]{2}|\*)$/, 'País en dos letras (o * para todos).'),
  servicio: z.enum(['flex', '*']).default('flex'),
  categoria: z.enum(CATEGORIAS as [CategoriaRetencion, ...CategoriaRetencion[]]),
  dias: z.number().int().min(1).max(3650),
  aprobada: z.boolean(),
});

flexRetencion.get('/admin/retencion', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const ultima = await db
    .prepare(
      'SELECT modo, origen, resultado_json, creado_en FROM flex_limpiezas ORDER BY id DESC LIMIT 5',
    )
    .all<{ modo: string; origen: string; resultado_json: string; creado_en: string }>();
  return c.json({
    categorias: CATEGORIAS_RETENCION,
    politicas: await politicas(db),
    ultimas: ultima.results.map((x) => ({
      ...x,
      resultado: JSON.parse(x.resultado_json) as unknown,
    })),
  });
});

flexRetencion.put('/admin/retencion', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaPolitica);
  await base(c)
    .prepare(
      `INSERT INTO flex_retencion (pais, servicio, categoria, dias, aprobada, aprobada_por, aprobada_en)
       VALUES (?1, ?2, ?3, ?4, ?5, CASE WHEN ?5 THEN ?6 END, CASE WHEN ?5 THEN datetime('now') END)
       ON CONFLICT (pais, servicio, categoria) DO UPDATE SET dias = ?4, aprobada = ?5,
         aprobada_por = CASE WHEN ?5 THEN ?6 END, aprobada_en = CASE WHEN ?5 THEN datetime('now') END,
         actualizado_en = datetime('now')`,
    )
    .bind(d.pais, d.servicio, d.categoria, d.dias, d.aprobada ? 1 : 0, u.id)
    .run();
  return c.json({ ok: true });
});

flexRetencion.post('/admin/retencion/simular', async (c) => {
  exigir(c, 'admin');
  return c.json(await limpiarFlex(c.env, base(c), 'simulacion', 'admin'));
});

/** Ejecutar a mano exige una simulación de la última hora (se mira antes de borrar). */
flexRetencion.post('/admin/retencion/ejecutar', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const sim = await db
    .prepare(
      "SELECT 1 FROM flex_limpiezas WHERE modo = 'simulacion' AND creado_en > datetime('now', '-1 hours')",
    )
    .first();
  if (!sim)
    throw new ErrorDatos('Primero corre la simulación y revisa qué se borraría.', undefined, 409);
  return c.json(await limpiarFlex(c.env, db, 'ejecucion', 'admin'));
});
