import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PRECIO-CON-REGALO (18 nov 2026, robot en el iPhone): el viaje cancelado decía «Precio fijo: $1.42»
 * aunque el viaje era gratis con el regalo. Toda pantalla del viaje muestra el precio con su regalo
 * por la pieza única (PrecioDelViaje / PrecioCompacto), nunca el total a secas.
 *
 * C-RECOGIDA-REAL: la recogida con el GPS viajaba como el texto «Punto de recogida» y así salía en
 * «Buscando tu moto», en el viaje y en «Mis viajes». Ahora viaja la calle real (o «Tu ubicación
 * actual» si no se pudo leer) y el formulario muestra «Tu ubicación actual» con la calle debajo.
 */
const leer = (archivo: string) => readFileSync(join(__dirname, archivo), 'utf8');

describe('el precio con regalo en todas las pantallas del viaje', () => {
  it('buscando, en camino, terminado y cancelado usan la pieza única', () => {
    const s = leer('ViajeEnCurso.tsx');
    expect(s).toContain('<PrecioCompacto');
    expect(s).toContain('<PrecioDelViaje');
    expect(s).not.toMatch(/monto\(viaje\.total\)/);
    expect(s).not.toMatch(/pagaEnMano\(viaje\.total/);
  });

  it('«Mis viajes» y el recibo también', () => {
    const s = leer('MisViajes.tsx');
    expect(s).toContain('<PrecioCompacto');
    expect(s).toContain('<PrecioDelViaje');
    expect(s).not.toMatch(/formatearMonto\(v\.total/);
    expect(s).not.toMatch(/monto\(r\.total \+ r\.propina\)/);
    expect(s).toMatch(/regalo\??: RegaloDelViaje \| null/);
  });
});

describe('la recogida viaja con su calle real', () => {
  it('el pedido nunca manda el texto genérico «Punto de recogida» como dirección', () => {
    const s = leer('PedirMoto.tsx');
    expect(s).not.toMatch(/\|\| t\.recogida\b/);
    expect(s).toContain('calleActual');
    expect(s).toContain('calleDelPunto(');
  });
  // C-AVISO-BORRADOR-JUSTO (robot de Android): con solo la recogida recuperada, elegir el destino
  // AHORA hacía aparecer «Recuperamos lo que estabas escribiendo». El aviso mira lo recuperado al
  // abrir, no lo que la persona escribe después.
  it('el aviso de borrador sale solo si al abrir ya había un destino guardado', () => {
    const s = leer('PedirMoto.tsx');
    expect(s).toContain('destinoRecuperado');
    expect(s).not.toMatch(/visible=\{b\.recuperado && !rellenado && v\.destino/);
  });
  it('el formulario muestra «Tu ubicación actual» con la calle debajo', () => {
    const s = leer('PedirMoto.tsx');
    expect(s).toContain("'moto-recogida-calle'");
    expect(s).toMatch(/calleRecogida \? tn\.ubicacionActual : tn\.recogerEn/);
  });
});
