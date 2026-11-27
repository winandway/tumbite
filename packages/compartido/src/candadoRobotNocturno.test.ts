import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * C-ROBOT-NOCTURNO (26 nov 2026, Gerencia con autorización de Richard). Los tres robots de la lista de
 * aceptación (apps con Maestro, panel con Playwright y examen de Camila) corren cada noche SOLO contra
 * el sitio de pruebas y con cuentas de prueba. Este candado se pone en rojo si alguno puede apuntar a
 * producción, si un recorrido toca las cuentas o la zona de revisión de las tiendas, o si un recorrido
 * de Maestro no dice qué línea de la lista comprueba.
 */
const RAIZ = resolve(__dirname, '../../..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

function archivos(dir: string, fin: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) salida.push(...archivos(ruta, fin));
    else if (e.name.endsWith(fin)) salida.push(ruta);
  }
  return salida;
}

describe('C-ROBOT-NOCTURNO · los robots solo van al sitio de pruebas', () => {
  const antes = process.env.ACEPTACION_URL;
  afterEach(() => {
    if (antes === undefined) delete process.env.ACEPTACION_URL;
    else process.env.ACEPTACION_URL = antes;
  });

  it('la pieza común rechaza producción y acepta el sitio de pruebas', async () => {
    // Ruta en variable: es un .mjs sin tipos y aquí solo hace falta una función.
    const pieza = '../../../scripts/aceptacion/comun.mjs';
    const { sitioDePruebas } = (await import(/* @vite-ignore */ pieza)) as {
      sitioDePruebas: () => string;
    };
    for (const malo of ['https://divoox.com', 'https://tumbite.com', 'https://www.divoox.com']) {
      process.env.ACEPTACION_URL = malo;
      expect(() => sitioDePruebas(), malo).toThrow();
    }
    process.env.ACEPTACION_URL = 'https://staging.tumbite.com';
    expect(sitioDePruebas()).toBe('https://staging.tumbite.com');
    delete process.env.ACEPTACION_URL;
    expect(sitioDePruebas()).toBe('https://staging.tumbite.com');
  });

  it('los tres lanzadores pasan por la pieza común del sitio de pruebas', () => {
    // camila.mjs y panel-datos.mjs llegan al sitio por base-pruebas.mjs (URL_PRUEBAS = sitioDePruebas()).
    expect(leer('scripts/aceptacion/base-pruebas.mjs')).toMatch(
      /export const URL_PRUEBAS = sitioDePruebas\(\);/,
    );
    for (const f of [
      'apps.mjs',
      'panel.mjs',
      'camila.mjs',
      'base-pruebas.mjs',
      'panel-datos.mjs',
    ]) {
      const texto = leer(`scripts/aceptacion/${f}`);
      expect(texto, f).toMatch(/sitioDePruebas|URL_PRUEBAS/);
      expect(texto, f).not.toMatch(/https:\/\/(www\.)?(divoox|tumbite)\.com(?![\w.-])/);
    }
  });

  it('ningún recorrido toca producción ni las cuentas o la zona de revisión de las tiendas', () => {
    const todos = [
      ...archivos('maestro', '.yaml'),
      ...archivos('e2e/aceptacion', '.ts'),
      'scripts/aceptacion/camila-preguntas.json',
    ];
    expect(todos.length).toBeGreaterThan(5);
    for (const f of todos) {
      const texto = leer(f);
      expect(texto, f).not.toMatch(/revisor\.[a-z]+@windoce\.com/i);
      expect(texto, f).not.toMatch(/https:\/\/(www\.)?(divoox|tumbite)\.com(?![\w.-])/);
    }
  });

  it('cada recorrido de Maestro dice qué línea de la lista comprueba', () => {
    const flujos = [
      ...archivos('maestro/repartidor', '.yaml'),
      ...archivos('maestro/cliente', '.yaml'),
    ];
    expect(flujos.length).toBeGreaterThanOrEqual(6);
    for (const f of flujos) {
      const texto = leer(f);
      expect(texto, f).toMatch(/^# linea: [CP]\d+$/m);
      expect(texto, f).toMatch(/^# titulo: .+$/m);
    }
  });

  it('un solo juego: el examen de Camila corre una vez por noche y C1 va en seis ciudades', () => {
    const camila = leer('scripts/aceptacion/camila.mjs');
    expect(camila).toContain('existsSync(YA_CORRIO)');
    expect(camila).toContain("'--forzar'");
    const apps = leer('scripts/aceptacion/apps.mjs');
    for (const c of ['El Vigía', 'Maracaibo', 'Caracas', 'Gilroy', 'Nueva York', 'Novi'])
      expect(apps, c).toContain(`nombre: '${c}'`);
    expect(apps).toContain('al segundo intento');
    // La tarea de la Mac es UNA: robot-nocturno (2:00) y su parte (7:00), nada más.
    const tarea = leer('scripts/aceptacion/instalar-tarea.sh');
    expect([...tarea.matchAll(/^plist (\S+)/gm)].map((m) => m[1])).toEqual([
      'robot-nocturno',
      'robot-parte',
    ]);
  });
});
