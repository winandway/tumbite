/**
 * G4b (2 nov 2026), como DoorDash: quien reparte en carro, moto o scooter con motor necesita
 * licencia y seguro vigentes. A pie o en bici no se pide nada. Devuelve qué falta primero, o null.
 */
export type PapelesVehiculo = {
  vehiculoTipo: string | null | undefined;
  licenciaNumero?: string | null;
  licenciaVence?: string | null;
  seguroPoliza?: string | null;
  seguroVence?: string | null;
};
export type FaltaPapel = 'licencia' | 'licencia_vencida' | 'seguro' | 'seguro_vencido';

export const VEHICULOS_CON_MOTOR: readonly string[] = ['carro', 'moto', 'scooter'];

const vigente = (fecha: string, hoy: Date) => fecha.slice(0, 10) >= hoy.toISOString().slice(0, 10);

export function faltaPapel(p: PapelesVehiculo, hoy = new Date()): FaltaPapel | null {
  if (!VEHICULOS_CON_MOTOR.includes(p.vehiculoTipo ?? '')) return null;
  if (!p.licenciaNumero?.trim() || !p.licenciaVence) return 'licencia';
  if (!vigente(p.licenciaVence, hoy)) return 'licencia_vencida';
  if (!p.seguroPoliza?.trim() || !p.seguroVence) return 'seguro';
  if (!vigente(p.seguroVence, hoy)) return 'seguro_vencido';
  return null;
}
