import { describe, expect, it } from 'vitest';
import { type ItemComida, type ItemHito, puedePasar, unidadesQueCuentan } from './rewardsHitos';

// C-REWARDS-HITOS (30 oct 2026): estados sin pagos y antifraude distinto por servicio.
describe('estados de un hito', () => {
  it('nada salta a pagado sin pasar por ganado, y lo pagado o cancelado no se mueve', () => {
    expect(puedePasar('condicionado', 'pagado')).toBe(false);
    expect(puedePasar('ganado', 'pagado')).toBe(true);
    expect(puedePasar('pagado', 'cancelado')).toBe(false);
    expect(puedePasar('cancelado', 'ganado')).toBe(false);
    expect(puedePasar('sin_presupuesto', 'condicionado')).toBe(true);
  });
});

describe('antifraude por servicio', () => {
  const comida = (cliente: string, o: Partial<ItemComida> = {}): ItemHito => ({
    servicio: 'comida',
    cliente,
    pagado: true,
    reclamoAprobado: false,
    propio: false,
    ...o,
  });

  it('comida: máximo 3 por cliente, sin pedidos propios, sin reclamos ni impagos', () => {
    const r = unidadesQueCuentan([
      ...Array.from({ length: 5 }, () => comida('a')),
      comida('b', { propio: true }),
      comida('c', { reclamoAprobado: true }),
      comida('d', { pagado: false }),
      comida('e'),
    ]);
    expect(r.cuentan).toBe(4);
    expect(r.descartes).toEqual({
      tope_por_cliente: 2,
      pedido_propio: 1,
      reclamo_aprobado: 1,
      sin_pagar: 1,
    });
  });

  it('comida con pocos clientes distintos queda bloqueada (no se reparte con dos clientes amigos)', () => {
    const r = unidadesQueCuentan([
      ...Array.from({ length: 3 }, () => comida('a')),
      ...Array.from({ length: 3 }, () => comida('b')),
    ]);
    expect(r.bloqueo).toBe('pocos_clientes_distintos');
  });

  it('express: los viajes de menos de 1 km no cuentan', () => {
    const r = unidadesQueCuentan([
      { servicio: 'express', cliente: 'x', pagado: true, distanciaKm: 0.4, propio: false },
      { servicio: 'express', cliente: 'y', pagado: true, distanciaKm: 3, propio: false },
    ]);
    expect(r.cuentan).toBe(1);
    expect(r.descartes).toEqual({ viaje_muy_corto: 1 });
  });

  it('flex no usa la regla de clientes distintos: cuenta paquetes de empresas verificadas, ajenas y con ruta cerrada, con tope por ruta', () => {
    const base = {
      servicio: 'flex' as const,
      empresa: 'e1',
      empresaVerificada: true,
      conductorEsDeLaEmpresa: false,
      rutaCerrada: true,
    };
    const r = unidadesQueCuentan([
      { ...base, ruta: 'r1', paquetesEntregados: 40 },
      { ...base, ruta: 'r2', paquetesEntregados: 20 },
      { ...base, ruta: 'r3', paquetesEntregados: 20, empresaVerificada: false },
      { ...base, ruta: 'r4', paquetesEntregados: 20, conductorEsDeLaEmpresa: true },
      { ...base, ruta: 'r5', paquetesEntregados: 20, rutaCerrada: false },
    ]);
    expect(r.cuentan).toBe(50);
    expect(r.bloqueo).toBeNull();
    expect(r.descartes).toEqual({
      tope_por_ruta: 10,
      empresa_no_verificada: 1,
      empresa_propia: 1,
      ruta_sin_cerrar: 1,
    });
  });
});
