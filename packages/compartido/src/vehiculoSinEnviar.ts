/**
 * C-FICHA-VEHICULO-SIN-ENVIAR (Richard, 25 nov 2026) — todos los países. Un vehículo «registrado» (el
 * conductor no lo envió a revisión) se puede aprobar desde la ficha del equipo SOLO si ya tiene sus
 * fotos y su placa completas, y los papeles que la base exige para aprobar cualquier vehículo
 * motorizado (el registro y, fuera del plazo de papeles, el seguro: disparador
 * vehiculos_aprobar_exige_documentos, que no se afloja). Una sola regla para el botón del panel y para
 * la ruta del servidor, que se niega sin ellas. Pieza pura (lleva su prueba).
 */
export type FaltaSinEnviar =
  'placa' | 'placa_estado' | 'foto_frente' | 'foto_placa' | 'foto_interior' | 'registro' | 'seguro';

const MOTORIZADOS = new Set(['carro', 'moto', 'scooter']);

/** Las fotos que tienen que estar subidas para aprobar un vehículo sin enviar. */
export function fotosParaAprobar(tipo: string): readonly FaltaSinEnviar[] {
  if (tipo === 'carro') return ['foto_frente', 'foto_placa', 'foto_interior'];
  if (MOTORIZADOS.has(tipo)) return ['foto_frente', 'foto_placa'];
  return ['foto_frente'];
}

/** Lo que le falta (vacío = se puede aprobar). Solo cuentan las fotos subidas que no se rechazaron. */
export function faltaParaAprobarSinEnviar(
  v: { tipo: string; placa?: string | null; placa_estado?: string | null },
  documentos: readonly { tipo: string; estado: string }[],
  /** Los papeles que pide la base para aprobarlo (en su plazo de papeles, solo el registro). */
  papeles: readonly ('registro' | 'seguro')[] = ['registro', 'seguro'],
): FaltaSinEnviar[] {
  const falta: FaltaSinEnviar[] = [];
  if (MOTORIZADOS.has(v.tipo)) {
    if (!String(v.placa ?? '').trim()) falta.push('placa');
    if (!String(v.placa_estado ?? '').trim()) falta.push('placa_estado');
  }
  const subidas = new Set(
    documentos
      .filter((d) => d.estado === 'pendiente' || d.estado === 'aprobado')
      .map((d) => d.tipo),
  );
  for (const f of fotosParaAprobar(v.tipo)) if (!subidas.has(f)) falta.push(f);
  if (MOTORIZADOS.has(v.tipo)) for (const p of papeles) if (!subidas.has(p)) falta.push(p);
  return falta;
}
