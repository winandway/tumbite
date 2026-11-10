import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appsDeMapa } from './mapas';

/** C-ELEGIR-MAPAS (todos los países): el repartidor elige con qué app navega, también en comida. */
describe('apps de mapas para «Cómo llegar»', () => {
  it('en Android ofrece Google Maps y Waze; en iPhone además Apple Maps, primero', () => {
    const destino = { lat: 25.77, lng: -80.19 };
    expect(appsDeMapa('android', destino).map((a) => a.id)).toEqual(['google', 'waze']);
    expect(appsDeMapa('ios', destino).map((a) => a.id)).toEqual(['apple', 'google', 'waze']);
    expect(appsDeMapa('android', destino)[1]?.url).toBe(
      'https://waze.com/ul?ll=25.77,-80.19&navigate=yes',
    );
  });

  it('sin coordenadas navega por la dirección escrita', () => {
    const [google, waze] = appsDeMapa('android', {
      lat: null,
      lng: null,
      direccion: '100 Calle de Prueba',
    });
    expect(google?.url).toContain('destination=100%20Calle%20de%20Prueba');
    expect(waze?.url).toContain('q=100%20Calle%20de%20Prueba');
  });

  it('candado: ninguna pantalla del repartidor arma el enlace del mapa por su cuenta', () => {
    const raiz = join(__dirname, '../../../apps/repartidor/src');
    const fuentes = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const r = join(dir, n);
        if (statSync(r).isDirectory()) return fuentes(r);
        return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [r] : [];
      });
    const sueltos = fuentes(raiz).filter((f) => {
      if (f.endsWith('comoLlegar.ts')) return false;
      return /maps\.apple\.com|google\.com\/maps\/dir|waze\.com\/ul/.test(readFileSync(f, 'utf8'));
    });
    expect(sueltos.map((f) => f.slice(raiz.length + 1))).toEqual([]);
  });
});
