import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { politicaPlazoDeFabrica } from '@tumbite/compartido';
import {
  FiltroPapeles,
  InsigniaPapeles,
  PapelesConductor,
  PoliticaPapelesPais,
  TableroVerificacionIa,
} from './SuperPapeles';
import { SuperRepartidores } from './SuperFichas';

const ID = '00000000-0000-4000-8000-000000000001';

function servidor(manejar: (url: string, init?: RequestInit) => unknown) {
  const llamadas: { url: string; metodo: string; cuerpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    let cuerpo: unknown;
    try {
      cuerpo = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    } catch {
      cuerpo = undefined;
    }
    llamadas.push({ url, metodo: init?.method ?? 'GET', cuerpo });
    const r = manejar(url, init);
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200 });
  });
  return llamadas;
}

const foto = (paso: string, color: string, extra: Record<string, unknown> = {}) => ({
  paso,
  papel: paso === 'cara' ? 'cara' : 'identidad',
  foto: {
    id: `foto-${paso}`,
    estado: 'vigente',
    motivo: '',
    insistio: false,
    color,
    clase: paso === 'cara' ? 'cara' : 'identidad_frente',
    confianza: 93,
    lectura: null,
    decision: '',
    creadoEn: '2026-11-20 10:00:00',
    ...extra,
  },
});

const VERIFICACION = {
  nombre: 'Conductor de ejemplo',
  pais: 'VE',
  plazo: { estado: 'en_plazo', venceEn: '2026-12-19 10:00:00', dias: 8 },
  papeles: [
    { papel: 'identidad', pasos: ['doc_frente', 'doc_reverso'], estado: 'en_revision', motivo: '' },
    { papel: 'cara', pasos: ['cara'], estado: 'en_revision', motivo: '' },
  ],
  caras: { resultado: 'dudoso', confianza: 55, color: 'amarillo' },
  fotos: [
    foto('doc_frente', 'verde', {
      lectura: { nombre: 'NOMBRE DE EJEMPLO', numero: 'V-00000000', vence: '2030-01-01' },
    }),
    foto('doc_reverso', 'rojo', { clase: 'cara', insistio: true }),
    { paso: 'cara', papel: 'cara', foto: null },
  ],
};

/** C-PLAZO-PAPELES y C-VERIFICACION-IA: lo que el equipo ve de los papeles de un conductor. */
describe('papeles del conductor en el superadmin', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState(null, '', '/panel/control-x/drivers');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la insignia dice los días que quedan, lo completo en verde y lo vencido en rojo', () => {
    const { rerender } = render(<InsigniaPapeles papeles="en_plazo" dias={8} idioma="es" />);
    expect(screen.getByText('En plazo · quedan 8 días')).toHaveClass('papeles-por-vencer');
    rerender(<InsigniaPapeles papeles="en_plazo" dias={1} idioma="es" />);
    expect(screen.getByText('En plazo · queda 1 día')).toBeInTheDocument();
    rerender(<InsigniaPapeles papeles="en_plazo" dias={25} idioma="es" />);
    expect(screen.getByText('En plazo · quedan 25 días')).not.toHaveClass('papeles-por-vencer');
    rerender(<InsigniaPapeles papeles="completo" dias={null} idioma="es" />);
    expect(screen.getByText('Completos')).toHaveClass('insignia-aprobado');
    rerender(<InsigniaPapeles papeles="vencido" dias={null} idioma="es" />);
    expect(screen.getByText('Plazo vencido · en pausa')).toHaveClass('insignia-rechazado');
    rerender(<InsigniaPapeles papeles="sin_plazo" dias={null} idioma="en" />);
    expect(screen.getByText('No grace period')).toBeInTheDocument();
  });

  it('la lista de conductores trae la columna de papeles y filtra «por vencer»', async () => {
    const llamadas = servidor((url) => {
      if (url.includes('/admin/ciudades')) return { ciudades: [] };
      if (url.includes('/admin/preferencias')) return { valores: {} };
      return {
        repartidores: [
          {
            id: ID,
            codigo: 'XX-000001',
            nombre: 'Conductor de ejemplo',
            correo: 'correo@ejemplo.com',
            conectado: false,
            vehiculo: 'moto',
            placa: '',
            seguro: 'vigente',
            licencia: 'vigente',
            antecedentes: 'pendiente',
            entregas: 0,
            papeles: 'en_plazo',
            diasPlazo: 8,
          },
        ],
        siguiente: null,
      };
    });
    render(<SuperRepartidores base="/panel/control-x" idioma="es" />);
    expect(await screen.findByText('En plazo · quedan 8 días')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Papeles' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByTestId('filtro-papeles'), 'por_vencer');
    await waitFor(() =>
      expect(llamadas.some((l) => l.url.includes('plazo=por_vencer'))).toBe(true),
    );
  });

  it('el filtro ofrece por vencer, dentro del plazo y vencido', async () => {
    const cambiar = vi.fn();
    render(<FiltroPapeles valor="" cambiar={cambiar} idioma="en" />);
    await userEvent.selectOptions(screen.getByTestId('filtro-papeles'), 'vencido');
    expect(cambiar).toHaveBeenCalledWith('vencido');
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('cada foto llega con su color, lo leído y la comparación de la cara; lo dudoso se avisa', async () => {
    servidor(() => VERIFICACION);
    render(<PapelesConductor id={ID} idioma="es" completa />);
    const frente = await screen.findByTestId('foto-doc_frente');
    expect(frente).toHaveTextContent('Cédula (frente)');
    expect(frente).toHaveTextContent('Verde');
    expect(frente).toHaveTextContent('NOMBRE DE EJEMPLO');
    expect(frente).toHaveTextContent('V-00000000');
    const reverso = screen.getByTestId('foto-doc_reverso');
    expect(reverso).toHaveTextContent('Rojo');
    expect(reverso).toHaveTextContent('Se ve: una cara');
    expect(reverso).toHaveTextContent('La persona la dejó pese al aviso');
    expect(screen.getByText('Todavía no la tomó')).toBeInTheDocument();
    expect(screen.getByTestId('papeles-caras')).toHaveTextContent('Amarillo');
    expect(screen.getByTestId('papeles-caras')).toHaveTextContent('Dudoso · 55 % confianza');
    expect(screen.getByText(/amarillo o en rojo/)).toBeInTheDocument();
    expect(screen.queryByText(/vienen en verde/)).not.toBeInTheDocument();
    expect(screen.getByText('En plazo · quedan 8 días')).toBeInTheDocument();
  });

  it('con todo en verde lo dice, para aprobar en un toque', async () => {
    servidor(() => ({
      ...VERIFICACION,
      caras: { resultado: 'misma', confianza: 96, color: 'verde' },
      fotos: [foto('doc_frente', 'verde'), foto('doc_reverso', 'verde'), foto('cara', 'verde')],
    }));
    render(<PapelesConductor id={ID} idioma="es" completa />);
    expect(await screen.findByText(/vienen en verde/)).toBeInTheDocument();
    expect(screen.queryByText(/amarillo o en rojo/)).not.toBeInTheDocument();
  });

  it('pide de nuevo UNA sola foto, con motivo; sin motivo no sale y lo escrito no se pierde', async () => {
    const llamadas = servidor((url, init) =>
      init?.method === 'POST' && url.includes('pedir-foto') ? { ok: true } : VERIFICACION,
    );
    render(<PapelesConductor id={ID} idioma="es" completa />);
    await userEvent.click(await screen.findByTestId('pedir-doc_reverso'));
    await userEvent.click(screen.getByRole('button', { name: 'Pedir esta foto otra vez' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el motivo');
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
    await userEvent.type(screen.getByLabelText('Motivo (le llega a la persona)'), 'Va el reverso');
    await userEvent.click(screen.getByRole('button', { name: 'Pedir esta foto otra vez' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST')).toMatchObject({
        url: `/datos/admin/verificacion/${ID}/pedir-foto`,
        cuerpo: { paso: 'doc_reverso', motivo: 'Va el reverso' },
      }),
    );
  });

  it('a quien se registró antes del plazo, el equipo se lo puede dar; en la ficha, sin fotos ni plazo, no estorba', async () => {
    const sinPlazo = {
      ...VERIFICACION,
      plazo: { estado: 'sin_plazo', venceEn: null, dias: 0 },
      caras: null,
      fotos: VERIFICACION.fotos.map((f) => ({ ...f, foto: null })),
    };
    const llamadas = servidor((_u, init) => (init?.method === 'POST' ? { ok: true } : sinPlazo));
    const { unmount } = render(<PapelesConductor id={ID} idioma="es" />);
    await waitFor(() => expect(llamadas.length).toBeGreaterThan(0));
    expect(screen.queryByTestId('papeles-conductor')).not.toBeInTheDocument();
    unmount();
    render(<PapelesConductor id={ID} idioma="es" completa />);
    await userEvent.click(await screen.findByRole('button', { name: 'Dar plazo de papeles' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.metodo === 'POST' && l.url.endsWith('/plazo'))).toBe(true),
    );
  });

  it('una respuesta que no es la de papeles no pinta una tarjeta rota', async () => {
    const llamadas = servidor(() => ({ repartidor: {} }));
    render(<PapelesConductor id={ID} idioma="es" completa />);
    await waitFor(() => expect(llamadas.length).toBeGreaterThan(0));
    expect(screen.queryByTestId('papeles-conductor')).not.toBeInTheDocument();
  });

  it('la política del país se guarda ENTERA, con la aprobación automática apagada de fábrica y el acierto medido', async () => {
    servidor(() => ({
      acierto: [
        {
          pais: 'VE',
          paso: 'doc_frente',
          decididas: 40,
          conOpinion: 30,
          aciertos: 27,
          porcentaje: 90,
        },
        {
          pais: 'PE',
          paso: 'doc_frente',
          decididas: 5,
          conOpinion: 5,
          aciertos: 1,
          porcentaje: 20,
        },
      ],
      hoy: { microdolares: 120000, llamadas: 9, fallos: 0, topeMicrodolares: 2000000 },
    }));
    const guardar = vi.fn(async () => undefined);
    render(
      <PoliticaPapelesPais
        pais="VE"
        politica={politicaPlazoDeFabrica('VE')}
        guardar={guardar}
        idioma="es"
      />,
    );
    expect(screen.getByTestId('politica-automatica')).not.toBeChecked();
    expect(screen.getByTestId('politica-dias')).toHaveValue('30');
    expect(screen.getByText(/sin licencia ni seguro verificados/)).toBeInTheDocument();
    expect(await screen.findByText(/90 % de acierto en 30 fotos/)).toBeInTheDocument();
    await userEvent.clear(screen.getByTestId('politica-dias'));
    await userEvent.type(screen.getByTestId('politica-dias'), '45');
    await userEvent.click(screen.getByLabelText('Licencia'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar el plazo de papeles' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(guardar).toHaveBeenCalledWith({
      dias: 45,
      paraEmpezar: ['cara', 'licencia'],
      exentos: ['antecedentes', 'antecedentes_pasajeros'],
      asistente: true,
      aprobacionAutomatica: false,
    });
    expect(await screen.findByText('Guardado.')).toBeInTheDocument();
  });

  it('el tablero dice lo gastado hoy, el tope y el acierto por foto', async () => {
    servidor(() => ({
      acierto: [
        { pais: 'VE', paso: 'cara', decididas: 12, conOpinion: 10, aciertos: 9, porcentaje: 90 },
      ],
      hoy: { microdolares: 120000, llamadas: 9, fallos: 1, topeMicrodolares: 2000000 },
    }));
    render(<TableroVerificacionIa idioma="es" />);
    const tablero = await screen.findByTestId('tablero-ia');
    expect(tablero).toHaveTextContent('9 consultas');
    expect(tablero).toHaveTextContent('$0.12 gastado');
    expect(tablero).toHaveTextContent('tope del día $2.00');
    expect(tablero).toHaveTextContent('1 sin respuesta');
    expect(tablero).toHaveTextContent('90 %');
  });
});
