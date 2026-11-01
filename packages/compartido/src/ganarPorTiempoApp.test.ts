import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** C-GANAR-POR-TIEMPO: Driver muestra «¿Cómo quieres cobrar hoy?» solo cuando está encendido. */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('Driver: elegir cómo cobrar', () => {
  it('la tarjeta cambia el modo en el servidor y no se cambia conectado', () => {
    const p = leer('apps', 'repartidor', 'src', 'piezas', 'ModoPago.tsx');
    expect(p).toContain("'/datos/repartidor/modo-pago'");
    expect(p).toContain('if (!datos.activo) return null;');
    expect(p).toContain('if (conectado || modo === datos.modo) return;');
    expect(leer('apps', 'repartidor', 'src', 'Inicio.tsx')).toContain('<ModoPago');
  });
});
