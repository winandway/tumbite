import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAVES_FORMA_PAGO, nombreFormaPago } from './formaDePago';

/** C-FORMA-PAGO-TEXTO: ninguna pantalla muestra «pago_movil» ni otra clave cruda. */
describe('C-FORMA-PAGO-TEXTO', () => {
  it('cada forma de pago tiene nombre en los dos idiomas, sin claves crudas', () => {
    for (const k of CLAVES_FORMA_PAGO)
      for (const i of ['es', 'en'] as const) {
        const n = nombreFormaPago(k, i);
        expect(n).toBeTruthy();
        expect(n).not.toContain('_');
      }
    expect(nombreFormaPago('pago_movil', 'es')).toBe('Pago móvil');
    expect(nombreFormaPago('transferencia_repartidor', 'en')).toBe('Bank transfer');
    expect(nombreFormaPago('algo_nuevo', 'es')).toBe('Algo nuevo');
  });

  it('las pantallas no pintan la clave de la forma de pago ni del tipo de cuenta sin traducir', () => {
    const raiz = join(__dirname, '..', '..', '..');
    const carpetas = [
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'apps/panel/src',
      'packages/movil/src',
    ];
    const crudos: string[] = [];
    const recorrer = (d: string) => {
      for (const n of readdirSync(d)) {
        const r = join(d, n);
        if (statSync(r).isDirectory()) recorrer(r);
        else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) {
          const s = readFileSync(r, 'utf8');
          // Un valor de forma de pago o de tipo de cuenta pintado tal cual dentro de JSX.
          if (/\{\s*[\w.?]*(cuentaCobro\.tipo|metodoPago|metodo_pago)\s*\}/.test(s)) crudos.push(r);
        }
      }
    };
    for (const c of carpetas) recorrer(join(raiz, c));
    expect(crudos).toEqual([]);
  });
});
