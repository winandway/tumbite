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
          expect(String(op.locationAlwaysAndWhenInUsePermission)).toMatch(/Divoox/);
          expect(String(op.locationAlwaysPermission)).toMatch(/Divoox/);
        } else {
          expect(loc[1]).toMatchObject({
            locationAlwaysPermission: false,
            locationAlwaysAndWhenInUsePermission: false,
          });
        }
        // C-IOS-TEXTOS-PERMISO: el sensor de movimiento NO va en false (Apple rechaza con el error
        // 90683); lleva un texto propio de Divoox, nunca el genérico.
        expect(String((loc[1] as Record<string, unknown>).motionUsagePermission)).toMatch(/Divoox/);
      }
      expect(JSON.stringify(e)).not.toContain('$(PRODUCT_NAME)');
    }
  });

  // C-SIN-VENTANA-ENCIMA (16 nov 2026): React Native mete SYSTEM_ALERT_WINDOW («mostrar encima de
  // otras apps») en el manifiesto; ninguna app lo usa y el auditor de Google Play lo marcó como
  // permiso de más que no se envía. Visto en el .aab de producción (cliente 25, Driver 23,
  // Restaurants 16) antes de bloquearlo.
  it('ninguna app pide mostrarse encima de otras apps ni almacenamiento', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const bloqueados = leer(app, 'app.json').expo.android.blockedPermissions as string[];
      for (const p of [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ])
        expect(bloqueados, `${app}: ${p}`).toContain(p);
    }
    // El cliente no sigue la ubicación con la app cerrada: sin servicio de ubicación en primer plano.
    expect(plugin(leer('cliente', 'app.json').expo, 'expo-location')?.[1]).toMatchObject({
      isAndroidForegroundServiceEnabled: false,
      isAndroidBackgroundLocationEnabled: false,
    });
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

  // C-OFERTA-SUENA-EN-BUCLE (18 nov 2026): Driver toca el tono de la oferta con expo-audio sin
  // sumar permisos: ni micrófono, ni audio en segundo plano, ni cambiar los ajustes de audio.
  it('el repartidor suena la oferta sin permisos nuevos', () => {
    const e = leer('repartidor', 'app.json').expo;
    expect(plugin(e, 'expo-audio')?.[1]).toMatchObject({
      microphonePermission: false,
      recordAudioAndroid: false,
      enableBackgroundPlayback: false,
    });
    expect(e.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
      ]),
    );
    expect(e.android.permissions).not.toContain('MODIFY_AUDIO_SETTINGS');
    expect(e.ios?.infoPlist?.UIBackgroundModes ?? []).not.toContain('audio');
  });

  // C-CAMARA-EN-TODA-SUBIDA (regla global del 9 nov 2026): desde el 10 nov el restaurante sí usa la
  // cámara, solo para tomar la foto de un plato, y lo explica en los dos idiomas. Sigue sin micrófono.
  it('el restaurante explica las fotos y la cámara (para el menú) en los dos idiomas, sin micrófono', () => {
    const e = leer('restaurante', 'app.json').expo;
    expect(e.ios.infoPlist.NSPhotoLibraryUsageDescription).toMatch(/photo/);
    const fotos = plugin(e, 'expo-image-picker')?.[1] as Record<string, unknown>;
    expect(fotos.microphonePermission).toBe(false);
    expect(String(fotos.cameraPermission)).toMatch(/camera.*photo of each dish/);
    expect(leer('restaurante', 'idiomas/es.json').ios.NSCameraUsageDescription).toMatch(
      /cámara.*plato/,
    );
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
