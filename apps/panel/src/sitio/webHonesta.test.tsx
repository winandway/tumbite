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

  it('un solo buzón público: el de soporte de Divoox (C-SOPORTE-UN-BUZON)', () => {
    expect(CONTACTO).toBe('soporte+divoox@windoce.com');
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

/**
 * C-WEB-AL-DIA (13 nov 2026, orden de Richard): la portada y «Cómo funciona» cuentan lo publicado
 * el 10, 11 y 13 de noviembre para comida, y no prometen lo que está apagado (los retiros al banco).
 * Todos los países.
 */
describe('la web está al día con lo publicado (C-WEB-AL-DIA)', async () => {
  const { PREGUNTAS_COMO_FUNCIONA } = await import('./ComoFunciona');
  const fuente = await import('./ComoFunciona?raw').then((m: { default: string }) => m.default);
  const es = JSON.stringify(TEXTOS_SITIO.es);
  const en = JSON.stringify(TEXTOS_SITIO.en);

  it('las apps de Android ya están en Google Play y el iPhone se instala desde Safari', () => {
    expect(es).not.toMatch(/apps para iPhone y Android llegan/);
    expect(en).not.toMatch(/iPhone and Android apps are coming/);
    expect(es).toMatch(/Google Play.*Safari/);
    expect(en).toMatch(/Google Play.*Safari/);
  });

  it('«Cómo llegar» con Google Maps, Waze o Apple Maps (C-ELEGIR-MAPAS) y entrega con PIN', () => {
    for (const t of [es, en, fuente]) {
      expect(t).toMatch(/Google Maps, Waze,? o?r? ?Apple Maps/);
      expect(t).toMatch(/PIN/);
    }
  });

  it('el plato que falta lo decide el cliente antes de «Listo» (C-LISTO-SIN-AJUSTE)', () => {
    expect(es).toMatch(/Falta un plato: el cliente decide/);
    expect(en).toMatch(/Missing an item\? The customer decides/);
    expect(fuente).toMatch(/antes de marcarlo listo/);
    expect(fuente).toMatch(/before marking it ready/);
  });

  it('no promete retiros al banco mientras están apagados (como la ficha de Google Play)', () => {
    for (const t of [es, en, fuente, JSON.stringify(PREGUNTAS_COMO_FUNCIONA)]) {
      expect(t).not.toMatch(/retiras a tu banco|retiro a tu banco|retira a su banco/);
      expect(t).not.toMatch(/[Cc]ash out to (your|their) bank|cash-out to your bank/);
      expect(t).not.toMatch(/Cobras en tu banco|Get paid to your bank/);
    }
  });
});
