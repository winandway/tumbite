/**
 * C-REGALO-VIAJE-REAL (19 nov 2026) — todos los países. Un viaje con regalo de Divoox solo le
 * acredita el regalo al conductor si el viaje fue real. Aquí vive la regla, sin base de datos: recibe
 * lo medido y devuelve los motivos por los que el regalo pasa a revisión (ninguno = se acredita).
 *
 * El viaje se termina SIEMPRE: esto nunca frena al conductor. Lo que no cumple no se pierde, queda
 * «en revisión» para que una persona del equipo lo apruebe o lo rechace (un GPS malo no castiga a un
 * conductor honesto).
 *
 * Ninguna plataforma publica sus umbrales (ficha docs/investigaciones-rea/2026-11-19-regalo-viaje-real.md):
 * estos son los de arranque de Divoox. Viven en el código a propósito: el panel no los puede aflojar.
 */
export const UMBRALES_VIAJE_REAL = {
  /** El conductor termina a esta distancia del destino, como mucho (metros). */
  radioDestinoM: 300,
  /** Su última ubicación tiene que ser de hace menos de estos minutos. */
  minutosUbicacion: 2,
  /** Recorrido medido por el servidor, como parte de la distancia cotizada. */
  parteDistancia: 0.5,
  /** Duración real (de «iniciar» a «terminar»), como parte de la cotizada. */
  parteDuracion: 0.4,
  /** Piso de duración (segundos), para viajes cotizados muy cortos. */
  pisoDuracionS: 120,
  /** Menos de esto recorrido es «no se movió» (metros). */
  pisoRecorridoM: 200,
  /** El teléfono del pasajero a más de esto del conductor cuenta como «lejos» (metros). */
  radioPasajeroM: 300,
  /** Lecturas del pasajero que hacen falta para opinar. */
  lecturasPasajero: 2,
  /** Regalos del mismo conductor con cuentas creadas el mismo día que disparan la alerta. */
  cuentasMismoDia: 3,
} as const;

export const MOTIVOS_REVISION = [
  'sin_moverse',
  'muy_corto',
  'lejos_destino',
  'sin_ubicacion',
  'pasajero_lejos',
] as const;
export type MotivoRevision = (typeof MOTIVOS_REVISION)[number];

export type MedidasViaje = {
  /** Lo cotizado. */
  cotizadaM: number;
  cotizadaS: number;
  /** Lo que midió el servidor con las ubicaciones del conductor mientras el viaje estaba en curso. */
  recorridoM: number;
  /** Segundos entre «iniciar» y «terminar». */
  duracionS: number;
  /**
   * Metros del conductor al destino al terminar. `null` = no tenía una ubicación reciente.
   * `undefined` = no se pudo mirar (el cierre lo hizo el reloj después): no cuenta en contra.
   */
  alDestinoM?: number | null;
  /** Lecturas del teléfono del pasajero durante el viaje: junto al conductor y lejos de él. */
  pasajeroCerca: number;
  pasajeroLejos: number;
};

/** Los motivos por los que este regalo pasa a revisión. Vacío: el viaje fue real y se acredita. */
export function evaluarViajeReal(m: MedidasViaje): MotivoRevision[] {
  const U = UMBRALES_VIAJE_REAL;
  const motivos: MotivoRevision[] = [];
  const pisoRecorrido = Math.min(U.pisoRecorridoM, m.cotizadaM * U.parteDistancia);
  const pisoDuracion = Math.max(
    m.cotizadaS * U.parteDuracion,
    Math.min(U.pisoDuracionS, m.cotizadaS),
  );
  if (m.recorridoM < pisoRecorrido) motivos.push('sin_moverse');
  else if (m.recorridoM < m.cotizadaM * U.parteDistancia || m.duracionS < pisoDuracion)
    motivos.push('muy_corto');
  // Sin moverse y además en un suspiro: se dice lo más grave, una sola vez.
  if (m.alDestinoM === null) motivos.push('sin_ubicacion');
  else if (m.alDestinoM !== undefined && m.alDestinoM > U.radioDestinoM)
    motivos.push('lejos_destino');
  if (m.pasajeroCerca + m.pasajeroLejos >= U.lecturasPasajero && m.pasajeroLejos > m.pasajeroCerca)
    motivos.push('pasajero_lejos');
  return motivos;
}

const metros = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${Math.round(n)} m`);
const minutos = (s: number) => (s >= 90 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

/** El motivo en palabras del equipo, con lo medido (para el reporte del superadmin). */
export function detalleRevision(motivos: MotivoRevision[], m: MedidasViaje): string {
  const frases: Record<MotivoRevision, string> = {
    sin_moverse: `Terminó sin moverse: recorrió ${metros(m.recorridoM)} de ${metros(m.cotizadaM)} cotizados.`,
    muy_corto: `Demasiado corto: ${metros(m.recorridoM)} en ${minutos(m.duracionS)}, contra ${metros(m.cotizadaM)} y ${minutos(m.cotizadaS)} cotizados.`,
    lejos_destino: `Terminó a ${metros(m.alDestinoM ?? 0)} del destino.`,
    sin_ubicacion: 'Terminó sin una ubicación reciente del conductor.',
    pasajero_lejos: `El teléfono del pasajero estuvo lejos del conductor (${m.pasajeroLejos} de ${m.pasajeroCerca + m.pasajeroLejos} lecturas).`,
  };
  const de = new Map(Object.entries(frases));
  return motivos.map((x) => de.get(x) ?? '').join(' ');
}
