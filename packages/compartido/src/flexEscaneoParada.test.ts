import { describe, expect, it } from 'vitest';
import { faltanPorEscanear, paqueteDeEscaneo } from './flex';

/**
 * C-FLEX-ESCANEO-PARADA (31 oct 2026, como «Escanee los paquetes · 1 de 1» de Amazon Flex): en la
 * parada se escanea cada paquete antes de entregar, para no dejar uno equivocado en la puerta.
 */
const paquetes = [
  { id: 'a', codigoSeguimiento: 'DVXRBHDX4RBZT', codigoEtiqueta: 'ABCDEFGHJKLM' },
  { id: 'b', codigoSeguimiento: 'DVXZTSK5RQED6', codigoEtiqueta: 'NPQRSTUVWXYZ' },
];

describe('escanear en la parada', () => {
  it('reconoce el número de seguimiento y la etiqueta, sin importar mayúsculas', () => {
    expect(paqueteDeEscaneo('dvxrbhdx4rbzt', paquetes)).toBe('a');
    expect(paqueteDeEscaneo(' NPQRSTUVWXYZ ', paquetes)).toBe('b');
  });
  it('un paquete de otra parada no cuenta', () => {
    expect(paqueteDeEscaneo('DVXQUHFPHBGAP', paquetes)).toBeNull();
    expect(paqueteDeEscaneo('hola', paquetes)).toBeNull();
  });
  it('dice cuántos faltan de los que van en camino', () => {
    expect(faltanPorEscanear(['a', 'b'], new Set(['a']))).toBe(1);
    expect(faltanPorEscanear(['a', 'b'], new Set(['a', 'b']))).toBe(0);
  });
});
