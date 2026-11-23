import { randomInt } from 'node:crypto';

/**
 * C-CELULAR-DE-GUION (23 nov 2026, Gerencia). El celular de una cuenta del recorrido del sitio de
 * pruebas: un número de Estados Unidos que EXISTE para la validación del registro (C-TELEFONO-E164) y
 * distinto en cada cuenta (un teléfono no abre dos cuentas del mismo tipo, y allá las cuentas se
 * quedan). Antes cada guion armaba el suyo con «3» y ocho cifras del reloj: muchas veces el código de
 * área no existía y el registro contestaba «That number doesn't exist in that country».
 *
 * Código de área real, central «5xx» (nunca empieza por 0 ni por 1, ni es un servicio «N11») y cinco
 * cifras al azar. El sitio de pruebas no les manda códigos de verdad (C-GUIONES-SIN-CODIGO-REAL).
 */
const AREAS = ['305', '786', '248', '313', '212', '415', '617', '702', '404', '512'] as const;

export function celularDePrueba(): string {
  const area = AREAS[randomInt(AREAS.length)]!;
  // Central 520–599 sin la 555 (reservada en parte para ficción, no hace falta rozarla).
  let central = 520 + randomInt(80);
  if (central === 555) central = 556;
  return `${area}${central}${String(randomInt(10_000)).padStart(4, '0')}`;
}
