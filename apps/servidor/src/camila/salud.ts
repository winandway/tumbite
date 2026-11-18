import { leerAjustes } from './memoria';
import { gastoDeHoy, topeEnMicro } from './modelo';

/**
 * Pieza «camila» del canario (C-CAMILA-TOPE): «tope» si hoy llegó al tope de IA (sigue contestando
 * sin IA; no es un fallo), «error» si el gasto pasó el tope en más de un 10 % o si dio más regalos de
 * arranque que su tope del día (no debe pasar nunca), «ok» en lo demás.
 */
export async function saludCamila(db: D1Database): Promise<'ok' | 'error' | 'tope'> {
  const [g, a] = await Promise.all([gastoDeHoy(db), leerAjustes(db)]);
  const tope = topeEnMicro(a.topeDiarioCentavos);
  if (g.microdolares > tope * 1.1 + 10_000 || g.regalos > a.regalosPorDia) return 'error';
  if (tope > 0 && g.microdolares >= tope) return 'tope';
  return 'ok';
}
