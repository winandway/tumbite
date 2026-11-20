import { LETRAS_PLANAS } from '@tumbite/compartido';

/**
 * C-BUSCADOR-SERIO (15 nov 2026). Todos los países. Las expresiones SQL del buscador interno y los
 * índices que las sostienen. Una consulta usa un índice de expresión solo si escribe EXACTAMENTE la
 * misma expresión: por eso viven aquí y las consultas las arman con estas mismas funciones (sobre
 * la columna sin apodo, dentro de una subconsulta de una sola tabla).
 *
 * Cada índice es una escritura más por fila que se crea (o que cambia esa columna): están solo los
 * que el buscador necesita para no recorrer tablas enteras, y cada uno tiene su porqué en
 * CANDADOS.md (C-BUSCADOR-SERIO). Las columnas ya existen en producción, así que van en INDICES de
 * esquema.ts (corren al arrancar, una vez por versión), nunca como columnas nuevas.
 */

/** «José Pérez» → «jose perez»: la columna sin acentos y en minúscula (la tabla vive en compartido). */
export function sqlPlano(columna: string): string {
  const sinAcentos = LETRAS_PLANAS.reduce((e, [a, b]) => `replace(${e}, '${a}', '${b}')`, columna);
  return `lower(${sinAcentos})`;
}

/** Solo los dígitos del teléfono guardado tal cual (los mismos cambios que TELEFONO_DIEZ). */
export const TELEFONO_DIGITOS =
  "replace(replace(replace(replace(replace(telefono, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')";
/** Los últimos cuatro dígitos: lo que casi todo el mundo recuerda de un teléfono. */
export const TELEFONO_FINAL = `substr(${TELEFONO_DIGITOS}, -4)`;
/** La condición del índice parcial del final del teléfono (la consulta la repite tal cual). */
export const CON_TELEFONO = "telefono IS NOT NULL AND telefono != ''";

export const NOMBRE_PLANO = sqlPlano('nombre');

export const INDICES_BUSCADOR = [
  // Nombre por comienzo sin acentos ni mayúsculas (clientes, repartidores): «jose» encuentra «José».
  `CREATE INDEX IF NOT EXISTS usuarios_rol_nombre_plano ON usuarios(rol, ${NOMBRE_PLANO})`,
  // Restaurantes y tiendas por comienzo del nombre, sin acentos.
  `CREATE INDEX IF NOT EXISTS restaurantes_nombre_plano ON restaurantes(${NOMBRE_PLANO})`,
  // Teléfono por los últimos cuatro dígitos (cuentas nuevas y viejas, guardado como venga).
  `CREATE INDEX IF NOT EXISTS usuarios_telefono_final ON usuarios(${TELEFONO_FINAL}) WHERE ${CON_TELEFONO}`,
  // Placa por comienzo: el índice único que hay es (placa_estado, upper(placa)) y no sirve sin el estado.
  "CREATE INDEX IF NOT EXISTS vehiculos_placa ON vehiculos(upper(placa)) WHERE placa != ''",
  // Placa declarada por el repartidor de comida (se guarda en mayúscula).
  "CREATE INDEX IF NOT EXISTS repartidor_datos_placa ON repartidor_datos(placa) WHERE placa != ''",
  // C-BUSCADOR-SECCIONES: empresas de Divoox Flex por comienzo del nombre, sin acentos (se escribe
  // una fila más solo al crear una empresa o cambiarle el nombre).
  `CREATE INDEX IF NOT EXISTS empresas_nombre_plano ON empresas(${NOMBRE_PLANO})`,
  // Tickets por correo de quien escribió (la columna ya es NOCASE: el índice también lo es).
  'CREATE INDEX IF NOT EXISTS tickets_correo ON tickets(correo)',
];
