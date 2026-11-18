import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PERMISOS-EXPLICADOS (31 oct 2026, como DoorDash): el Driver explica para qué pide la ubicación y
 * los avisos antes de que salgan las ventanas del sistema.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (...p: string[]) => readFileSync(join(raiz, ...p), 'utf8');

describe('permisos explicados antes de pedirlos', () => {
  it('el Driver usa la pantalla y la sesión espera para pedir los avisos', () => {
    const layout = leer('apps', 'repartidor', 'src', 'app', '_layout.tsx');
    expect(layout).toContain('explicarPermisos');
    expect(layout).toContain('<PantallaPermisos');
    const sesion = leer('packages', 'movil', 'src', 'sesion.tsx');
    expect(sesion).toContain(
      // C-AVISOS-IDIOMA: el idioma de la app va al final; la espera de los permisos no cambia.
      'useAvisosCelular(api, usuario, !explicarPermisos || permisosVistos === true, idioma)',
    );
    const avisos = leer('packages', 'movil', 'src', 'avisos.ts');
    expect(avisos).toContain('if (!permiso.granted && !preguntar) return;');
  });
  // Tercera auditoría de tiendas (18 nov 2026, ubicación en segundo plano de Google Play): la
  // primera pantalla pide la ubicación, y después de darla ya no sale la otra explicación. Por eso
  // ESTA pantalla dice que se usa con la pantalla apagada o en segundo plano, y cuándo deja de usarse.
  it('el Driver avisa ANTES del permiso que la ubicación sigue en segundo plano', () => {
    const layout = leer('apps', 'repartidor', 'src', 'app', '_layout.tsx');
    expect(layout).toContain('con la pantalla apagada o la app en segundo plano');
    expect(layout).toContain('with the screen off or the app in the background');
    expect(layout).toContain('Al desconectarte y sin un trabajo en curso, deja de usarse.');
    expect(layout).toContain('When you go offline with no job in progress, it stops.');
  });
});
