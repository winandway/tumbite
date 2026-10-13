import { describe, expect, it } from 'vitest';
import { fechaBase, semaforoPedido } from './semaforo';

const AHORA = fechaBase('2026-10-12 20:30:00');
const hace = (min: number) =>
  new Date(AHORA - min * 60000).toISOString().slice(0, 19).replace('T', ' ');

describe('semáforo del pedido (C-MANAGER-1)', () => {
  it('pagado sin aceptar: verde, amarillo a los 3 y rojo a los 6 minutos', () => {
    const p = (m: number) =>
      semaforoPedido({ estado: 'pagado', creadoEn: hace(m), pagadoEn: hace(m) }, AHORA);
    expect(p(2)?.luz).toBe('verde');
    expect(p(3)?.luz).toBe('amarillo');
    expect(p(6)?.luz).toBe('rojo');
    expect(p(6)?.motivo).toBe('restaurante');
  });
  it('en cocina se compara con el tiempo que prometió el restaurante', () => {
    const p = (m: number) =>
      semaforoPedido(
        { estado: 'aceptado', creadoEn: hace(60), aceptadoEn: hace(m), tiempoPrepMin: 15 },
        AHORA,
      );
    expect(p(15)?.luz).toBe('verde');
    expect(p(16)?.luz).toBe('amarillo');
    expect(p(25)?.luz).toBe('rojo');
  });
  it('lista sin repartidor y en camino tienen sus propios límites', () => {
    expect(
      semaforoPedido({ estado: 'listo', creadoEn: hace(60), listoEn: hace(15) }, AHORA)?.luz,
    ).toBe('rojo');
    expect(
      semaforoPedido({ estado: 'en_camino', creadoEn: hace(60), recogidoEn: hace(20) }, AHORA)?.luz,
    ).toBe('verde');
  });
  it('entregado y cancelado no llevan semáforo; las fechas sin zona son UTC', () => {
    expect(semaforoPedido({ estado: 'entregado', creadoEn: hace(5) }, AHORA)).toBeNull();
    expect(fechaBase('2026-10-12 20:30:00')).toBe(Date.parse('2026-10-12T20:30:00Z'));
  });
});
