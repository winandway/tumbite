import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-IOS-TEXTOS-PERMISO (30 oct 2026): Apple rechaza la compilación al procesarla (error 90683) si una
 * librería toca un sensor o dato protegido y la app no explica para qué. Pasó con el sensor de
 * movimiento en Divoox y Divoox Driver: la subida «terminó» en Expo pero nunca apareció en App Store
 * Connect. Cada app lleva sus textos en `expo.ios.infoPlist`.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const EXIGIDOS: Record<string, string[]> = {
  cliente: ['NSLocationWhenInUseUsageDescription', 'NSMotionUsageDescription'],
  repartidor: [
    'NSLocationWhenInUseUsageDescription',
    'NSLocationAlwaysAndWhenInUseUsageDescription',
    'NSCameraUsageDescription',
    'NSMotionUsageDescription',
  ],
  restaurante: ['NSPhotoLibraryUsageDescription', 'NSMotionUsageDescription'],
};

describe('textos de permiso de iPhone', () => {
  for (const [app, claves] of Object.entries(EXIGIDOS)) {
    it(`${app} explica cada permiso que Apple exige`, () => {
      const json = JSON.parse(readFileSync(join(RAIZ, 'apps', app, 'app.json'), 'utf8')) as {
        expo: { ios?: { infoPlist?: Record<string, unknown> }; plugins?: unknown[] };
      };
      // Un plugin con el permiso en `false` BORRA el texto del infoPlist al compilar (pasó con
      // expo-location y `motionUsagePermission: false`: la prueba de abajo daba verde y Apple seguía
      // rechazando).
      for (const p of json.expo.plugins ?? []) {
        if (!Array.isArray(p) || typeof p[1] !== 'object' || p[1] === null) continue;
        for (const [k, v] of Object.entries(p[1] as Record<string, unknown>))
          if (/Permission$/.test(k) && v === false && /motion/i.test(k))
            expect.fail(`${app}: ${String(p[0])} tiene ${k} en false y borra el texto de Apple`);
      }
      const plist = new Map(Object.entries(json.expo.ios?.infoPlist ?? {}));
      for (const clave of claves) {
        const texto = plist.get(clave);
        expect(typeof texto === 'string' && texto.length > 20, `${app}: falta ${clave}`).toBe(true);
      }
    });
  }
});
