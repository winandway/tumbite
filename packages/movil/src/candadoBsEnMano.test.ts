import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-BS-EN-MANO (18 nov 2026, Venezuela): todo lo que se cobra o se paga en mano se ve en dólares y en
 * bolívares con la tasa fijada, con UNA sola pieza (`MontoEnMano`), en Driver y en el cliente. Si una
 * pantalla vuelve a mostrar solo el «≈ Bs.» suelto (o nada) donde se cobra en mano, esto se pone en rojo.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-BS-EN-MANO: la pieza única en cada pantalla donde se cobra o se paga en mano', () => {
  it('Driver: la oferta, la tarjeta del viaje y el cobro al terminar', () => {
    expect(leer('apps/repartidor/src/viajes/OfertaViaje.tsx')).toMatch(
      /<MontoEnMano[\s\S]{0,200}oferta\.enMano/,
    );
    const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    expect(v).toMatch(/testID="viaje-bs"[\s\S]{0,80}monto=\{cobroEnMano\(false\)\}/);
    expect(v).toMatch(/testID="viaje-cobra-monto"[\s\S]{0,80}monto=\{cobroEnMano\(true\)\}/);
    // El cobro en mano también se ve con pago móvil (no solo en efectivo).
    // C-PAGO-A-CELULAR: «aCelular» es pago móvil (Venezuela), Yape o Plin (Perú).
    expect(v).toMatch(/const aCelular = esPagoACelular\(viaje\.metodo_pago\)/);
    // C-SALDO-CLIENTE: también con el viaje pagado con saldo (lo que queda en mano, o «no cobras nada»).
    expect(v).toMatch(
      /cobraEnManoMetodo =\s*viaje\.metodo_pago === 'efectivo' \|\|\s*viaje\.metodo_pago === 'saldo' \|\|\s*esPagoACelular\(viaje\.metodo_pago\)/,
    );
    expect(v).toMatch(/cobraEnManoMetodo && enMano != null/);
  });

  it('cliente: el precio antes de pedir, el viaje en curso y el recibo', () => {
    expect(leer('apps/cliente/src/viajes/PedirMoto.tsx')).toMatch(
      /<MontoEnMano[\s\S]{0,120}cotizacion\.enMano/,
    );
    expect(leer('apps/cliente/src/viajes/ViajeEnCurso.tsx')).toMatch(
      /<MontoEnMano[\s\S]{0,120}viaje\.enMano/,
    );
    expect(leer('apps/cliente/src/viajes/MisViajes.tsx')).toMatch(
      /<MontoEnMano[\s\S]{0,200}r\.enManoLocal/,
    );
  });

  it('comida con pago al recibir: el cliente ve lo mismo que cobra el repartidor', () => {
    const s = leer('apps/cliente/src/app/order/[id].tsx');
    expect(s).toMatch(/<MontoEnMano\s+testID="pedido-en-mano"[\s\S]{0,120}p\.enMano/);
  });

  it('pago móvil: los bolívares exactos, grandes y con botón de copiar (conductor y cliente)', () => {
    const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    expect(v).toMatch(/testID="viaje-pago-movil-monto"[\s\S]{0,200}tamano="grande"\s+copiable/);
    expect(v).not.toMatch(/` \(\$\{textoLocal/);
    expect(leer('apps/cliente/src/viajes/ViajeEnCurso.tsx')).toMatch(
      /copiable=\{esPagoACelular\(viaje\.metodoPago\)/,
    );
    const m = leer('packages/movil/src/MontoEnMano.tsx');
    expect(m).toMatch(/Portapapeles\.setStringAsync\(montoParaCopiar/);
  });

  it('la pieza dice la tasa usada y, sin tasa, lo dice en palabras', () => {
    const s = leer('packages/movil/src/MontoEnMano.tsx');
    expect(s).toMatch(/textoTasaUsada\(monto\.local/);
    expect(s).toMatch(/monto\.sinTasa \?[\s\S]{0,200}textoSinTasa/);
  });
});
