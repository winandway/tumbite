import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SENAL_PERDIDA_S,
  estimacionLlegada,
  rangoLlegada,
  segundosDesde,
  senalPerdida,
  textoActualizado,
  textoRango,
} from './seguimientoHonesto';

/**
 * C-SEGUIMIENTO-HONESTO (BRE-2, 2 nov 2026): el seguimiento dice cuándo se actualizó, avisa si se
 * perdió la señal del repartidor y da la llegada como rango, nunca como precisión falsa
 * (estudio «Estudio-plataforma-de-comida…»: «mostrar un rango entendible y la última
 * actualización… si el mapa se congela, indicarlo»).
 */
const AHORA = Date.parse('2026-11-02T16:30:00Z');

describe('C-SEGUIMIENTO-HONESTO', () => {
  it('lee la hora de la base (UTC sin zona) y la ISO', () => {
    expect(segundosDesde('2026-11-02 16:29:52', AHORA)).toBe(8);
    expect(segundosDesde('2026-11-02T16:28:00.000Z', AHORA)).toBe(120);
    expect(segundosDesde(null, AHORA)).toBeNull();
    expect(segundosDesde('basura', AHORA)).toBeNull();
    // Un reloj adelantado nunca da segundos negativos.
    expect(segundosDesde('2026-11-02 16:30:30', AHORA)).toBe(0);
  });

  it('la señal se pierde pasado un minuto, no antes', () => {
    expect(SENAL_PERDIDA_S).toBe(60);
    expect(senalPerdida(60)).toBe(false);
    expect(senalPerdida(61)).toBe(true);
    expect(senalPerdida(null)).toBe(false);
  });

  it('«Actualizado hace…» en los dos idiomas', () => {
    expect(textoActualizado(8, 'es')).toBe('Actualizado hace 8 s');
    expect(textoActualizado(8, 'en')).toBe('Updated 8 s ago');
    expect(textoActualizado(150, 'es')).toBe('Actualizado hace 2 min');
    expect(textoActualizado(150, 'en')).toBe('Updated 2 min ago');
    expect(textoActualizado(0, 'es')).toBe('Actualizado hace un momento');
  });

  it('la llegada es un rango de diez minutos que no pasa del «a más tardar»', () => {
    const r = rangoLlegada(AHORA, 10, null);
    expect(r).toEqual({ desde: '2026-11-02T16:40:00.000Z', hasta: '2026-11-02T16:50:00.000Z' });
    // Con «a más tardar» antes del final del rango, el rango se recorta (mínimo 5 minutos).
    const c = rangoLlegada(AHORA, 10, '2026-11-02T16:47:00.000Z');
    expect(c?.hasta).toBe('2026-11-02T16:47:00.000Z');
    const m = rangoLlegada(AHORA, 10, '2026-11-02T16:41:00.000Z');
    expect(m?.hasta).toBe('2026-11-02T16:45:00.000Z');
    expect(rangoLlegada(AHORA, null, null)).toBeNull();
  });

  it('el rango se escribe como «12:40–12:50» en la hora de quien lo ve', () => {
    const r = { desde: '2026-11-02T16:40:00.000Z', hasta: '2026-11-02T16:50:00.000Z' };
    expect(textoRango(r, 'en', 'America/New_York')).toBe('11:40 AM–11:50 AM');
    expect(textoRango(r, 'es', 'UTC')).toMatch(/^4:40\s?p\.\s?m\.–4:50\s?p\.\s?m\.$/);
  });

  it('la estimación es la misma para la app y para el enlace compartido', () => {
    const rest = { lat: 25.77, lng: -80.19 };
    const casa = { lat: 25.79, lng: -80.19 };
    const e = estimacionLlegada({
      estado: 'aceptado',
      tiempoPrepMin: 15,
      aceptadoMs: AHORA - 5 * 60_000,
      restaurante: rest,
      casa,
      repartidor: null,
    });
    expect(e.minutosEstimados).toBe(15 + 5);
    expect(e.llegaAMasTardar).not.toBeNull();
    const fin = estimacionLlegada({
      estado: 'entregado',
      tiempoPrepMin: 15,
      aceptadoMs: AHORA,
      restaurante: rest,
      casa,
      repartidor: null,
    });
    expect(fin).toEqual({ minutosEstimados: null, llegaAMasTardar: null });
  });
});

const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('C-SEGUIMIENTO-HONESTO en la app del cliente', () => {
  it('el pedido en camino dice hace cuánto, avisa sin señal y da el rango', () => {
    const app = leer('apps', 'cliente', 'src', 'app', 'order', '[id].tsx');
    expect(app).toContain('textoActualizado(');
    expect(app).toContain('textoRango(');
    expect(app).toContain('t.sinSenal');
    expect(app).toContain('senalPerdida(');
    // El mapa recibe el aviso para dejar de presentarse como en vivo.
    expect(app).toMatch(/<MapaEntrega[\s\S]*?sinSenal=/);
    const mapa = leer('apps', 'cliente', 'src', 'MapaEntrega.tsx');
    expect(mapa).toContain('sinSenal');
    expect(mapa).toMatch(/opacity: sinSenal/);
  });
});
