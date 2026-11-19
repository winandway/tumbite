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
  // C-VERSION-VISIBLE (18 nov 2026): la versión nativa (versionName / CFBundleShortVersionString)
  // también cambia con cada compilación: app.config.js la arma con el número que los guiones de
  // compilar consultan a EAS antes de compilar (DIVOOX_NUMERO_COMPILACION). Lo que se LEE en la app
  // es exacto aunque eso falle, porque sale del número nativo (nativeBuildVersion).
  it.each(['cliente', 'repartidor', 'restaurante'])(
    '%s fija la versión 0.1.<compilación> en app.config.js',
    async (app) => {
      const ruta = join(__dirname, '..', '..', app, 'app.config.js');
      const { createRequire } = await import('node:module');
      const req = createRequire(import.meta.url);
      delete req.cache[req.resolve(ruta)];
      const armar = req(ruta) as (x: { config: Record<string, unknown> }) => {
        version: string;
      };
      const base = { name: 'X', version: '0.1.0', android: {}, ios: {} };
      const antes = process.env.DIVOOX_NUMERO_COMPILACION;
      try {
        process.env.DIVOOX_NUMERO_COMPILACION = '47';
        expect(armar({ config: base }).version).toBe('0.1.47');
        process.env.DIVOOX_NUMERO_COMPILACION = 'nada';
        expect(armar({ config: base }).version).toBe('0.1.0');
        delete process.env.DIVOOX_NUMERO_COMPILACION;
        expect(armar({ config: base }).version).toBe('0.1.0');
      } finally {
        if (antes === undefined) delete process.env.DIVOOX_NUMERO_COMPILACION;
        else process.env.DIVOOX_NUMERO_COMPILACION = antes;
      }
    },
  );
  it('el guion de compilar consulta el número siguiente y lo pasa a la compilación', () => {
    const s = leer('..', 'scripts', 'tiendas', 'compilar.mjs');
    expect(s).toContain("from './numero-compilacion.mjs'");
    expect(s).toMatch(/entornoNumeroCompilacion\(/);
  });
  it('el número siguiente sale de EAS (+1); en iPhone o si falla, no se toca la versión nativa', async () => {
    const { entornoNumeroCompilacion } = (await import(
      join(__dirname, '..', '..', '..', 'scripts', 'tiendas', 'numero-compilacion.mjs')
    )) as {
      entornoNumeroCompilacion: (o: Record<string, unknown>) => Record<string, string>;
    };
    const llamadas: string[][] = [];
    const ejecutar = (_: string, args: string[]) => {
      llamadas.push(args);
      return JSON.stringify({ versionCode: '46' });
    };
    const op = { cwd: '.', perfil: 'production', datosPerfil: { autoIncrement: true }, ejecutar };
    expect(entornoNumeroCompilacion({ ...op, plataforma: 'android' })).toEqual({
      DIVOOX_NUMERO_COMPILACION: '47',
    });
    expect(llamadas[0]).toContain('build:version:get');
    expect(entornoNumeroCompilacion({ ...op, plataforma: 'ios' })).toEqual({});
    expect(
      entornoNumeroCompilacion({
        ...op,
        plataforma: 'android',
        datosPerfil: { autoIncrement: false },
      }),
    ).toEqual({});
    const falla = () => {
      throw new Error('sin red');
    };
    expect(entornoNumeroCompilacion({ ...op, plataforma: 'android', ejecutar: falla })).toEqual({});
  });
  it('la pantalla de borrar la cuenta también dice la compilación', () => {
    expect(leer('..', 'packages', 'movil', 'src', 'BorrarCuenta.tsx')).toMatch(
      /textoVersion\(VERSION_APP, idioma, COMPILACION_APP\)/,
    );
  });
});
