import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { celularDePrueba } from '../../../e2e/recorrido/celularDePrueba';
import { leerTelefono } from './pais/telefono';

/**
 * C-CELULAR-DE-GUION (23 nov 2026, Gerencia): el recorrido del sitio de pruebas fallaba a ratos porque
 * cada guion armaba su celular con cifras del reloj y el registro, que valida el número de verdad
 * (C-TELEFONO-E164), lo rechazaba cuando el código de área no existía. Los guiones del sitio de
 * pruebas usan la pieza única `celularDePrueba`; la validación NO se relaja.
 */
const RECORRIDO = join(__dirname, '../../../e2e/recorrido');

describe('C-CELULAR-DE-GUION', () => {
  it('cada celular de guion existe en Estados Unidos y es un celular', () => {
    for (let i = 0; i < 5000; i++) {
      const n = celularDePrueba();
      const r = leerTelefono(n, 'US', { soloCelular: true });
      expect(r.ok, n).toBe(true);
      if (r.ok) expect(r.telefono.pais).toBe('US');
    }
  });

  it('no se repiten a cada rato: cinco mil seguidos dan casi cinco mil distintos', () => {
    const vistos = new Set(Array.from({ length: 5000 }, () => celularDePrueba()));
    expect(vistos.size).toBeGreaterThan(4900);
  });

  it('ningún guion arma un celular con cifras del reloj detrás de un «3» suelto', () => {
    const malos = readdirSync(RECORRIDO)
      .filter((a) => /Staging.*\.ts$/.test(a))
      .filter((a) =>
        /`3\$\{String\(Date\.now\(\)\)/.test(readFileSync(join(RECORRIDO, a), 'utf8')),
      );
    expect(malos).toEqual([]);
  });
});
