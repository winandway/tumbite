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
const paso = (usuario: string, nombre: string) =>
  `INSERT INTO embudo_cuenta (usuario_id, paso, pais)
   SELECT ${usuario}, '${nombre}', (SELECT pais FROM embudo_cuenta WHERE usuario_id = ${usuario} AND paso = 'cuenta')
    WHERE ${usuario} IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM embudo_cuenta WHERE usuario_id = ${usuario} AND paso = '${nombre}');`;

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
  if (!viajeViejo && !faltan) return false;
  await db.batch([
    // El del viaje se suelta aquí; `asegurarFase3`, que corre justo después, lo vuelve a crear ya nuevo.
    ...(viajeViejo ? [db.prepare('DROP TRIGGER IF EXISTS viajes_al_cambiar_estado')] : []),
    ...DISPARADORES_RASTRO.map((sql) => db.prepare(sql)),
  ]);
  console.warn('esquema: disparadores del rastro de actividad puestos (C-RASTRO)');
  return true;
}
