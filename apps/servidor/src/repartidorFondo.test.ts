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
        android: { permissions: string[]; blockedPermissions: string[] };
        plugins: unknown[];
      };
    };
    expect(app.expo.ios.infoPlist.UIBackgroundModes).toEqual(['location']);
    // Android (27 oct 2026): sin el permiso «todo el tiempo» (Google Play pide un video para
    // aprobarlo); el servicio en primer plano con notificación basta con la app abierta primero.
    expect(app.expo.android.permissions).not.toContain('ACCESS_BACKGROUND_LOCATION');
    expect(app.expo.android.blockedPermissions).toContain(
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    );
    expect(app.expo.android.permissions).toEqual(
      expect.arrayContaining(['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION']),
    );
    const loc = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location') as [
      string,
      Record<string, unknown>,
    ];
    expect(loc[1].isAndroidBackgroundLocationEnabled).toBe(false);
    expect(loc[1].isAndroidForegroundServiceEnabled).toBe(true);
    const tarea = leer('apps/repartidor/src/ubicacionFondo.ts');
    expect(tarea).toContain('TaskManager.defineTask(TAREA_UBICACION');
    expect(tarea).toContain('startLocationUpdatesAsync');
    // Solo iPhone pide el permiso de fondo; en Android pedirlo sin tenerlo en el manifiesto revienta.
    expect(tarea).toContain("if (Platform.OS === 'ios') {");
    expect(tarea).toContain('foregroundService: {');
    expect(tarea).toContain('/datos/repartidor/ubicacion');
    // Sin sesión o con la sesión vencida, el servicio se apaga solo (no queda encendido tras salir).
    expect(tarea).toContain('if (!token) return detenerUbicacionFondo();');
    expect(tarea).toContain('if (r.status === 401) await detenerUbicacionFondo();');
    const inicio = leer('apps/repartidor/src/Inicio.tsx');
    expect(inicio).toContain('iniciarUbicacionFondo(');
    expect(inicio).toContain('detenerUbicacionFondo()');
    expect(inicio).toContain('useEffect(() => () => void detenerUbicacionFondo(), []);');
    expect(
      JSON.parse(leer('apps/repartidor/package.json')).dependencies['expo-task-manager'],
    ).toBeTruthy();
  });
});
