import { leerAjustes } from './memoria';
import { gastoDeHoy, hoy, topeEnMicro } from './modelo';

/**
 * Pieza «camila» del canario (C-CAMILA-TOPE): «tope» si hoy llegó al tope de IA (sigue contestando
 * sin IA; no es un fallo), «atrasado» si el modelo de IA falló en la última hora (Gemini caído, modelo
 * retirado o sin saldo: Camila sigue contestando sin IA, por eso no es «error» ni tumba la salud),
 * «error» si el gasto pasó el tope en más de un 10 % o si dio más regalos de arranque que su tope del
 * día (no debe pasar nunca), «ok» en lo demás.
 */
export async function saludCamila(db: D1Database): Promise<'ok' | 'error' | 'tope' | 'atrasado'> {
  // Una detrás de otra (no en paralelo): si la base falla, falla UNA promesa y la atrapa quien llama.
  const g = await gastoDeHoy(db);
  const a = await leerAjustes(db);
  const fallo = await db
    .prepare(
      "SELECT 1 AS hay FROM camila_gasto WHERE dia = ? AND error_en > datetime('now', '-1 hour')",
    )
    .bind(hoy())
    .first<{ hay: number }>();
  const tope = topeEnMicro(a.topeDiarioCentavos);
  if (g.microdolares > tope * 1.1 + 10_000 || g.regalos > a.regalosPorDia) return 'error';
  if (fallo) return 'atrasado';
  if (tope > 0 && g.microdolares >= tope) return 'tope';
  return 'ok';
}
