/* eslint-disable security/detect-object-injection -- los índices salen del mapa de encabezados conocido, no del usuario */
import { Hono } from 'hono';
import { z } from 'zod';
import { leerCsv, mapearEncabezados } from '@tumbite/compartido';
import { sha256 } from '../cripto';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { actorDeEmpresa, exigirPermiso, nuevoIdFlex, sentenciaAuditoria } from './autorizacion';
import { esquemaEnvio, sentenciasDeEnvio } from './envios';

/**
 * Divoox Flex · importación por CSV en dos pasos: previsualizar (se validan columnas y filas,
 * se detectan duplicados y se guardan las filas con su error) y confirmar (se crean los envíos
 * en lotes pequeños; se puede volver a llamar hasta terminar). La misma hoja (misma huella) no
 * se importa dos veces. Nunca se cruzan empresas: todo cuelga del actor de la empresa.
 */
export const flexImportacion = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Filas por importación (tope por defecto; `FLEX_IMPORTACION_MAX` lo cambia sin publicar). */
export const LIMITE_FILAS_DEFECTO = 500;
/** Filas que se procesan por llamada de confirmación (cada fila son ≥ 3 sentencias). */
const FILAS_POR_LLAMADA = 100;
const FILAS_POR_LOTE = 10;
const MAX_CSV_BYTES = 1_000_000;

const esquemaPrevisualizar = z.object({
  csv: z.string().min(1).max(MAX_CSV_BYTES),
  centroId: z.string().uuid().nullable().optional(),
  nombreArchivo: z.string().trim().max(120).default(''),
});

type FilaValidada = { numero: number; datos: Record<string, unknown>; error: string | null };

function limiteFilas(env: Env): number {
  const n = Number((env as unknown as { FLEX_IMPORTACION_MAX?: string }).FLEX_IMPORTACION_MAX);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : LIMITE_FILAS_DEFECTO;
}

/** Convierte una fila del CSV en la entrada de un envío, o dice qué está mal (en palabras). */
export function validarFila(
  celdas: string[],
  mapa: Record<string, number>,
  centroId: string | null,
) {
  const v = (campo: string) => {
    const i = mapa[campo];
    return i === undefined ? '' : (celdas[i] ?? '').trim();
  };
  const numero = (campo: string) => {
    const t = v(campo);
    if (t === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };
  const nPaquetes = v('paquetes') === '' ? 1 : Number(v('paquetes'));
  if (!Number.isInteger(nPaquetes) || nPaquetes < 1 || nPaquetes > 50)
    return { datos: null, error: 'La columna de paquetes debe ser un número entero entre 1 y 50.' };
  const lat = numero('lat');
  const lng = numero('lng');
  if (Number.isNaN(lat) || Number.isNaN(lng))
    return { datos: null, error: 'Latitud o longitud no numéricas.' };
  const pesoG = numero('peso_g');
  if (Number.isNaN(pesoG)) return { datos: null, error: 'El peso debe ser un número en gramos.' };
  const entrada = {
    centroId,
    referenciaExterna: v('referencia') || null,
    destinatarioNombre: v('destinatario'),
    destinatarioTelefono: v('telefono'),
    direccion: v('direccion'),
    lat,
    lng,
    instrucciones: v('instrucciones'),
    ventanaDesde: v('ventana_desde') || null,
    ventanaHasta: v('ventana_hasta') || null,
    paquetes: Array.from({ length: nPaquetes }, () => ({
      pesoG: pesoG === null ? null : Math.round(pesoG),
      descripcion: v('descripcion'),
    })),
  };
  const r = esquemaEnvio.safeParse(entrada);
  if (!r.success) {
    const p = r.error.issues[0];
    const campo = p?.path[0] ? `${String(p.path[0])}: ` : '';
    return { datos: null, error: `${campo}${p?.message ?? 'Datos inválidos.'}` };
  }
  return { datos: r.data, error: null };
}

flexImportacion.post('/empresas/:id/importaciones/previsualizar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'importar');
  const d = await leerCuerpo(c, esquemaPrevisualizar);
  const db = base(c);
  if (d.centroId) {
    const f = await db
      .prepare(
        "SELECT 1 FROM empresa_centros WHERE id = ? AND empresa_id = ? AND estado = 'activo'",
      )
      .bind(d.centroId, actor.empresaId)
      .first();
    if (!f) throw new ErrorDatos('Ese centro no existe en tu empresa.', 'centroId', 404);
  }
  const huella = await sha256(`${actor.empresaId}\n${d.centroId ?? ''}\n${d.csv}`);
  // La misma hoja ya previsualizada o importada: se devuelve esa, no se duplica.
  const previa = await db
    .prepare(
      "SELECT id FROM importaciones WHERE empresa_id = ? AND huella = ? AND estado <> 'cancelada'",
    )
    .bind(actor.empresaId, huella)
    .first<{ id: string }>();
  if (previa) return c.json(await detalleImportacion(db, actor.empresaId, previa.id, true));

  const filas = leerCsv(d.csv);
  if (filas.length < 2)
    throw new ErrorDatos(
      'La hoja necesita una fila de encabezados y al menos una fila de datos.',
      'csv',
    );
  const mapa = mapearEncabezados(filas[0] as string[]);
  for (const obligatoria of ['destinatario', 'direccion'])
    if (mapa[obligatoria] === undefined)
      throw new ErrorDatos(
        `Falta la columna «${obligatoria}» (acepta también sus nombres en inglés: recipient, address).`,
        'csv',
      );
  const datos = filas.slice(1);
  const limite = limiteFilas(c.env);
  if (datos.length > limite)
    throw new ErrorDatos(
      `La hoja tiene ${datos.length} filas y el máximo por importación es ${limite}. Divídela.`,
      'csv',
      413,
    );

  // Duplicados dentro de la hoja y contra la base (referencias que ya existen en la empresa).
  const validadas: FilaValidada[] = datos.map((celdas, i) => {
    const r = validarFila(celdas, mapa, d.centroId ?? null);
    return {
      numero: i + 1,
      datos: (r.datos ?? { crudo: celdas }) as Record<string, unknown>,
      error: r.error,
    };
  });
  const vistas = new Map<string, number>();
  for (const f of validadas) {
    const ref = f.error
      ? null
      : ((f.datos as { referenciaExterna?: string | null }).referenciaExterna ?? null);
    if (!ref) continue;
    const antes = vistas.get(ref);
    if (antes !== undefined) f.error = `Referencia «${ref}» repetida en la hoja (fila ${antes}).`;
    else vistas.set(ref, f.numero);
  }
  const refs = [...vistas.keys()];
  const existentes = new Set<string>();
  for (let i = 0; i < refs.length; i += 90) {
    const trozo = refs.slice(i, i + 90);
    const { results } = await db
      .prepare(
        `SELECT referencia_externa FROM envios WHERE empresa_id = ? AND referencia_externa IN (${trozo.map(() => '?').join(',')})`,
      )
      .bind(actor.empresaId, ...trozo)
      .all<{ referencia_externa: string }>();
    for (const r of results) existentes.add(r.referencia_externa);
  }
  for (const f of validadas) {
    const ref = f.error
      ? null
      : ((f.datos as { referenciaExterna?: string | null }).referenciaExterna ?? null);
    if (ref && existentes.has(ref)) f.error = `Ya existe un envío con la referencia «${ref}».`;
  }
  const validas = validadas.filter((f) => !f.error).length;
  const id = nuevoIdFlex();
  const sentencias = [
    db
      .prepare(
        'INSERT INTO importaciones (id, empresa_id, centro_id, nombre_archivo, huella, total, validas, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        actor.empresaId,
        d.centroId ?? null,
        d.nombreArchivo,
        huella,
        validadas.length,
        validas,
        actor.actorId,
      ),
    ...validadas.map((f) =>
      db
        .prepare(
          'INSERT INTO importacion_filas (importacion_id, numero, datos_json, error) VALUES (?, ?, ?, ?)',
        )
        .bind(id, f.numero, JSON.stringify(f.datos), f.error),
    ),
    sentenciaAuditoria(db, actor, 'importacion.previsualizar', id, {
      total: validadas.length,
      validas,
    }),
  ];
  // Lotes de hasta 100 sentencias para no cargar D1 de golpe.
  for (let i = 0; i < sentencias.length; i += 100) await db.batch(sentencias.slice(i, i + 100));
  return c.json(await detalleImportacion(db, actor.empresaId, id, true), 201);
});

async function detalleImportacion(
  db: D1Database,
  empresaId: string,
  id: string,
  conVista: boolean,
) {
  const f = await db
    .prepare('SELECT * FROM importaciones WHERE id = ? AND empresa_id = ?')
    .bind(id, empresaId)
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Esa importación no existe.', undefined, 404);
  const errores = await db
    .prepare(
      'SELECT numero, error, datos_json FROM importacion_filas WHERE importacion_id = ? AND error IS NOT NULL ORDER BY numero LIMIT 200',
    )
    .bind(id)
    .all<{ numero: number; error: string; datos_json: string }>();
  const vista = conVista
    ? await db
        .prepare(
          'SELECT numero, datos_json, error, envio_id FROM importacion_filas WHERE importacion_id = ? ORDER BY numero LIMIT 20',
        )
        .bind(id)
        .all<{
          numero: number;
          datos_json: string;
          error: string | null;
          envio_id: string | null;
        }>()
    : { results: [] };
  return {
    importacion: {
      id: f.id,
      centroId: f.centro_id,
      nombreArchivo: f.nombre_archivo,
      estado: f.estado,
      total: f.total,
      validas: f.validas,
      procesadas: f.procesadas,
      creadoEn: f.creado_en,
      actualizadoEn: f.actualizado_en,
    },
    errores: errores.results.map((e) => ({ fila: e.numero, error: e.error })),
    vista: vista.results.map((v) => ({
      fila: v.numero,
      datos: JSON.parse(v.datos_json),
      error: v.error,
      envioId: v.envio_id,
    })),
  };
}

flexImportacion.get('/empresas/:id/importaciones', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'importar');
  const { results } = await base(c)
    .prepare('SELECT * FROM importaciones WHERE empresa_id = ? ORDER BY creado_en DESC LIMIT 50')
    .bind(actor.empresaId)
    .all<Record<string, unknown>>();
  return c.json({
    importaciones: results.map((f) => ({
      id: f.id,
      nombreArchivo: f.nombre_archivo,
      estado: f.estado,
      total: f.total,
      validas: f.validas,
      procesadas: f.procesadas,
      creadoEn: f.creado_en,
    })),
  });
});

flexImportacion.get('/empresas/:id/importaciones/:impId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'importar');
  return c.json(await detalleImportacion(base(c), actor.empresaId, c.req.param('impId'), true));
});

/**
 * Confirmar: crea los envíos de las filas válidas que todavía no tienen envío, en lotes de 10
 * filas, hasta 100 filas por llamada. Es idempotente y reanudable: volver a llamar sigue donde
 * quedó; cuando no queda nada, la importación pasa a «terminada».
 */
flexImportacion.post('/empresas/:id/importaciones/:impId/confirmar', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'importar');
  const db = base(c);
  const id = c.req.param('impId');
  const f = await db
    .prepare('SELECT * FROM importaciones WHERE id = ? AND empresa_id = ?')
    .bind(id, actor.empresaId)
    .first<{ estado: string; centro_id: string | null; validas: number }>();
  if (!f) throw new ErrorDatos('Esa importación no existe.', undefined, 404);
  if (f.estado === 'cancelada') throw new ErrorDatos('Esa importación se canceló.', undefined, 410);
  if (f.estado === 'terminada')
    return c.json(await detalleImportacion(db, actor.empresaId, id, false));
  if (f.estado === 'previsualizada')
    await db.batch([
      db
        .prepare(
          "UPDATE importaciones SET estado = 'confirmada', actualizado_en = datetime('now') WHERE id = ?",
        )
        .bind(id),
      sentenciaAuditoria(db, actor, 'importacion.confirmar', id),
    ]);
  const pendientes = await db
    .prepare(
      'SELECT numero, datos_json FROM importacion_filas WHERE importacion_id = ? AND error IS NULL AND envio_id IS NULL ORDER BY numero LIMIT ?',
    )
    .bind(id, FILAS_POR_LLAMADA)
    .all<{ numero: number; datos_json: string }>();
  let creadas = 0;
  for (let i = 0; i < pendientes.results.length; i += FILAS_POR_LOTE) {
    const trozo = pendientes.results.slice(i, i + FILAS_POR_LOTE);
    const sentencias: D1PreparedStatement[] = [];
    for (const fila of trozo) {
      const entrada = esquemaEnvio.parse(JSON.parse(fila.datos_json));
      const e = sentenciasDeEnvio(
        db,
        actor,
        { ...entrada, centroId: f.centro_id },
        `importacion:${id}`,
      );
      sentencias.push(
        ...e.sentencias,
        db
          .prepare(
            'UPDATE importacion_filas SET envio_id = ? WHERE importacion_id = ? AND numero = ? AND envio_id IS NULL',
          )
          .bind(e.id, id, fila.numero),
      );
    }
    sentencias.push(
      db
        .prepare(
          "UPDATE importaciones SET procesadas = procesadas + ?, actualizado_en = datetime('now') WHERE id = ?",
        )
        .bind(trozo.length, id),
    );
    try {
      await db.batch(sentencias);
      creadas += trozo.length;
    } catch (e) {
      // Si una referencia apareció mientras tanto, esa fila queda con su error y las demás siguen.
      const msg = String(e instanceof Error ? e.message : e);
      if (!msg.includes('envios_referencia_unica') && !msg.includes('UNIQUE')) throw e;
      for (const fila of trozo) {
        const entrada = esquemaEnvio.parse(JSON.parse(fila.datos_json));
        const ee = sentenciasDeEnvio(
          db,
          actor,
          { ...entrada, centroId: f.centro_id },
          `importacion:${id}`,
        );
        try {
          await db.batch([
            ...ee.sentencias,
            db
              .prepare(
                'UPDATE importacion_filas SET envio_id = ? WHERE importacion_id = ? AND numero = ? AND envio_id IS NULL',
              )
              .bind(ee.id, id, fila.numero),
            db
              .prepare(
                "UPDATE importaciones SET procesadas = procesadas + 1, actualizado_en = datetime('now') WHERE id = ?",
              )
              .bind(id),
          ]);
          creadas++;
        } catch {
          await db
            .prepare(
              'UPDATE importacion_filas SET error = ? WHERE importacion_id = ? AND numero = ?',
            )
            .bind(
              'Ya existe un envío con esa referencia (apareció después de la previsualización).',
              id,
              fila.numero,
            )
            .run();
        }
      }
    }
  }
  const quedan = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM importacion_filas WHERE importacion_id = ? AND error IS NULL AND envio_id IS NULL',
    )
    .bind(id)
    .first<{ n: number }>();
  if (!quedan?.n)
    await db.batch([
      db
        .prepare(
          "UPDATE importaciones SET estado = 'terminada', actualizado_en = datetime('now') WHERE id = ?",
        )
        .bind(id),
      sentenciaAuditoria(db, actor, 'importacion.terminar', id, { creadas }),
    ]);
  return c.json({
    ...(await detalleImportacion(db, actor.empresaId, id, false)),
    creadasAhora: creadas,
    quedan: quedan?.n ?? 0,
  });
});

flexImportacion.delete('/empresas/:id/importaciones/:impId', async (c) => {
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, 'importar');
  const db = base(c);
  const r = await db
    .prepare(
      "UPDATE importaciones SET estado = 'cancelada', actualizado_en = datetime('now') WHERE id = ? AND empresa_id = ? AND estado = 'previsualizada'",
    )
    .bind(c.req.param('impId'), actor.empresaId)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos(
      'Solo se cancela una importación que no se ha confirmado.',
      undefined,
      409,
    );
  await sentenciaAuditoria(db, actor, 'importacion.cancelar', c.req.param('impId')).run();
  return c.json({ ok: true });
});
