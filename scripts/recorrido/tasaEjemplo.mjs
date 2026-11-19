/**
 * C-TASA-CORDURA (19 nov 2026): la ÚNICA tasa de ejemplo de los recorridos y las capturas. Es una
 * tasa oficial creíble (la del Banco Central del 19 nov 2026) y entra como entra la de verdad: una
 * fila «bcv» con la fecha de hoy en Venezuela. Ningún guion escribe una «tasa del día» inventada ni
 * cambia el modo de la tasa: el 19 nov un guion de capturas dejó 240 por dólar en el sitio de pruebas
 * y eso fue lo que vieron las apps de prueba, con la oficial en 917,78.
 */
export const TASA_EJEMPLO = 917.78;
export const SQL_TASA_EJEMPLO = `INSERT OR REPLACE INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', date('now', '-4 hours'), 'bcv', ${TASA_EJEMPLO})`;
