import { Hono } from 'hono';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  SERVICIOS_DINAMICA,
  esquemaFijarDinamica,
  estadoDinamica,
  fijarDinamica,
} from '../viajesDinamica';

/**
 * C-CARRO-DINAMICA: lo que el equipo ve y decide de la tarifa dinámica de una ciudad. Encenderla es
 * subir el tope en la tarifa de la ciudad (nace en 10 000 = sin recargo); aquí se mira cómo va, se
 * fija a mano por un rato o se apaga (emergencias). Todo con auditoría.
 */
export const dinamicaViaje = new Hono<{ Bindings: Env; Variables: Variables }>();

dinamicaViaje.get('/admin/viajes/dinamica/:servicio/:zona', async (c) => {
  exigir(c, 'admin');
  const servicio = c.req.param('servicio');
  if (!(SERVICIOS_DINAMICA as readonly string[]).includes(servicio))
    throw new ErrorDatos('Ese servicio no tiene tarifa dinámica.', 'servicio', 422);
  return c.json({ dinamica: await estadoDinamica(base(c), servicio, c.req.param('zona')) });
});

dinamicaViaje.put('/admin/viajes/dinamica/:servicio/:zona', async (c) => {
  const admin = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaFijarDinamica);
  return c.json({
    dinamica: await fijarDinamica(
      base(c),
      admin.id,
      c.req.param('servicio'),
      c.req.param('zona'),
      d,
    ),
  });
});
