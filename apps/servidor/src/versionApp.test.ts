import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { app } from './app';
import { esMenor, leerCabeceraApp, minimosDe } from './versionApp';

const raiz = join(__dirname, '..', '..', '..');

/** F16 de la auditoría final: las apps dicen quiénes son y el servidor puede pedir «actualiza» (C-VERSION-APP). */
describe('versión mínima de las apps (C-VERSION-APP)', () => {
  it('lee la cabecera y los mínimos, y compara versiones', () => {
    expect(leerCabeceraApp('cliente/0.1.0')).toEqual({ app: 'cliente', version: [0, 1, 0] });
    expect(leerCabeceraApp('otra/1.0.0')).toBeNull();
    expect(leerCabeceraApp(undefined)).toBeNull();
    expect(minimosDe('cliente=0.2.0, repartidor=0.1.5').get('repartidor')).toEqual([0, 1, 5]);
    expect(minimosDe('0.2.0').get('*')).toEqual([0, 2, 0]);
    expect(esMenor([0, 1, 9], [0, 2, 0])).toBe(true);
    expect(esMenor([0, 2, 0], [0, 2, 0])).toBe(false);
  });

  it('una app vieja recibe 426 en toda la API; la web (sin cabecera), lo público y una app al día pasan', async () => {
    const env = { APP_VERSION_MINIMA: 'cliente=0.2.0' };
    const vieja = await app.request(
      '/datos/cuentas/yo',
      { headers: { 'x-tumbite-app': 'cliente/0.1.0' } },
      env,
    );
    expect(vieja.status).toBe(426);
    expect(((await vieja.json()) as { actualizar: boolean; error: string }).actualizar).toBe(true);
    const enIngles = await app.request(
      '/datos/cuentas/yo',
      { headers: { 'x-tumbite-app': 'cliente/0.1.0', 'x-idioma': 'en' } },
      env,
    );
    expect(((await enIngles.json()) as { error: string }).error).toMatch(/update/i);
    expect(
      (await app.request('/datos/publico', { headers: { 'x-tumbite-app': 'cliente/0.1.0' } }, env))
        .status,
    ).toBe(200);
    expect((await app.request('/datos/cuentas/yo', {}, env)).status).not.toBe(426);
    expect(
      (
        await app.request(
          '/datos/cuentas/yo',
          { headers: { 'x-tumbite-app': 'cliente/0.2.0' } },
          env,
        )
      ).status,
    ).not.toBe(426);
    expect(
      (
        await app.request(
          '/datos/cuentas/yo',
          { headers: { 'x-tumbite-app': 'repartidor/0.0.1' } },
          env,
        )
      ).status,
    ).not.toBe(426);
  });

  it('las apps mandan su nombre y versión, y el idioma elegido llega a la cuenta', () => {
    const api = readFileSync(join(raiz, 'packages/compartido/src/api.ts'), 'utf8');
    expect(api).toContain("headers['x-tumbite-app']");
    const sesion = readFileSync(join(raiz, 'packages/movil/src/sesion.tsx'), 'utf8');
    expect(sesion).toMatch(/app: \(\) =>/);
    expect(sesion).toContain("'/datos/cuentas/idioma'");
  });
});
