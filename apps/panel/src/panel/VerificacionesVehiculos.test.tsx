import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperKyc } from './SuperKyc';
import { PapelesConductor } from './SuperPapeles';
import { BarraActivacion } from './RevisionConductor';
import { EVENTO_CAMBIO } from './sonarEvento';

/**
 * C-VERIFICACIONES-VEHICULOS, C-FOTO-DICE-LA-VERDAD, C-DOCUMENTO-VENCIDO-CLARO y
 * C-BARRA-VEHICULO-COHERENTE en el panel (25 nov 2026, Richard en Verificaciones) — todos los países.
 */
const BASE = '/panel/control-x';
type Llamada = { url: string; metodo: string; cuerpo: unknown };

function servidor(manejar: (url: string, metodo: string) => unknown) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({
      url,
      metodo,
      cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return new Response(JSON.stringify(manejar(url, metodo) ?? {}), { status: 200 });
  });
  return llamadas;
}
const haceHoras = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');

const moto = (x: Record<string, unknown> = {}) => ({
  id: 'veh-1',
  conductor_id: 'con-1',
  conductor: 'Conductor Uno',
  codigo: 'VE-ZZN-000003',
  zona: 'Ciudad Norte',
  es_prueba: 0,
  tipo: 'moto',
  marca: 'Motos Ejemplo',
  modelo: 'M150',
  anio: 2023,
  color: 'Negro',
  placa: 'AB123CD',
  placa_estado: '',
  estado: 'en_revision',
  pais: 'VE',
  creado_en: haceHoras(30),
  actualizado_en: haceHoras(5),
  documentos: [
    { id: 'doc-1', tipo: 'foto_frente', estado: 'pendiente', venceEn: null },
    { id: 'doc-2', tipo: 'registro', estado: 'pendiente', venceEn: null },
  ],
  ...x,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('C-VERIFICACIONES-VEHICULOS: la pestaña «Vehículos» de Verificaciones', () => {
  function conVehiculos() {
    let aprobado = false;
    const llamadas = servidor((url, metodo) => {
      if (url.startsWith('/datos/admin/kyc?'))
        return { solicitudes: [], siguiente: null, totales: { pendiente: 0 } };
      if (url.startsWith('/datos/admin/vehiculos?')) {
        if (url.includes('estado=registrado'))
          return {
            vehiculos: [
              moto({
                id: 'veh-2',
                conductor: 'Conductor Dos',
                estado: 'registrado',
                documentos: [],
              }),
            ],
            totales: { en_revision: aprobado ? 0 : 1, registrado: 1 },
          };
        return {
          vehiculos: aprobado ? [] : [moto()],
          totales: { en_revision: aprobado ? 0 : 1, registrado: 1 },
        };
      }
      if (metodo === 'PUT' && url === '/datos/admin/vehiculos/veh-1') aprobado = true;
      if (url.includes('/horario/ciudades')) return { ciudades: [] };
      if (url.includes('/preferencias/')) return { valor: {}, guardada: false };
      return {};
    });
    return llamadas;
  }

  it('muestra los que esperan revisión con su conductor, fotos y placa, y se aprueba ahí mismo', async () => {
    const llamadas = conVehiculos();
    const cambios: Event[] = [];
    const oir = (e: Event) => cambios.push(e);
    window.addEventListener(EVENTO_CAMBIO, oir);
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    const pestana = await screen.findByTestId('pestana-vehiculos');
    await waitFor(() => expect(pestana.textContent).toBe('Vehículos (1)'));
    await userEvent.click(pestana);
    const fila = await screen.findByTestId('vehiculo-fila');
    expect(within(fila).getByText('Conductor Uno')).toBeTruthy();
    expect(within(fila).getAllByText(/AB123CD/).length).toBeGreaterThan(0);
    expect(within(fila).getByText('Revisar todo del conductor').getAttribute('href')).toBe(
      `${BASE}/verifications/con-1`,
    );
    expect(screen.getByTestId('vehiculo-fotos-veh-1').querySelectorAll('img')).toHaveLength(2);
    await userEvent.click(within(fila).getByRole('button', { name: 'Aprobar la moto' }));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.metodo === 'PUT' && l.url === '/datos/admin/vehiculos/veh-1'),
      ).toBe(true),
    );
    // El número del menú y el de la pestaña bajan enseguida.
    await waitFor(() => expect(cambios.length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(screen.getByTestId('pestana-vehiculos').textContent).toBe('Vehículos (0)'),
    );
    window.removeEventListener(EVENTO_CAMBIO, oir);
  });

  it('«Sin enviar» lista los registrados a medias, sin botón de aprobar y con el recordatorio de Camila', async () => {
    conVehiculos();
    render(<SuperKyc base={BASE} idioma="es" id={null} />);
    await userEvent.click(await screen.findByTestId('pestana-vehiculos'));
    await userEvent.click(await screen.findByTestId('vehiculos-registrado'));
    const fila = await screen.findByText('Conductor Dos');
    const li = fila.closest('li')!;
    expect(within(li).getByText('Camila le recuerda enviarlo')).toBeTruthy();
    expect(within(li).queryByRole('button', { name: 'Aprobar la moto' })).toBeNull();
  });
});

describe('C-FOTO-DICE-LA-VERDAD y C-DOCUMENTO-VENCIDO-CLARO: la tarjeta de papeles', () => {
  const verificacion = {
    nombre: 'Conductor Uno',
    pais: 'VE',
    plazo: { estado: 'sin_plazo', venceEn: null, dias: 0 },
    caras: null,
    papeles: [
      { papel: 'identidad', pasos: ['doc_frente'], estado: 'aprobado', motivo: '' },
      { papel: 'licencia', pasos: ['licencia_frente'], estado: 'aprobado', motivo: '' },
      { papel: 'seguro', pasos: ['seguro'], estado: 'aprobado', motivo: '' },
    ],
    fotos: [
      {
        paso: 'doc_frente',
        papel: 'identidad',
        foto: {
          id: 'f1',
          estado: 'vigente',
          motivo: '',
          insistio: false,
          color: 'amarillo',
          clase: 'identidad_frente',
          confianza: 80,
          lectura: { vencido: 'si', vence: '2024-01-31' },
          decision: 'aprobado',
          creadoEn: haceHoras(48),
        },
      },
      {
        paso: 'licencia_frente',
        papel: 'licencia',
        foto: null,
        otraFoto: { url: '/datos/admin/papeles-conductor/lic-1/archivo', origen: 'papeles' },
        aprobadoSinFoto: false,
      },
      { paso: 'seguro', papel: 'seguro', foto: null, aprobadoSinFoto: true },
    ],
  };

  it('la licencia que llegó por «Tus papeles» se ve; lo aprobado sin foto se dice; lo vencido va arriba en rojo', async () => {
    const llamadas = servidor((url) =>
      url.startsWith('/datos/admin/verificacion/') ? verificacion : {},
    );
    render(<PapelesConductor id="con-1" idioma="es" completa />);
    const lic = await screen.findByTestId('otra-foto-licencia_frente');
    expect(lic.querySelector('img')?.getAttribute('src')).toBe(
      '/datos/admin/papeles-conductor/lic-1/archivo',
    );
    expect(within(lic).getByText('Llegó por «Tus papeles»')).toBeTruthy();
    expect(within(lic).queryByText('Todavía no la tomó')).toBeNull();
    const seguro = screen.getByTestId('sin-foto-seguro');
    expect(within(seguro).getByText(/Aprobado sin foto guardada/)).toBeTruthy();
    const vencido = screen.getByTestId('vencido-aprobado-doc_frente');
    expect(vencido.getAttribute('role')).toBe('alert');
    expect(vencido.textContent).toMatch(/parece vencido y su verificación está aprobada/);
    // «Pedir el documento vigente» manda el pedido con el motivo ya escrito.
    await userEvent.click(
      within(vencido).getByRole('button', { name: 'Pedir el documento vigente' }),
    );
    await userEvent.click(
      within(vencido).getByRole('button', { name: 'Pedir esta foto otra vez' }),
    );
    await waitFor(() =>
      expect(llamadas.find((l) => l.url.endsWith('/pedir-foto'))?.cuerpo).toEqual({
        paso: 'doc_frente',
        motivo: 'Tu documento está vencido. Toma la foto de tu documento vigente.',
      }),
    );
  });
});

describe('C-BARRA-VEHICULO-COHERENTE: la barra dice qué falta del vehículo', () => {
  it('«Vehículo aprobado» pendiente dice que falta enviarlo a revisión y a quién le toca', async () => {
    servidor(() => ({
      pasos: [
        { clave: 'vehiculo', estado: 'hecho', quien: 'conductor', opcional: false },
        {
          clave: 'vehiculo_aprobado',
          estado: 'pendiente',
          quien: 'conductor',
          opcional: true,
          falta: 'vehiculo_sin_enviar',
        },
        { clave: 'vehiculo_activo', estado: 'hecho', quien: 'sistema', opcional: false },
      ],
      listo: true,
      recibiendo: false,
      servicios: ['moto'],
      siguiente: null,
      hechos: 2,
      total: 2,
      vehiculo: { id: 'veh-1', tipo: 'moto', estado: 'registrado' },
    }));
    render(<BarraActivacion id="con-1" base={BASE} idioma="es" />);
    const paso = await screen.findByTestId('paso-vehiculo_aprobado');
    expect(paso.textContent).toMatch(
      /Le toca al conductor · lo registró, falta enviarlo a revisión/,
    );
    expect(paso.getAttribute('data-estado')).toBe('pendiente');
  });
});
