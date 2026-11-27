import { sqlPlano } from './buscadorSql';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026; Venezuela y Estados Unidos). Las columnas del lugar donde
 * vive la persona, en `usuarios` (tabla que ya existe: van en COLUMNAS, nunca en schema.sql) y los
 * índices que piden sus consultas reales. Todos son PARCIALES: una cuenta sin lugar no escribe nada
 * de más; una con lugar escribe una fila por índice al crearse y otra si cambia su ciudad.
 */
export const LUGAR_COLUMNAS: [tabla: string, columna: string, definicion: string][] = [
  ['usuarios', 'lugar_pais', 'TEXT'],
  ['usuarios', 'lugar_estado', 'TEXT'],
  ['usuarios', 'lugar_municipio', 'TEXT'],
  ['usuarios', 'lugar_ciudad', 'TEXT'],
  ['usuarios', 'lugar_id', 'TEXT'],
  ['usuarios', 'lugar_lat', 'REAL'],
  ['usuarios', 'lugar_lng', 'REAL'],
  ['usuarios', 'lugar_en', 'TEXT'],
  ['usuarios', 'lugar_espera', 'INTEGER'],
  // Cuándo pasó de la espera a la zona de su ciudad (abre su ventana de recordatorios «lo que te falta»).
  ['usuarios', 'lugar_paso_en', 'TEXT'],
];

/** La ciudad del lugar sin acentos ni mayúsculas (el buscador la escribe EXACTAMENTE igual). */
export const LUGAR_CIUDAD_PLANA = sqlPlano('lugar_ciudad');

export const INDICES_LUGAR = [
  // Los que esperan en cada ciudad (conteo del panel y «quiénes esperan en Maracaibo»). Solo las
  // cuentas en espera: al recibir su zona salen del índice (una escritura).
  'CREATE INDEX IF NOT EXISTS usuarios_espera_lugar ON usuarios(lugar_id) WHERE lugar_espera = 1',
  // País y estado del lugar: el paso de los que esperan al abrir una zona (por país), los filtros de
  // Repartidores y del Embudo, y el buscador por estado.
  'CREATE INDEX IF NOT EXISTS usuarios_lugar_estado ON usuarios(rol, lugar_pais, lugar_estado) WHERE lugar_id IS NOT NULL',
  // El buscador por ciudad, desde la primera letra y sin acentos («marac» → Maracaibo).
  `CREATE INDEX IF NOT EXISTS usuarios_lugar_ciudad ON usuarios(rol, ${LUGAR_CIUDAD_PLANA}) WHERE lugar_id IS NOT NULL`,
  // Los que pasaron de la espera a su zona, para el circuito de recordatorios (solo esas cuentas).
  'CREATE INDEX IF NOT EXISTS usuarios_lugar_paso ON usuarios(rol, lugar_paso_en) WHERE lugar_paso_en IS NOT NULL',
];
