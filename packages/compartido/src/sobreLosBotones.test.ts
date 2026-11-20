import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-SOBRE-LOS-BOTONES y C-ENTRAR-CON-SALIDA (14 nov 2026, Richard, probando en un Xiaomi con
 * Android 14 y los tres botones del sistema) — todos los países. Candado de lectura:
 * 1. Nada de la app queda debajo de los botones del teléfono (el menú de abajo quedaba tapado y no
 *    recibía el toque). Las tres apps envuelven sus pantallas en la pieza única `SobreLosBotones`.
 * 2. La pantalla de entrar tiene salida a la vista: flecha «Volver» arriba y el botón de atrás del
 *    teléfono, además de «Seguir mirando sin cuenta».
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

describe('nada queda debajo de los botones del teléfono', () => {
  it('las tres apps envuelven todas sus pantallas en SobreLosBotones', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const t = leer(`apps/${app}/src/app/_layout.tsx`);
      expect(t, app).toMatch(/<SobreLosBotones>[\s\S]*<Stack[\s\S]*<\/SobreLosBotones>/);
    }
  });
  it('la pieza deja libre el alto de los botones en Android y no lo suma dos veces más adentro', () => {
    const t = leer('packages/movil/src/SobreLosBotones.tsx');
    expect(t).toContain('useSafeAreaInsets()');
    expect(t).toMatch(/Platform\.OS === 'android'/);
    expect(t).toMatch(/paddingBottom: abajo/);
    // Las pantallas de adentro ya no vuelven a contar ese margen.
    expect(t).toMatch(/SafeAreaInsetsContext\.Provider/);
    expect(t).toMatch(/bottom: 0/);
  });
});

describe('la pantalla de entrar tiene salida', () => {
  it('flecha «Volver» arriba y botón de atrás del teléfono cuando se puede seguir sin cuenta', () => {
    const acceso = leer('packages/movil/src/Acceso.tsx');
    // C-SIN-CALLEJON: en «Crear cuenta» la flecha vuelve a «Entrar»; en «Entrar», a seguir mirando.
    expect(acceso).toContain('volver={registro ? aEntrar : seguirMirando}');
    expect(acceso).toContain("BackHandler.addEventListener('hardwareBackPress'");
    const ui = leer('packages/movil/src/ui.tsx');
    expect(ui).toContain('testID="cabecera-volver"');
    const textos = leer('packages/movil/src/textos.ts');
    expect(textos).toMatch(/volver: 'Volver'/);
    expect(textos).toMatch(/volver: 'Back'/);
  });
});
