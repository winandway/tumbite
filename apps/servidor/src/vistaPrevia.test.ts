import { beforeEach, describe, expect, it } from 'vitest';
import { esHostVistaPrevia, entornoDeHost, nombreVistaPrevia } from '@tumbite/compartido';
import { app } from './app';
import { crearBasePruebas } from './pruebas/d1';
import { CLAVE_MARCA_VISTA_PREVIA, olvidarVistaPreviaConfirmada } from './vistaPrevia';
import type { Env } from './env';

/**
 * C-VISTA-PREVIA-RAMA (26 nov 2026): la vista previa de una rama solo atiende con SU base aparte.
 * Si quedara conectada a la base de producción o del sitio compartido (sin la marca), responde 503.
 */
const HOST = 'https://divoox-preview-textos-prueba.windoce1.workers.dev';

describe('C-VISTA-PREVIA-RAMA: nombres y dominios', () => {
  it('el nombre sale de la rama, limpio y con el prefijo fijo', () => {
    expect(nombreVistaPrevia('fase-licencia-una-cara')).toBe('divoox-preview-licencia-una-cara');
    expect(nombreVistaPrevia('refs/heads/fase-Textos_Prueba')).toBe('divoox-preview-textos-prueba');
    expect(nombreVistaPrevia(`fase-${'x'.repeat(80)}`).length).toBeLessThanOrEqual(55);
    expect(() => nombreVistaPrevia('fase-')).toThrow();
  });
  it('solo el subdominio de la cuenta de Divoox cuenta como vista previa (y es de pruebas)', () => {
    expect(esHostVistaPrevia('divoox-preview-abc.windoce1.workers.dev')).toBe(true);
    expect(entornoDeHost('divoox-preview-abc.windoce1.workers.dev')).toBe('pruebas');
    expect(esHostVistaPrevia('divoox-preview-abc.otra.workers.dev')).toBe(false);
    expect(esHostVistaPrevia('divoox-preview-abc.windoce1.workers.dev.evil.com')).toBe(false);
    expect(esHostVistaPrevia('tumbite-reloj.windoce1.workers.dev')).toBe(false);
    expect(entornoDeHost('divoox.com')).toBe('produccion');
  });
});

describe('C-VISTA-PREVIA-RAMA: candado de la base', () => {
  beforeEach(() => olvidarVistaPreviaConfirmada());

  it('con una base SIN la marca (producción o el sitio compartido) no atiende nada: 503', async () => {
    const env = { DB: crearBasePruebas(), VISTA_PREVIA_BASE: 'divoox-preview-textos-prueba' } as Env;
    const r = await app.request(`${HOST}/datos/salud`, {}, env);
    expect(r.status).toBe(503);
    const pagina = await app.request(`${HOST}/`, {}, env);
    expect(pagina.status).toBe(503);
  });

  it('si el worker no dice su base de vista previa, tampoco atiende', async () => {
    const db = crearBasePruebas();
    await db
      .prepare('INSERT INTO config (clave, valor) VALUES (?, ?)')
      .bind(CLAVE_MARCA_VISTA_PREVIA, 'divoox-preview-textos-prueba')
      .run();
    const r = await app.request(`${HOST}/datos/salud`, {}, { DB: db } as Env);
    expect(r.status).toBe(503);
  });

  it('con la marca de OTRA vista previa tampoco (cada rama, su base)', async () => {
    const db = crearBasePruebas();
    await db
      .prepare('INSERT INTO config (clave, valor) VALUES (?, ?)')
      .bind(CLAVE_MARCA_VISTA_PREVIA, 'divoox-preview-otra-rama')
      .run();
    const env = { DB: db, VISTA_PREVIA_BASE: 'divoox-preview-textos-prueba' } as Env;
    expect((await app.request(`${HOST}/datos/salud`, {}, env)).status).toBe(503);
  });

  it('con su propia base marcada atiende normal', async () => {
    const db = crearBasePruebas();
    await db
      .prepare('INSERT INTO config (clave, valor) VALUES (?, ?)')
      .bind(CLAVE_MARCA_VISTA_PREVIA, 'divoox-preview-textos-prueba')
      .run();
    const env = { DB: db, VISTA_PREVIA_BASE: 'divoox-preview-textos-prueba' } as Env;
    const r = await app.request(`${HOST}/datos/version`, {}, env);
    expect(r.status).toBe(200);
  });

  it('fuera de una vista previa no hace nada (el sitio compartido sigue igual)', async () => {
    const env = { DB: crearBasePruebas() } as Env;
    const r = await app.request('https://staging.tumbite.com/datos/version', {}, env);
    expect(r.status).toBe(200);
  });
});
