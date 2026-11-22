/**
 * C-RASTRO (22 nov 2026, Richard) — todos los países. Los pasos del registro los anota la BASE sola, con
 * disparadores, la primera vez que cada cuenta los alcanza. Así no depende de qué pantalla, ruta o
 * persona del equipo provocó el paso: una foto subida por la app, por la web o cargada por soporte deja
 * el mismo rastro. La segunda vez no escribe nada.
 *
 * El paso «cuenta» lo pone el alta desde el código (lleva la app, la plataforma y el país de la red);
 * los demás heredan ese país.
 */
// Sin «OR IGNORE»: dentro de un disparador manda la regla de conflicto de la orden que lo provocó (un
// «ON CONFLICT DO UPDATE» de fuera convertiría el choque en un error). El «NOT EXISTS» no depende de eso.
const paso = (usuario: string, nombre: string, si = '') =>
  `INSERT INTO embudo_cuenta (usuario_id, paso, pais)
   SELECT ${usuario}, '${nombre}', (SELECT pais FROM embudo_cuenta WHERE usuario_id = ${usuario} AND paso = 'cuenta')
    WHERE ${usuario} IS NOT NULL${si ? ` AND ${si}` : ''}
      AND NOT EXISTS (SELECT 1 FROM embudo_cuenta WHERE usuario_id = ${usuario} AND paso = '${nombre}');`;

/**
 * C-RASTRO-FUENTES (22 nov 2026, Gerencia) — todos los países. Cada paso del registro tiene MÁS de una
 * fuente real: las fotos entran por el asistente (`verificacion_fotos`) o por la verificación anterior
 * (`kyc.selfie`, `kyc.doc_frente`); la licencia, además, por los papeles del conductor; y lo que el
 * equipo aprobó quedó hecho aunque la cuenta sea de antes del rastro. Esta lista es la ÚNICA definición:
 * de aquí salen el relleno hacia atrás (`rellenarRastro`) y lo que la ficha lee de cada cuenta
 * (`sqlFuentesDeCuenta`), para que la ficha nunca contradiga a la verificación.
 *
 * `fuente` dice cómo se sabe: cuenta, aviso, foto (asistente de fotos), verificacion (la verificación
 * anterior), papeles, vehiculo, equipo (lo aprobó el equipo), actividad, viaje.
 */
const FECHA_KYC =
  'COALESCE(k.enviado_en, k.revisado_en, (SELECT creado_en FROM usuarios WHERE id = k.usuario_id))';
type Fuente = { paso: string; fuente: string; uid: string; fecha: string; de: string; si: string };
export const FUENTES_PASO: readonly Fuente[] = [
  {
    paso: 'cuenta',
    fuente: 'cuenta',
    uid: 'u.id',
    fecha: 'u.creado_en',
    de: 'usuarios u',
    si: "u.rol IN ('cliente', 'repartidor')",
  },
  {
    paso: 'correo',
    fuente: 'cuenta',
    uid: 'u.id',
    fecha: 'u.correo_confirmado_en',
    de: 'usuarios u',
    si: 'u.correo_confirmado_en IS NOT NULL',
  },
  {
    paso: 'telefono',
    fuente: 'cuenta',
    uid: 'u.id',
    fecha: 'u.telefono_verificado_en',
    de: 'usuarios u',
    si: 'u.telefono_verificado_en IS NOT NULL',
  },
  {
    paso: 'aviso_ia',
    fuente: 'aviso',
    uid: 'a.conductor_id',
    fecha: 'a.decidido_en',
    de: 'verificacion_permiso_ia a',
    si: '1 = 1',
  },
  {
    paso: 'aviso_ia',
    fuente: 'verificacion',
    uid: 'k.usuario_id',
    fecha: 'k.consentimiento_en',
    de: 'kyc k',
    si: 'k.consentimiento_en IS NOT NULL',
  },
  ...(
    [
      ['foto_cara', 'cara', 'k.selfie IS NOT NULL'],
      ['foto_documento', 'doc_frente', 'k.doc_frente IS NOT NULL'],
      ['foto_licencia', 'licencia_frente', "k.doc_tipo = 'licencia' AND k.doc_frente IS NOT NULL"],
    ] as const
  ).flatMap(([p, foto, vieja]) => [
    {
      paso: p,
      fuente: 'foto',
      uid: 'f.conductor_id',
      fecha: 'f.creado_en',
      de: 'verificacion_fotos f',
      si: `f.paso = '${foto}'`,
    },
    {
      paso: p,
      fuente: 'verificacion',
      uid: 'k.usuario_id',
      fecha: FECHA_KYC,
      de: 'kyc k',
      si: vieja,
    },
  ]),
  {
    paso: 'foto_licencia',
    fuente: 'papeles',
    uid: 'd.conductor_id',
    fecha: 'd.creado_en',
    de: 'conductor_documentos d',
    si: "d.tipo IN ('licencia_moto', 'licencia_conducir')",
  },
  {
    paso: 'vehiculo',
    fuente: 'vehiculo',
    uid: 'v.conductor_id',
    fecha: 'v.creado_en',
    de: 'vehiculos v',
    si: '1 = 1',
  },
  {
    paso: 'enviado',
    fuente: 'verificacion',
    uid: 'k.usuario_id',
    fecha: 'k.enviado_en',
    de: 'kyc k',
    si: 'k.enviado_en IS NOT NULL',
  },
  // Lo que el equipo aprobó quedó hecho: la cara, el documento y el envío no pueden salir pendientes.
  ...['foto_cara', 'foto_documento', 'enviado'].map((p) => ({
    paso: p,
    fuente: 'equipo',
    uid: 'k.usuario_id',
    fecha: FECHA_KYC,
    de: 'kyc k',
    si: "k.estado = 'aprobado'",
  })),
  {
    paso: 'aprobado',
    fuente: 'equipo',
    uid: 'k.usuario_id',
    fecha:
      'COALESCE(k.revisado_en, k.enviado_en, (SELECT creado_en FROM usuarios WHERE id = k.usuario_id))',
    de: 'kyc k',
    si: "k.estado = 'aprobado'",
  },
  {
    paso: 'conectado',
    fuente: 'actividad',
    uid: 'r.usuario_id',
    fecha: 'COALESCE(r.ubicacion_en, r.creado_en)',
    de: 'repartidores r',
    si: '(r.conectado = 1 OR r.ubicacion_en IS NOT NULL)',
  },
  {
    paso: 'conectado',
    fuente: 'viaje',
    uid: 'o.conductor_id',
    fecha: 'o.creado_en',
    de: 'operaciones o',
    si: 'o.conductor_id IS NOT NULL',
  },
  {
    paso: 'conectado',
    fuente: 'viaje',
    uid: 'p.repartidor_id',
    fecha: 'p.creado_en',
    de: 'pedidos p',
    si: 'p.repartidor_id IS NOT NULL',
  },
  ...['cliente_id', 'conductor_id'].map((quien) => ({
    paso: 'primer_viaje',
    fuente: 'viaje',
    uid: `o.${quien}`,
    fecha: 'COALESCE(v.terminado_en, o.creado_en)',
    de: 'operaciones o JOIN viajes v ON v.operacion_id = o.id',
    si: `v.estado = 'terminado' AND o.${quien} IS NOT NULL`,
  })),
  ...['cliente_id', 'repartidor_id'].map((quien) => ({
    paso: 'primer_viaje',
    fuente: 'viaje',
    uid: `p.${quien}`,
    fecha: 'COALESCE(p.entregado_en, p.creado_en)',
    de: 'pedidos p',
    si: `p.estado = 'entregado' AND p.${quien} IS NOT NULL`,
  })),
];

const sqlFuente = (f: Fuente, extra = '') =>
  `SELECT ${f.uid} AS uid, '${f.paso}' AS paso, '${f.fuente}' AS fuente, MIN(${f.fecha}) AS fecha FROM ${f.de} WHERE ${f.si}${extra} GROUP BY 1`;

/**
 * Lo que cada fuente dice de UNA cuenta (`?1`): paso, cómo se sabe y desde cuándo. Una consulta corta
 * por fuente, por índice. NUNCA unidas con UNION: la base de la nube admite muy pocos términos en una
 * consulta compuesta («too many terms in compound SELECT», visto en el servidor local el 22 nov 2026).
 */
export const sqlFuentesDeCuenta = (): string[] =>
  FUENTES_PASO.map((f) => sqlFuente(f, ` AND ${f.uid} = ?1`));

/** La versión del relleno: al cambiar la lista de fuentes se sube y el relleno corre una vez más. */
export const VERSION_RELLENO = '1';
const CLAVE_RELLENO = 'rastro:relleno';

/**
 * Rellena hacia atrás los pasos de las cuentas que ya existían (o cuyos pasos pasaron por una ruta sin
 * disparador), con la fecha real de cada fuente. Una orden por fuente; lo que ya está anotado no se toca.
 * Presupuesto: corre UNA vez por versión dentro de la migración; escribe como mucho una fila por paso y
 * cuenta (en producción, el 22 nov 2026: 89 cuentas, menos de 400 filas). Devuelve cuántas escribió.
 */
export async function rellenarRastro(db: D1Database): Promise<number> {
  // «cuenta» va primera (los demás pasos heredan su país) y, de cada paso, la fuente más concreta.
  const res = await db.batch(
    FUENTES_PASO.map((f) =>
      db.prepare(
        `INSERT INTO embudo_cuenta (usuario_id, paso, pais, creado_en)
         SELECT x.uid, x.paso,
                COALESCE((SELECT c.pais FROM embudo_cuenta c WHERE c.usuario_id = x.uid AND c.paso = 'cuenta'),
                         (SELECT z.pais FROM zonas z WHERE z.id = u.zona_id)),
                x.fecha
           FROM (${sqlFuente(f)}) x
           JOIN usuarios u ON u.id = x.uid AND u.rol IN ('cliente', 'repartidor')
          WHERE x.fecha IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM embudo_cuenta e WHERE e.usuario_id = x.uid AND e.paso = x.paso)`,
      ),
    ),
  );
  return res.reduce((n, r) => n + Number(r.meta?.changes ?? 0), 0);
}

export const DISPARADORES_RASTRO: readonly string[] = [
  `CREATE TRIGGER IF NOT EXISTS rastro_correo AFTER UPDATE OF correo_confirmado_en ON usuarios
WHEN NEW.correo_confirmado_en IS NOT NULL AND OLD.correo_confirmado_en IS NULL
BEGIN ${paso('NEW.id', 'correo')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_telefono AFTER UPDATE OF telefono_verificado_en ON usuarios
WHEN NEW.telefono_verificado_en IS NOT NULL AND OLD.telefono_verificado_en IS NULL
BEGIN ${paso('NEW.id', 'telefono')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_aviso_ia AFTER INSERT ON verificacion_permiso_ia
BEGIN ${paso('NEW.conductor_id', 'aviso_ia')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_foto_cara AFTER INSERT ON verificacion_fotos WHEN NEW.paso = 'cara'
BEGIN ${paso('NEW.conductor_id', 'foto_cara')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_foto_documento AFTER INSERT ON verificacion_fotos WHEN NEW.paso = 'doc_frente'
BEGIN ${paso('NEW.conductor_id', 'foto_documento')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_foto_licencia AFTER INSERT ON verificacion_fotos WHEN NEW.paso = 'licencia_frente'
BEGIN ${paso('NEW.conductor_id', 'foto_licencia')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_vehiculo AFTER INSERT ON vehiculos
BEGIN ${paso('NEW.conductor_id', 'vehiculo')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_kyc_alta AFTER INSERT ON kyc WHEN NEW.enviado_en IS NOT NULL
BEGIN ${paso('NEW.usuario_id', 'enviado')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_kyc_enviado AFTER UPDATE OF enviado_en ON kyc WHEN NEW.enviado_en IS NOT NULL
BEGIN ${paso('NEW.usuario_id', 'enviado')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_kyc_aprobado_alta AFTER INSERT ON kyc WHEN NEW.estado = 'aprobado'
BEGIN ${paso('NEW.usuario_id', 'aprobado')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_kyc_aprobado AFTER UPDATE OF estado ON kyc WHEN NEW.estado = 'aprobado' AND OLD.estado <> 'aprobado'
BEGIN ${paso('NEW.usuario_id', 'aprobado')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_conectado AFTER UPDATE OF conectado ON repartidores WHEN NEW.conectado = 1 AND OLD.conectado = 0
BEGIN ${paso('NEW.usuario_id', 'conectado')} END`,
  // C-RASTRO-FUENTES: las rutas que no tenían disparador (el aviso aceptado después, la verificación
  // anterior, los papeles, lo que el equipo aprueba, y quien nace conectado).
  `CREATE TRIGGER IF NOT EXISTS rastro_aviso_ia_cambio AFTER UPDATE ON verificacion_permiso_ia
BEGIN ${paso('NEW.conductor_id', 'aviso_ia')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_kyc_consentimiento AFTER UPDATE OF consentimiento_en ON kyc WHEN NEW.consentimiento_en IS NOT NULL
BEGIN ${paso('NEW.usuario_id', 'aviso_ia')} END`,
  ...(['INSERT', 'UPDATE OF selfie, doc_frente, doc_tipo, estado'] as const).map(
    (
      cuando,
      i,
    ) => `CREATE TRIGGER IF NOT EXISTS rastro_kyc_fotos_${i ? 'cambio' : 'alta'} AFTER ${cuando} ON kyc
BEGIN
  ${paso('NEW.usuario_id', 'foto_cara', "(NEW.selfie IS NOT NULL OR NEW.estado = 'aprobado')")}
  ${paso('NEW.usuario_id', 'foto_documento', "(NEW.doc_frente IS NOT NULL OR NEW.estado = 'aprobado')")}
  ${paso('NEW.usuario_id', 'foto_licencia', "NEW.doc_tipo = 'licencia' AND NEW.doc_frente IS NOT NULL")}
  ${paso('NEW.usuario_id', 'enviado', "NEW.estado = 'aprobado'")}
END`,
  ),
  `CREATE TRIGGER IF NOT EXISTS rastro_papel_licencia AFTER INSERT ON conductor_documentos WHEN NEW.tipo IN ('licencia_moto', 'licencia_conducir')
BEGIN ${paso('NEW.conductor_id', 'foto_licencia')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_conectado_alta AFTER INSERT ON repartidores WHEN NEW.conectado = 1
BEGIN ${paso('NEW.usuario_id', 'conectado')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_conectado_senal AFTER UPDATE OF ubicacion_en ON repartidores WHEN NEW.ubicacion_en IS NOT NULL AND OLD.ubicacion_en IS NULL
BEGIN ${paso('NEW.usuario_id', 'conectado')} END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_primer_viaje AFTER UPDATE OF estado ON viajes WHEN NEW.estado = 'terminado' AND OLD.estado <> 'terminado'
BEGIN
  ${paso('(SELECT cliente_id FROM operaciones WHERE id = NEW.operacion_id)', 'primer_viaje')}
  ${paso('(SELECT conductor_id FROM operaciones WHERE id = NEW.operacion_id)', 'primer_viaje')}
END`,
  `CREATE TRIGGER IF NOT EXISTS rastro_primer_pedido AFTER UPDATE OF estado ON pedidos WHEN NEW.estado = 'entregado' AND OLD.estado <> 'entregado'
BEGIN
  ${paso('NEW.cliente_id', 'primer_viaje')}
  ${paso('NEW.repartidor_id', 'primer_viaje')}
END`,
];

const NOMBRES = DISPARADORES_RASTRO.map((s) => /IF NOT EXISTS (\w+)/.exec(s)![1]!);

/**
 * Deja puestos los disparadores del rastro y rehace el del viaje si es el de antes (sin la posición del
 * conductor en cada cambio de estado). Corre solo dentro de la migración completa. Devuelve si cambió algo.
 */
export async function asegurarRastro(db: D1Database): Promise<boolean> {
  const { results } = await db
    .prepare(
      `SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name IN ('viajes_al_cambiar_estado', ${NOMBRES.map(() => '?').join(',')})`,
    )
    .bind(...NOMBRES)
    .all<{ name: string; sql: string | null }>();
  const viaje = results.find((r) => r.name === 'viajes_al_cambiar_estado');
  const viajeViejo = Boolean(viaje) && !String(viaje?.sql).includes('ubicacion_en');
  const faltan =
    results.filter((r) => r.name !== 'viajes_al_cambiar_estado').length < NOMBRES.length;
  const relleno = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_RELLENO)
    .first<{ valor: string }>()
    .catch(() => null);
  const faltaRelleno = relleno?.valor !== VERSION_RELLENO;
  if (!viajeViejo && !faltan && !faltaRelleno) return false;
  if (viajeViejo || faltan)
    await db.batch([
      // El del viaje se suelta aquí; `asegurarFase3`, que corre justo después, lo vuelve a crear ya nuevo.
      ...(viajeViejo ? [db.prepare('DROP TRIGGER IF EXISTS viajes_al_cambiar_estado')] : []),
      ...DISPARADORES_RASTRO.map((sql) => db.prepare(sql)),
    ]);
  if (faltaRelleno) {
    const filas = await rellenarRastro(db);
    await db
      .prepare(
        `INSERT INTO config (clave, valor) VALUES (?, ?)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
      )
      .bind(CLAVE_RELLENO, VERSION_RELLENO)
      .run();
    console.warn(`esquema: pasos del registro rellenados hacia atrás: ${filas} (C-RASTRO-FUENTES)`);
  }
  if (viajeViejo || faltan)
    console.warn('esquema: disparadores del rastro de actividad puestos (C-RASTRO)');
  return true;
}
