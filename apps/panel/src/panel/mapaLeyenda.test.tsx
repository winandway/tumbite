import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RastreoVivo } from './RastreoVivo';
import { PermisosContexto } from './permisosPanel';
import { ProveedorHorario } from './horario';

/**
 * C-MAPA-LEYENDA y C-TIEMPO-HUMANO (16 nov 2026, Richard en la ficha en vivo del #B4290C: no supo
 * quién era quién en el mapa, y leyó «Sin señal hace 45805 min»). Todos los países.
 * El mapa de Google se cambia por botones (uno por marca) para poder «tocar» cada una.
 */
vi.mock('@tumbite/compartido/src/mapaWebGoogle', async (original) => ({
  ...(await original<typeof import('@tumbite/compartido/src/mapaWebGoogle')>()),
  elegirMapaWeb: () => 'google',
  MapaGoogleBajoDemanda: ({
    puntos,
  }: {
    puntos: { id: string; etiqueta?: string; alTocar?: () => void }[];
  }) => (
    <div>
      {puntos.map((p) => (
        <button key={p.id} type="button" data-marca={p.id} onClick={p.alTocar}>
          marca {p.id}
        </button>
      ))}
    </div>
  ),
}));

const respuesta = (haceS: number) => ({
  vivo: true,
  estado: 'en_camino',
  fase: 'llevando',
  esEnvio: false,
  origen: { lat: 25.77, lng: -80.19 },
  destino: { lat: 25.78, lng: -80.2 },
  posicion: { lat: 25.775, lng: -80.195, en: new Date().toISOString(), haceS },
  llegada: null,
  ruta: null,
  detenido: { motivo: 'sin_senal', desdeS: haceS },
});

function montar(idioma: 'es' | 'en', haceS: number) {
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(JSON.stringify(String(url).includes('/rastreo') ? respuesta(haceS) : {})),
  );
  return render(
    <PermisosContexto.Provider
      value={{ acceso: null, cargando: false, puedeVer: () => true, recargar: () => undefined }}
    >
      <ProveedorHorario>
        <RastreoVivo
          tipo="pedido"
          id="b4290c3e-5bfe-401c-ad55-0fbef2bb9806"
          idioma={idioma}
          zona="America/New_York"
          pais="US"
          fijos={[
            { id: 'rest', lat: 25.77, lng: -80.19, color: '#101010', etiqueta: 'Novi Pizza Co.' },
            { id: 'casa', lat: 25.78, lng: -80.2, color: '#f20d20', etiqueta: '41200 Ten Mile Rd' },
          ]}
          vivo
        />
      </ProveedorHorario>
    </PermisosContexto.Provider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('C-MAPA-LEYENDA · quién es quién en el mapa en vivo', () => {
  it('la leyenda está siempre a la vista, en español y en inglés', async () => {
    montar('es', 120);
    const leyenda = await screen.findByRole('list', { name: 'Qué es cada marca' });
    expect([...leyenda.querySelectorAll('li')].map((l) => l.textContent)).toEqual([
      'Repartidor',
      'Restaurante',
      'Cliente (destino)',
    ]);
    // El repartidor con el mismo dibujo del mapa (el isotipo); los demás con su color.
    expect(leyenda.querySelector('img')).toBeTruthy();
  });

  it('en inglés', async () => {
    montar('en', 120);
    const leyenda = await screen.findByRole('list', { name: 'Map key' });
    expect([...leyenda.querySelectorAll('li')].map((l) => l.textContent)).toEqual([
      'Driver',
      'Restaurant',
      'Customer (drop-off)',
    ]);
  });

  it('tocar cada marca dice su nombre debajo del mapa', async () => {
    montar('es', 120);
    await userEvent.click(await screen.findByRole('button', { name: 'marca rest' }));
    expect(screen.getByTestId('mapa-tocado').textContent).toBe('Restaurante: Novi Pizza Co.');
    await userEvent.click(screen.getByRole('button', { name: 'marca casa' }));
    expect(screen.getByTestId('mapa-tocado').textContent).toBe(
      'Cliente (destino): 41200 Ten Mile Rd',
    );
    await userEvent.click(screen.getByRole('button', { name: 'marca repartidor' }));
    expect(screen.getByTestId('mapa-tocado').textContent).toBe('Repartidor');
  });
});

describe('C-TIEMPO-HUMANO · la señal vieja se dice en días, no en miles de minutos', () => {
  it('«Sin señal hace 31 días» y «Última señal hace 31 días»', async () => {
    montar('es', 45805 * 60);
    expect((await screen.findByTestId('ficha-detenido')).textContent).toBe(
      'Sin señal hace 31 días',
    );
    expect(screen.getByTestId('ficha-senal').textContent).toBe('Última señal hace 31 días');
  });
});
