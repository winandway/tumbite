import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-RECORRIDO-NO-PISA (31 oct 2026): el recorrido automático del sitio de pruebas cancelaba TODOS los
 * pedidos aceptados sin repartidor y desconectaba a TODOS los repartidores; cortó una prueba manual en
 * Michigan. Sus limpiezas quedan acotadas a lo suyo (@recorrido.test) y a Miami, donde corre.
 */
const DIR = join(__dirname, '..', '..', '..', 'e2e', 'recorrido');

describe('el recorrido no pisa las pruebas de las personas', () => {
  for (const archivo of readdirSync(DIR).filter((a) => a.endsWith('.spec.ts'))) {
    it(archivo, () => {
      const fuente = readFileSync(join(DIR, archivo), 'utf8');
      // Ninguna desconexión global de repartidores.
      expect(fuente).not.toMatch(/SET conectado = 0['"`]\s*\)/);
      // Ninguna cancelación de pedidos sin acotar a los restaurantes del recorrido.
      for (const m of fuente.matchAll(/UPDATE pedidos SET estado = 'cancelado'[^"`]*/g))
        expect(m[0]).toContain('@recorrido.test');
    });
  }
});
