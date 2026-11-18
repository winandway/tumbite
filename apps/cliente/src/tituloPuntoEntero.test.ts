import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tituloPuntoExacto } from '@tumbite/compartido';

/**
 * C-TITULO-PUNTO-ENTERO (robot de Android, 18 nov 2026): a 360 de ancho, «Confirma el punto de
 * encuentro» no cabía en un renglón y Android lo cortaba por los dos lados («:onfirma … encuen·r·»).
 * El título del punto en el mapa va hasta en dos renglones y, en Android, con la letra que se ajusta.
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, r), 'utf8');
const titulo = (s: string) => {
  const i = s.indexOf('{tituloPuntoExacto(idioma, tipo)}');
  return s.slice(s.lastIndexOf('<Text', i), i);
};

describe('el título del punto en el mapa se ve entero', () => {
  it('en el celular: dos renglones, letra que se ajusta y medición simple', () => {
    const t = titulo(leer('PuntoExacto.tsx'));
    expect(t).toContain('numberOfLines={2}');
    expect(t).toContain('adjustsFontSizeToFit');
    expect(t).toContain('textBreakStrategy="simple"');
    expect(t).toContain('flexShrink: 1');
  });
  it('en la web: dos renglones y cede su ancho', () => {
    const t = titulo(leer('PuntoExacto.web.tsx'));
    expect(t).toContain('numberOfLines={2}');
    expect(t).toContain('flexShrink: 1');
  });
  it('los títulos largos existen en los dos idiomas (por eso hace falta)', () => {
    expect(tituloPuntoExacto('es', 'encuentro').length).toBeGreaterThan(25);
    expect(tituloPuntoExacto('en', 'encuentro').length).toBeGreaterThan(20);
  });
});
