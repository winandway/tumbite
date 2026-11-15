import { describe, expect, it } from 'vitest';
import {
  type ConfigDinamica,
  cargoEsperaParadas,
  carroCumpleCategoria,
  carroRecibeCategoria,
  categoriasOfrecidas,
  cotizarViaje,
  esquemaTarifaViaje,
  multiplicadorPorDemanda,
  tarifaDeCategoria,
  textoMultiplicador,
} from './viajes';
import { perfilPasajeros, tarifaDeMercado } from './perfilPasajeros';

/** C-CARRO-CATEGORIAS, C-CARRO-DINAMICA y C-VIAJE-PARADAS (14 nov 2026): las reglas puras. */
const TARIFA = esquemaTarifaViaje.parse({ base: 300, porKm: 120, porMinuto: 25, minimo: 800 });

describe('categorías de Carro', () => {
  it('cada categoría cotiza con su factor y sin factor no existe', () => {
    expect(tarifaDeCategoria(TARIFA, 'estandar')).toBe(TARIFA);
    expect(tarifaDeCategoria(TARIFA, 'comfort')).toBeNull();
    const t = { ...TARIFA, comfortPb: 12_500, premiumPb: 18_000, xlPb: 15_000 };
    expect(tarifaDeCategoria(t, 'comfort')).toMatchObject({ base: 375, porKm: 150, minimo: 1000 });
    expect(tarifaDeCategoria(t, 'premium')).toMatchObject({ base: 540, porKm: 216, minimo: 1440 });
    expect(tarifaDeCategoria(t, 'xl')).toMatchObject({ base: 450 });
    expect(categoriasOfrecidas(t)).toEqual(['estandar', 'comfort', 'premium', 'xl']);
    expect(categoriasOfrecidas(TARIFA)).toEqual(['estandar']);
  });

  it('un carro recibe su categoría y las de abajo si no las apagó; nunca las de arriba', () => {
    const carro = (categoria: string, aceptaMenores = true, plazas = 4) => ({
      categoria,
      plazas,
      aceptaMenores,
    });
    expect(carroRecibeCategoria(carro('estandar'), 'estandar')).toBe(true);
    expect(carroRecibeCategoria(carro('estandar'), 'comfort')).toBe(false);
    expect(carroRecibeCategoria(carro('comfort'), 'premium')).toBe(false);
    expect(carroRecibeCategoria(carro('premium'), 'comfort')).toBe(true);
    expect(carroRecibeCategoria(carro('premium', false), 'comfort')).toBe(false);
    expect(carroRecibeCategoria(carro('premium', false), 'premium')).toBe(true);
    expect(carroRecibeCategoria(carro('estandar'), 'xl')).toBe(false);
    expect(carroRecibeCategoria(carro('estandar', true, 7), 'xl')).toBe(true);
  });

  it('los requisitos salen del perfil del país', () => {
    const us = perfilPasajeros('US').carro.categorias;
    const ve = perfilPasajeros('VE').carro.categorias;
    expect(carroCumpleCategoria(us.comfort, { anio: 2018, plazas: 4 }, 2026)).toBe(true);
    expect(carroCumpleCategoria(us.comfort, { anio: 2017, plazas: 4 }, 2026)).toBe(false);
    expect(carroCumpleCategoria(ve.comfort, { anio: 2014, plazas: 4 }, 2026)).toBe(true);
    expect(carroCumpleCategoria(us.comfort, { anio: null, plazas: 4 }, 2026)).toBe(false);
    expect(carroCumpleCategoria(us.comfort, { anio: 2024, plazas: 2 }, 2026)).toBe(false);
    expect(us.premium.revisionManual).toBe(true);
    // Un país sin perfil propio usa el de EE. UU. (el más exigente).
    expect(perfilPasajeros('CO').carro).toEqual(perfilPasajeros('US').carro);
    // Venezuela ofrece Comfort y Premium en su tarifa de mercado.
    expect(tarifaDeMercado('VE', 'carro')).toMatchObject({ comfortPb: 13_000, premiumPb: 18_000 });
  });
});

describe('tarifa dinámica', () => {
  const cfg: ConfigDinamica = perfilPasajeros('US').carro.dinamica;

  it('sube por escalones con la demanda y nunca pasa del tope', () => {
    expect(multiplicadorPorDemanda(cfg, 3, 3, 20_000)).toBe(10_000);
    expect(multiplicadorPorDemanda(cfg, 3, 2, 20_000)).toBe(12_000);
    expect(multiplicadorPorDemanda(cfg, 4, 2, 20_000)).toBe(15_000);
    expect(multiplicadorPorDemanda(cfg, 9, 3, 20_000)).toBe(20_000);
    expect(multiplicadorPorDemanda(cfg, 50, 0, 20_000)).toBe(20_000);
    // El tope de la ciudad por debajo del país.
    expect(multiplicadorPorDemanda(cfg, 50, 0, 15_000)).toBe(15_000);
    // El tope del país por debajo del de la ciudad.
    expect(multiplicadorPorDemanda(perfilPasajeros('VE').carro.dinamica, 50, 0, 30_000)).toBe(
      15_000,
    );
  });

  it('con poca demanda o con el tope en 1 no hay recargo', () => {
    expect(multiplicadorPorDemanda(cfg, 2, 0, 20_000)).toBe(10_000);
    expect(multiplicadorPorDemanda(cfg, 50, 0, 10_000)).toBe(10_000);
  });

  it('el recargo va sobre el recorrido, no sobre el cargo fijo, y el desglose suma el total', () => {
    const t = { ...TARIFA, topeDinamicoPb: 20_000, cargoFijo: 100 };
    const d = cotizarViaje(t, { distanciaM: 5000, duracionS: 600 }, 15_000);
    expect(d.dinamico).toBe(Math.round((300 + 600 + 250) * 0.5));
    expect(
      d.base + d.distancia + d.tiempo + d.ajusteMinimo + d.dinamico + d.cargoFijo + d.redondeo,
    ).toBe(d.total);
    // Aunque se pida más, la tarifa lo acota.
    expect(cotizarViaje(t, { distanciaM: 5000, duracionS: 600 }, 90_000).dinamico).toBe(1150);
  });

  it('el multiplicador se dice en palabras cortas', () => {
    expect(textoMultiplicador(15_000)).toBe('× 1,5');
    expect(textoMultiplicador(20_000)).toBe('× 2');
  });
});

describe('espera en las paradas', () => {
  it('cada parada tiene su espera gratis y después se cobra por minuto empezado', () => {
    const t = { esperaParadaGratisS: 120, porMinutoEspera: 50 };
    expect(cargoEsperaParadas(t, [])).toBe(0);
    expect(cargoEsperaParadas(t, [60, 120])).toBe(0);
    expect(cargoEsperaParadas(t, [121])).toBe(50);
    expect(cargoEsperaParadas(t, [300, 181])).toBe(150 + 100);
  });
});
