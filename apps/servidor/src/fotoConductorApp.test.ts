import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-FOTO-CONDUCTOR-SE-VE (24 nov 2026) — todos los países. En la carrera real del 23 nov el pasajero
 * vio la inicial del conductor y no su cara, aunque estaba aprobada y su miniatura guardada: el
 * servidor mandaba `conductor.foto: true`, pero la app la pedía con `<Image source={{ headers }}>`,
 * la única foto privada de las apps que no pasaba por `api.verFoto` (comida y conductor de confianza
 * sí, y se ven). Toda foto privada de las apps se pide con la sesión por `api.verFoto` (la pieza
 * `useFotoPrivada`), nunca con cabeceras dentro de `<Image>`.
 */
const RAIZ = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

function archivosTsx(dir: string): string[] {
  const salida: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    if (n === 'node_modules' || n.startsWith('.') || n.startsWith('dist')) continue;
    const r = join(dir, n);
    if (statSync(join(RAIZ, r)).isDirectory()) salida.push(...archivosTsx(r));
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) salida.push(r);
  }
  return salida;
}

describe('C-FOTO-CONDUCTOR-SE-VE · la foto del conductor llega por la sesión, no por <Image headers>', () => {
  it('ninguna app pide una foto con cabeceras dentro de <Image>', () => {
    const conCabeceras = [
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'packages/movil/src',
    ]
      .flatMap(archivosTsx)
      .filter((r) => /source=\{\{[\s\S]{0,200}?headers:/.test(leer(r)));
    expect(conCabeceras).toEqual([]);
  });

  it('el viaje del pasajero y «Así te ven» usan la pieza que pide la foto con la sesión', () => {
    const pieza = leer('packages/movil/src/fotoPrivada.ts');
    expect(pieza).toMatch(/api\s*\.verFoto\(ruta\)/);
    const pasajero = leer('apps/cliente/src/viajes/ViajeEnCurso.tsx');
    expect(pasajero).toMatch(
      /useFotoPrivada\(\s*hay \? `\/datos\/viajes\/\$\{viajeId\}\/conductor\/foto` : null/,
    );
    const driver = leer('apps/repartidor/src/grandes/AsiTeVen.tsx');
    expect(driver).toMatch(/useFotoPrivada\(hay \? '\/datos\/repartidor\/perfil\/foto' : null\)/);
  });

  it('el panel repara solo la foto de los aprobados sin miniatura al abrir Verificaciones', () => {
    const bandeja = leer('apps/panel/src/panel/SuperKyc.tsx');
    expect(bandeja).toMatch(/'\/datos\/admin\/kyc\/miniaturas-faltantes'/);
    expect(bandeja).toMatch(/useEffect\(\(\) => \{\s*void repararMiniaturas\(\);\s*\}, \[\]\)/);
    expect(leer('apps/panel/src/panel/SuperKycFicha.tsx')).toMatch(
      /export async function guardarMiniatura/,
    );
  });
});
