import { type FiltroCuentas, leerFiltroCuentas } from './rutas/cuentaPrueba';

/**
 * C-CUENTA-PRUEBA (21 nov 2026) — todos los países. Fragmentos SQL para que los reportes y conteos del
 * superadmin dejen fuera, por defecto, lo que hacen las cuentas de prueba (`usuarios.es_prueba`).
 *
 * Una operación es «de prueba» si lo es el cliente, el conductor/repartidor o el dueño del restaurante.
 * Las listas de cuentas de prueba son subconsultas SIN correlación: SQLite las arma una sola vez por
 * consulta (y salen del índice parcial `usuarios_es_prueba`, que solo tiene esas filas).
 *
 * OJO: esto es para REPORTES y CONTEOS. La conciliación del dinero NO excluye nada (ver conciliacion.ts):
 * existe para encontrar descuadres reales y un descuadre de una cuenta de prueba también se muestra.
 */
const PRUEBAS = '(SELECT id FROM usuarios WHERE es_prueba = 1)';

/** El pedido (alias `p` por defecto) NO toca ninguna cuenta de prueba. Sin « AND » delante. */
export const pedidoSinPrueba = (a = 'p') =>
  `(${a}.cliente_id NOT IN ${PRUEBAS} AND COALESCE(${a}.repartidor_id, '') NOT IN ${PRUEBAS}` +
  ` AND ${a}.restaurante_id NOT IN (SELECT r0.id FROM restaurantes r0 WHERE r0.dueno_id IN ${PRUEBAS}))`;

/** La operación (viaje, envío…; alias `o` por defecto) NO toca ninguna cuenta de prueba. */
export const operacionSinPrueba = (a = 'o') =>
  `(${a}.cliente_id NOT IN ${PRUEBAS} AND COALESCE(${a}.conductor_id, '') NOT IN ${PRUEBAS})`;

const sql = (v: FiltroCuentas, sin: string): string =>
  v === 'todas' ? '' : ` AND ${v === 'prueba' ? `NOT ${sin}` : sin}`;

/** « AND …» para los pedidos según el filtro «Cuentas» (vacío si es «todas»). */
export const pedidosPorCuentas = (valor: string | undefined | null, a = 'p') =>
  sql(leerFiltroCuentas(valor), pedidoSinPrueba(a));

/** « AND …» para las operaciones según el filtro «Cuentas». */
export const operacionesPorCuentas = (valor: string | undefined | null, a = 'o') =>
  sql(leerFiltroCuentas(valor), operacionSinPrueba(a));

/** « AND …» para una columna de usuario (cliente, repartidor, dueño…) según el filtro «Cuentas». */
export function usuarioPorCuentas(valor: string | undefined | null, columna: string): string {
  const f = leerFiltroCuentas(valor);
  if (f === 'todas') return '';
  return f === 'prueba' ? ` AND ${columna} IN ${PRUEBAS}` : ` AND ${columna} NOT IN ${PRUEBAS}`;
}
