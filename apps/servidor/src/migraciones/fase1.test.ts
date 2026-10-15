import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRACIONES_FASE1 } from './fase1';

/** Candado: lo que corre el diagnóstico es EXACTAMENTE lo que está en docs/fase-1. */
describe('migraciones de la Fase 1 dentro del servidor', () => {
  it('son idénticas a los archivos revisados', () => {
    const d = join(__dirname, '..', '..', '..', '..', 'docs', 'fase-1');
    const leer = (f: string) => readFileSync(join(d, f), 'utf8');
    expect(MIGRACIONES_FASE1.m4).toBe(leer('M4-vehiculos.sql'));
    expect(MIGRACIONES_FASE1.m5).toBe(leer('M5-comida-y-vehiculo-activo.sql'));
    expect(MIGRACIONES_FASE1.verificar).toBe(leer('verificar.sql'));
    expect(MIGRACIONES_FASE1.revertir).toBe(leer('revertir.sql'));
  });
});
