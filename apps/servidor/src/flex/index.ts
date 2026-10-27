import { Hono } from 'hono';
import type { Env } from '../env';
import type { Variables } from '../sesion';
import { flexEmpresas } from './empresas';
import { flexEnvios } from './envios';
import { flexImportacion } from './importacion';
import { flexLotes } from './lotes';
import { flexRutasEmpresa } from './rutasEmpresa';
import { flexConductor } from './conductor';

/**
 * Divoox Flex · API empresarial v1 (Fase 1). Se monta en /datos/v1/flex (nunca /api: regla de
 * YaDominios). Panel e integraciones usan las MISMAS rutas: cambia solo cómo se autentican
 * (sesión de un miembro o cabecera x-api-key de una clave de la empresa).
 */
export const flex = new Hono<{ Bindings: Env; Variables: Variables }>();
flex.route('/', flexEmpresas);
flex.route('/', flexEnvios);
flex.route('/', flexImportacion);
flex.route('/', flexLotes);
flex.route('/', flexRutasEmpresa);
flex.route('/', flexConductor);
