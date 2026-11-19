import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PAGO-A-CELULAR y C-PAPELES-POR-PAIS (19 nov 2026) — Perú y Venezuela. Dos textos que las capturas
 * reales de Perú destaparon:
 * - con el número del conductor YA en pantalla, el pasajero seguía leyendo «Cuando te asignen
 *   conductor verás su número…»: la ayuda de esa tarjeta dice qué hacer ahora (enviar el pago);
 * - en Perú el registro del conductor hablaba de «tu cédula»: allá el documento es el DNI.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-PAGO-A-CELULAR: la tarjeta del pago en el viaje del pasajero', () => {
  it('con los datos del conductor en pantalla dice que envíe el pago, no que espere a que lo asignen', () => {
    const v = leer('apps/cliente/src/viajes/ViajeEnCurso.tsx');
    expect(v).toMatch(/medioCelular \? t\.celularEnviar : t\.pagoMovilEnviar/);
    expect(v).not.toMatch(/t\.celularAyuda|t\.pagoMovilAyuda/);
    const t = leer('apps/cliente/src/viajes/textos.ts');
    // En los dos idiomas, y sin la frase de antes de tener conductor.
    for (const patron of [
      /celularEnviar:\s*\n?\s*'([^']+)'/g,
      /pagoMovilEnviar:\s*\n?\s*'([^']+)'/g,
    ]) {
      const veces = [...t.matchAll(patron)];
      expect(veces.length, String(patron)).toBe(2);
      for (const m of veces) expect(m[1]).not.toMatch(/Cuando te asignen|Once you get a driver/);
    }
  });
});

describe('C-PAPELES-POR-PAIS: la identidad en el registro del conductor', () => {
  it('en Perú habla del DNI, no de la cédula', () => {
    const a = leer('apps/repartidor/src/viajes/AltaPasajeros.tsx');
    expect(a).toMatch(/paisCiudad === 'PE' \? tc\.identidadPeru : tc\.identidad/);
    const peru = [...a.matchAll(/identidadPeru:\s*\n?\s*'([^']+)'/g)].map((m) => m[1] ?? '');
    expect(peru.length).toBe(2);
    for (const texto of peru) {
      expect(texto).toContain('DNI');
      expect(texto).not.toMatch(/cédula/);
    }
  });
});
