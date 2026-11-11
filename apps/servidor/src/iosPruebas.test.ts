import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * C-IOS-PRUEBAS-NO-A-REVISION (11 nov 2026) — todos los países. Las compilaciones de iPhone para
 * probar con Stripe de prueba hablan con el sitio de pruebas y viven en TestFlight. Nunca pueden
 * llegar a la revisión de la tienda, y el perfil de la tienda nunca puede hablar con pruebas.
 */
const leer = (ruta: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${ruta}`, import.meta.url).href), 'utf8');

describe('C-IOS-PRUEBAS-NO-A-REVISION', () => {
  for (const app of ['cliente', 'repartidor', 'restaurante']) {
    it(`${app}: «production» habla con producción y «pruebas-tienda» con el sitio de pruebas`, () => {
      const eas = JSON.parse(leer(`apps/${app}/eas.json`)) as {
        build: Record<string, { env: { EXPO_PUBLIC_API_URL: string } }>;
      };
      expect(eas.build.production?.env.EXPO_PUBLIC_API_URL).toBe('https://divoox.com');
      expect(eas.build['pruebas-tienda']?.env.EXPO_PUBLIC_API_URL).toBe(
        'https://staging.tumbite.com',
      );
    });
  }
  it('la compilación de pruebas se anota antes de enviarse y solo se hace en esta Mac', () => {
    const guion = leer('scripts/tiendas/compilar-ios.mjs');
    expect(guion).toContain("pruebas ? 'pruebas-tienda' : 'production'");
    expect(guion).toContain('ios-compilaciones-de-pruebas');
    expect(guion.indexOf('ios-compilaciones-de-pruebas')).toBeLessThan(guion.indexOf("'submit',"));
    expect(guion).toMatch(/pruebas && !local/);
  });
  it('el envío a revisión rechaza una compilación anotada como de pruebas', () => {
    const guion = leer('scripts/tiendas/enviar-revision-ios.mjs');
    expect(guion).toContain('ios-compilaciones-de-pruebas');
    expect(guion).toMatch(/dePruebas\.has\(/);
    expect(guion).toContain('process.exit(3)');
  });
});
