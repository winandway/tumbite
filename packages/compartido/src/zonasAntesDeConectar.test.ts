import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-ZONAS-ANTES-DE-CONECTAR (1 nov 2026): el mapa de zonas con más pedidos se ve ANTES de
 * conectarse (como Dasher), que es cuando el repartidor decide adónde ir. Antes la app solo conocía
 * la ubicación estando conectada, y desconectado el mapa nunca pedía las zonas.
 */
const inicio = readFileSync(
  join(__dirname, '..', '..', '..', 'apps', 'repartidor', 'src', 'Inicio.tsx'),
  'utf8',
);

describe('Driver: zonas con más pedidos antes de conectarse', () => {
  it('desconectado, lee la ubicación una vez (sin volver a pedir el permiso) y pide las zonas', () => {
    const bloque = inicio.slice(inicio.indexOf('C-ZONAS-ANTES-DE-CONECTAR'));
    expect(bloque.length).toBeGreaterThan(30);
    expect(bloque).toContain('if (estado?.conectado || aqui) return;');
    expect(bloque).toContain('getForegroundPermissionsAsync');
    expect(bloque.indexOf('getForegroundPermissionsAsync')).toBeLessThan(
      bloque.indexOf('ubicacionConLimite()'),
    );
    expect(inicio).toContain('/datos/repartidor/demanda?lat=');
  });
});
