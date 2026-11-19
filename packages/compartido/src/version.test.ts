import { describe, expect, it } from 'vitest';
import {
  commitCorto,
  crearInfoVersion,
  textoVersion,
  versionDeCompilacion,
  versionLimpia,
} from './version';

describe('versión del artefacto (C-VERSION-DEL-ARTEFACTO)', () => {
  it('corta el commit a 7 caracteres', () => {
    expect(commitCorto('A74309F9b2c1d0e8f7a6b5c4d3e2f1a0b9c8d7e6')).toBe('a74309f');
  });
  it('sin commit, o con algo que no es un commit, dice «local» (nunca inventa uno)', () => {
    for (const v of [undefined, null, '', 'local', '<script>', 'abc', 'zzzzzzz'])
      expect(commitCorto(v)).toBe('local');
  });
  it('la versión solo acepta 1.2.3', () => {
    expect(versionLimpia('0.1.0')).toBe('0.1.0');
    expect(versionLimpia('1.0.0-beta')).toBe('0.0.0');
    expect(versionLimpia(undefined)).toBe('0.0.0');
  });
  // C-VERSION-VISIBLE (18 nov 2026): la versión visible cambia con CADA compilación: 0.1.<número de
  // compilación de la tienda> (0.1.47 para la compilación 47), el mismo número que versionCode de
  // Android y buildNumber de iPhone. Antes todas decían «0.1.0» y soporte no podía distinguirlas.
  it('la versión de una compilación de la tienda es 0.1.<compilación>', () => {
    expect(versionDeCompilacion('0.1.0', '47')).toBe('0.1.47');
    expect(versionDeCompilacion('0.1.46', '47')).toBe('0.1.47');
    expect(versionDeCompilacion('1.2.0', '9')).toBe('1.2.9');
    // Sin compilación (la web) o con algo que no es un número, la de app.json.
    expect(versionDeCompilacion('0.1.0', null)).toBe('0.1.0');
    expect(versionDeCompilacion('0.1.0', 'x; y')).toBe('0.1.0');
    expect(versionDeCompilacion(undefined, '47')).toBe('0.0.47');
  });
  it('el texto sale en los dos idiomas: «Versión 0.1.47 (47)» con la compilación de la tienda', () => {
    const v = crearInfoVersion('0.1.0', 'a74309f9');
    expect(textoVersion(v, 'es')).toBe('Versión 0.1.0 · a74309f');
    expect(textoVersion(v, 'es', '47')).toBe('Versión 0.1.47 (47) · a74309f');
    expect(textoVersion(v, 'en', '47')).toBe('Version 0.1.47 (47) · a74309f');
    expect(textoVersion(v, 'en', 'x; y')).toBe('Version 0.1.0 · a74309f');
  });
});
