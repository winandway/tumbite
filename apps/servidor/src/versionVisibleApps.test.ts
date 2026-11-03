import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-VERSION-VISIBLE (SIG-7, 2 nov 2026): para soporte, cada app dice a la vista la versión y la
 * compilación instaladas (como Uber y DoorDash en Ajustes → Acerca de): Mi cuenta del cliente, la
 * cuenta de Divoox Driver y Más de la app del restaurante. Las apps no corren en vitest: el candado
 * mira su código. La web y el panel ya la muestran (VersionPublicada, C-VERSION-DEL-ARTEFACTO).
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', ...r), 'utf8');

describe('versión visible en las tres apps (C-VERSION-VISIBLE)', () => {
  it('la pieza común lee la compilación instalada de expo-application', () => {
    const v = leer('..', 'packages', 'movil', 'src', 'version.tsx');
    expect(v).toMatch(/nativeBuildVersion/);
    expect(v).toMatch(/export function VersionInstalada/);
    expect(v).toMatch(/textoVersion\(VERSION_APP, idioma, COMPILACION_APP\)/);
  });
  it.each([
    ['cliente', 'src', 'app', 'account.tsx'],
    ['repartidor', 'src', 'Inicio.tsx'],
    ['restaurante', 'src', 'Mas.tsx'],
  ])('%s la muestra a la vista', (...ruta) => {
    expect(leer(...ruta)).toMatch(/<VersionInstalada \/>/);
  });
  it('las tres apps instalan expo-application', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante'])
      expect(leer(app, 'package.json')).toMatch(/"expo-application"/);
  });
});
