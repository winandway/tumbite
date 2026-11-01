import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  anuncioPara,
  olvidarAnuncios,
  recordarAnuncio,
} from '../../../apps/cliente/src/comida/anuncioTocado';

// C-ANUNCIOS en la app del cliente: el anuncio tocado viaja en el pedido de ESE restaurante.
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('C-ANUNCIOS: anuncio tocado en la app', () => {
  afterEach(() => olvidarAnuncios());

  it('recuerda el anuncio del restaurante tocado y anota el toque', () => {
    const pedir = vi.fn().mockResolvedValue({ ok: true });
    recordarAnuncio({ pedir }, { id: 'r1', anuncioId: 'c1' });
    expect(anuncioPara('r1')).toBe('c1');
    expect(anuncioPara('r2')).toBeUndefined();
    expect(pedir).toHaveBeenCalledWith('POST', '/datos/anuncios/c1/toque', {});
  });

  it('un restaurante sin anuncio no deja nada', () => {
    const pedir = vi.fn().mockResolvedValue({});
    recordarAnuncio({ pedir }, { id: 'r1' });
    expect(anuncioPara('r1')).toBeUndefined();
    expect(pedir).not.toHaveBeenCalled();
  });

  it('el carrito manda el anuncio y las tarjetas dicen «Patrocinado»', () => {
    expect(leer('apps', 'cliente', 'src', 'app', 'cart.tsx')).toContain(
      'anuncioId: anuncioPara(carrito.restauranteId)',
    );
    for (const f of [
      ['apps', 'cliente', 'src', 'inicio', 'Restaurantes.tsx'],
      ['apps', 'cliente', 'src', 'app', 'restaurants.tsx'],
    ])
      expect(leer(...f)).toContain("'Patrocinado'");
  });
});
