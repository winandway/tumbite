import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PAGINA-EN-APP (2 nov 2026): un restaurante reportó que al tocar «términos y condiciones» la app
 * lo sacaba al navegador. Las páginas legales, las guías y la conversación de un caso se abren dentro
 * de la app con `abrirPagina`; nadie vuelve a usar `Linking.openURL` para ellas.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('las páginas legales se abren dentro de la app', () => {
  it('ninguna página pública se abre con Linking fuera de la app', () => {
    const archivos = [
      'packages/movil/src/Acceso.tsx',
      'packages/movil/src/BorrarCuenta.tsx',
      'packages/movil/src/ReportarProblema.tsx',
      'apps/repartidor/src/Inicio.tsx',
    ];
    const malos = archivos.filter((f) =>
      /Linking\.openURL\([^)]*(terms|privacy|delete-account|\/docs|enlace|enIdiomaDireccion\(ruta)/.test(
        leer(f),
      ),
    );
    expect(malos).toEqual([]);
  });
  it('el visor vive una sola vez, dentro de la sesión de las tres apps', () => {
    expect(leer('packages/movil/src/sesion.tsx')).toMatch(/<VisorPaginas idioma=\{idioma\} \/>/);
    expect(leer('packages/movil/src/index.ts')).toContain("'./PaginaEnApp'");
  });
});
