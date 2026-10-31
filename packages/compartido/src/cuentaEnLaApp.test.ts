import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CUENTA-EN-LA-APP (31 oct 2026, Richard grabando el video para Apple): en Driver no encontraba
 * cerrar sesión ni borrar la cuenta, y en la app del restaurante borrar mandaba a la web. Las dos
 * apps muestran «Tu cuenta» con «Cerrar sesión» y, en los tres puntos, «Borrar la cuenta» con la
 * confirmación escrita, sin salir de la app (Apple 5.1.1 v).
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8');

describe('cerrar sesión y borrar la cuenta dentro de la app', () => {
  const pieza = leer('packages', 'movil', 'src', 'OpcionesCuenta.tsx');
  it('borra con la API, sin abrir la web, y pide escribir la palabra', () => {
    expect(pieza).toContain("api.pedir('DELETE', '/datos/cuentas/yo')");
    expect(pieza).not.toContain('Linking');
    expect(pieza).toMatch(/escrito\.trim\(\)\.toUpperCase\(\) === t\.palabra/);
  });
  it('Driver y restaurante la muestran', () => {
    expect(leer('apps', 'repartidor', 'src', 'Inicio.tsx')).toContain('<OpcionesCuenta />');
    expect(leer('apps', 'restaurante', 'src', 'Mas.tsx')).toContain('<OpcionesCuenta />');
  });
});

describe('el menú Más del restaurante se abre dentro de la app (C-MAS-EN-LA-APP)', () => {
  it('Mi restaurante, Ganancias, Equipo y Configuración son pantallas de la app', () => {
    const mas = leer('packages', 'compartido', 'src', 'masRestaurante.ts');
    for (const id of ['restaurante', 'ganancias', 'equipo', 'configuracion'])
      expect(mas).toContain(`o('${id}', undefined, '${id}')`);
    expect(mas).not.toMatch(/'\/panel\/(restaurant|earnings|team|settings)'/);
    const pantallas = leer('apps', 'restaurante', 'src', 'MasPantallas.tsx');
    expect(pantallas).toContain('<OpcionesCuenta />');
    expect(pantallas).toContain("formulario: 'app-mi-restaurante'");
  });
});
