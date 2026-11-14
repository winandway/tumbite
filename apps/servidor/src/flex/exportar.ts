import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos } from '../validar';
import { actorDeEmpresa, exigirPermiso } from './autorizacion';
import { cuentaEmpresa, empresaFinanciera, tipoMovimiento } from '../finanzas/billetera';

/**
 * Divoox Flex · Fase 7 (C-FLEX-EXPORTAR). Todos los países.
 *
 * Exportar a CSV las listas del panel de la empresa con los MISMOS filtros que tiene puestos la
 * pantalla. Reglas de la casa:
 * - Solo lee: ni una escritura (ni auditoría por mirar: exportar es mirar).
 * - Tope por página (`FLEX_EXPORTAR_PAGINA`) y paginado por índice (cursor «creado_en|rowid» o
 *   «rowid»), nunca OFFSET: cada página lee lo que devuelve y no las anteriores.
 * - El panel pide página tras página hasta `FLEX_EXPORTAR_MAX` filas y arma el archivo en el
 *   navegador; el servidor no guarda nada.
 * - Celdas que empiezan con = + - @ van con un apóstrofo delante (una hoja de cálculo no las
 *   ejecuta como fórmula).
 * - El dinero va en centavos enteros y además en unidades con dos decimales, armado con enteros.
 */
export const flexExportar = new Hono<{ Bindings: Env; Variables: Variables }>();

export const FLEX_EXPORTAR_PAGINA = 500;
export const FLEX_EXPORTAR_MAX = 10_000;
export const TIPOS_EXPORTAR = [
  'envios',
  'paquetes',
  'rutas',
  'incidencias',
  'devoluciones',
  'movimientos',
] as const;
export type TipoExportar = (typeof TIPOS_EXPORTAR)[number];

/** Una celda CSV: comillas dobles escapadas y fórmulas desarmadas. */
export function celdaCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const filaCsv = (celdas: unknown[]) => celdas.map(celdaCsv).join(',');

/** 123456 → «1234.56»; −5 → «-0.05». Solo enteros: nada de coma flotante con dinero. */
export function unidades(centavos: number): string {
  const n = Math.trunc(Number(centavos) || 0);
  const signo = n < 0 ? '-' : '';
  const a = Math.abs(n);
  return `${signo}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

const esquema = z.object({
  estado: z.string().max(32).optional(),
  q: z.string().trim().max(80).optional(),
  centro: z.string().max(64).optional(),
  centroId: z.string().max(64).optional(),
  conductorId: z.string().max(64).optional(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  cursor: z.string().max(80).optional(),
  limite: z.coerce.number().int().min(1).max(FLEX_EXPORTAR_PAGINA).default(FLEX_EXPORTAR_PAGINA),
});
type Filtros = z.infer<typeof esquema>;

/** Cursor «fecha|rowid» (o solo «rowid»). Lo que no se entiende se rechaza: nunca un recorrido. */
function leerCursor(c: string | undefined, conFecha: boolean) {
  if (!c) return null;
  const partes = c.split('|');
  const n = Number(partes.at(-1));
  if (!Number.isSafeInteger(n) || n < 1) throw new ErrorDatos('Cursor inválido.', 'cursor');
  if (!conFecha) return { fecha: null, n };
  const fecha = partes.length === 2 ? (partes[0] ?? '') : '';
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(fecha))
    throw new ErrorDatos('Cursor inválido.', 'cursor');
  return { fecha, n };
}

type Pagina = { columnas: string[]; filas: unknown[][]; siguiente: string | null };

type Fila = Record<string, unknown>;

/** Ordena por (creado_en, rowid) descendente con el índice (empresa_id, …, creado_en). */
function porFecha(alias: string, f: Filtros, cond: string[], vals: unknown[]) {
  const cur = leerCursor(f.cursor, true);
  if (cur) {
    cond.push(`(${alias}.creado_en < ? OR (${alias}.creado_en = ? AND ${alias}.rowid < ?))`);
    vals.push(cur.fecha, cur.fecha, cur.n);
  }
  return `ORDER BY ${alias}.creado_en DESC, ${alias}.rowid DESC LIMIT ?`;
}

const siguientePorFecha = (filas: Fila[], limite: number) => {
  if (filas.length <= limite) return null;
  const u = filas[limite - 1];
  return u ? `${String(u.creado_en)}|${String(u.n)}` : null;
};
const siguientePorRowid = (filas: Fila[], limite: number) => {
  if (filas.length <= limite) return null;
  const u = filas[limite - 1];
  return u ? String(u.n) : null;
};

async function envios(db: D1Database, empresaId: string, f: Filtros): Promise<Pagina> {
  const cond = ['e.empresa_id = ?'];
  const vals: unknown[] = [empresaId];
  if (f.estado) {
    cond.push('e.estado = ?');
    vals.push(f.estado);
  }
  if (f.q) {
    cond.push(
      '(e.referencia_externa LIKE ? OR e.destinatario_nombre LIKE ? OR e.direccion LIKE ?)',
    );
    const like = `%${f.q}%`;
    vals.push(like, like, like);
  }
  const orden = porFecha('e', f, cond, vals);
  const { results } = await db
    .prepare(
      `SELECT e.rowid AS n, e.id, e.referencia_externa, e.destinatario_nombre, e.direccion, e.estado,
              e.creado_en,
              (SELECT COUNT(*) FROM paquetes p WHERE p.envio_id = e.id) AS paquetes,
              (SELECT COUNT(*) FROM paquetes p WHERE p.envio_id = e.id AND p.estado = 'entregado') AS entregados
         FROM envios e WHERE ${cond.join(' AND ')} ${orden}`,
    )
    .bind(...vals, f.limite + 1)
    .all<Fila>();
  return {
    columnas: [
      'id',
      'referencia',
      'destinatario',
      'direccion',
      'estado',
      'paquetes',
      'entregados',
      'creado_utc',
    ],
    filas: results
      .slice(0, f.limite)
      .map((x) => [
        x.id,
        x.referencia_externa,
        x.destinatario_nombre,
        x.direccion,
        x.estado,
        x.paquetes,
        x.entregados,
        x.creado_en,
      ]),
    siguiente: siguientePorFecha(results, f.limite),
  };
}

async function paquetes(db: D1Database, empresaId: string, f: Filtros): Promise<Pagina> {
  const cond = ['p.empresa_id = ?'];
  const vals: unknown[] = [empresaId];
  if (f.estado) {
    cond.push('p.estado = ?');
    vals.push(f.estado);
  }
  if (f.q) {
    cond.push(
      '(p.codigo_seguimiento LIKE ? OR p.codigo_etiqueta LIKE ? OR e.referencia_externa LIKE ? OR e.destinatario_nombre LIKE ?)',
    );
    const like = `%${f.q}%`;
    vals.push(like, like, like, like);
  }
  if (f.centro) {
    cond.push('e.centro_id = ?');
    vals.push(f.centro);
  }
  const orden = porFecha('p', f, cond, vals);
  const { results } = await db
    .prepare(
      `SELECT p.rowid AS n, p.id, p.codigo_seguimiento, p.codigo_etiqueta, p.descripcion, p.estado, p.creado_en,
              e.referencia_externa, e.destinatario_nombre, e.direccion
         FROM paquetes p JOIN envios e ON e.id = p.envio_id WHERE ${cond.join(' AND ')} ${orden}`,
    )
    .bind(...vals, f.limite + 1)
    .all<Fila>();
  return {
    columnas: [
      'id',
      'seguimiento',
      'etiqueta',
      'descripcion',
      'estado',
      'referencia',
      'destinatario',
      'direccion',
      'creado_utc',
    ],
    filas: results
      .slice(0, f.limite)
      .map((x) => [
        x.id,
        x.codigo_seguimiento,
        x.codigo_etiqueta,
        x.descripcion,
        x.estado,
        x.referencia_externa,
        x.destinatario_nombre,
        x.direccion,
        x.creado_en,
      ]),
    siguiente: siguientePorFecha(results, f.limite),
  };
}

/**
 * Rutas: el índice es (empresa_id, estado); se pagina por rowid dentro de la empresa. Las rutas
 * de una empresa son pocas comparadas con sus paquetes: no se agrega un índice (cada índice es una
 * escritura más en cada cambio de estado de la ruta).
 */
async function rutas(db: D1Database, empresaId: string, f: Filtros): Promise<Pagina> {
  const cond = ['r.empresa_id = ?'];
  const vals: unknown[] = [empresaId];
  if (f.estado) {
    cond.push('r.estado = ?');
    vals.push(f.estado);
  }
  if (f.centroId) {
    cond.push('r.centro_id = ?');
    vals.push(f.centroId);
  }
  if (f.conductorId) {
    cond.push('r.conductor_id = ?');
    vals.push(f.conductorId);
  }
  if (f.fecha) {
    cond.push('(date(COALESCE(r.bloque_desde, r.creado_en)) = ?)');
    vals.push(f.fecha);
  }
  const cur = leerCursor(f.cursor, false);
  if (cur) {
    cond.push('r.rowid < ?');
    vals.push(cur.n);
  }
  const { results } = await db
    .prepare(
      `SELECT r.rowid AS n, r.id, r.nombre, r.estado, r.bloque_desde, r.bloque_hasta, r.creado_en,
              u.nombre AS conductor, ce.nombre AS centro,
              (SELECT COUNT(*) FROM ruta_paradas rp WHERE rp.ruta_id = r.id) AS paradas,
              (SELECT COUNT(*) FROM ruta_paradas rp WHERE rp.ruta_id = r.id AND rp.estado = 'entregada') AS entregadas,
              (SELECT COUNT(*) FROM flex_incidencias i WHERE i.ruta_id = r.id) AS incidencias
         FROM rutas_flex r LEFT JOIN usuarios u ON u.id = r.conductor_id
         LEFT JOIN empresa_centros ce ON ce.id = r.centro_id
        WHERE ${cond.join(' AND ')} ORDER BY r.rowid DESC LIMIT ?`,
    )
    .bind(...vals, f.limite + 1)
    .all<Fila>();
  return {
    columnas: [
      'id',
      'nombre',
      'estado',
      'centro',
      'conductor',
      'paradas',
      'entregadas',
      'incidencias',
      'bloque_desde',
      'bloque_hasta',
      'creado_utc',
    ],
    filas: results
      .slice(0, f.limite)
      .map((x) => [
        x.id,
        x.nombre,
        x.estado,
        x.centro,
        x.conductor,
        x.paradas,
        x.entregadas,
        x.incidencias,
        x.bloque_desde,
        x.bloque_hasta,
        x.creado_en,
      ]),
    siguiente: siguientePorRowid(results, f.limite),
  };
}

async function incidencias(db: D1Database, empresaId: string, f: Filtros): Promise<Pagina> {
  const cond = ['i.empresa_id = ?'];
  const vals: unknown[] = [empresaId];
  if (f.estado) {
    cond.push('i.estado = ?');
    vals.push(f.estado);
  }
  const orden = porFecha('i', f, cond, vals);
  const { results } = await db
    .prepare(
      `SELECT i.rowid AS n, i.id, i.motivo, i.observaciones, i.proxima_accion, i.estado, i.creado_en,
              p.codigo_seguimiento, r.nombre AS ruta, u.nombre AS conductor
         FROM flex_incidencias i JOIN paquetes p ON p.id = i.paquete_id JOIN rutas_flex r ON r.id = i.ruta_id
         JOIN usuarios u ON u.id = i.conductor_id
        WHERE ${cond.join(' AND ')} ${orden}`,
    )
    .bind(...vals, f.limite + 1)
    .all<Fila>();
  return {
    columnas: [
      'id',
      'seguimiento',
      'ruta',
      'conductor',
      'motivo',
      'observaciones',
      'proxima_accion',
      'estado',
      'creado_utc',
    ],
    filas: results
      .slice(0, f.limite)
      .map((x) => [
        x.id,
        x.codigo_seguimiento,
        x.ruta,
        x.conductor,
        x.motivo,
        x.observaciones,
        x.proxima_accion,
        x.estado,
        x.creado_en,
      ]),
    siguiente: siguientePorFecha(results, f.limite),
  };
}

/** Lo mismo que la lista de devoluciones: paquetes que vienen de vuelta en una ruta activa. */
async function devoluciones(db: D1Database, empresaId: string, f: Filtros): Promise<Pagina> {
  // Entra por el índice (empresa_id, estado, creado_en) de paquetes; ruta_paquetes por su índice
  // único de la fila activa. Mismo resultado que la lista de la pantalla.
  const cond = ['p.empresa_id = ?', "p.estado = 'en_devolucion'", 'rq.activo = 1'];
  const vals: unknown[] = [empresaId];
  const orden = porFecha('p', f, cond, vals);
  const { results } = await db
    .prepare(
      `SELECT p.rowid AS n, p.creado_en, p.codigo_seguimiento, p.codigo_etiqueta, rq.devuelto_centro_en, r.nombre AS ruta,
              u.nombre AS conductor, e.referencia_externa, e.destinatario_nombre,
              (SELECT motivo FROM flex_incidencias i WHERE i.paquete_id = p.id AND i.ruta_id = rq.ruta_id ORDER BY i.creado_en DESC LIMIT 1) AS motivo
         FROM paquetes p JOIN ruta_paquetes rq ON rq.paquete_id = p.id AND rq.activo = 1
         JOIN rutas_flex r ON r.id = rq.ruta_id
         JOIN envios e ON e.id = p.envio_id LEFT JOIN usuarios u ON u.id = r.conductor_id
        WHERE ${cond.join(' AND ')} ${orden}`,
    )
    .bind(...vals, f.limite + 1)
    .all<Fila>();
  return {
    columnas: [
      'seguimiento',
      'etiqueta',
      'ruta',
      'conductor',
      'referencia',
      'destinatario',
      'motivo',
      'entregado_al_centro_utc',
    ],
    filas: results
      .slice(0, f.limite)
      .map((x) => [
        x.codigo_seguimiento,
        x.codigo_etiqueta,
        x.ruta,
        x.conductor,
        x.referencia_externa,
        x.destinatario_nombre,
        x.motivo,
        x.devuelto_centro_en,
      ]),
    siguiente: siguientePorFecha(results, f.limite),
  };
}

/** Movimientos de la billetera: el índice del libro (cuenta_id, bolsillo, país, moneda) + rowid. */
async function movimientos(db: D1Database, empresaId: string, f: Filtros): Promise<Pagina> {
  const e = await empresaFinanciera(db, empresaId);
  const cur = leerCursor(f.cursor, false);
  const { results } = await db
    .prepare(
      `SELECT rowid AS n, bolsillo, monto, concepto, creado_en FROM libro
        WHERE cuenta_id = ?1 AND pais = ?2 AND moneda = ?3
          AND (?4 IS NULL OR creado_en >= ?4) AND (?5 IS NULL OR creado_en <= ?5)
          AND (?6 IS NULL OR rowid < ?6)
        ORDER BY rowid DESC LIMIT ?7`,
    )
    .bind(
      cuentaEmpresa(e.id),
      e.pais,
      e.moneda,
      f.desde ?? null,
      f.hasta ? `${f.hasta} 23:59:59` : null,
      cur?.n ?? null,
      f.limite + 1,
    )
    .all<Fila>();
  return {
    columnas: ['id', 'tipo', 'bolsillo', 'monto_centavos', 'monto', 'moneda', 'fecha_utc'],
    filas: results
      .slice(0, f.limite)
      .map((x) => [
        x.n,
        tipoMovimiento(String(x.concepto), String(x.bolsillo)),
        x.bolsillo,
        x.monto,
        unidades(Number(x.monto)),
        e.moneda,
        x.creado_en,
      ]),
    siguiente: siguientePorRowid(results, f.limite),
  };
}

const HACER = new Map<TipoExportar, (db: D1Database, e: string, f: Filtros) => Promise<Pagina>>([
  ['envios', envios],
  ['paquetes', paquetes],
  ['rutas', rutas],
  ['incidencias', incidencias],
  ['devoluciones', devoluciones],
  ['movimientos', movimientos],
]);

/**
 * GET /empresas/:id/exportar/:tipo → una página CSV (text/csv). La primera página lleva la fila de
 * títulos; la cabecera `x-siguiente` trae el cursor de la próxima (vacía = no hay más).
 */
flexExportar.get('/empresas/:id/exportar/:tipo', async (c) => {
  const tipo = c.req.param('tipo') as TipoExportar;
  const hacer = HACER.get(tipo);
  if (!hacer) throw new ErrorDatos('Esa lista no se puede exportar.', 'tipo', 404);
  const actor = await actorDeEmpresa(c, c.req.param('id'));
  exigirPermiso(actor, tipo === 'movimientos' ? 'finanzas.ver' : 'envios.ver');
  const f = esquema.parse(c.req.query());
  const p = await hacer(base(c), actor.empresaId, f);
  const lineas = [...(f.cursor ? [] : [filaCsv(p.columnas)]), ...p.filas.map(filaCsv)];
  return new Response(lineas.length ? `${lineas.join('\r\n')}\r\n` : '', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'no-store',
      'x-siguiente': p.siguiente ?? '',
      'x-filas': String(p.filas.length),
      'access-control-expose-headers': 'x-siguiente, x-filas',
    },
  });
});
