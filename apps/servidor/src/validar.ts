import type { Context } from 'hono';
import type { z } from 'zod';
import { avisoCasillaEnIdioma } from '@tumbite/compartido';

export class ErrorDatos extends Error {
  constructor(
    message: string,
    public readonly campo?: string,
    public readonly estado: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 415 | 422 | 429 | 503 = 400,
    /** Código estable para las apps (además del texto), cuando hace falta reconocer el caso. */
    public readonly codigo?: string,
  ) {
    super(message);
  }
}

/** Lee el cuerpo JSON y lo valida. Si algo falla, responde con el primer error en palabras claras. */
export async function leerCuerpo<T extends z.ZodType>(c: Context, esquema: T): Promise<z.infer<T>> {
  let cuerpo: unknown;
  try {
    cuerpo = await c.req.json();
  } catch {
    throw new ErrorDatos('No pudimos leer los datos enviados.');
  }
  const r = esquema.safeParse(cuerpo);
  if (!r.success) {
    const primero = r.error.issues[0];
    // C-CASILLA-CON-SU-TIPO: el aviso de la casilla, en el idioma de la app.
    const idioma = c.req.header('x-idioma') === 'en' ? 'en' : 'es';
    throw new ErrorDatos(
      avisoCasillaEnIdioma(primero?.message ?? 'Datos inválidos.', idioma),
      primero?.path.join('.'),
    );
  }
  return r.data;
}
