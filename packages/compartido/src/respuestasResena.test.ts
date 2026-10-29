import { describe, expect, it } from 'vitest';
import { respuestasSugeridas } from './respuestasResena';

// C-RESENAS-SUGERIDAS: buenas y malas reseñas tienen su respuesta, con el primer nombre.
describe('C-RESENAS-SUGERIDAS', () => {
  it('agradece las buenas y se disculpa en las malas, sin prometer dinero', () => {
    expect(respuestasSugeridas(5, 'Ana López', 'es')[0]).toMatch(/^¡Gracias por tu pedido, Ana!/);
    expect(respuestasSugeridas(2, 'Ana López', 'en')[0]).toMatch(/^We’re sorry .*, Ana\./);
    for (const t of [
      ...respuestasSugeridas(1, 'Ana', 'es'),
      ...respuestasSugeridas(1, 'Ana', 'en'),
    ])
      expect(t).not.toMatch(/\$|reembolso|refund|gratis|free|descuento|discount/i);
  });
  it('sin nombre no deja una coma suelta', () => {
    expect(respuestasSugeridas(5, '', 'es')[0]).toBe(
      '¡Gracias por tu pedido! Nos alegra que te gustara. Te esperamos pronto.',
    );
  });
});
