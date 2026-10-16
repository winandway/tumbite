import { describe, expect, it } from 'vitest';
import { commitCorto, crearInfoVersion, textoVersion, versionLimpia } from './version';

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
  it('el texto sale en los dos idiomas, con la compilación de la tienda si la hay', () => {
    const v = crearInfoVersion('0.1.0', 'a74309f9');
    expect(textoVersion(v, 'es')).toBe('Versión 0.1.0 · a74309f');
    expect(textoVersion(v, 'en', '12')).toBe('Version 0.1.0 (12) · a74309f');
    expect(textoVersion(v, 'en', 'x; y')).toBe('Version 0.1.0 · a74309f');
  });
});
