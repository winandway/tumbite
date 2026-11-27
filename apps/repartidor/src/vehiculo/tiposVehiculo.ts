/**
 * C-AGREGA-TU-VEHICULO (27 nov 2026, orden de Richard) — todos los países. Qué vehículos puede
 * registrar un conductor según los servicios que tiene, sin React para probarlo en node. Moto con
 * pasajeros pide moto; Carro con pasajeros pide carro; Comida y Envíos aceptan los cinco tipos.
 */
export type TipoVehiculo = 'carro' | 'moto' | 'scooter' | 'bicicleta' | 'a_pie';

export const TODOS_LOS_TIPOS: readonly TipoVehiculo[] = [
  'moto',
  'carro',
  'scooter',
  'bicicleta',
  'a_pie',
];

const CON_MOTOR: ReadonlySet<string> = new Set(['carro', 'moto', 'scooter']);

/** Con motor se piden placa y papeles; bicicleta y a pie solo se guardan. */
export const esMotorizado = (tipo: string): boolean => CON_MOTOR.has(tipo);

export function tiposDisponibles(servicios: readonly string[] | undefined): TipoVehiculo[] {
  const ids = new Set(servicios ?? []);
  if (ids.has('comida') || ids.has('envios') || !ids.size) return [...TODOS_LOS_TIPOS];
  const tipos: TipoVehiculo[] = [];
  if (ids.has('moto')) tipos.push('moto');
  if (ids.has('carro')) tipos.push('carro');
  return tipos.length ? tipos : [...TODOS_LOS_TIPOS];
}

/** Los papeles que se piden con la foto del frente y la de la placa (lista del país o la básica). */
export function papelesDeAlta(
  delPais: readonly string[] | undefined,
  tipo: string,
  porDefecto: readonly string[],
): string[] {
  const base =
    delPais ?? (tipo === 'moto' || tipo === 'carro' ? porDefecto : ['registro', 'seguro']);
  return [
    'foto_frente',
    'foto_placa',
    ...base.filter((p) => p !== 'foto_frente' && p !== 'foto_placa'),
  ];
}

/** Lo que falta de las dos fotos que obligan a terminar. */
export function fotosQueFaltan(
  documentos: readonly { tipo: string; estado: string }[],
): ('foto_frente' | 'foto_placa')[] {
  const subida = (tipo: string) =>
    documentos.some(
      (d) => d.tipo === tipo && (d.estado === 'pendiente' || d.estado === 'aprobado'),
    );
  return (['foto_frente', 'foto_placa'] as const).filter((t) => !subida(t));
}
