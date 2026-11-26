import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXTOS_VIAJE } from './textos';

/**
 * C-OFERTA-SIN-COBRO (19 nov 2026) — todos los países. Cuando el regalo de Divoox cubre todo el
 * viaje, la oferta mostraba «Cobras en efectivo al terminar $0.00 / Bs. 0,00» en cifra grande y
 * verde: un cero protagonista que confunde. Ahora dice en palabras que no cobra nada en mano (lo que
 * paga Divoox sigue en su línea aparte). En ROJO antes del cambio: no existían el texto ni la rama.
 */
describe('C-OFERTA-SIN-COBRO · con el viaje cubierto por el regalo no se pinta un cero grande', () => {
  const s = readFileSync(join(import.meta.dirname, 'OfertaViaje.tsx'), 'utf8');
  it('la oferta de viaje no pinta el cobro grande cuando el monto en mano es cero', () => {
    expect(s).toMatch(/oferta\.enMano\.monto > 0 \?/);
    expect(s).toMatch(/testID="oferta-viaje-sin-cobro"/);
    expect(s).toMatch(/t\.noCobrasEnMano/);
  });
  it('la pantalla del viaje tampoco pinta un cero grande', () => {
    const v = readFileSync(join(import.meta.dirname, 'ViajeActivo.tsx'), 'utf8');
    expect(v).toMatch(/\(cobroEnMano\(false\)\?\.monto \?\? 0\) > 0 \?/);
    expect(v).toMatch(/testID="viaje-sin-cobro"/);
  });
  // Tercera mirada (19 nov 2026): el cierre «Viaje terminado» seguía pintando «Cobra al pasajero
  // $0.00 / Bs. 0,00», y la oferta decía a la vez «no cobras nada» y «el pasajero paga menos en
  // mano». En ROJO antes del cambio.
  it('el cierre del viaje tampoco pinta un cero grande', () => {
    const v = readFileSync(join(import.meta.dirname, 'ViajeActivo.tsx'), 'utf8');
    expect(v).toMatch(/\(cobroEnMano\(true\)\?\.monto \?\? 0\) > 0 \?/);
    expect(v).toMatch(/testID="viaje-cobra-sin-cobro"/);
  });
  it('con todo cubierto, la línea del regalo de la oferta no habla de pagar menos en mano', () => {
    expect(s).toMatch(/sinCobro\s*\?\s*t\.regaloOfertaTodo\s*:\s*t\.regaloOferta/);
    // C-SALDO-CLIENTE: con el Saldo Divoox del pasajero, su propia línea (todo o parte).
    expect(s).toMatch(
      /sinCobro\s*\?\s*textos\.oferta\.saldoOfertaTodo\s*:\s*textos\.oferta\.saldoOferta/,
    );
    expect(TEXTOS_VIAJE.es.oferta.saldoOfertaTodo).not.toMatch(/menos en mano/);
    expect(TEXTOS_VIAJE.es.oferta.regaloOfertaTodo).toMatch(/Divoox te paga \{monto\}/);
    expect(TEXTOS_VIAJE.es.oferta.regaloOfertaTodo).not.toMatch(/menos en mano/);
    expect(TEXTOS_VIAJE.en.oferta.regaloOfertaTodo).toMatch(/Divoox pays you \{monto\}/);
  });
  it('el texto existe en español y en inglés', () => {
    expect(TEXTOS_VIAJE.es.oferta.noCobrasEnMano).toMatch(/No cobras nada en mano/);
    expect(TEXTOS_VIAJE.en.oferta.noCobrasEnMano).toMatch(/Nothing to collect/);
  });
});

describe('C-SALDO-CLIENTE (revisión, M3): el pago con saldo en revisión no se llama «regalo»', () => {
  it('dice «Divoox está revisando este pago»', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const v = readFileSync(join(__dirname, 'ViajeActivo.tsx'), 'utf8');
    expect(v).toMatch(/respuesta\?\.saldoEnRevision \? t\.pagoEnRevision : t\.regaloEnRevision/);
    expect(TEXTOS_VIAJE.es.activo.pagoEnRevision).toBe('Divoox está revisando este pago');
    expect(TEXTOS_VIAJE.en.activo.pagoEnRevision).toBe('Divoox is reviewing this payment');
  });
});
