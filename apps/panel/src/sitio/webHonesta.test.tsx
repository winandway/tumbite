import { describe, expect, it } from 'vitest';
import { CIUDADES } from './cobertura';
import { CONTACTO, TEXTOS_SITIO } from './textos';

/**
 * Punto 33 y F17 (C-WEB-HONESTA): la web solo promete lo que existe. Lo que todavía no está dice
 * «muy pronto» (o «coming soon»), hay un solo buzón público y Miami no figura como abierta hasta
 * el lanzamiento público (decisión de Richard ese día).
 */
describe('la web solo promete lo que existe (C-WEB-HONESTA)', () => {
  const es = JSON.stringify(TEXTOS_SITIO.es);
  const en = JSON.stringify(TEXTOS_SITIO.en);

  it('un solo buzón público: support@divoox.com', () => {
    expect(CONTACTO).toBe('support@divoox.com');
    for (const t of [es, en]) {
      expect(t).not.toMatch(/hello@tumbite|sales@tumbite|ventas@tumbite/);
    }
  });

  it('Apple Pay y Google Pay, promociones destacadas y ayuda con fotos dicen «muy pronto»', () => {
    expect(es).toMatch(/Apple Pay y Google Pay, muy pronto/);
    expect(en).toMatch(/Apple Pay and Google Pay, coming soon/);
    expect(es).toMatch(/Promociones destacadas en el inicio de la app: muy pronto/);
    expect(en).toMatch(/Featured promotions on the app’s home: coming soon/);
    expect(es).toMatch(/Ayuda con fotos y marketing: muy pronto/);
    expect(en).toMatch(/Help with photos and marketing: coming soon/);
  });

  it('la música en vivo se presenta como lo que viene, no como algo que ya pasa', () => {
    expect(es).toMatch(/Es lo que viene/);
    expect(en).toMatch(/It’s what’s coming/);
  });

  it('ninguna ciudad figura como abierta antes del lanzamiento público', () => {
    expect(CIUDADES.find((c) => c.slug === 'miami')?.estado).toBe('pronto');
    expect(CIUDADES.filter((c) => c.estado === 'activo')).toEqual([]);
  });
});
