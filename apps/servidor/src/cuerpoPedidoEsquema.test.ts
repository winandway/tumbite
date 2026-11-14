import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { armarCuerpoPedido, huellaPedido } from '@tumbite/compartido';
import { esquemaNuevoPedido } from './rutas/pedidos';

// C-COBRO-MISMOS-DATOS (revisión del 13 nov 2026): la huella del cobro se calcula sobre el cuerpo
// REAL que arma el carrito. Si el servidor acepta un campo que el carrito no manda dentro de ese
// cuerpo (o el carrito deja de mandar uno), un cambio en ese dato no cambiaría la huella y se
// reutilizaría un cobro con datos viejos. Esta prueba compara los dos, campo por campo.
const lleno = armarCuerpoPedido({
  restauranteId: 'r1',
  esTienda: true,
  lineas: [
    {
      platoId: 'p1',
      cantidad: 2,
      opciones: [{ id: 'o1' }],
      sustitucion: 'especifico',
      reemplazo: { platoId: 'p2' },
      nota: 'Sin cebolla',
    },
  ],
  propinaCentavos: 300,
  anuncioId: 'a1',
  usarSaldoRegalo: true,
  valores: {
    direccion: '100 Main St',
    apto: '4B',
    notas: 'Timbre roto',
    alergias: 'Maní',
    entrega: 'mano',
    pin: 'si',
    paraNombre: 'Ana',
    paraTelefono: '3055550100',
    paraMensaje: 'Feliz día',
  },
  comoRegalo: true,
  metodoPago: 'tarjeta',
  cupon: 'BIENVENIDO',
  punto: { lat: 25.77, lng: -80.19 },
  regalo: 'cumpleanos',
  programadoPara: '2026-11-14T18:00:00.000Z',
});

/** Campos que el servidor acepta pero que no son datos del pedido (no van en la huella). */
const FUERA_DE_LA_HUELLA = ['totalEsperado'];

describe('C-COBRO-MISMOS-DATOS: el cuerpo del carrito y el esquema del servidor', () => {
  it('el cuerpo real tiene exactamente los campos del esquema (menos el total)', () => {
    const delEsquema = Object.keys(esquemaNuevoPedido.shape)
      .filter((k) => !FUERA_DE_LA_HUELLA.includes(k))
      .sort();
    expect(Object.keys(lleno).sort()).toEqual(delEsquema);
  });

  it('cada línea tiene exactamente los campos de una línea del esquema', () => {
    const linea = esquemaNuevoPedido.shape.lineas.element.shape;
    expect(Object.keys(lleno.lineas[0] ?? {}).sort()).toEqual(Object.keys(linea).sort());
  });

  it('el servidor acepta el cuerpo real tal cual (más el total)', () => {
    const r = esquemaNuevoPedido.safeParse({ ...lleno, totalEsperado: 1000 });
    expect(r.success).toBe(true);
  });

  it('cambiar cualquiera de esos campos cambia la huella', () => {
    const base = huellaPedido(lleno);
    for (const k of Object.keys(lleno) as (keyof typeof lleno)[]) {
      const otro = { ...lleno, [k]: k === 'lineas' ? [] : `${String(lleno[k])}-x` };
      expect(huellaPedido(otro), k).not.toBe(base);
    }
  });

  it('el carrito arma el cuerpo con la pieza compartida y manda solo eso más el total', () => {
    const fuente = readFileSync(
      join(__dirname, '..', '..', 'cliente', 'src', 'app', 'cart.tsx'),
      'utf8',
    );
    expect(fuente).toMatch(/const cuerpoPedido = armarCuerpoPedido\(/);
    expect(fuente).toMatch(/const huella = huellaPedido\(cuerpoPedido\)/);
    const inicio = fuente.indexOf("api.pedir<Cobro>('POST', '/datos/pedidos', {");
    expect(inicio).toBeGreaterThan(0);
    const llamada = fuente
      .slice(inicio, fuente.indexOf('});', inicio))
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'));
    expect(llamada).toEqual(['...cuerpoPedido,', 'totalEsperado: d.totalCliente,']);
  });
});
