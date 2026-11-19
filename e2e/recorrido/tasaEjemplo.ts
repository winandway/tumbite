/**
 * C-TASA-CORDURA (19 nov 2026): la ÚNICA tasa de ejemplo de los recorridos (la misma de
 * scripts/recorrido/tasaEjemplo.mjs; una prueba comprueba que no se separen). Es una oficial creíble
 * y entra como la de verdad: una fila «bcv» con la fecha de hoy en Venezuela.
 */
export const TASA_EJEMPLO = 917.78;
export const SQL_TASA_EJEMPLO = `INSERT OR REPLACE INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', date('now', '-4 hours'), 'bcv', ${TASA_EJEMPLO})`;
