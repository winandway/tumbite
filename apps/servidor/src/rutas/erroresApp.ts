import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { guardarError } from '../errores';
import { limiteIntentos } from '../seguridad';
import { type Variables, base } from '../sesion';
import { leerCuerpo } from '../validar';

/**
 * C-APP-SIN-CIERRES (2 nov 2026): cuando una pantalla de las apps falla, la red de seguridad de la
 * app (LimiteErrores) la reemplaza por un aviso con «Volver» y avisa aquí. Queda en el registro de
 * errores con la app y la pantalla, para arreglarlo antes de que alguien lo reporte. Sin datos
 * personales: solo el mensaje y los primeros renglones de la pila.
 */
export const erroresApp = new Hono<{ Bindings: Env; Variables: Variables }>();

erroresApp.post('/app/error', limiteIntentos(10, 60_000), async (c) => {
  const d = await leerCuerpo(
    c,
    z.object({
      app: z.enum(['cliente', 'repartidor', 'restaurante']),
      pantalla: z.string().trim().max(120).default(''),
      mensaje: z.string().trim().min(1).max(500),
      pila: z.string().max(1500).default(''),
      version: z.string().trim().max(40).default(''),
    }),
  );
  const e = new Error(`app ${d.app}${d.version ? ` ${d.version}` : ''}: ${d.mensaje}`);
  e.stack = d.pila;
  await guardarError(base(c), 'APP', `${d.app}:${d.pantalla || '?'}`, e);
  return c.json({ ok: true });
});
