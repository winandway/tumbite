import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-NUNCA-EN-BLANCO (16 nov 2026): ninguna pantalla de las tres apps puede quedar en blanco.
// 1) Toda ventana pasa por el Modal de @tumbite/movil (Hoja.tsx), que lleva su atrapador de errores.
// 2) Cada app engancha el atrapador global al arrancar.
// 3) La hoja «¿A dónde te lo llevamos?» no abre otra ventana encima: en el iPhone, cerrar las dos a la
//    vez dejó la de abajo en blanco y sin salida (captura de Richard, 16 nov). Los pasos van dentro.
const RAIZ = join(__dirname, '..', '..', '..');
const CARPETAS = [
  'apps/cliente/src',
  'apps/repartidor/src',
  'apps/restaurante/src',
  'packages/movil/src',
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

const TODOS = CARPETAS.flatMap((c) => archivos(join(RAIZ, c)));
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

describe('C-NUNCA-EN-BLANCO', () => {
  it('ninguna pantalla importa Modal de react-native (solo Hoja.tsx)', () => {
    const malos = TODOS.filter((p) => !p.endsWith('Hoja.tsx')).filter((p) =>
      [...readFileSync(p, 'utf8').matchAll(/import\s*\{([^}]*)\}\s*from\s*'react-native'/g)].some(
        (m) =>
          m[1]!
            .split(',')
            .map((x) => x.trim())
            .includes('Modal'),
      ),
    );
    expect(malos.map((p) => p.slice(RAIZ.length + 1))).toEqual([]);
  });

  it('la Hoja lleva su atrapador de errores con «Volver» que cierra la ventana', () => {
    const h = leer('packages/movil/src/Hoja.tsx');
    expect(h).toMatch(/getDerivedStateFromError/);
    expect(h).toMatch(/<AtrapaFallos[\s\S]*onRequestClose\?\.\(/);
  });

  it('las tres apps enganchan el atrapador global al arrancar', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante'])
      expect(leer(`apps/${app}/src/app/_layout.tsx`)).toMatch(
        new RegExp(`registrarAtrapaFallos\\('${app}'\\)`),
      );
  });

  it('la hoja de dirección no abre la de las fotos como otra ventana encima', () => {
    const d = leer('apps/cliente/src/inicio/ElegirDireccion.tsx');
    const usos = [...d.matchAll(/<HojaFotosPuerta\b[^>]*>/g)].map((m) => m[0]);
    expect(usos.length).toBeGreaterThan(0);
    for (const u of usos) expect(u).toMatch(/\benLinea\b/);
  });
});
