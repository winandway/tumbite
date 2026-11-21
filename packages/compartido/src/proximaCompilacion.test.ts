import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Deuda de los envíos del 20 nov 2026 a Google Play (Driver 65 y clientes 58):
 * - C-PANTALLA-VERTICAL-OPCIONAL: Google avisó que las apps exigían `android.hardware.screen.portrait`
 *   (lo deduce de la pantalla fija en vertical) y con eso deja fuera a tabletas y a aparatos que no
 *   declaran esa pieza. Se declara a mano como NO obligatoria.
 * - C-SIN-HUELLA: ninguna app usa la huella ni la cara del teléfono; el permiso no viaja.
 * - C-APP-SIN-CIUDADES: ninguna app nombra ciudades, tampoco en su descripción.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const APPS = ['cliente', 'repartidor', 'restaurante'] as const;
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');
const expo = (app: string) =>
  (JSON.parse(leer(`apps/${app}/app.json`)) as { expo: Record<string, any> }).expo;
const requerir = createRequire(import.meta.url);
const ARCHIVO = join(RAIZ, 'plugins', 'pantalla-vertical-opcional.js');

describe('C-PANTALLA-VERTICAL-OPCIONAL', () => {
  it('las tres apps usan el complemento', () => {
    for (const app of APPS)
      expect(expo(app).plugins, app).toContain('../../plugins/pantalla-vertical-opcional');
  });

  it('el manifiesto declara la pantalla vertical como no obligatoria, una sola vez', () => {
    expect(existsSync(ARCHIVO)).toBe(true);
    const { conPantallaOpcional } = requerir(ARCHIVO) as {
      conPantallaOpcional: (m: Record<string, any>) => Record<string, any>;
    };
    const pieza = {
      $: { 'android:name': 'android.hardware.screen.portrait', 'android:required': 'false' },
    };
    const vacio = conPantallaOpcional({ manifest: {} });
    expect(vacio.manifest['uses-feature']).toEqual([pieza]);
    // Si otro complemento ya la puso como obligatoria, se corrige en vez de duplicarla.
    const conOtra = conPantallaOpcional({
      manifest: {
        'uses-feature': [
          { $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } },
          { $: { 'android:name': 'android.hardware.screen.portrait', 'android:required': 'true' } },
        ],
      },
    });
    expect(conOtra.manifest['uses-feature']).toHaveLength(2);
    expect(conOtra.manifest['uses-feature'][1]).toEqual(pieza);
    expect(conPantallaOpcional(conOtra)).toEqual(conOtra);
  });
});

describe('C-SIN-HUELLA', () => {
  it('Driver y clientes bloquean la huella, y ninguna app trae la pieza que la usaría', () => {
    for (const app of ['cliente', 'repartidor']) {
      const bloqueados = expo(app).android.blockedPermissions as string[];
      expect(bloqueados, app).toContain('android.permission.USE_BIOMETRIC');
      expect(bloqueados, app).toContain('android.permission.USE_FINGERPRINT');
    }
    for (const app of APPS) {
      expect(leer(`apps/${app}/package.json`), app).not.toContain('expo-local-authentication');
      // El almacén seguro no pide la cara ni la huella.
      const seguro = (expo(app).plugins as unknown[]).find(
        (p) => Array.isArray(p) && p[0] === 'expo-secure-store',
      ) as [string, Record<string, unknown>] | undefined;
      expect(seguro?.[1], app).toEqual({ faceIDPermission: false });
    }
    expect(leer('packages/movil/package.json')).not.toContain('expo-local-authentication');
  });
});

describe('C-APP-SIN-CIUDADES', () => {
  it('la configuración de ninguna app nombra una ciudad', () => {
    const CIUDADES =
      /\b(Miami|Novi|Detroit|Michigan|Florida|El Vig[ií]a|Tucan[ií]|M[eé]rida|Caracas|Bogot[aá]|Medell[ií]n|Ica|Lima)\b/;
    for (const app of APPS) {
      const e = expo(app);
      expect(String(e.description), app).not.toMatch(CIUDADES);
      expect(JSON.stringify(e), app).not.toMatch(CIUDADES);
      expect(leer(`apps/${app}/idiomas/es.json`), app).not.toMatch(CIUDADES);
    }
  });
});
