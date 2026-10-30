import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PERMISOS_CLAVE_API,
  fechaHoraLocal,
  textoAccionFlex,
  textoPermisoClave,
} from '@tumbite/compartido';

/**
 * C-FLEX-ACTIVIDAD (30 oct 2026): la actividad reciente del panel de Flex mostraba códigos internos
 * («empresa.crear») y los permisos de las claves salían como códigos sueltos. Cada acción que el
 * servidor anota tiene su frase en los dos idiomas.
 */
const CARPETA = join(__dirname, '..');
const accionesDelServidor = () => {
  const vistas = new Set<string>();
  const recorrer = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const ruta = join(d, f.name);
      if (f.isDirectory()) recorrer(ruta);
      else if (f.name.endsWith('.ts') && !f.name.endsWith('.test.ts')) {
        const s = readFileSync(ruta, 'utf8');
        for (const m of s.matchAll(/sentenciaAuditoria\([^']*'([a-z_]+\.[a-z_.]+)'/g))
          vistas.add(m[1]!);
      }
    }
  };
  recorrer(CARPETA);
  return [...vistas];
};

describe('C-FLEX-ACTIVIDAD', () => {
  it('cada acción que anota el servidor tiene su frase en español e inglés', () => {
    const acciones = accionesDelServidor();
    expect(acciones.length).toBeGreaterThan(30);
    for (const a of acciones)
      for (const idioma of ['es', 'en'] as const) {
        const t = textoAccionFlex(a, idioma);
        expect(t, `${a} (${idioma})`).not.toBe(a);
        expect(t).not.toMatch(/[a-z]\.[a-z]/);
        expect(t, `${a} sin frase propia`).not.toBe(textoAccionFlex('algo.nuevo', idioma));
      }
    expect(textoAccionFlex('empresa.crear', 'es')).toBe('Creó la empresa');
    expect(textoAccionFlex('empresa.crear', 'en')).toBe('Created the company');
  });

  it('una acción nueva sin frase no muestra el código pelado', () => {
    expect(textoAccionFlex('algo.nuevo', 'es')).toBe('Cambio en la empresa');
  });

  it('cada permiso de las claves tiene su nombre claro', () => {
    for (const p of PERMISOS_CLAVE_API) {
      expect(textoPermisoClave(p, 'es')).not.toBe(p);
      expect(textoPermisoClave(p, 'en')).not.toBe(p);
    }
    expect(textoPermisoClave('envios.crear', 'en')).toBe('Create shipments');
  });
});

describe('C-FLEX-ACTIVIDAD: la hora', () => {
  it('se muestra en la hora local y en el idioma, no en el formato de la base', () => {
    const es = fechaHoraLocal('2026-10-30 12:23:05', 'es', 'America/New_York');
    const en = fechaHoraLocal('2026-10-30 12:23:05', 'en', 'America/New_York');
    expect(es).toMatch(/30 oct 2026/);
    expect(es).toMatch(/8:23/);
    expect(en).toMatch(/Oct 30, 2026/);
    expect(en).toMatch(/8:23\sAM/);
    expect(fechaHoraLocal('no es fecha', 'es')).toBe('no es fecha');
  });
});
