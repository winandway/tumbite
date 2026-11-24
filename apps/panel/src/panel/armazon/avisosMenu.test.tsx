import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Armazon, SesionArmazon } from './Armazon';
import { conPendientes, filtrosPendientes } from './menus';

/**
 * C-AVISOS-MENU (21 nov 2026, Gerencia): cada sección del menú dice cuánto espera, con un punto que
 * palpita en verde (trabajo) o en rojo (urgente). Sin pendientes no hay nada.
 */
const base = [
  {
    titulo: 'Operación',
    items: [
      { clave: 'verifications', texto: 'Verificaciones', a: '/x/verifications' },
      { clave: 'rides', texto: 'Viajes', a: '/x/rides' },
      { clave: 'tickets', texto: 'Tickets', a: '/x/tickets' },
    ],
  },
];

function montar(menu: Parameters<typeof conPendientes>[1]) {
  render(
    <SesionArmazon.Provider
      value={{ usuario: null, idioma: 'es', cambiar: vi.fn(), salir: vi.fn() }}
    >
      <Armazon grupos={conPendientes(base, menu)}>
        <p>Contenido</p>
      </Armazon>
    </SesionArmazon.Provider>,
  );
}

describe('C-AVISOS-MENU', () => {
  it('pone el número y el tono a cada sección con pendientes', () => {
    montar([
      { clave: 'verifications', cantidad: 3, tono: 'trabajo' },
      { clave: 'rides', cantidad: 1, tono: 'urgente', urgentes: 1 },
      { clave: 'tickets', cantidad: 3, tono: 'urgente', urgentes: 1 },
    ]);
    const v = screen.getByTestId('pendiente-verifications');
    expect(v).toHaveTextContent('3');
    expect(v).toHaveClass('pd-item-trabajo');
    expect(v).toHaveAttribute('aria-label', '3 pendientes');
    const r = screen.getByTestId('pendiente-rides');
    expect(r).toHaveClass('pd-item-urgente');
    expect(r).toHaveAttribute(
      'aria-label',
      '1 pendiente · 1 pasó su límite (más de 24 h o una emergencia)',
    );
    // El rojo dice por qué: de 3, solo 1 pasó su límite (Gerencia, 21 nov).
    const tk = screen.getByTestId('pendiente-tickets');
    expect(tk).toHaveAttribute(
      'title',
      '3 pendientes · 1 pasó su límite (más de 24 h o una emergencia)',
    );
    expect(v).toHaveAttribute('title', '3 pendientes');
  });

  it('sin pendientes, el menú queda igual (el punto se apaga al atender)', () => {
    montar([]);
    expect(screen.queryByTestId('pendiente-verifications')).toBeNull();
    expect(conPendientes(base, [])).toBe(base);
  });

  it('C-CONTADORES-DE-TAREA: con tareas, tocar el ítem lleva a esas tareas ya filtradas', () => {
    const g = conPendientes(
      [
        {
          titulo: 'Personas',
          items: [
            { clave: 'drivers', texto: 'Repartidores', a: '/x/drivers' },
            { clave: 'tickets', texto: 'Tickets', a: '/x/tickets' },
          ],
        },
      ],
      [{ clave: 'drivers', cantidad: 3, tono: 'trabajo' }],
      filtrosPendientes,
    );
    expect(g[0]?.items[0]?.a).toBe('/x/drivers?zona=sin_zona');
    // Sin tareas, la sección de siempre (sin filtro).
    expect(g[0]?.items[1]?.a).toBe('/x/tickets');
  });

  it('más de 99 se dice «99+»', () => {
    montar([{ clave: 'tickets', cantidad: 140, tono: 'trabajo' }]);
    expect(screen.getByTestId('pendiente-tickets')).toHaveTextContent('99+');
  });

  it('el punto palpita en CSS y se queda quieto para quien pide menos movimiento', () => {
    const css = readFileSync(join(__dirname, 'armazon.css'), 'utf8');
    expect(css).toContain('@keyframes pd-palpita');
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*\{[^@]*\.pd-item-punto::after/);
    // El superadmin lo pide con la misma lectura de la campana (cada 30 s, nada escribe).
    const app = readFileSync(join(__dirname, '..', 'PanelApp.tsx'), 'utf8');
    expect(app).toContain('conPendientes(grupos, pendientesMenu, filtrosPendientes)');
  });
});
