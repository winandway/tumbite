import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-ARRANQUE-CON-MARCA (24 nov 2026, Richard) — todos los países. En teléfonos Android reales, al abrir
 * en frío salía «una pantalla de círculos con rayas en cruz»: ninguna de las tres apps configuraba
 * `expo-splash-screen` y el prebuild dejaba la imagen de plantilla de Expo (`splashscreen_logo`) como
 * fondo de la ventana. Ahora cada app arranca con el logo completo de Divoox (generado desde los
 * vectores aprobados) sobre su color, en Android y en iPhone por igual, y sigue con una pantalla de
 * carga igual con una barra fina en verde mientras lee la sesión.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const APPS = { cliente: '#F20D20', repartidor: '#1F4D69', restaurante: '#101010' } as const;

type Ajustes = { image?: string; backgroundColor?: string; resizeMode?: string };

describe('C-ARRANQUE-CON-MARCA', () => {
  for (const [app, color] of Object.entries(APPS)) {
    it(`${app}: arranque con su color y el logo de Divoox, igual en Android e iPhone`, () => {
      const json = JSON.parse(readFileSync(join(RAIZ, 'apps', app, 'app.json'), 'utf8')) as {
        expo: { plugins: unknown[] };
      };
      const plugin = json.expo.plugins.find(
        (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
      ) as [string, Ajustes & { android?: Ajustes; ios?: Ajustes }] | undefined;
      expect(plugin, 'falta expo-splash-screen: saldría la imagen de plantilla').toBeDefined();
      const a = plugin![1];
      for (const lado of [a, a.android, a.ios]) {
        expect(lado?.image).toBe('./assets/splash-logo.png');
        expect(lado?.backgroundColor).toBe(color);
        expect(lado?.resizeMode).toBe('contain');
      }
      expect(existsSync(join(RAIZ, 'apps', app, 'assets', 'splash-logo.png'))).toBe(true);
      const paquete = readFileSync(join(RAIZ, 'apps', app, 'package.json'), 'utf8');
      expect(paquete).toContain('"expo-splash-screen"');
      // La pantalla de carga: mismo color y logo, y la entrada la usa mientras se lee la sesión.
      const layout = readFileSync(join(RAIZ, 'apps', app, 'src', 'app', '_layout.tsx'), 'utf8');
      expect(layout).toContain(`fijarPantallaCarga({ fondo: '${color}', logo: logoArranque })`);
      expect(layout).toContain("from '../../assets/splash-logo.png'");
      const entrada = readFileSync(join(RAIZ, 'apps', app, 'src', 'app', 'index.tsx'), 'utf8');
      expect(entrada).toContain('if (cargando) return <PantallaCarga />;');
    });
  }

  it('el logo sale de los vectores aprobados y la barra de carga es verde', () => {
    const gen = readFileSync(join(RAIZ, 'scripts', 'marca', 'generar-identidad.mjs'), 'utf8');
    expect(gen).toContain('LOGO_ARRANQUE');
    expect(gen).toContain("'splash-logo.png'");
    const carga = readFileSync(join(__dirname, 'PantallaCarga.tsx'), 'utf8');
    expect(carga).toContain('backgroundColor: MARCA.colores.exito');
    expect(readFileSync(join(__dirname, 'ConSesion.tsx'), 'utf8')).toContain(
      'if (cargando) return <PantallaCarga />;',
    );
  });
});
