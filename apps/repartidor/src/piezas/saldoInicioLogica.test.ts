import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tarjetaSaldoInicio } from './saldoInicioLogica';

/**
 * C-SALDO-EN-INICIO (paquete 12, 19 nov 2026). Donde el país cobra la comisión del saldo prepago del
 * conductor (Venezuela), el inicio de Driver muestra su saldo, con aviso en rojo cuando se acaba, y
 * lleva a Ganancias para recargar. En EE. UU. (Stripe Connect, sin prepago) no sale nada. Mirar el
 * inicio solo LEE el saldo (GET), nunca escribe en la base.
 *
 * Visto en ROJO el 19 nov 2026: sin `saldoInicioLogica.ts` este archivo no compilaba, y el inicio no traía
 * la tarjeta `saldo-inicio`.
 */
const base = { disponible: 0, moneda: 'USD' };

describe('C-SALDO-EN-INICIO: la tarjeta del saldo en el inicio de Driver', () => {
  it('sin prepago en el país (EE. UU.) no se muestra', () => {
    expect(tarjetaSaldoInicio(null)).toBeNull();
    expect(tarjetaSaldoInicio({ ...base, disponible: 1500 })).toBeNull();
    expect(
      tarjetaSaldoInicio({
        ...base,
        comisionTipica: 0,
        comisionTipicaComida: 0,
        efectivoActivo: false,
        transferenciaActiva: false,
        recargasPuntoVenta: false,
      }),
    ).toBeNull();
  });

  it('con saldo de sobra va en verde y dice para cuántas carreras alcanza', () => {
    expect(
      tarjetaSaldoInicio({ ...base, disponible: 2000, comisionTipica: 100, carrerasAlcanzan: 20 }),
    ).toEqual({ nivel: 'ok', alcanza: { tipo: 'carreras', n: 20 }, soloCarreras: true });
  });

  it('con poco saldo avisa (bajo)', () => {
    expect(
      tarjetaSaldoInicio({
        ...base,
        disponible: 200,
        comisionTipica: 100,
        carrerasAlcanzan: 2,
        saldoBajo: true,
      })?.nivel,
    ).toBe('bajo');
    // Solo comida en mano: menos de 3 pedidos también es bajo.
    expect(
      tarjetaSaldoInicio({
        ...base,
        disponible: 150,
        efectivoActivo: true,
        comisionTipicaComida: 70,
        pedidosAlcanzan: 2,
      }),
    ).toEqual({ nivel: 'bajo', alcanza: { tipo: 'pedidos', n: 2 }, soloCarreras: false });
  });

  it('sin saldo (o sin lo que cuesta una comisión) dice que no le llegan', () => {
    expect(tarjetaSaldoInicio({ ...base, disponible: 0, comisionTipica: 100 })?.nivel).toBe('sin');
    expect(
      tarjetaSaldoInicio({
        ...base,
        disponible: 50,
        comisionTipica: 100,
        carrerasAlcanzan: 0,
        sinSaldo: true,
      })?.nivel,
    ).toBe('sin');
    // Le alcanza para comida aunque no para una carrera: es bajo, no «sin».
    expect(
      tarjetaSaldoInicio({
        ...base,
        disponible: 80,
        comisionTipica: 100,
        carrerasAlcanzan: 0,
        sinSaldo: true,
        comisionTipicaComida: 40,
        pedidosAlcanzan: 2,
        sinSaldoComida: false,
      })?.nivel,
    ).toBe('bajo');
  });

  it('C-COMIDA-VE-QUIEN-PAGA: con la comida sin comisión, el saldo en cero no le quita los pedidos', () => {
    // Solo comida con pago directo y 0 % sobre el envío: nada sale del saldo, no hay problema.
    expect(
      tarjetaSaldoInicio({
        ...base,
        disponible: 0,
        efectivoActivo: true,
        transferenciaActiva: true,
        comisionTipicaComida: 0,
        comidaEnvioEntero: true,
      }),
    ).toEqual({ nivel: 'ok', alcanza: null, soloCarreras: false });
    // Con carreras que sí cobran: «sin», pero el aviso habla solo de carreras.
    expect(
      tarjetaSaldoInicio({
        ...base,
        disponible: 0,
        comisionTipica: 100,
        sinSaldo: true,
        efectivoActivo: true,
        comisionTipicaComida: 0,
        comidaEnvioEntero: true,
      }),
    ).toEqual({ nivel: 'sin', alcanza: null, soloCarreras: true });
    const raiz = join(import.meta.dirname, '..', '..', '..', '..');
    const pieza = readFileSync(join(raiz, 'apps/repartidor/src/piezas/SaldoInicio.tsx'), 'utf8');
    expect(pieza).toContain('t.inicioSinCarreras');
    const inicio = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
    expect(inicio).toContain('prepago.comidaEnvioEntero');
  });

  it('el inicio la muestra, la lee con GET y lleva a Ganancias para recargar', () => {
    const raiz = join(import.meta.dirname, '..', '..', '..', '..');
    const i = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
    expect(i).toContain('<SaldoInicio');
    // Al estar en el inicio se lee el saldo con GET (nada de escribir por mirar).
    expect(i).toMatch(
      /if \(vista !== 'inicio'\) return;[\s\S]{0,200}'GET', '\/datos\/repartidor\/saldo-prepago'/,
    );
    const pieza = readFileSync(join(raiz, 'apps/repartidor/src/piezas/SaldoInicio.tsx'), 'utf8');
    expect(pieza).toContain('testID="saldo-inicio"');
    expect(pieza).toContain('alRecargar');
  });
});
