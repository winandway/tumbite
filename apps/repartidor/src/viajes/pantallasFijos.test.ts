import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Candados C-VIAJES-FIJOS del Driver (16 nov 2026): se revisa el código de las pantallas. */
const leer = (n: string) => readFileSync(join(__dirname, n), 'utf8');

describe('Driver: clientes fijos, oferta y viaje en curso', () => {
  it('«No puedo» y «Dejar este viaje fijo» piden confirmación; dejar va en los tres puntos', () => {
    const c = leer('ClientesFijos.tsx');
    expect(c).toContain('setNoPuedo(s)');
    expect(c).toContain('t.siNoPuedo');
    expect(c).toContain('setDejar(menu)');
    expect(c).toContain('t.siDejar');
    expect(c).toContain('puedeDecirNoPuedo(s, ahora)');
  });
  it('la oferta dice confianza, viaje fijo y menor, y dura un minuto si es de confianza', () => {
    const o = leer('OfertaViaje.tsx');
    expect(o).toContain('textoOfertaConfianza(oferta');
    expect(o).toMatch(/oferta\.deConfianza \? 60 : 30/);
  });
  it('en el viaje en curso se recuerda al menor', () => {
    expect(leer('ViajeActivo.tsx')).toContain('viaje.menor_nombre');
  });
  it('el conductor de Moto puede decir si lleva menores', () => {
    expect(leer('AltaPasajeros.tsx')).toContain('moto-acepta-menores');
    // C-VIAJES-FIJOS: su propia ruta (nace apagado), nunca el interruptor de categorías de Carro.
    expect(leer('AltaPasajeros.tsx')).toContain('/lleva-menores`');
    expect(leer('AltaPasajeros.tsx')).toContain('vehiculo.llevaMenores === true');
  });
  it('se llega desde la Cuenta y desde Mis datos (C-REDISENO-DRIVER)', () => {
    const i = readFileSync(join(__dirname, '..', 'Inicio.tsx'), 'utf8');
    const cuenta = readFileSync(join(__dirname, '..', 'rediseno', 'CuentaDriver.tsx'), 'utf8');
    expect(i).toContain("setVista('clientesFijos')");
    expect(cuenta).toContain("alIr('clientesFijos')");
  });
});
