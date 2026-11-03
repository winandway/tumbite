import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

/**
 * C-ICONOS-POR-APP (3 nov 2026, lámina aprobada por Richard): Apple rechazó las tres apps por 4.3
 * (spam) y en las tiendas se veían iguales. Cada app lleva su color: cliente rojo, Driver azul de
 * logística y Restaurants negro, con el mismo isotipo. Todos los países.
 */
const raiz = (r: string) => fileURLToPath(new URL(`../../../${r}`, import.meta.url).href);
const esquina = (app: string) => {
  const png = PNG.sync.read(readFileSync(raiz(`apps/${app}/assets/icon.png`)));
  const [r, g, b] = png.data;
  return `#${[r, g, b].map((x) => x!.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};
const fondoAndroid = (app: string) =>
  (
    JSON.parse(readFileSync(raiz(`apps/${app}/app.json`), 'utf8')) as {
      expo: { android: { adaptiveIcon: { backgroundColor: string } } };
    }
  ).expo.android.adaptiveIcon.backgroundColor.toUpperCase();

describe('C-ICONOS-POR-APP', () => {
  it.each([
    ['cliente', '#F20D20'],
    ['repartidor', '#1F4D69'],
    ['restaurante', '#101010'],
  ])('el ícono de %s tiene su color propio (%s)', (app, color) => {
    expect(esquina(app)).toBe(color);
    expect(fondoAndroid(app)).toBe(color);
  });
});

describe('C-ICONOS-POR-APP: la primera pantalla de Driver no es la del cliente', () => {
  it('Driver entra con su propia portada azul que dice para quién es', () => {
    const entrada = readFileSync(raiz('apps/repartidor/src/app/index.tsx'), 'utf8');
    expect(entrada).toMatch(/<Acceso rolRegistro="repartidor" portada=\{<Portada \/>\} \/>/);
    expect(entrada).toContain('C.logistica');
    expect(entrada).toMatch(/For drivers/);
    // Con portada, el formulario sigue diciendo si es «Crear cuenta» o «Entrar».
    expect(readFileSync(raiz('packages/movil/src/Acceso.tsx'), 'utf8')).toMatch(
      /portada && rolRegistro \?/,
    );
  });
});
