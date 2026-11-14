import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-MAPA-ABRE-DONDE-ESTAS y C-MAPA-LLEGADA (14 nov 2026, Richard) — todos los países. Candado de
 * lectura: ningún mapa de las apps abre en una ciudad fija, y la web y las apps llevan lo mismo
 * (regla «todo se hace como versión final»: Apple, Android y web iguales).
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
function archivos(dir: string, salida: string[] = []): string[] {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const r = `${dir}/${n}`;
    if (n === 'node_modules' || n.startsWith('.')) continue;
    if (statSync(join(RAIZ, r)).isDirectory()) archivos(r, salida);
    else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) salida.push(r);
  }
  return salida;
}

describe('los mapas de las apps', () => {
  it('ninguno abre en una ciudad fija (ni Miami ni otra) cuando no sabe dónde está la persona', () => {
    const conCiudad = [
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'packages/movil/src',
    ]
      .flatMap((d) => archivos(d))
      .filter((r) => /lat:\s*-?\d{1,2}\.\d{3,}|latitude:\s*-?\d{1,2}\.\d{3,}/.test(leer(r)));
    expect(conCiudad).toEqual([]);
  });

  it('elegir un punto abre donde está la persona, en la web y en las apps', () => {
    for (const r of ['apps/cliente/src/ElegirEnMapa.tsx', 'apps/cliente/src/ElegirEnMapa.web.tsx'])
      expect(leer(r), r).toContain('useCentroParaElegir(');
    expect(leer('apps/cliente/src/centroMapa.ts')).toContain('centroParaElegir(');
  });

  it('seguimiento, conductor y ruta Flex se acercan al llegar, en la web y en las apps', () => {
    for (const r of [
      'apps/cliente/src/MapaEntrega.tsx',
      'apps/cliente/src/MapaEntrega.web.tsx',
      'apps/repartidor/src/piezas/Mapa.tsx',
      'apps/repartidor/src/piezas/Mapa.web.tsx',
      'apps/repartidor/src/flex/MapaRuta.tsx',
      'apps/repartidor/src/flex/MapaRuta.web.tsx',
    ]) {
      expect(leer(r), r).toContain('vistaDeLlegada(');
      expect(leer(r), r).toContain('rotuloDestino(');
    }
  });

  it('las pantallas pasan la dirección para que su número se lea al llegar', () => {
    expect(leer('apps/cliente/src/app/order/[id].tsx')).toContain('direccion={p.direccion}');
    expect(leer('apps/cliente/src/viajes/ViajeEnCurso.tsx')).toMatch(
      /meta=\{[\s\S]{0,120}'restaurante'/,
    );
    expect(leer('apps/repartidor/src/Inicio.tsx')).toContain('direccionDestino={');
    expect(leer('apps/repartidor/src/flex/MiRuta.tsx')).toContain('direccion: p.direccion');
  });
});
