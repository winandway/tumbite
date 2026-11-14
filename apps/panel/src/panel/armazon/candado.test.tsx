import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PanelApp } from '../PanelApp';

/**
 * Candado C-PANEL-ARMAZON (14 nov 2026, Richard): TODO panel web con sesión se dibuja dentro del
 * armazón único (menú lateral con íconos y grupos, cabecera con buscador, campana, idioma y
 * cuenta). Si alguien arma una pantalla por fuera, o vuelve a escribir un menú a mano, esto falla.
 */
const EMPRESA = '11111111-2222-3333-4444-555555555555';
const cuenta = (rol: string) => ({
  id: 'u1',
  nombre: 'Rosa Prueba',
  correo: 'rosa@ejemplo.com',
  rol,
  idioma: 'es',
});

function servidor(rol: string) {
  vi.stubGlobal('fetch', async (url: string) => {
    const u = String(url);
    const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
    if (u.endsWith('/datos/cuentas/yo')) return json({ usuario: cuenta(rol) });
    if (u.endsWith('/datos/admin/ruta')) return json({ ruta: 'control-abc' });
    if (u.endsWith('/datos/mi-franquicia')) return json({ ruta: null });
    if (u.endsWith(`/datos/v1/flex/empresas/${EMPRESA}`))
      return json({
        empresa: {
          id: EMPRESA,
          nombre: 'Paquetes Sur',
          pais: 'US',
          moneda: 'USD',
          estado: 'activa',
        },
        rol: 'dueno',
        permisos: [],
        resumen: {},
      });
    if (u.endsWith('/datos/v1/flex/empresas')) return json({ empresas: [] });
    return new Response('{}', { status: 404 });
  });
}

const CASOS: [string, string, string][] = [
  ['el superadmin', 'admin', '/panel/control-abc'],
  ['una sección del superadmin', 'admin', '/panel/control-abc/moto'],
  ['el restaurante', 'restaurante', '/panel'],
  ['una sección del restaurante', 'restaurante', '/panel/menu'],
  ['la configuración', 'restaurante', '/panel/settings'],
  ['la cuenta de un cliente', 'cliente', '/panel'],
  ['la configuración de un cliente', 'cliente', '/panel/settings'],
  ['los cobros del repartidor', 'repartidor', '/panel/earnings'],
  ['la franquicia', 'cliente', '/panel/franchise-miami-abc'],
  ['Flex: mis empresas', 'cliente', '/panel/business'],
  ['Flex: una empresa', 'cliente', `/panel/business/${EMPRESA}`],
  ['Flex: una invitación', 'cliente', '/panel/business/invite/tok-1'],
];

describe('C-PANEL-ARMAZON: todo panel web usa el armazón único', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('tumbite.idioma', 'es');
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(CASOS)('%s se dibuja dentro del armazón', async (_nombre, rol, ruta) => {
    servidor(rol);
    render(<PanelApp ruta={ruta} />);
    const armazon = await screen.findByTestId('armazon');
    // Menú con íconos, buscador, campana y la salida a la vista: nada de eso falta en ningún panel.
    const menu = armazon.querySelector('nav.pd-menu');
    expect(menu).not.toBeNull();
    const items = [...(menu?.querySelectorAll('a.pd-item') ?? [])];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.querySelector('svg')).not.toBeNull();
    expect(armazon.querySelector('.pd-grupo-titulo')).not.toBeNull();
    expect(armazon.querySelector('input[type="search"]')).not.toBeNull();
    expect(armazon.querySelector('.pd-campana')).not.toBeNull();
    expect(armazon.querySelector('.selector-idioma')).not.toBeNull();
    expect(screen.getByTestId('menu-salir')).toBeInTheDocument();
    // El contenido vive dentro del armazón, no al lado.
    expect(armazon.querySelector('main.pd-contenido')).not.toBeNull();
    expect(document.querySelectorAll('main')).toHaveLength(1);
  });

  it('ninguna pantalla del panel escribe su propio menú lateral ni su propia cabecera', () => {
    const raiz = join(__dirname, '..');
    const archivos = (carpeta: string): string[] =>
      readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? e.name === 'armazon'
            ? []
            : archivos(join(carpeta, e.name))
          : /\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)
            ? [join(carpeta, e.name)]
            : [],
      );
    const culpables = archivos(raiz).filter((a) => {
      const codigo = readFileSync(a, 'utf8');
      return /className="[^"]*\b(panel-menu|panel-cuerpo|panel-contenido|pd-lateral|pd-cabecera)\b/.test(
        codigo,
      );
    });
    expect(culpables.map((a) => a.slice(raiz.length + 1))).toEqual([]);
  });

  it('la hoja de estilos del armazón no usa morado, degradados ni franjas gruesas en tarjetas', () => {
    const css = readFileSync(join(__dirname, 'armazon.css'), 'utf8');
    expect(css).not.toMatch(/gradient/i);
    expect(css).not.toMatch(/purple|violet|#[0-9a-f]{0,2}(?:6|7|8|9)[0-9a-f]00ff\b/i);
    expect(css).not.toMatch(/border-(left|top)(-width)?:\s*(?:[3-9]|\d{2,})px/);
    // La identidad: rojo y negro de Divoox, azul de logística y verde para el éxito.
    for (const color of ['#f20d20', '#c20a1a', '#101010', '#666b73', '#1f4d69', '#0d7a3a'])
      expect(css).toContain(color);
  });
});
