import { readFileSync, readdirSync, statSync } from 'node:fs';
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

  it('nada sale de la app, salvo llamar, los mapas para navegar y WhatsApp', () => {
    const archivos = (d: string): string[] =>
      readdirSync(join(raiz, d)).flatMap((n) => {
        const r = `${d}/${n}`;
        if (n === 'node_modules') return [];
        if (statSync(join(raiz, r)).isDirectory()) return archivos(r);
        return /\.tsx?$/.test(n) && !n.includes('.test.') ? [r] : [];
      });
    // Las únicas salidas permitidas, como en DoorDash y Uber: el teléfono, la app de mapas y WhatsApp.
    const permitidos = new Set([
      'packages/movil/src/PaginaEnApp.tsx',
      'packages/movil/src/soporte.ts',
      'apps/repartidor/src/flex/MiRuta.tsx',
      // C-ELEGIR-MAPAS: la pieza única que abre la app de mapas elegida.
      'apps/repartidor/src/comoLlegar.ts',
    ]);
    const malos = [
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'packages/movil/src',
    ]
      .flatMap(archivos)
      .filter((f) => !permitidos.has(f))
      .flatMap((f) =>
        leer(f)
          .split('\n')
          .map((l, i) => ({ l, i }))
          .filter(
            ({ l }) => l.includes('Linking.openURL') && !/tel:|openURL\(url\)|openURL\($/.test(l),
          )
          .map(({ i }) => `${f}:${i + 1}`),
      );
    expect(malos).toEqual([]);
  });
});
