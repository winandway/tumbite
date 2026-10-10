import type { Context } from 'hono';
import type { z } from 'zod';

export class ErrorDatos extends Error {
  constructor(
    message: string,
    public readonly campo?: string,
    public readonly estado: 400 | 401 | 403 | 404 | 409 | 422 = 400,
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
    throw new ErrorDatos(primero?.message ?? 'Datos inválidos.', primero?.path.join('.'));
  }
  return r.data;
}
