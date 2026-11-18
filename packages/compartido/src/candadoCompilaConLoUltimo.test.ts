import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-COMPILA-CON-LO-ULTIMO (18 nov 2026) — todos los países. Apple avisó (ITMS-90725) que el cliente y
// el Driver se compilaron con el SDK de iOS 26.5: sin imagen fijada, Expo elegía la de Xcode 26.6.
// Regla de Richard: todo se compila con lo último. Cada perfil de las tres apps fija la imagen de
// iPhone con Xcode 27 y la de Android más nueva para este SDK de Expo. Xcode 27 exige el ciclo de
// escenas de UIKit: lo pone `plugins/escenas-ios`, que las tres apps deben seguir cargando.
const RAIZ = join(__dirname, '..', '..', '..');
const APPS = ['cliente', 'repartidor', 'restaurante'] as const;

describe('C-COMPILA-CON-LO-ULTIMO', () => {
  for (const app of APPS) {
    it(`${app}: cada perfil compila con Xcode 27 o más nuevo y con la imagen de Android fijada`, () => {
      const eas = JSON.parse(readFileSync(join(RAIZ, 'apps', app, 'eas.json'), 'utf8')) as {
        build: Record<string, { ios?: { image?: string }; android?: { image?: string } }>;
      };
      const perfiles = Object.entries(eas.build);
      expect(perfiles.length).toBeGreaterThan(0);
      for (const [nombre, perfil] of perfiles) {
        const xcode = /xcode-(\d+)\./.exec(perfil.ios?.image ?? '');
        expect(xcode, `${app}/${nombre} sin imagen de iPhone fijada`).not.toBeNull();
        expect(Number(xcode?.[1]), `${app}/${nombre}`).toBeGreaterThanOrEqual(27);
        expect(perfil.android?.image, `${app}/${nombre} sin imagen de Android fijada`).toMatch(
          /^ubuntu-\d+\.\d+-jdk-\d+-ndk-/,
        );
      }
    });

    it(`${app}: sigue cargando las escenas de iPhone, que Xcode 27 exige`, () => {
      const config = readFileSync(join(RAIZ, 'apps', app, 'app.json'), 'utf8');
      expect(config).toContain('plugins/escenas-ios');
    });
  }
});
