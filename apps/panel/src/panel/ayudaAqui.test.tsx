import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AyudaAqui, BaseAyudaInterna, olvidarAyuda } from './AyudaAqui';

/**
 * C-AYUDA-AQUI (16 nov 2026, Richard) — todos los países. El «?» va al lado de cada parte del
 * superadmin que tiene explicación en la ayuda interna, y abre ESA explicación en un panel lateral.
 * Este candado falla si una pantalla con guía se queda sin su «?», o si una guía de la ayuda no
 * tiene ningún «?» que lleve a ella.
 */
const AQUI = __dirname;
const MAPA: [archivo: string, guia: string][] = [
  ['BuscadorSuper.tsx', 'search-orders-rides-people'],
  ['SuperPedido.tsx', 'monitor-live-orders-rides'],
  ['SuperPedido.tsx', 'traffic-light-stuck'],
  ['FichaPiezas.tsx', 'read-order-ride-file'],
  ['RastreoVivo.tsx', 'read-order-ride-file'],
  ['SuperConfiguracion.tsx', 'time-zone-clock'],
  ['SuperConfiguracion.tsx', 'add-team-members-permissions'],
  ['SuperEquipo.tsx', 'add-team-members-permissions'],
  ['Superadmin.tsx', 'link-support-ticket'],
  ['Superadmin.tsx', 'how-divoox-works'],
  ['SuperReportes.tsx', 'flagged-content'],
  ['SuperAprobaciones.tsx', 'two-person-approval'],
  ['ResolverAutorizacion.tsx', 'resolve-expired-card-authorization'],
  ['SuperRegalosDivoox.tsx', 'create-divoox-gift-code'],
  ['SuperSaldoConductores.tsx', 'driver-balance-top-up'],
  ['SuperAgentes.tsx', 'divoox-agents'],
  ['SuperReferidosEquipos.tsx', 'referrals-and-teams'],
  ['SuperBanners.tsx', 'app-banners'],
  ['SuperCamila.tsx', 'camila-support-inbox'],
  ['CambiarCiudadConductor.tsx', 'change-driver-city'],
];
const fuente = (archivo: string) => readFileSync(join(AQUI, archivo), 'utf8');

describe('C-AYUDA-AQUI: cada parte con guía lleva su «?»', () => {
  it('cada pantalla del superadmin con guía tiene su «?» apuntando a ella', () => {
    for (const [archivo, guia] of MAPA)
      expect(
        [...fuente(archivo).matchAll(/<AyudaAqui[^>]*guia="([a-z-]+)"/g)].map((m) => m[1]),
        `${archivo} sin «?» de ${guia}`,
      ).toContain(guia);
  });

  it('toda guía de la ayuda interna tiene al menos un «?» en el panel', () => {
    const guias = readFileSync(
      join(AQUI, '..', '..', '..', 'servidor', 'src', 'ayudaInterna', 'guias.ts'),
      'utf8',
    );
    const ids = new Set([...guias.matchAll(/^\s+id: '([a-z0-9-]+)',$/gm)].map((m) => m[1]));
    for (const id of ['start', 'monitoring', 'support', 'money', 'settings']) ids.delete(id);
    expect(ids.size).toBeGreaterThanOrEqual(11);
    const cubiertas = new Set(MAPA.map(([, g]) => g));
    for (const id of ids) expect(cubiertas.has(id ?? ''), `guía ${id} sin «?»`).toBe(true);
  });
});

const SECCIONES = [
  {
    id: 'monitoring',
    titulo: 'Monitoreo',
    guias: [
      {
        id: 'read-order-ride-file',
        titulo: 'Leer la ficha de un pedido o un viaje',
        resumen: 'Cada pedido y viaje tiene su ficha.',
        explicacion: [
          'La tarjeta Tiempos calcula cada paso.',
          'La tarjeta En vivo muestra el mapa.',
        ],
        pasos: ['Abre la ficha.'],
      },
    ],
  },
];

describe('C-AYUDA-AQUI: el panel lateral', () => {
  beforeEach(() => {
    olvidarAyuda();
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ secciones: SECCIONES }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fuera del superadmin no dibuja nada (ningún otro panel ve la ayuda del equipo)', () => {
    render(<AyudaAqui guia="read-order-ride-file" idioma="es" />);
    expect(screen.queryByRole('button', { name: 'Cómo funciona esta parte' })).toBeNull();
  });

  it('abre la explicación de ESA parte sin salir de la pantalla, con enlace a la guía completa', async () => {
    render(
      <BaseAyudaInterna.Provider value="/panel/control-abc">
        <h2>
          En vivo <AyudaAqui guia="read-order-ride-file" parrafo={1} idioma="es" />
        </h2>
      </BaseAyudaInterna.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cómo funciona esta parte' }));
    const panel = await screen.findByRole('dialog', {
      name: 'Leer la ficha de un pedido o un viaje',
    });
    const parte = within(panel).getByText('Esta parte').parentElement as HTMLElement;
    expect(parte).toHaveTextContent('La tarjeta En vivo muestra el mapa.');
    expect(within(panel).getByRole('link', { name: /guía completa/ })).toHaveAttribute(
      'href',
      '/panel/control-abc/help/read-order-ride-file',
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
