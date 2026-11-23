import { llegaSoloARevision } from './rutas/verificacionConductor';

/**
 * C-LLEGA-SOLO-A-REVISION, la reparación (23 nov 2026, Richard: «si ya todo está en el servidor, no
 * es necesario que vuelva a entrar y le dé enviar»). Los conductores que ya subieron un papel o un
 * vehículo completo y se quedaron sin tocar «Enviar» van a revisión con la MISMA función que usa cada
 * subida (`llegaSoloARevision`), nunca con SQL suelto.
 *
 * - Corre una sola vez, dentro de la migración de arranque. La marca en `config` se toma ANTES de
 *   empezar con `INSERT OR IGNORE`: si dos servidores arrancan a la vez, solo uno la consigue.
 * - No toca cuentas de prueba (`es_prueba`), ni las de los revisores de las tiendas, ni cuentas
 *   inactivas. Lo ya enviado, aprobado o rechazado no se vuelve a mandar (la función solo manda lo
 *   que está completo y sin enviar).
 * - No manda un correo al equipo por cada una: las encuentran en «Verificaciones → Pendientes».
 * - Deja escrito a quién envió (`config`, clave `CLAVE_REPARACION_LLEGA_SOLO_ENVIADOS`).
 * - Presupuesto: como mucho TOPE cuentas; por cada una, unas ocho lecturas por índice y entre una y
 *   cuatro escrituras.
 */
export const CLAVE_REPARACION_LLEGA_SOLO = 'reparacion:llega-solo-a-revision:1';
export const CLAVE_REPARACION_LLEGA_SOLO_ENVIADOS = 'reparacion:llega-solo-a-revision:1:enviados';
export const TOPE_REPARACION_LLEGA_SOLO = 300;

export const SQL_CANDIDATOS_LLEGA_SOLO = `SELECT u.id FROM usuarios u
  WHERE u.rol = 'repartidor' AND u.activo = 1 AND COALESCE(u.es_prueba, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM revisores r WHERE r.correo = u.correo)
    AND (EXISTS (SELECT 1 FROM kyc k WHERE k.usuario_id = u.id AND k.estado = 'sin_enviar'
                   AND k.enviado_en IS NULL AND k.doc_frente IS NOT NULL AND k.selfie IS NOT NULL)
      OR EXISTS (SELECT 1 FROM verificacion_fotos f WHERE f.conductor_id = u.id AND f.estado = 'vigente'
                   AND f.paso IN ('licencia_frente', 'seguro'))
      OR EXISTS (SELECT 1 FROM vehiculos v WHERE v.conductor_id = u.id AND v.estado = 'registrado'
                   AND v.tipo IN ('carro', 'moto', 'scooter')))
  ORDER BY u.creado_en LIMIT ${TOPE_REPARACION_LLEGA_SOLO}`;

/** Devuelve los ids que mandó a revisión, o null si ya había corrido (o corre en otro servidor). */
export async function repararLlegaSoloARevision(db: D1Database): Promise<string[] | null> {
  const marca = await db
    .prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES (?, 'corriendo')")
    .bind(CLAVE_REPARACION_LLEGA_SOLO)
    .run();
  if (!Number(marca.meta?.changes ?? 0)) return null;
  const { results } = await db.prepare(SQL_CANDIDATOS_LLEGA_SOLO).all<{ id: string }>();
  const enviados: string[] = [];
  for (const { id } of results) {
    try {
      const r = await llegaSoloARevision(db, id);
      if (r.identidad || r.licencia || r.seguro || r.vehiculos) enviados.push(id);
    } catch (e) {
      console.error('reparación llega solo a revisión: una cuenta falló', id, e);
    }
  }
  await db.batch([
    db
      .prepare(
        `INSERT INTO config (clave, valor) VALUES (?, ?)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
      )
      .bind(
        CLAVE_REPARACION_LLEGA_SOLO_ENVIADOS,
        JSON.stringify({ revisadas: results.length, enviados }),
      ),
    db
      .prepare(
        "UPDATE config SET valor = 'hecha', actualizado_en = datetime('now') WHERE clave = ?",
      )
      .bind(CLAVE_REPARACION_LLEGA_SOLO),
  ]);
  if (enviados.length)
    console.warn(
      `reparación: ${enviados.length} conductores pasaron solos a revisión (C-LLEGA-SOLO-A-REVISION)`,
    );
  return enviados;
}
