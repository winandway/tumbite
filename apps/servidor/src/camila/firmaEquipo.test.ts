import { describe, expect, it } from 'vitest';
import { firmaDelEquipo } from './identidad';

/**
 * C-FIRMA-EQUIPO (Gerencia, 26 nov 2026: Richard recibió por WhatsApp una respuesta firmada «Soporte
 * Divoox, del equipo de soporte de Divoox») — todos los países y canales. Si el nombre ya dice
 * «Soporte» o la marca, firma solo «Soporte Divoox»; si es un nombre propio, «María, de Soporte Divoox».
 * La respuesta real por correo (ruta del equipo) se comprueba en correoEntrante.test.ts.
 */
describe('C-FIRMA-EQUIPO: la firma de una persona del equipo', () => {
  it('nombre con «Soporte» o con la marca: solo «Soporte Divoox», sin repetirse', () => {
    for (const nombre of [
      'Soporte Divoox',
      'Soporte',
      'Ana (Soporte)',
      'Soporte Tumbite',
      'Divoox',
    ])
      expect(firmaDelEquipo(nombre, 'es')).toBe('Soporte Divoox');
    expect(firmaDelEquipo('Soporte Divoox', 'en')).toBe('Divoox Support');
    expect(firmaDelEquipo('', 'es')).toBe('Soporte Divoox');
  });

  it('nombre propio: «María, de Soporte Divoox», en una sola línea', () => {
    expect(firmaDelEquipo('María', 'es')).toBe('María, de Soporte Divoox');
    expect(firmaDelEquipo('  María \n Pérez ', 'es')).toBe('María Pérez, de Soporte Divoox');
    expect(firmaDelEquipo('María', 'en')).toBe('María, Divoox Support');
    expect(firmaDelEquipo('María', 'es')).not.toMatch(/\n/);
  });
});
