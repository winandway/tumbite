import { leerAjustes } from './memoria';
import { hoy, topeEnMicro } from './modelo';

/**
 * Pieza «camila» del canario (C-CAMILA-TOPE): «tope» si hoy llegó al tope de IA (sigue contestando
 * sin IA; no es un fallo), «atrasado» si el modelo de IA falló en la última hora (Gemini caído, modelo
 * retirado o sin saldo: Camila sigue contestando sin IA, por eso no es «error» ni tumba la salud),
 * «error» si el gasto pasó el tope en más de un 10 % o si dio más regalos de arranque que su tope del
 * día (no debe pasar nunca), «ok» en lo demás.
 */
export async function saludCamila(db: D1Database): Promise<'ok' | 'error' | 'tope' | 'atrasado'> {
  // Una detrás de otra (no en paralelo): si la base falla, falla UNA promesa y la atrapa quien llama.
  // El gasto de hoy y el fallo de la última hora salen de la MISMA fila, en una sola lectura
  // (C-LECTURAS-SALUD: el canario lee poco; la lectura que se ahorra aquí la usa «correoEntrante»).
  const g = await db
    .prepare(
      `SELECT microdolares, regalos, (error_en > datetime('now', '-1 hour')) AS fallo
         FROM camila_gasto WHERE dia = ?`,
    )
    .bind(hoy())
    .first<{ microdolares: number; regalos: number; fallo: number | null }>();
  const a = await leerAjustes(db);
  const tope = topeEnMicro(a.topeDiarioCentavos);
  const microdolares = Number(g?.microdolares ?? 0);
  if (microdolares > tope * 1.1 + 10_000 || Number(g?.regalos ?? 0) > a.regalosPorDia)
    return 'error';
  if (Number(g?.fallo ?? 0) === 1) return 'atrasado';
  if (tope > 0 && microdolares >= tope) return 'tope';
  return 'ok';
}
