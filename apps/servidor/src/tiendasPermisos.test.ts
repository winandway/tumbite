import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-TIENDAS-PERMISOS: Apple rechaza las apps que piden permisos sin explicar para qué
 * (o con el texto genérico «Allow $(PRODUCT_NAME)…») y Google pregunta por cada permiso de más.
 * Cada app pide solo lo que usa, con su motivo en inglés y en español.
 */
const leer = (app: string, archivo: string) =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', app, archivo), 'utf8')) as Record<
    string,
    any
  >;
const plugin = (e: Record<string, any>, nombre: string) =>
  (e.plugins as (string | [string, Record<string, unknown>])[]).find((x) =>
    Array.isArray(x) ? x[0] === nombre : x === nombre,
  );

describe('permisos de las apps para las tiendas', () => {
  it('ninguna app deja los textos genéricos de Face ID, ubicación siempre o movimiento', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const e = leer(app, 'app.json').expo;
      expect(plugin(e, 'expo-secure-store')).toEqual([
        'expo-secure-store',
        { faceIDPermission: false },
      ]);
      const loc = plugin(e, 'expo-location');
      if (loc) {
        // Solo el repartidor pide «Siempre» (GPS en segundo plano, punto 23) y lo explica con sus palabras.
        if (app === 'repartidor') {
          const op = loc[1] as Record<string, unknown>;
          expect(op).toMatchObject({ motionUsagePermission: false });
          expect(String(op.locationAlwaysAndWhenInUsePermission)).toMatch(/Tumbite/);
          expect(String(op.locationAlwaysPermission)).toMatch(/Tumbite/);
        } else {
          expect(loc[1]).toMatchObject({
            locationAlwaysPermission: false,
            locationAlwaysAndWhenInUsePermission: false,
            motionUsagePermission: false,
          });
        }
      }
      expect(JSON.stringify(e)).not.toContain('$(PRODUCT_NAME)');
    }
  });

  it('el repartidor explica la cámara (verificación de identidad) en los dos idiomas', () => {
    const e = leer('repartidor', 'app.json').expo;
    expect(e.ios.infoPlist.NSCameraUsageDescription).toMatch(/camera/);
    expect(plugin(e, 'expo-image-picker')?.[1]).toMatchObject({ photosPermission: false });
    expect(leer('repartidor', 'idiomas/es.json').ios.NSCameraUsageDescription).toMatch(/cámara/);
  });

  it('el restaurante no pide micrófono ni audio en segundo plano', () => {
    const e = leer('restaurante', 'app.json').expo;
    expect(plugin(e, 'expo-audio')?.[1]).toMatchObject({
      microphonePermission: false,
      enableBackgroundPlayback: false,
    });
    expect(e.android.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
  });

  it('el restaurante explica las fotos (para el menú) en los dos idiomas y no pide cámara', () => {
    const e = leer('restaurante', 'app.json').expo;
    expect(e.ios.infoPlist.NSPhotoLibraryUsageDescription).toMatch(/photo/);
    expect(plugin(e, 'expo-image-picker')?.[1]).toMatchObject({
      cameraPermission: false,
      microphonePermission: false,
    });
    expect(e.locales).toEqual({ es: './idiomas/es.json' });
    expect(leer('restaurante', 'idiomas/es.json').ios.NSPhotoLibraryUsageDescription).toMatch(
      /fotos/,
    );
  });

  it('el cliente y el repartidor explican la ubicación también en español', () => {
    for (const app of ['cliente', 'repartidor']) {
      expect(leer(app, 'app.json').expo.locales).toEqual({ es: './idiomas/es.json' });
      expect(leer(app, 'idiomas/es.json').ios.NSLocationWhenInUseUsageDescription).toMatch(
        /ubicación/,
      );
    }
  });
});
