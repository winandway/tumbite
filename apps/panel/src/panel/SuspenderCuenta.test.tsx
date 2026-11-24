import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuspenderCuenta } from './SuspenderCuenta';

/**
 * C-CUENTA-UNICA-SUSPENSION (revisor de calidad, 24 nov 2026): el panel suspendía sin decir por qué y
 * el servidor lo tomaba como «otra razón» = la persona entera. Suspender a un conductor por papeles
 * vencidos le quitaba también la cuenta de cliente. Ahora el panel pide el tipo, con «papeles
 * vencidos» primero y marcado en la ficha del conductor, y lo manda. Vista en rojo quitando
 * `motivoTipo` del envío.
 */
function servidor() {
  const envios: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    envios.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ activo: true, papelConductor: 'suspendido' }));
  });
  return envios;
}

describe('suspender pide el porqué y lo manda', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('en la ficha de un conductor, «papeles vencidos» va marcado y se manda motivoTipo', async () => {
    const envios = servidor();
    const alSuspender = vi.fn();
    render(
      <SuspenderCuenta
        id="c1"
        esConductor
        idioma="es"
        alCerrar={() => undefined}
        alSuspender={alSuspender}
      />,
    );
    const papeles = screen.getByLabelText(/Papeles vencidos/);
    expect(papeles).toBeChecked();
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Licencia vencida');
    await userEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    await waitFor(() => expect(alSuspender).toHaveBeenCalled());
    expect(envios[0]).toMatchObject({ activo: false, motivoTipo: 'papeles' });
  });

  it('se puede elegir fraude; en un cliente no aparece «papeles vencidos»', async () => {
    const envios = servidor();
    render(
      <SuspenderCuenta
        id="c2"
        esConductor
        idioma="es"
        alCerrar={() => undefined}
        alSuspender={() => undefined}
      />,
    );
    await userEvent.click(screen.getByLabelText(/^Fraude/));
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Cobros falsos');
    await userEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    await waitFor(() => expect(envios[0]).toMatchObject({ motivoTipo: 'fraude' }));
  });

  it('en un cliente no se ofrece «papeles vencidos»', () => {
    render(
      <SuspenderCuenta
        id="c3"
        esConductor={false}
        idioma="en"
        alCerrar={() => undefined}
        alSuspender={() => undefined}
      />,
    );
    expect(screen.queryByLabelText(/Expired documents/)).toBeNull();
    expect(screen.getByLabelText(/Another reason/)).toBeChecked();
  });

  it('la ficha abre este formulario para suspender (nunca el PATCH sin porqué)', () => {
    const ficha = readFileSync(join(__dirname, 'SuperFichas.tsx'), 'utf8');
    expect(ficha).toContain('<SuspenderCuenta');
    expect(ficha).toContain("esConductor={rol === 'repartidor'}");
  });
});
