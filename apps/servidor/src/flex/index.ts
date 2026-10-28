import { Hono } from 'hono';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { flexEmpresas } from './empresas';
import { flexCobros } from './cobros';
import { flexTasas } from './tasas';
import { flexEnvios } from './envios';
import { flexUbicacion } from './ubicacion';
import { flexImportacion } from './importacion';
import { flexLotes } from './lotes';
import { flexRutasEmpresa } from './rutasEmpresa';
import { flexConductor } from './conductor';
import { flexIntegraciones, despacharIntegraciones } from './integraciones';
import { flexOperaciones } from './operaciones';
import { flexRetencion } from './automatizacion';
import { despues } from './avisosFlex';
import { finanzasEmpresa } from '../finanzas/rutasEmpresa';

/**
 * Divoox Flex · API empresarial v1 (Fase 1). Se monta en /datos/v1/flex (nunca /api: regla de
 * YaDominios). Panel e integraciones usan las MISMAS rutas: cambia solo cómo se autentican
 * (sesión de un miembro o cabecera x-api-key de una clave de la empresa).
 */
export const flex = new Hono<{ Bindings: Env; Variables: Variables }>();
// Fase 3: después de cada escritura que salió bien, se intenta mandar enseguida lo que esa
// empresa tenga en la cola de integraciones (pocos, en segundo plano). El reloj repasa lo demás.
flex.use('*', async (c, next) => {
  await next();
  if (c.req.method === 'GET' || c.res.status >= 400) return;
  const empresaId = /\/empresas\/([^/]+)/.exec(c.req.path)?.[1];
  await despues(c, () =>
    despacharIntegraciones(c.env, base(c), {
      limite: 5,
      presupuestoMs: 8_000,
      ...(empresaId ? { empresaId } : {}),
    }),
  );
});
flex.route('/', flexEmpresas);
flex.route('/', flexEnvios);
flex.route('/', flexUbicacion);
flex.route('/', flexImportacion);
flex.route('/', flexLotes);
flex.route('/', flexRutasEmpresa);
flex.route('/', flexConductor);
flex.route('/', flexCobros);
flex.route('/', flexTasas);
flex.route('/', flexIntegraciones);
flex.route('/', flexOperaciones);
flex.route('/', flexRetencion);
flex.route('/', finanzasEmpresa);
