import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Armazon, SesionArmazon } from './Armazon';
import type { AvisoCampana } from './Campana';

/**
 * C-CAMPANA-SE-VACIA (23 nov 2026, Richard): «uno le da clic, la abre, los lee, ve el historial y ya
 * esa no se vuelve a ver más». La campana cuenta solo lo NO leído; al abrirla va a cero en ese
 * momento, avisa al servidor UNA vez (lo guarda por cuenta) y lo leído queda como historial apagado.
 */
const grupos = [
  { titulo: 'Operación', items: [{ clave: 'inicio', texto: 'Inicio', a: '/panel' }] },
];

const avisos: AvisoCampana[] = [
  {
    clave: 'ticket-t1',
    texto: 'Ticket nuevo',
    detalle: 'No llega mi pedido',
    en: '2026-11-23 10:05:00',
    a: '/panel/control-x/tickets/t1',
    leido: false,
  },
  {
    clave: 'sin_zona-c1',
    texto: 'Conductor sin ciudad',
    detalle: 'Ana',
    en: '2026-11-23 09:00:00',
    a: '/panel/control-x/drivers/c1',
    leido: false,
  },
  {
    clave: 'ticket-t0',
    texto: 'Ticket nuevo',
    detalle: 'Cambio de dirección',
    en: '2026-11-20 08:00:00',
    a: '/panel/control-x/tickets/t0',
    leido: true,
    resuelto: true,
  },
];

function montar(lista: AvisoCampana[], alAbrir = vi.fn()) {
  const r = render(
    <SesionArmazon.Provider
      value={{ usuario: null, idioma: 'es', cambiar: vi.fn(), salir: vi.fn() }}
    >
      <Armazon grupos={grupos} campana={{ avisos: lista, alAbrir }}>
        <p>Contenido</p>
      </Armazon>
    </SesionArmazon.Provider>,
  );
  return { alAbrir, ...r };
}

describe('C-CAMPANA-SE-VACIA · la campana del panel', () => {
  beforeEach(() => vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 })));
  afterEach(() => vi.unstubAllGlobals());

  it('cuenta solo lo no leído, y al abrirla va a CERO y lo guarda una sola vez', async () => {
    const { alAbrir } = montar(avisos);
    const boton = screen.getByRole('button', { name: 'Avisos: 2 sin leer' });
    expect(within(boton).getByText('2')).toBeInTheDocument();
    await userEvent.click(boton);
    // En ese mismo momento, cero: el número desaparece.
    expect(screen.getByRole('button', { name: 'Avisos' })).toBeInTheDocument();
    expect(document.querySelector('.pd-campana-numero')).toBeNull();
    // Se guarda en el servidor «visto hasta» el más nuevo, una sola vez.
    expect(alAbrir).toHaveBeenCalledTimes(1);
    expect(alAbrir).toHaveBeenCalledWith('2026-11-23 10:05:00');
    // Cerrar y volver a abrir no vuelve a escribir.
    await userEvent.click(screen.getByRole('button', { name: 'Avisos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Avisos' }));
    expect(alAbrir).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.pd-campana-numero')).toBeNull();
  });

  it('cada aviso dice qué pasó, cuándo, y lleva al lugar donde se resuelve; lo nuevo resaltado y lo leído apagado', async () => {
    montar(avisos);
    await userEvent.click(screen.getByRole('button', { name: /Avisos/ }));
    const enlace = screen.getByRole('link', { name: /Ticket nuevo.*No llega mi pedido/ });
    expect(enlace).toHaveAttribute('href', '/panel/control-x/tickets/t1');
    expect(enlace.closest('li')).toHaveClass('pd-aviso-nuevo');
    const viejo = screen.getByRole('link', { name: /Cambio de dirección/ });
    expect(viejo.closest('li')).toHaveClass('pd-aviso-leido');
    // Lo resuelto se dice en verde.
    expect(within(viejo).getByText('Resuelto')).toHaveClass('pd-aviso-resuelto');
    expect(screen.getAllByRole('link', { name: /Conductor sin ciudad/ })).toHaveLength(1);
  });

  it('sin nada nuevo, abrirla no escribe nada', async () => {
    const { alAbrir } = montar(avisos.map((a) => ({ ...a, leido: true })));
    await userEvent.click(screen.getByRole('button', { name: 'Avisos' }));
    expect(alAbrir).not.toHaveBeenCalled();
  });

  it('llega algo NUEVO después de abrirla: vuelve a contar uno', async () => {
    const { alAbrir, rerender } = montar(avisos);
    await userEvent.click(screen.getByRole('button', { name: /Avisos/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Avisos' }));
    const nuevo: AvisoCampana = {
      clave: 'ticket-t2',
      texto: 'Ticket nuevo',
      en: '2026-11-23 11:00:00',
      a: '/x',
      leido: false,
    };
    // La siguiente lectura del servidor ya trae los de antes como leídos y uno nuevo.
    rerender(
      <SesionArmazon.Provider
        value={{ usuario: null, idioma: 'es', cambiar: vi.fn(), salir: vi.fn() }}
      >
        <Armazon
          grupos={grupos}
          campana={{ avisos: [nuevo, ...avisos.map((a) => ({ ...a, leido: true }))], alAbrir }}
        >
          <p>Contenido</p>
        </Armazon>
      </SesionArmazon.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Avisos: 1 sin leer' })).toBeInTheDocument();
  });

  it('sin avisos, la campana lo dice y no inventa números', async () => {
    montar([]);
    await userEvent.click(screen.getByRole('button', { name: 'Avisos' }));
    expect(screen.getByText('No hay avisos todavía.')).toBeInTheDocument();
  });
});
