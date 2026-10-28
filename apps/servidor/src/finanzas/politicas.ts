import {
  type ContextoCobro,
  type PoliticaFinanciera,
  type ReglaComision,
  elegirPolitica,
  esquemaRegla,
} from '@tumbite/compartido';

/**
 * Divoox · Fase 4: políticas financieras guardadas (C-FIN-POLITICAS). La elección es la función pura
 * de `packages/compartido/src/finanzas.ts`; aquí solo se leen de la base y se audita cada cambio.
 */

type FilaPolitica = {
  id: string;
  nombre: string;
  servicio: string;
  tipo_cuenta: string;
  pais: string;
  ciudad: string | null;
  empresa_id: string | null;
  modalidad: string;
  moneda: string;
  regla_json: string;
  descuento_pb: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  prioridad: number;
  activa: number;
  revision_legal_aprobada: number;
  revision_legal_nota: string;
  motivo: string;
  creado_por: string | null;
  creado_en: string;
  cerrada_en: string | null;
};

export const ahoraSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export function filaAPolitica(f: FilaPolitica): PoliticaFinanciera | null {
  let regla: ReglaComision;
  try {
    regla = esquemaRegla.parse(JSON.parse(f.regla_json));
  } catch {
    console.error('finanzas: política con regla dañada; no se usa', f.id);
    return null;
  }
  return {
    id: f.id,
    servicio: f.servicio as PoliticaFinanciera['servicio'],
    tipoCuenta: f.tipo_cuenta as PoliticaFinanciera['tipoCuenta'],
    pais: f.pais,
    ciudad: f.ciudad,
    empresaId: f.empresa_id,
    modalidad: f.modalidad as PoliticaFinanciera['modalidad'],
    moneda: f.moneda,
    regla,
    descuentoPb: Number(f.descuento_pb),
    vigenteDesde: f.vigente_desde,
    vigenteHasta: f.vigente_hasta,
    prioridad: Number(f.prioridad),
    activa: Boolean(f.activa),
    revisionLegalAprobada: Boolean(f.revision_legal_aprobada),
  };
}

export function politicaPublica(f: FilaPolitica) {
  const p = filaAPolitica(f);
  return {
    ...(p ?? {}),
    id: f.id,
    nombre: f.nombre,
    motivo: f.motivo,
    revisionLegalNota: f.revision_legal_nota,
    creadoPor: f.creado_por,
    creadoEn: f.creado_en,
    cerradaEn: f.cerrada_en,
    valida: Boolean(p),
  };
}

/** La política que rige una operación AHORA (o en `ctx.en`). Null = no se cobra nada. */
export async function politicaVigente(
  db: D1Database,
  ctx: Omit<ContextoCobro, 'en'> & { en?: string },
): Promise<PoliticaFinanciera | null> {
  const { results } = await db
    .prepare(
      `SELECT * FROM politicas_financieras
        WHERE servicio = ? AND tipo_cuenta = ? AND (pais = ? OR pais = '*') AND activa = 1`,
    )
    .bind(ctx.servicio, ctx.tipoCuenta, ctx.pais)
    .all<FilaPolitica>();
  const lista = results.map(filaAPolitica).filter((p): p is PoliticaFinanciera => p !== null);
  return elegirPolitica(lista, { ...ctx, en: ctx.en ?? ahoraSql() });
}

export async function filaPolitica(db: D1Database, id: string) {
  return db
    .prepare('SELECT * FROM politicas_financieras WHERE id = ?')
    .bind(id)
    .first<FilaPolitica>();
}

export async function listarPoliticas(
  db: D1Database,
  filtro: { servicio?: string; pais?: string },
) {
  const { results } = await db
    .prepare(
      `SELECT * FROM politicas_financieras
        WHERE (?1 IS NULL OR servicio = ?1) AND (?2 IS NULL OR pais = ?2 OR pais = '*')
        ORDER BY activa DESC, servicio, pais, creado_en DESC LIMIT 500`,
    )
    .bind(filtro.servicio ?? null, filtro.pais ?? null)
    .all<FilaPolitica>();
  return results.map(politicaPublica);
}

/** Sentencia de auditoría financiera (inmutable), para el mismo lote que el cambio. */
export function sentenciaAuditoriaFin(
  db: D1Database,
  p: {
    actorId: string | null;
    actorTipo?: 'usuario' | 'sistema';
    accion: string;
    objeto?: string;
    empresaId?: string | null;
    detalle?: unknown;
  },
): D1PreparedStatement {
  return db
    .prepare(
      'INSERT INTO finanzas_auditoria (actor_id, actor_tipo, accion, objeto, empresa_id, detalle_json) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      p.actorId,
      p.actorTipo ?? 'usuario',
      p.accion,
      p.objeto ?? '',
      p.empresaId ?? null,
      JSON.stringify(p.detalle ?? null),
    );
}
