import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-MERCHANT-NOMBRE (27 nov 2026, Richard, todos los países): la app de TODOS los comercios
 * (restaurantes, mercados, farmacias, licorerías, ferreterías, tiendas) se llama «Divoox Merchant»;
 * antes se llamaba «Divoox Restaurants». La identidad interna no cambia (paquete
 * com.windoce.tumbite.restaurants, slug, rutas, carpetas, claves `restaurante`/`restaurantes`).
 * Solo cambia lo que ve una persona: el nombre viejo no puede volver a código visible.
 *
 * Única excepción: las claves que son el NOMBRE DE LA CARPETA de capturas
 * («Divoox Restaurants (restaurante)»): renombrar carpetas rompería las rutas de docs/capturas.
 */
const RAIZ = join(__dirname, '../../..');
const VIEJO = 'Divoox Restaurants';
const CARPETA_DE_CAPTURAS = 'Divoox Restaurants (restaurante)';

function archivos(dir: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === 'dist' || nombre === '.expo') continue;
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    if (st.isDirectory()) archivos(ruta, salida);
    else if (/\.(tsx?|jsx?|mjs|json|html)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

function aRevisar(): string[] {
  const lista: string[] = [];
  for (const grupo of ['apps', 'packages']) {
    for (const p of readdirSync(join(RAIZ, grupo))) {
      const src = join(RAIZ, grupo, p, 'src');
      try {
        if (statSync(src).isDirectory()) archivos(src, lista);
      } catch {
        /* esa carpeta no tiene src */
      }
    }
  }
  lista.push(join(RAIZ, 'apps/restaurante/app.json'));
  for (const f of readdirSync(join(RAIZ, 'progreso'))) {
    if (f.endsWith('.json')) lista.push(join(RAIZ, 'progreso', f));
  }
  return lista;
}

describe('C-MERCHANT-NOMBRE', () => {
  it('la app de comercios se llama «Divoox Merchant» en el nombre de la app', () => {
    const app = JSON.parse(readFileSync(join(RAIZ, 'apps/restaurante/app.json'), 'utf8'));
    expect(app.expo.name).toBe('Divoox Merchant');
  });

  it('«Divoox Restaurants» no aparece en código visible (salvo la carpeta de capturas)', () => {
    const culpables: string[] = [];
    for (const ruta of aRevisar()) {
      if (ruta.endsWith('candadoMerchantNombre.test.ts')) continue;
      const texto = readFileSync(ruta, 'utf8').split(CARPETA_DE_CAPTURAS).join('');
      if (texto.includes(VIEJO)) culpables.push(relative(RAIZ, ruta));
    }
    expect(culpables).toEqual([]);
  });
});
