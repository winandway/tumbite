import { describe, expect, it } from 'vitest';
import { TEXTOS_VIAJE } from '../../../apps/repartidor/src/viajes/textos';
import { TEXTOS_MOTO } from '../../../apps/cliente/src/viajes/textos';

/**
 * C-ENVIO-TEXTOS (14 nov 2026, todos los países): un envío no se trata como viaje de pasajero. Driver
 * y la app del cliente tienen su juego de textos de envío, en los dos idiomas, y ninguno habla de
 * «pasajero» ni de «viaje».
 */
describe('C-ENVIO-TEXTOS', () => {
  it('Driver: la oferta y el viaje activo de un envío hablan del paquete', () => {
    for (const i of ['es', 'en'] as const) {
      const t = TEXTOS_VIAJE[i];
      const textos = [...Object.values(t.ofertaEnvio), ...Object.values(t.activoEnvio)].join(' ');
      expect(textos).not.toMatch(/pasajero|rider|\bride\b/i);
      for (const k of Object.keys(t.ofertaEnvio)) expect(k in t.oferta).toBe(true);
      for (const k of Object.keys(t.activoEnvio)) expect(k in t.activo).toBe(true);
    }
    expect(TEXTOS_VIAJE.es.activoEnvio.califica).toBe('Califica a quien envía');
    expect(TEXTOS_VIAJE.es.activoEnvio.iniciar).toBe('Recogí el paquete');
  });

  it('cliente: el envío en curso no dice «Vas en camino a tu destino»', () => {
    for (const i of ['es', 'en'] as const) {
      const t = TEXTOS_MOTO[i];
      for (const k of Object.keys(t.envio)) expect(k in t).toBe(true);
      expect(t.envio.enCurso).not.toBe(t.enCurso);
    }
    expect(TEXTOS_MOTO.es.envio.enCurso).toBe('Tu paquete va en camino');
  });
});
