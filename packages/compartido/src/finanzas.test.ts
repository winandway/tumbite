import { describe, expect, it } from 'vitest';
import {
  type PoliticaFinanciera,
  calcularComision,
  comisionEstimada,
  desgloseServicioLogistico,
  elegirPolitica,
  esquemaRegla,
  tarifaUnitaria,
} from './finanzas';

const base: PoliticaFinanciera = {
  id: 'general',
  servicio: 'flex',
  tipoCuenta: 'empresa',
  pais: 'US',
  ciudad: null,
  empresaId: null,
  modalidad: 'prepago',
  moneda: 'USD',
  regla: { tipo: 'por_paquete', monto: 25 },
  descuentoPb: 0,
  vigenteDesde: '2026-01-01 00:00:00',
  vigenteHasta: null,
  prioridad: 0,
  activa: true,
  revisionLegalAprobada: false,
};
const ctx = {
  servicio: 'flex' as const,
  tipoCuenta: 'empresa' as const,
  pais: 'US',
  ciudad: 'Miami',
  empresaId: 'e1',
  moneda: 'USD',
  en: '2026-10-27 12:00:00',
};

describe('C-FIN-POLITICAS · elegir la política que rige', () => {
  it('la más específica gana: empresa > ciudad > país > todos', () => {
    const lista: PoliticaFinanciera[] = [
      { ...base, id: 'todos', pais: '*' },
      base,
      { ...base, id: 'miami', ciudad: 'miami', regla: { tipo: 'por_paquete', monto: 30 } },
      { ...base, id: 'e1', empresaId: 'e1', regla: { tipo: 'por_paquete', monto: 20 } },
    ];
    expect(elegirPolitica(lista, ctx)?.id).toBe('e1');
    expect(elegirPolitica(lista, { ...ctx, empresaId: 'otra' })?.id).toBe('miami');
    expect(elegirPolitica(lista, { ...ctx, empresaId: 'otra', ciudad: 'Orlando' })?.id).toBe(
      'general',
    );
    expect(elegirPolitica(lista, { ...ctx, pais: 'CO', moneda: 'USD', empresaId: null })?.id).toBe(
      'todos',
    );
  });

  it('sin política no hay cobro (nunca una tarifa inventada); vigencia, moneda y servicio cuentan', () => {
    expect(elegirPolitica([], ctx)).toBeNull();
    expect(elegirPolitica([{ ...base, moneda: 'COP' }], ctx)).toBeNull();
    expect(elegirPolitica([{ ...base, servicio: 'food' }], ctx)).toBeNull();
    expect(elegirPolitica([{ ...base, activa: false }], ctx)).toBeNull();
    expect(elegirPolitica([{ ...base, vigenteDesde: '2026-11-01 00:00:00' }], ctx)).toBeNull();
    expect(elegirPolitica([{ ...base, vigenteHasta: '2026-10-27 12:00:00' }], ctx)).toBeNull();
  });

  it('una promoción con más prioridad manda dentro de su ventana y después vuelve la normal', () => {
    const promo: PoliticaFinanciera = {
      ...base,
      id: 'promo',
      prioridad: 10,
      descuentoPb: 5000,
      vigenteDesde: '2026-10-01 00:00:00',
      vigenteHasta: '2026-11-01 00:00:00',
    };
    expect(elegirPolitica([base, promo], ctx)?.id).toBe('promo');
    expect(elegirPolitica([base, promo], { ...ctx, en: '2026-11-02 00:00:00' })?.id).toBe(
      'general',
    );
  });

  it('el prepago de conductores NO rige sin la revisión legal del mercado aprobada', () => {
    const cond: PoliticaFinanciera = {
      ...base,
      id: 'cond',
      tipoCuenta: 'conductor',
      regla: { tipo: 'porcentaje', pb: 1000 },
    };
    const c = { ...ctx, tipoCuenta: 'conductor' as const, empresaId: null };
    expect(elegirPolitica([cond], c)).toBeNull();
    expect(elegirPolitica([{ ...cond, revisionLegalAprobada: true }], c)?.id).toBe('cond');
  });
});

describe('C-FIN-POLITICAS · cálculo de comisiones', () => {
  it('el ejemplo comercial: 40 paquetes × 0,25 = 10,00', () => {
    expect(calcularComision({ tipo: 'por_paquete', monto: 25 }, { unidades: 40 })).toBe(1000);
    expect(comisionEstimada({ tipo: 'por_paquete', monto: 25 }, { paquetes: 40 })).toBe(1000);
  });
  it('por ruta: una vez si hubo algo facturable', () => {
    expect(calcularComision({ tipo: 'por_ruta', monto: 500 }, { unidades: 12 })).toBe(500);
    expect(calcularComision({ tipo: 'por_ruta', monto: 500 }, { unidades: 0 })).toBe(0);
  });
  it('porcentaje del conductor: 10 % de una entrega de 8,00 = 0,80; con mínimo y máximo', () => {
    expect(calcularComision({ tipo: 'porcentaje', pb: 1000 }, { unidades: 1, valor: 800 })).toBe(
      80,
    );
    expect(
      calcularComision({ tipo: 'porcentaje', pb: 1000, minimo: 100 }, { unidades: 1, valor: 800 }),
    ).toBe(100);
    expect(
      calcularComision({ tipo: 'porcentaje', pb: 1000, maximo: 50 }, { unidades: 1, valor: 800 }),
    ).toBe(50);
    expect(calcularComision({ tipo: 'porcentaje', pb: 1000 }, { unidades: 1 })).toBe(0);
  });
  it('volumen: el tramo alcanzado manda', () => {
    const r = {
      tipo: 'volumen' as const,
      tramos: [
        { desde: 0, monto: 30 },
        { desde: 1000, monto: 25 },
        { desde: 5000, monto: 20 },
      ],
    };
    expect(tarifaUnitaria(r, { volumenPrevio: 0 })).toBe(30);
    expect(tarifaUnitaria(r, { volumenPrevio: 999 })).toBe(25);
    expect(tarifaUnitaria(r, { volumenPrevio: 6000 })).toBe(20);
  });
  it('promoción del 50 % y exención', () => {
    expect(
      calcularComision({ tipo: 'por_paquete', monto: 25 }, { unidades: 40, descuentoPb: 5000 }),
    ).toBe(520);
    expect(calcularComision({ tipo: 'exenta' }, { unidades: 40 })).toBe(0);
  });
  it('el esquema rechaza montos negativos o con decimales', () => {
    expect(esquemaRegla.safeParse({ tipo: 'por_paquete', monto: -1 }).success).toBe(false);
    expect(esquemaRegla.safeParse({ tipo: 'por_paquete', monto: 0.5 }).success).toBe(false);
  });
});

describe('C-FIN-LOGISTICO · el servicio completo se separa en sus partes', () => {
  it('tecnología, transporte, conductor, procesador e impuestos nunca se mezclan', () => {
    const d = desgloseServicioLogistico({
      paquetes: 40,
      tecnologiaPorPaquete: 25,
      transportePorPaquete: 300,
      conductorPb: 8000,
      procesadorPb: 290,
      procesadorFijo: 30,
      impuestoPb: 0,
    });
    expect(d.tecnologiaDivoox).toBe(1000);
    expect(d.transporte).toBe(12000);
    expect(d.remuneracionConductor).toBe(9600);
    expect(d.margenTransporteDivoox).toBe(2400);
    expect(d.totalEmpresa).toBe(13000);
    expect(d.procesadorPagos).toBe(407);
    // La comisión de 0,25 sola no cubre el transporte.
    expect(d.tecnologiaDivoox).toBeLessThan(d.transporte);
  });
});
