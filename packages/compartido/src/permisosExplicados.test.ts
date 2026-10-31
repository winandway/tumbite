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
      'useAvisosCelular(api, usuario, !explicarPermisos || permisosVistos === true)',
    );
    const avisos = leer('packages', 'movil', 'src', 'avisos.ts');
    expect(avisos).toContain('if (!permiso.granted && !preguntar) return;');
  });
});
