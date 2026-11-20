import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuperRegalosDivoox } from './SuperRegalosDivoox';

// C-CUPON-USOS en el panel: el reporte dice cuántas personas lo tomaron y cuántas quedan.
describe('C-CUPON-USOS en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('un cupón con tope de personas muestra «quedan N» y el formulario deja escribir el tope', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            cupones: [
              {
                codigo: 'EJEMPLO01',
                nombreEs: 'Regalo de ejemplo',
                nombreEn: 'Sample gift',
                tipo: 'monto',
                valor: 200,
                moneda: 'USD',
                servicios: ['moto'],
                zonas: ['Z1'],
                venceEn: null,
                presupuesto: 25_000,
                bienvenida: false,
                topeDiarioConductor: 6,
                activo: false,
                agotado: false,
                gastado: 400,
                apartado: 0,
                restante: 24_600,
                usos: 2,
                usosMaximos: 125,
                usosTomados: 2,
                usosQuedan: 123,
              },
            ],
            conductores: [],
            zonas: [{ id: 'Z1', nombre: 'Ciudad Ejemplo', pais: 'US', moneda: 'USD' }],
            servicios: ['moto'],
            topes: {
              valorMaximo: 1_000,
              presupuestoMaximo: 50_000,
              presupuestoGlobalMaximo: 100_000,
            },
            alertas: [],
            revisiones: [],
            pendientes: [],
          }),
          { status: 200 },
        ),
    );
    render(<SuperRegalosDivoox idioma="es" />);
    expect((await screen.findByTestId('regalo-quedan-usos')).textContent).toBe(
      'Lo tomaron 2 de 125 personas · quedan 123',
    );
    expect(screen.getByTestId('regalo-usos-maximos')).toBeTruthy();
  });
});
