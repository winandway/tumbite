import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Punto 23: GPS en segundo plano en la app del repartidor (C-GPS-FONDO). Candado de archivos. */
describe('GPS en segundo plano del repartidor (C-GPS-FONDO)', () => {
  const raiz = join(__dirname, '..', '..', '..');
  const leer = (x: string) => readFileSync(join(raiz, x), 'utf8');
  it('la app declara el permiso de fondo en iOS y Android, define la tarea y la enciende al conectarse', () => {
    const app = JSON.parse(leer('apps/repartidor/app.json')) as {
      expo: {
        ios: { infoPlist: Record<string, unknown> };
        android: { permissions: string[] };
        plugins: unknown[];
      };
    };
    expect(app.expo.ios.infoPlist.UIBackgroundModes).toEqual(['location']);
    expect(app.expo.android.permissions).toContain('ACCESS_BACKGROUND_LOCATION');
    const loc = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location') as [
      string,
      Record<string, unknown>,
    ];
    expect(loc[1].isAndroidBackgroundLocationEnabled).toBe(true);
    const tarea = leer('apps/repartidor/src/ubicacionFondo.ts');
    expect(tarea).toContain('TaskManager.defineTask(TAREA_UBICACION');
    expect(tarea).toContain('startLocationUpdatesAsync');
    expect(tarea).toContain('/datos/repartidor/ubicacion');
    const inicio = leer('apps/repartidor/src/Inicio.tsx');
    expect(inicio).toContain('iniciarUbicacionFondo(');
    expect(inicio).toContain('detenerUbicacionFondo()');
    expect(
      JSON.parse(leer('apps/repartidor/package.json')).dependencies['expo-task-manager'],
    ).toBeTruthy();
  });
});
