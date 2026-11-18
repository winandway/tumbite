import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Revisión de calidad del 18 nov (C-INICIO-NUEVO). Las pantallas de React Native no se pintan en
 * node: se revisa su código.
 */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

describe('revisión del inicio nuevo', () => {
  it('borrar un lugar que falla dice «no se pudo borrar» y no deja la hoja muda', () => {
    const f = leer('viajes', 'LugaresFila.tsx');
    expect(f).not.toMatch(/void borrar\(\)\.then\(salir\)/);
    expect(f).toContain('t.noSeBorro');
    expect(leer('viajes', 'textosLugares.ts')).toMatch(/noSeBorro:/);
  });

  it('la portada se pide una sola vez, con la ciudad ya conocida', () => {
    const f = leer('Inicio.tsx');
    expect(f).toMatch(/if \(!servicios\) return;[\s\S]{0,400}rutaBanners\('cabecera'/);
  });

  it('el «Cerrar» de la hoja va en el idioma de la persona', () => {
    const f = leer('inicio', 'HojaAbajo.tsx');
    expect(f).not.toContain('accessibilityLabel="Cerrar"');
    expect(f).toMatch(/idioma === 'en' \? 'Close' : 'Cerrar'/);
  });

  it('volver al viaje se reintenta si no hubo red al abrir', () => {
    const f = leer('viajes', 'useVolverAlViaje.ts');
    expect(f).toMatch(/yaRevisado = false/);
    expect(f).toContain('setTimeout');
  });
});
