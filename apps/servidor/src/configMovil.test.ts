// Candado de la configuración de las tres apps (C-APPS-MOVILES). Lee los app.json y eas.json
// reales: si alguien rompe un permiso, el sonido del restaurante o el perfil de pruebas, salta.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canalPedidos } from '@tumbite/compartido';

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

describe('C-ESCENAS-IOS: iOS 27 exige el ciclo de escenas', () => {
  // La plantilla de AppDelegate de Expo 57 (la que genera «expo prebuild»).
  const PLANTILLA = `class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  public override func application() -> Bool {
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`;

  it('el complemento deja el arranque sin ventana propia y declara la escena', () => {
    // El complemento es de Node con módulos clásicos: se carga como lo carga «expo prebuild».
    const p = createRequire(join(RAIZ, 'package.json'))('./plugins/escenas-ios.js') as {
      conEscenas: (c: string) => string;
      MANIFIESTO: Record<string, any>;
    };
    const nuevo = p.conEscenas(PLANTILLA);
    expect(nuevo).toContain('ExpoAppDelegate, ExpoReactNativeFactoryProvider');
    expect(nuevo).not.toContain('UIWindow(frame:');
    expect(nuevo).toContain('return super.application');
    expect(
      p.MANIFIESTO.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0]
        .UISceneDelegateClassName,
    ).toBe('$(PRODUCT_MODULE_NAME).SceneDelegate');
  });

  it.each(APPS)('%s usa el complemento de escenas', (app) => {
    expect((leer(app, 'app.json') as Conf).expo.plugins).toContain('../../plugins/escenas-ios');
  });
});
