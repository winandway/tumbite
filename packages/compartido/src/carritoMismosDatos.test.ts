import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { huellaPedido } from './huellaPedido';

const fuente = readFileSync(
  join(__dirname, '..', '..', '..', 'apps', 'cliente', 'src', 'app', 'cart.tsx'),
  'utf8',
);

// C-COBRO-MISMOS-DATOS (11 nov 2026): tras «Continuar al pago» el pedido ya existe. Si el cliente
// cambia la dirección, el apto, las notas, alergias, puerta o mano, PIN o regalo sin cambiar el
// total, el cobro viejo ya no sirve: se crea el pedido de nuevo.
describe('C-COBRO-MISMOS-DATOS', () => {
  const cuerpo = {
    restauranteId: 'r1',
    lineas: [{ platoId: 'p1', cantidad: 1, opciones: [] }],
    direccion: '100 Main St',
    apto: '',
    notas: '',
    alergias: '',
    entrega: 'puerta',
    pin: true,
    paraOtro: null,
  };

  it('el orden de las claves no cambia la huella', () => {
    const alReves = Object.fromEntries(Object.entries(cuerpo).reverse());
    expect(huellaPedido(alReves)).toBe(huellaPedido(cuerpo));
  });

  it('cualquier dato distinto cambia la huella aunque el total sea el mismo', () => {
    for (const cambio of [
      { apto: '4B' },
      { direccion: '200 Main St' },
      { notas: 'Timbre roto' },
      { alergias: 'Maní' },
      { entrega: 'mano' },
      { pin: false },
      { paraOtro: { nombre: 'Ana', telefono: '3055550100', mensaje: '' } },
      { lineas: [{ platoId: 'p1', cantidad: 1, opciones: [], nota: 'Sin cebolla' }] },
    ])
      expect(huellaPedido({ ...cuerpo, ...cambio })).not.toBe(huellaPedido(cuerpo));
  });

  it('el carrito solo reutiliza el cobro si la huella del cuerpo enviado es la misma', () => {
    expect(fuente).toMatch(/cobroGuardado\.huella === huella/);
    expect(fuente).toMatch(/setCobro\(\{[^}]*huella/);
  });
});
