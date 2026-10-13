import { describe, expect, it } from 'vitest';
import { direccionNueva, enIdiomaDireccion, panelNuevo } from './rutasPublicas';

describe('direcciones públicas en inglés (C-INGLES-PRINCIPAL)', () => {
  it('cada dirección vieja en español tiene su nueva en inglés', () => {
    expect(direccionNueva('/privacidad')).toBe('/privacy');
    expect(direccionNueva('/terminos-restaurantes')).toBe('/restaurant-terms');
    expect(direccionNueva('/borrar-cuenta')).toBe('/delete-account');
    expect(direccionNueva('/pais/brasil')).toBe('/country/brazil');
    expect(direccionNueva('/pais/colombia')).toBe('/country/colombia');
    expect(direccionNueva('/ciudad/miami')).toBe('/city/miami');
    expect(direccionNueva('/comida/postres')).toBe('/food/desserts');
    expect(direccionNueva('/docs/comensales/cancelar')).toBe('/docs/ordering/cancel-order');
    expect(direccionNueva('/docs/confianza')).toBe('/docs/trust');
    expect(direccionNueva('/billetera/lista')).toBe('/wallet/ready');
  });
  it('lo que ya está en inglés no se toca', () => {
    expect(direccionNueva('/privacy')).toBeNull();
    expect(direccionNueva('/docs/ordering/cancel-order')).toBeNull();
    expect(direccionNueva('/panel/pedidos')).toBeNull();
  });
  it('el inglés no lleva prefijo y el español va bajo /es', () => {
    expect(enIdiomaDireccion('/terms', 'en')).toBe('/terms');
    expect(enIdiomaDireccion('/terms', 'es')).toBe('/es/terms');
    expect(enIdiomaDireccion('/', 'es')).toBe('/es');
  });
  it('el panel también pasa a inglés, sin tocar los códigos', () => {
    expect(panelNuevo('/panel/pedidos')).toBe('/panel/orders');
    expect(panelNuevo('/panel/control-0bc2aa8f/kyc/1234')).toBe(
      '/panel/control-0bc2aa8f/verifications/1234',
    );
    expect(panelNuevo('/panel/franquicia-miami-abc')).toBe('/panel/franchise-miami-abc');
    expect(panelNuevo('/panel/orders')).toBeNull();
    expect(panelNuevo('/panel')).toBeNull();
  });
});
