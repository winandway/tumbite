import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { RastreoVivo, REFRESCO_RASTREO_MS } from './RastreoVivo';
import { TarjetaTiempos } from './FichaPiezas';
import { PermisosContexto } from './permisosPanel';
import { ProveedorHorario } from './horario';

/**
 * C-RASTREO-VIVO y C-TIEMPOS-OPERACION (16 nov 2026, orden de Richard). Todos los países.
 * La tarjeta «En vivo» pregunta solo mientras la ficha está abierta y visible, dice la hora de
 * llegada y si el repartidor está detenido; sin el permiso de ubicación no pide nada.
 */
const ID = '407f2f1c-1234-4abc-9def-000000000001';
const VIVO = {
  vivo: true,
  estado: 'en_camino',
  fase: 'llevando',
  esEnvio: false,
  origen: { lat: 25.77, lng: -80.19 },
  destino: { lat: 25.78, lng: -80.2 },
  posicion: { lat: 25.775, lng: -80.195, en: new Date().toISOString(), haceS: 200 },
  llegada: {
    fase: 'llevando',
    llegaEn: '2026-11-16T20:28:00.000Z',
    faltanS: 540,
    tramoFaltanS: null,
    distanciaM: 3200,
    fuente: 'trafico',
    calculadaHaceS: 20,
  },
  ruta: null,
  detenido: { motivo: 'quieto', desdeS: 240 },
};

function servidor(respuesta: () => unknown) {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    // El horario del empleado pide sus preferencias: no cuenta como rastreo.
    if (String(url).includes('/rastreo')) llamadas.push(String(url));
    return new Response(JSON.stringify(String(url).includes('/rastreo') ? respuesta() : {}));
  });
  return llamadas;
}
const permisos = (si: boolean) => ({
  acceso: null,
  cargando: false,
  puedeVer: (p: string) => si || p !== 'viajes.ubicacion_en_vivo',
  recargar: () => undefined,
});
const montar = (si = true) =>
  render(
    <PermisosContexto.Provider value={permisos(si)}>
      <ProveedorHorario>
        <RastreoVivo
          tipo="pedido"
          id={ID}
          idioma="es"
          zona="America/New_York"
          pais="US"
          fijos={[]}
          vivo
        />
      </ProveedorHorario>
    </PermisosContexto.Provider>,
  );

let visibilidad: DocumentVisibilityState = 'visible';
Object.defineProperty(document, 'visibilityState', { get: () => visibilidad, configurable: true });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  visibilidad = 'visible';
});

describe('C-RASTREO-VIVO · tarjeta «En vivo» de la ficha', () => {
  it('dice el tramo, la hora de llegada, lo que falta, la última señal y «detenido»', async () => {
    servidor(() => VIVO);
    montar();
    expect(await screen.findByText(/Llevando el pedido/)).toBeTruthy();
    const llegada = screen.getByTestId('ficha-llegada').textContent ?? '';
    expect(llegada).toContain('Llega a las 3:28 p. m.');
    expect(llegada).toContain('faltan 9 min');
    expect(llegada).toContain('3.2 km');
    expect(screen.getByTestId('ficha-senal').textContent).toBe('Última señal hace 3 min');
    expect(screen.getByTestId('ficha-detenido').textContent).toBe('Detenido hace 4 min');
  });

  it('pregunta cada 5 s solo con la pestaña visible; oculta, se pausa; cerrado, deja de preguntar', async () => {
    vi.useFakeTimers();
    let vivo = true;
    const llamadas = servidor(() => (vivo ? VIVO : { ...VIVO, vivo: false, posicion: null }));
    montar();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(llamadas).toEqual([`/datos/admin/pedidos/${ID}/rastreo`]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESCO_RASTREO_MS);
    });
    expect(llamadas).toHaveLength(2);
    // Pestaña oculta: no pregunta por más que pase el tiempo.
    visibilidad = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESCO_RASTREO_MS * 6);
    });
    expect(llamadas).toHaveLength(2);
    // Vuelve: pregunta de una. Y si ya terminó, no vuelve a preguntar.
    vivo = false;
    visibilidad = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESCO_RASTREO_MS * 4);
    });
    expect(llamadas).toHaveLength(3);
  });

  it('sin el permiso de ubicación en vivo no pide nada y lo dice', async () => {
    const llamadas = servidor(() => VIVO);
    montar(false);
    expect(screen.getByText(/no tiene permiso para ver la ubicación en vivo/)).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(llamadas).toHaveLength(0);
  });
});

describe('C-TIEMPOS-OPERACION · tramo abierto o abandonado', () => {
  const base = { previstoS: 900, diferenciaMin: null, falta: [] };
  it('«en curso» dice «Lleva» y no «Se pasó»; «sin cerrar» va en gris con su explicación', () => {
    render(
      <TarjetaTiempos
        idioma="es"
        tiempos={[
          { clave: 'entrega', realS: 1800, resultado: 'en_curso', ...base },
          { clave: 'total', realS: 761 * 3600 + 36 * 60, resultado: 'sin_cerrar', ...base },
        ]}
      />,
    );
    const texto = document.body.textContent ?? '';
    expect(texto).not.toContain('Tomó');
    expect(texto).not.toContain('Se pasó');
    expect(texto).toContain('Lleva');
    expect(texto).toContain('Sin cerrar');
    expect(texto).toContain('Abierto hace');
    expect(texto).toContain('no hubo movimiento en más de 12 horas');
    expect(document.querySelector('.ficha-tramo-neutro')).toBeTruthy();
  });
});
