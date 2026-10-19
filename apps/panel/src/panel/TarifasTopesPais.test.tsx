import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TarifasTopesPais } from './TarifasTopesPais';

/** C-TOPES-PAIS: el superadmin escribe tarifas y topes de un país, en su moneda. */
describe('tarifas y topes de un país en el superadmin', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('Estados Unidos no se edita aquí', () => {
    render(
      <TarifasTopesPais
        pais="US"
        moneda="USD"
        tarifas={null}
        topes={null}
        idioma="es"
        guardar={vi.fn()}
      />,
    );
    expect(screen.getByText(/configuración de siempre/)).toBeInTheDocument();
  });

  it('un país sin nada dice qué falta; los topes en pesos se guardan como pesos; a medias, no', async () => {
    const guardar = vi.fn(async () => undefined);
    render(
      <TarifasTopesPais
        pais="CO"
        moneda="COP"
        tarifas={null}
        topes={null}
        idioma="es"
        guardar={guardar}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Incompleto.*las tarifas, los topes/);
    await userEvent.type(screen.getByLabelText('Propina máxima'), '200000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar tarifas y topes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Completa todos los campos/);
    expect(guardar).not.toHaveBeenCalled();
    const valores: [string, string][] = [
      ['Bono de la oferta abierta', '3000'],
      ['Precio máximo de una opción', '40000'],
      ['Propina posterior mínima', '1000'],
      ['Propina posterior máxima', '40000'],
      ['Monto máximo de un cupón', '50000'],
      ['Reembolso automático máximo por queja', '60000'],
    ];
    for (const [etiqueta, v] of valores) await userEvent.type(screen.getByLabelText(etiqueta), v);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar tarifas y topes' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(guardar).toHaveBeenCalledWith({
      topes: {
        bonoOfertaAbierta: 3000,
        opcionPrecioMax: 40000,
        propinaMax: 200000,
        propinaExtraMin: 1000,
        propinaExtraMax: 40000,
        cuponMontoMax: 50000,
        quejaReembolsoMax: 60000,
      },
    });
  });

  it('lo escrito vuelve si se cierra la pantalla antes de guardar', async () => {
    const { unmount } = render(
      <TarifasTopesPais
        pais="VE"
        moneda="VES"
        tarifas={null}
        topes={null}
        idioma="en"
        guardar={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText('Maximum tip'), '150,50');
    await new Promise((r) => setTimeout(r, 700));
    unmount();
    render(
      <TarifasTopesPais
        pais="VE"
        moneda="VES"
        tarifas={null}
        topes={null}
        idioma="en"
        guardar={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Maximum tip')).toHaveValue('150,50'));
  });
});
