import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { esAppDePruebas } from './entornos';

/**
 * C-FRANJA-SOLO-EN-PRUEBAS (18 nov 2026) — todos los países. La versión de la tienda (46 del
 * cliente, 42 de Driver) pintó la franja «PRUEBAS» en la pantalla de entrar de todo el mundo:
 * la franja se calculaba al cargar el archivo, dentro de un círculo de importaciones, cuando la
 * dirección del servidor todavía no tenía valor, y «sin valor» contaba como «de pruebas».
 */
const movil = join(__dirname, '..', '..', 'movil', 'src');
const leer = (archivo: string) => readFileSync(join(movil, archivo), 'utf8');

describe('la franja «PRUEBAS» solo sale en la app de pruebas', () => {
  it('una dirección sin valor no convierte la app en «de pruebas»', () => {
    expect(esAppDePruebas(undefined as unknown as string)).toBe(false);
    expect(esAppDePruebas('')).toBe(false);
    expect(esAppDePruebas('https://divoox.com')).toBe(false);
    expect(esAppDePruebas('https://staging.tumbite.com')).toBe(true);
    expect(esAppDePruebas('http://localhost:8787')).toBe(true);
  });

  it('la dirección del servidor vive en un archivo que no importa nada de la app', () => {
    const importaciones = leer('servidor.ts').match(/^import .*$/gm) ?? [];
    expect(importaciones).toEqual([
      "import { elegirServidor } from '@tumbite/compartido/src/entornos';",
    ]);
    // Y nadie más la calcula por su cuenta.
    const quienes = readdirSync(movil)
      .filter((a) => /\.tsx?$/.test(a) && !a.includes('.test.'))
      .filter((a) => /elegirServidor\(/.test(leer(a)));
    expect(quienes).toEqual(['servidor.ts']);
  });

  it('la franja se decide al pintar, nunca al cargar el archivo', () => {
    const franja = leer('FranjaPruebas.tsx');
    expect(franja).not.toMatch(/^export const \w+ = .*esAppDePruebas\(/m);
    expect(franja).toContain("from './servidor'");
    expect(franja).toMatch(/visible \?\? esEstaAppDePruebas\(\)/);
    for (const a of readdirSync(movil).filter((x) => /\.tsx?$/.test(x) && !x.includes('.test.')))
      expect(leer(a), a).not.toMatch(/^(export )?const \w+ = [^\n]*esAppDePruebas\(/m);
  });
});
