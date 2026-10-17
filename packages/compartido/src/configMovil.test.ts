// Candado de la configuración de las tres apps (C-APPS-MOVILES). Lee los app.json y eas.json
// reales: si alguien rompe un permiso, el sonido del restaurante o el perfil de pruebas, salta.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canalPedidos } from './avisosCanal';

const RAIZ = join(__dirname, '../../..');
type Conf = { expo: Record<string, any> };
const leer = (app: string, f: string) =>
  JSON.parse(readFileSync(join(RAIZ, 'apps', app, f), 'utf8')) as any;
const APPS = ['cliente', 'repartidor', 'restaurante'] as const;
const plugin = (c: Conf, nombre: string) =>
  (c.expo.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === nombre) as
    [string, Record<string, any>] | undefined;

describe('configuración de las apps móviles', () => {
  it.each(APPS)(
    '%s: identificadores propios, sin campos vencidos y perfil de pruebas a staging',
    (app) => {
      const c = leer(app, 'app.json') as Conf;
      const eas = leer(app, 'eas.json');
      expect(c.expo.privacy).toBeUndefined();
      expect(c.expo.owner).toBe('windoce-llc');
      expect(c.expo.android.package).toBe(c.expo.ios.bundleIdentifier);
      expect(eas.build.pruebas.env.EXPO_PUBLIC_API_URL).toBe('https://staging.tumbite.com');
      expect(eas.build.pruebas.android.buildType).toBe('apk');
      for (const perfil of ['preview', 'production'])
        expect(eas.build[perfil].env.EXPO_PUBLIC_API_URL).toBe('https://tumbite.com');
      expect(plugin(c, 'expo-notifications')?.[1].defaultChannel).toBe('pedidos');
      // Las frases de permisos de iPhone van bajo «ios»: sueltas, Expo las copia también a
      // Android y su compilación se cae (ExtraTranslation), aquí y en EAS.
      expect(Object.keys(leer(app, 'idiomas/es.json'))).toEqual(['ios']);
    },
  );

  it('los paquetes de las tres apps son distintos', () => {
    const ids = APPS.map((a) => (leer(a, 'app.json') as Conf).expo.android.package);
    expect(new Set(ids).size).toBe(3);
  });

  it('el restaurante incluye su alarma y la usa en el canal de avisos', () => {
    const c = leer('restaurante', 'app.json') as Conf;
    const sonidos = plugin(c, 'expo-notifications')?.[1].sounds as string[];
    expect(sonidos).toContain('./assets/sonidos/alarma.wav');
    expect(existsSync(join(RAIZ, 'apps/restaurante/assets/sonidos/alarma.wav'))).toBe(true);
    expect(c.expo.extra.sonidoAvisos).toBe('alarma.wav');
    expect(canalPedidos(c.expo.extra, 7)).toEqual({
      name: 'Pedidos',
      importance: 7,
      sound: 'alarma.wav',
    });
    expect(canalPedidos(undefined, 7).sound).toBe('default');
  });

  it('el repartidor pide cámara y ubicación; ninguna app pide micrófono', () => {
    const r = leer('repartidor', 'app.json') as Conf;
    expect(r.expo.android.permissions).toEqual(
      expect.arrayContaining(['ACCESS_FINE_LOCATION', 'CAMERA']),
    );
    for (const a of APPS)
      expect((leer(a, 'app.json') as Conf).expo.android.permissions ?? []).not.toContain(
        'RECORD_AUDIO',
      );
  });
});
