import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AyudaInterna, buscarAyuda } from './AyudaInterna';

/**
 * C-AYUDA-INTERNA (16 nov 2026) — todos los países. La ayuda del equipo dentro del superadmin: lee
 * las guías del servidor (nunca del paquete público), barra lateral por secciones, buscador desde la
 * primera letra, una página por guía y noindex mientras está abierta.
 */
const SECCIONES = [
  {
    id: 'start',
    titulo: 'Empieza aquí',
    guias: [
      {
        id: 'how-divoox-works',
        titulo: 'Así funciona Divoox: empieza aquí',
        resumen: 'Para quien entra nuevo al equipo: qué es Divoox y qué hace el equipo.',
        explicacion: ['Divoox es una plataforma de reparto y de viajes.'],
        capturas: [
          {
            src: '/datos/admin/ayuda/captura/monitoreo-pestanas-es.webp',
            alt: 'La pantalla Pedidos en curso con sus pestañas.',
            pie: 'Pedidos en curso.',
          },
        ],
        preguntas: ['Soy nuevo en el equipo: ¿por dónde empiezo?'],
        pasos: ['Lee esta guía.'],
      },
    ],
  },
  {
    id: 'monitoring',
    titulo: 'Monitoreo',
    guias: [
      {
        id: 'traffic-light-stuck',
        titulo: 'El semáforo y «Atascado»',
        resumen: 'Verde, amarillo y rojo en cada pedido y viaje.',
        pasos: ['Abre Pedidos en curso.'],
      },
    ],
  },
];

describe('C-AYUDA-INTERNA: la ayuda del equipo', () => {
  const pedidas: string[] = [];
  beforeEach(() => {
    localStorage.clear();
    pedidas.length = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      pedidas.push(String(url));
      return new Response(JSON.stringify({ secciones: SECCIONES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('el índice lista las secciones y sus guías, leídas del servidor, y no se indexa', async () => {
    render(<AyudaInterna base="/panel/control-abc" sub="" idioma="es" />);
    expect(
      await screen.findByRole('navigation', { name: 'Secciones de la ayuda' }),
    ).toBeInTheDocument();
    expect(pedidas.some((u) => u.includes('/datos/admin/ayuda?idioma=es'))).toBe(true);
    expect(screen.getAllByText('Así funciona Divoox: empieza aquí').length).toBeGreaterThan(0);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'noindex',
    );
  });

  it('cada guía es su propia página, con capturas por la dirección privada', async () => {
    render(<AyudaInterna base="/panel/control-abc" sub="/how-divoox-works" idioma="es" />);
    expect(
      await screen.findByRole('heading', { name: 'Así funciona Divoox: empieza aquí' }),
    ).toBeInTheDocument();
    const img = screen.getByRole('img', { name: /Pedidos en curso/ });
    expect(img.getAttribute('src')).toMatch(/^\/datos\/admin\/ayuda\/captura\//);
    expect(screen.getByRole('link', { name: /Siguiente/ })).toHaveAttribute(
      'href',
      '/panel/control-abc/help/traffic-light-stuck',
    );
  });

  it('una guía que no existe lo dice', async () => {
    render(<AyudaInterna base="/panel/control-abc" sub="/no-existe" idioma="es" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Esa guía no existe');
  });

  it('el buscador encuentra desde la primera letra, sin acentos', async () => {
    expect(buscarAyuda(SECCIONES, 'a').map((r) => r.guia.id)).toContain('how-divoox-works');
    expect(buscarAyuda(SECCIONES, 'semaforo').map((r) => r.guia.id)).toEqual([
      'traffic-light-stuck',
    ]);
    render(<AyudaInterna base="/panel/control-abc" sub="" idioma="es" />);
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Buscar en la ayuda' }),
      'sem',
    );
    // Los resultados reemplazan el contenido: solo la guía que coincide.
    const lista = await screen.findByRole('list');
    expect(lista).toHaveClass('ayi-resultados');
    expect(within(lista).getAllByRole('link')).toHaveLength(1);
    expect(within(lista).getByRole('link', { name: /El semáforo/ })).toBeInTheDocument();
  });
});
