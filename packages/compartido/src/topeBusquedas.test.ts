import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOPE_BUSQUEDAS_DIA, quedanBusquedas } from './lugares';

/**
 * Revisión de calidad del 18 nov (C-DESTINO-RESULTADOS): el tope diario de búsquedas del mapa es solo
 * de «¿A dónde vas?», se reinicia cada día, y las demás casillas de dirección (Flex, comida, envíos)
 * nunca se quedan sin sugerencias por él.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8');

describe('tope diario de búsquedas del mapa', () => {
  it('se reinicia al cambiar el día', () => {
    const hoy = new Date(2026, 10, 18, 10);
    for (let i = 0; i < TOPE_BUSQUEDAS_DIA; i++) quedanBusquedas(hoy);
    expect(quedanBusquedas(hoy)).toBe(false);
    expect(quedanBusquedas(new Date(2026, 10, 19, 10))).toBe(true);
  });

  it('solo «¿A dónde vas?» lo pide; la casilla común no', () => {
    expect(leer('packages/compartido/src/lugares.ts')).toMatch(
      /opRef\.current\.tope && !quedanBusquedas\(\)/,
    );
    expect(leer('packages/compartido/src/lugares.ts')).toMatch(/setAgotado\(false\)/);
    expect(leer('apps/cliente/src/viajes/BuscarDestino.tsx')).toContain('tope: true');
    expect(leer('packages/movil/src/CampoDireccion.tsx')).not.toContain('tope: true');
  });
});
