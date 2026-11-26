import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MandarWhatsappFalta, WhatsappFaltaAjustes } from './WhatsappFalta';
import { PermisosContexto } from './permisosPanel';

/**
 * C-WHATSAPP-FALTA en el panel (25 nov 2026) — todos los países. «Mandarle por WhatsApp lo que le
 * falta»: primero la vista previa con el texto exacto, nada sale sin confirmar, y si ya se le mandó uno
 * hace menos de 24 horas se pide otra confirmación. Sin permiso no se ofrece. Los ajustes dicen en
 * palabras por qué no sale nada. Datos neutros.
 */
type Llamada = { metodo: string; url: string; cuerpo: unknown };
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });

const TEXTO =
  'Hola Ana 👋 Para que tu cuenta de Divoox Driver empiece a recibir carreras te falta: enviar tu moto a revisión. Entra a la app y complétalo. Si tienes dudas, responde a este mensaje.';
const vista = (extra: Record<string, unknown> = {}) => ({
  id: 'u-ejemplo-1',
  nombre: 'Ana Ejemplo',
  falta: { clave: 'vehiculo_enviar', texto: 'enviar tu moto a revisión' },
  texto: TEXTO,
  puede: true,
  motivo: null,
  delPaso: 0,
  ultimoEn: null,
  ...extra,
});

function simular(respuestas: (c: Llamada) => Response) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const c = {
      metodo: init?.method ?? 'GET',
      url: String(url),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    llamadas.push(c);
    return respuestas(c);
  });
  return llamadas;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('C-WHATSAPP-FALTA: el botón de la ficha y de Verificaciones', () => {
  it('muestra el texto exacto y NO envía hasta confirmar; al confirmar manda una sola vez', async () => {
    const llamadas = simular((c) =>
      (c.cuerpo as { soloVista?: boolean })?.soloVista
        ? json({ vista: vista() })
        : json({ vista: vista(), enviado: true, estado: 'enviado' }),
    );
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    render(<MandarWhatsappFalta id="u-ejemplo-1" idioma="es" />);
    await userEvent.click(screen.getByTestId('whatsapp-falta-boton'));
    expect(await screen.findByTestId('whatsapp-falta-texto')).toHaveTextContent(TEXTO);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]!.cuerpo).toEqual({ soloVista: true });
    // Dice que no: nada sale.
    await userEvent.click(screen.getByTestId('whatsapp-falta-enviar'));
    expect(llamadas).toHaveLength(1);
    // Dice que sí: una sola llamada que envía.
    await userEvent.click(screen.getByTestId('whatsapp-falta-enviar'));
    await screen.findByText(/le mandamos el WhatsApp/);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[1]!.cuerpo).toEqual({ confirmar: true });
    expect(confirmar).toHaveBeenCalledTimes(2);
  });

  it('menos de 24 horas: lo dice y NO ofrece mandarlo (a mano tampoco se salta)', async () => {
    const llamadas = simular(() =>
      json({ vista: vista({ puede: false, motivo: 'ya_hoy', delPaso: 1 }) }),
    );
    render(<MandarWhatsappFalta id="u-ejemplo-1" idioma="es" />);
    await userEvent.click(screen.getByTestId('whatsapp-falta-boton'));
    expect(await screen.findByTestId('whatsapp-falta-motivo')).toHaveTextContent(
      'Ya le mandamos uno hace menos de 24 horas.',
    );
    expect(screen.queryByTestId('whatsapp-falta-enviar')).toBeNull();
    expect(llamadas).toHaveLength(1);
  });

  it('cuenta nuestra o zona de revisión: lo dice y no hay botón de enviar', async () => {
    for (const [motivo, texto] of [
      ['cuenta_interna', 'Es una cuenta nuestra'],
      ['zona_revision', 'zona de revisión de las tiendas'],
    ] as const) {
      simular(() => json({ vista: vista({ puede: false, motivo }) }));
      const { unmount } = render(<MandarWhatsappFalta id="u-ejemplo-1" idioma="es" />);
      await userEvent.click(screen.getByTestId('whatsapp-falta-boton'));
      expect(await screen.findByTestId('whatsapp-falta-motivo')).toHaveTextContent(texto);
      expect(screen.queryByTestId('whatsapp-falta-enviar')).toBeNull();
      unmount();
    }
  });

  it('sin consentimiento no hay botón de enviar, y dice por qué en palabras', async () => {
    simular(() => json({ vista: vista({ puede: false, motivo: 'no_confirmo_por_whatsapp' }) }));
    render(<MandarWhatsappFalta id="u-ejemplo-1" idioma="es" />);
    await userEvent.click(screen.getByTestId('whatsapp-falta-boton'));
    expect(await screen.findByTestId('whatsapp-falta-motivo')).toHaveTextContent(
      'No confirmó su celular con el código por WhatsApp',
    );
    expect(screen.queryByTestId('whatsapp-falta-enviar')).toBeNull();
  });

  it('sin el permiso de escribirle a la persona, el botón no se ofrece', () => {
    render(
      <PermisosContexto.Provider
        value={{
          acceso: null,
          cargando: false,
          puedeVer: (p) => p !== 'tickets.responder',
          recargar: () => undefined,
        }}
      >
        <MandarWhatsappFalta id="u-ejemplo-1" idioma="es" />
      </PermisosContexto.Provider>,
    );
    expect(screen.queryByTestId('whatsapp-falta-boton')).toBeNull();
  });
});

describe('C-WHATSAPP-FALTA: los ajustes y la zona', () => {
  const ESTADO = {
    listo: false,
    motivo: 'plantilla_no_aprobada',
    plantilla: {
      nombre: 'divoox_driver_te_falta',
      estado: 'PENDING',
      categoria: 'UTILITY',
      motivo: null,
      cuerpo: 'Hola {{1}} 👋 … te falta: {{2}}. …',
    },
    ajustes: {
      paises: { VE: true, US: false },
      topeDiario: 150,
      presupuestoDiaUsd: 3,
      costoUsd: 0.01,
    },
    gasto: { mensajes: 0, usd: 0 },
    zonas: [{ id: 'ZZ-EJEMPLO-A', nombre: 'Zona de ejemplo A', pais: 'VE' }],
  };

  it('sin plantilla aprobada dice que no sale nada; la zona se mira y se manda solo confirmando', async () => {
    const llamadas = simular((c) => {
      if (c.url.endsWith('/datos/admin/camila/whatsapp')) return json(ESTADO);
      if (c.metodo === 'GET')
        return json({
          filas: [
            vista(),
            vista({ id: 'u-ejemplo-2', nombre: 'Luis Ejemplo', puede: false, motivo: 'baja' }),
          ],
          hayMas: false,
        });
      return json({ enviados: 1, fallidos: 0, filas: [] });
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WhatsappFaltaAjustes idioma="es" />);
    expect(await screen.findByTestId('whatsapp-falta-estado')).toHaveTextContent(
      'La plantilla todavía no está aprobada por Meta',
    );
    await userEvent.selectOptions(screen.getByTestId('whatsapp-falta-zona'), 'ZZ-EJEMPLO-A');
    await userEvent.click(screen.getByRole('button', { name: 'Ver a quién se le manda' }));
    expect(await screen.findByTestId('whatsapp-falta-tabla')).toHaveTextContent(
      'Pidió no recibir más recordatorios.',
    );
    await userEvent.click(screen.getByTestId('whatsapp-falta-zona-enviar'));
    await screen.findByText(/Salieron 1/);
    const post = llamadas.find((c) => c.metodo === 'POST');
    expect(post!.url).toContain('/datos/admin/camila/whatsapp/zona/ZZ-EJEMPLO-A');
    // Solo los que pueden recibirlo, y confirmado.
    expect(post!.cuerpo).toEqual({ ids: ['u-ejemplo-1'], confirmar: true });
  });
});
