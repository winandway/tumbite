import { describe, expect, it } from 'vitest';
import { cuentaDelConductor, esQuienPaga, repartirComision } from './quienPaga';

describe('C-QUIEN-PAGA-VIAJES · reparto de la comisión', () => {
  it('conductor: como siempre, nada para el pasajero', () => {
    expect(repartirComision(20, 'conductor')).toEqual({ tarifaServicio: 0, parteConductor: 20 });
  });
  it('cliente: la comisión entera es la tarifa de servicio', () => {
    expect(repartirComision(20, 'cliente')).toEqual({ tarifaServicio: 20, parteConductor: 0 });
  });
  it('mitad: mitad y mitad; el centavo impar lo pone el conductor', () => {
    expect(repartirComision(20, 'mitad')).toEqual({ tarifaServicio: 10, parteConductor: 10 });
    expect(repartirComision(21, 'mitad')).toEqual({ tarifaServicio: 10, parteConductor: 11 });
  });
  it('nunca negativo ni con decimales', () => {
    expect(repartirComision(-5, 'cliente')).toEqual({ tarifaServicio: 0, parteConductor: 0 });
    expect(repartirComision(10.9, 'cliente').tarifaServicio).toBe(10);
  });
  it('lo que ve el conductor: cobra 2,20 · 2,00 son tuyos · 0,20 de Divoox', () => {
    expect(cuentaDelConductor({ total: 220, comision: 20, tarifaServicio: 20 })).toEqual({
      cobra: 220,
      tuyo: 200,
      deDivoox: 20,
      tarifaServicio: 20,
    });
    expect(cuentaDelConductor({ total: 210, comision: 20, tarifaServicio: 10 }).tuyo).toBe(190);
  });
  it('solo acepta los tres valores', () => {
    expect(esQuienPaga('mitad')).toBe(true);
    expect(esQuienPaga('restaurante')).toBe(false);
  });
});
