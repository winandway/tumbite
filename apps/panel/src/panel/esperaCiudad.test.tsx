import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TEXTOS_PANEL } from './textos';
import { gruposAdmin } from './armazon/menus';
import {
  type CiudadEspera,
  ciudadesVisibles,
  coincide,
  estadoLugarCuenta,
  sumaEspera,
  textoFallaron,
  textoPasaron,
  pasoDeRespuesta,
} from './esperaCiudad';
import { SuperEsperaCiudad } from './SuperEsperaCiudad';
import { InsigniaLugar } from './LugarCuentaPanel';
import { PasarEspera } from './PasarEspera';
import { PonerCiudadCuenta } from './PonerCiudadCuenta';
import { elegirCiudad, respuestaCatalogo } from '../pruebasLugar';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026; Venezuela y Estados Unidos). Candados del panel:
 * la lista de espera cuenta por ciudad, ordena por más esperando y filtra por país y estado; el
 * buscador encuentra sin acentos desde la primera letra; «En espera de su ciudad» nunca se pinta
 * como error; Zonas dice en verde cuántos pasaron; «Poner su ciudad» manda un lugar del contrato.
 * Las respuestas del servidor (parte B) se simulan con el contrato escrito en esperaCiudad.ts.
 */
const CIUDADES: CiudadEspera[] = [
  {
    pais: 'VE',
    estado: 'L',
    municipio: 'Libertador',
    ciudad: 'Mérida',
    lugarId: 'gn:3632308',
    conductores: 2,
    clientes: 1,
    anonimos: 0,
    desde: '2026-11-20T12:00:00Z',
  },
  {
    pais: 'VE',
    estado: 'V',
    municipio: 'Maracaibo',
    ciudad: 'Maracaibo',
    lugarId: 'gn:3633009',
    conductores: 9,
    clientes: 4,
    anonimos: 1,
    desde: '2026-11-18T12:00:00Z',
  },
  {
    pais: 'US',
    estado: 'CA',
    municipio: 'Santa Clara County',
    ciudad: 'San José',
    lugarId: 'gn:5392171',
    conductores: 3,
    clientes: 0,
    anonimos: 2,
    desde: null,
  },
  {
    pais: 'US',
    estado: 'CA',
    municipio: 'Santa Clara County',
    ciudad: 'Gilroy',
    lugarId: 'gn:5352214',
    conductores: 0,
    clientes: 1,
    anonimos: 0,
    desde: null,
  },
];

describe('C-REGISTRO-TODO-EL-PAIS (parte C): la lógica de la lista de espera', () => {
  it('cuenta por ciudad y ordena por más esperando', () => {
    const v = ciudadesVisibles(CIUDADES, {});
    expect(v.map((c) => c.ciudad)).toEqual(['Maracaibo', 'San José', 'Mérida', 'Gilroy']);
    expect(sumaEspera(v)).toBe(14 + 5 + 3 + 1);
  });

  it('filtra por país, por estado y por quién espera', () => {
    expect(ciudadesVisibles(CIUDADES, { pais: 'US' }).map((c) => c.ciudad)).toEqual([
      'San José',
      'Gilroy',
    ]);
    expect(ciudadesVisibles(CIUDADES, { pais: 'VE', estado: 'V' }).map((c) => c.ciudad)).toEqual([
      'Maracaibo',
    ]);
    // Solo clientes: San José (0 clientes) sale de la lista; el orden es por clientes.
    const clientes = ciudadesVisibles(CIUDADES, { rol: 'clientes' });
    expect(clientes.map((c) => c.ciudad)).toEqual(['Maracaibo', 'Gilroy', 'Mérida']);
    expect(sumaEspera(clientes, 'clientes')).toBe(6);
  });

  it('el buscador encuentra sin acentos, sin mayúsculas, desde la primera letra y por estado o municipio', () => {
    const [merida, maracaibo, sanJose] = CIUDADES as [CiudadEspera, CiudadEspera, CiudadEspera];
    expect(coincide(merida, 'merida')).toBe(true);
    expect(coincide(merida, 'MÉR')).toBe(true);
    expect(coincide(maracaibo, 'm')).toBe(true);
    expect(coincide(maracaibo, 'zul')).toBe(true); // por el estado
    expect(coincide(sanJose, 'san jo')).toBe(true);
    expect(coincide(sanJose, 'santa clara')).toBe(true); // por el condado
    expect(coincide(sanJose, 'california')).toBe(true);
    expect(coincide(maracaibo, 'caibo')).toBe(false); // por comienzo de palabra, no por el medio
    expect(ciudadesVisibles(CIUDADES, { q: 'mara' }).map((c) => c.ciudad)).toEqual(['Maracaibo']);
  });

  it('el lugar de una cuenta: en su zona, en espera de su ciudad o sin ciudad', () => {
    const lugar = {
      pais: 'VE' as const,
      estado: 'V',
      ciudad: 'Maracaibo',
      lugarId: 'gn:3633009',
      lat: 10.6,
      lng: -71.6,
    };
    expect(estadoLugarCuenta({ sinZona: false })).toBe('en_zona');
    expect(estadoLugarCuenta({ sinZona: true, lugar })).toBe('en_espera');
    expect(estadoLugarCuenta({ sinZona: true, enEspera: true })).toBe('en_espera');
    expect(estadoLugarCuenta({ sinZona: true, lugar: null })).toBe('sin_ciudad');
  });

  it('«En espera de su ciudad» se pinta en ámbar (pendiente), nunca en rojo; «Sin ciudad» en gris', () => {
    const lugar = {
      pais: 'VE' as const,
      estado: 'V',
      ciudad: 'Maracaibo',
      lugarId: 'gn:3633009',
      lat: 10.6,
      lng: -71.6,
    };
    const { rerender } = render(<InsigniaLugar fila={{ sinZona: true, lugar }} idioma="es" />);
    const espera = screen.getByTestId('lugar-en_espera');
    expect(espera).toHaveTextContent('En espera de su ciudad');
    expect(espera.getAttribute('data-tono')).toBe('pendiente');
    expect(espera.className).not.toMatch(/problema|error/);
    rerender(<InsigniaLugar fila={{ sinZona: true, lugar: null }} idioma="en" />);
    expect(screen.getByTestId('lugar-sin_ciudad')).toHaveTextContent('No city');
    expect(screen.getByTestId('lugar-sin_ciudad').getAttribute('data-tono')).toBe('apagado');
    rerender(<InsigniaLugar fila={{ sinZona: false }} idioma="es" />);
    expect(screen.queryByTestId(/^lugar-/)).toBeNull();
  });

  it('va en el grupo Personas del menú, en los dos idiomas', () => {
    for (const idioma of ['es', 'en'] as const) {
      const grupos = gruposAdmin(TEXTOS_PANEL[idioma], idioma, '/x', '/x', false);
      const personas = grupos.find((g) => g.items.some((i) => i.clave === 'drivers'));
      const item = personas?.items.find((i) => i.clave === 'city-waitlist');
      expect(item?.a).toBe('/x/city-waitlist');
      expect(item?.texto).toBe(idioma === 'es' ? 'Espera por ciudad' : 'Waitlist by city');
      expect(grupos[0]?.items.some((i) => i.clave === 'city-waitlist')).toBe(false);
    }
  });

  it('el aviso de cuántos pasaron está en palabras', () => {
    expect(textoPasaron(14, 'es')).toBe(
      '14 personas de la lista de espera pasaron a esta zona. Camila les avisa.',
    );
    expect(textoPasaron(1, 'en')).toMatch(/^1 person/);
    expect(textoPasaron(0, 'es')).toMatch(/Nadie/);
  });
});

type Llamada = { metodo: string; url: string; cuerpo: unknown };
function simularServidor(responder: (l: Llamada) => unknown) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const l = {
      metodo: init?.method ?? 'GET',
      url: String(url),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    llamadas.push(l);
    if (l.url.includes('/datos/admin/preferencias/'))
      return new Response(JSON.stringify({ valor: {}, guardada: false }), { status: 200 });
    return new Response(JSON.stringify(responder(l) ?? {}), { status: 200 });
  });
  return llamadas;
}

describe('C-REGISTRO-TODO-EL-PAIS (parte C): la pantalla «Lista de espera por ciudad»', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('muestra cada ciudad con cuántos esperan, la de más gente arriba, y abre quiénes esperan', async () => {
    const llamadas = simularServidor((l) =>
      l.url.includes('/personas')
        ? {
            personas: [
              {
                id: 'u1',
                rol: 'repartidor',
                nombre: 'Conductor Ejemplo',
                creadoEn: '2026-11-20 12:00:00',
                papeles: 2,
              },
              { id: 'u2', rol: 'cliente', nombre: 'Cliente Ejemplo', creadoEn: null },
            ],
          }
        : { total: 23, ciudades: CIUDADES },
    );
    render(<SuperEsperaCiudad base="/panel/x" idioma="es" />);
    const tabla = await screen.findByTestId('espera-tabla');
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas[0]).toHaveTextContent('Maracaibo, Zulia');
    expect(screen.getByTestId('espera-n-gn:3633009')).toHaveTextContent('14');
    expect(filas[1]).toHaveTextContent('San José, California (CA)');
    expect(screen.getByTestId('espera-total')).toHaveTextContent(
      '23 personas esperan en 4 ciudades.',
    );
    await userEvent.click(screen.getByRole('button', { name: /Ver quiénes esperan en Maracaibo/ }));
    const personas = await screen.findByTestId('espera-personas');
    expect(within(personas).getByRole('link', { name: /Conductor Ejemplo/ })).toHaveAttribute(
      'href',
      '/panel/x/drivers/u1',
    );
    expect(within(personas).getByRole('link', { name: /Cliente Ejemplo/ })).toHaveAttribute(
      'href',
      '/panel/x/customers/u2',
    );
    expect(llamadas.some((l) => l.url.endsWith('/personas?lugarId=gn%3A3633009'))).toBe(true);
  });

  it('filtra por país y estado (y se lo pide al servidor), y el buscador encuentra sin acentos', async () => {
    const llamadas = simularServidor(() => ({ total: 23, ciudades: CIUDADES }));
    render(<SuperEsperaCiudad base="/panel/x" idioma="es" />);
    await screen.findByTestId('espera-tabla');
    await userEvent.selectOptions(screen.getByTestId('espera-pais'), 'VE');
    await userEvent.selectOptions(screen.getByTestId('espera-estado'), 'L');
    await waitFor(() =>
      expect(llamadas.some((l) => l.url.endsWith('/espera-ciudades?pais=VE&estado=L'))).toBe(true),
    );
    const tabla = screen.getByTestId('espera-tabla');
    expect(within(tabla).getAllByRole('row')).toHaveLength(2);
    expect(tabla).toHaveTextContent('Mérida, Mérida');
    await userEvent.selectOptions(screen.getByTestId('espera-pais'), '');
    await userEvent.type(screen.getByTestId('espera-buscar'), 'merida');
    expect(screen.getByTestId('espera-tabla')).toHaveTextContent('Mérida');
    expect(screen.getByTestId('espera-tabla')).not.toHaveTextContent('Maracaibo');
  });

  it('sin nadie esperando lo dice en palabras', async () => {
    simularServidor(() => ({ total: 0, ciudades: [] }));
    render(<SuperEsperaCiudad base="/panel/x" idioma="en" />);
    expect(await screen.findByText('Nobody is waiting with those filters.')).toBeInTheDocument();
  });
});

describe('C-REGISTRO-TODO-EL-PAIS (parte C): Zonas pasa a los que esperan', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('«Pasar a los que esperan» llama al servidor y dice en verde cuántos pasaron', async () => {
    const llamadas = simularServidor(() => ({
      zonaId: 'VE-ZU-MARACAIBO',
      pasaron: 14,
      conductores: 10,
      clientes: 4,
      revisados: 14,
      quedan: 0,
      siguiente: null,
      motivo: null,
    }));
    render(<PasarEspera zonaId="VE-ZU-MARACAIBO" idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a los que esperan' }));
    const aviso = await screen.findByTestId('pasaron-espera');
    expect(aviso).toHaveTextContent('14 personas de la lista de espera pasaron a esta zona.');
    expect(aviso).toHaveClass('ok');
    expect(llamadas.at(-1)).toMatchObject({
      metodo: 'POST',
      url: '/datos/admin/zonas/VE-ZU-MARACAIBO/pasar-espera',
    });
  });
});

describe('C-REGISTRO-TODO-EL-PAIS: el paso va de a un lote (contrato del servidor)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lee el paso solo o dentro de «espera», y nada si no vino', () => {
    const paso = { pasaron: 3, quedan: 7, siguiente: 'u5', motivo: null };
    expect(pasoDeRespuesta(paso)).toEqual({ ...paso, fallaron: 0 });
    expect(pasoDeRespuesta({ ok: true, espera: paso })).toEqual({ ...paso, fallaron: 0 });
    expect(pasoDeRespuesta({ ...paso, fallaron: 2 })?.fallaron).toBe(2);
    expect(pasoDeRespuesta({ ok: true, espera: null })).toBeNull();
    expect(pasoDeRespuesta({ pasaronDeEspera: 3 })).toBeNull();
  });

  it('con «quedan N» muestra «Seguir», que manda desde dónde seguir y suma lo que pasó', async () => {
    const llamadas = simularServidor((l) =>
      (l.cuerpo as { desde?: string } | undefined)?.desde === 'u5'
        ? { pasaron: 2, quedan: 0, siguiente: null, motivo: null }
        : { pasaron: 3, quedan: 7, siguiente: 'u5', motivo: null },
    );
    render(<PasarEspera zonaId="VE-ZU-MARACAIBO" idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a los que esperan' }));
    expect(await screen.findByTestId('pasaron-espera')).toHaveTextContent(
      '3 personas de la lista de espera pasaron a esta zona. Camila les avisa. Quedan 7 por revisar',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    await waitFor(() =>
      expect(screen.getByTestId('pasaron-espera')).toHaveTextContent(
        '5 personas de la lista de espera pasaron a esta zona.',
      ),
    );
    expect(screen.queryByRole('button', { name: 'Seguir' })).toBeNull();
    expect(llamadas.at(-1)?.cuerpo).toEqual({ desde: 'u5' });
  });

  /**
   * C-REGISTRO-TODO-EL-PAIS (26 nov): la respuesta trae `fallaron` (siguen en espera y se reintentan) y
   * el panel no lo decía: parecía que no quedaba nadie. Comprobado en ROJO sin la línea ámbar.
   */
  it('los que no pudieron pasar se dicen en ámbar junto a «Quedan N», nunca en verde, y se suman', async () => {
    simularServidor((l) =>
      (l.cuerpo as { desde?: string } | undefined)?.desde === 'u5'
        ? { pasaron: 2, quedan: 0, siguiente: null, motivo: null, fallaron: 1 }
        : { pasaron: 3, quedan: 7, siguiente: 'u5', motivo: null, fallaron: 2 },
    );
    render(<PasarEspera zonaId="VE-ZU-MARACAIBO" idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a los que esperan' }));
    expect(await screen.findByTestId('pasaron-espera')).toHaveTextContent('Quedan 7 por revisar');
    const fallo = screen.getByTestId('fallaron-espera');
    expect(fallo).toHaveTextContent('2 no pudieron pasar; siguen en espera y se reintentan.');
    expect(fallo).toHaveClass('aviso-ambar');
    expect(fallo).not.toHaveClass('ok');
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    await waitFor(() =>
      expect(screen.getByTestId('fallaron-espera')).toHaveTextContent(
        '3 no pudieron pasar; siguen en espera y se reintentan.',
      ),
    );
    expect(textoFallaron(1, 'es')).toBe('1 no pudo pasar; sigue en espera y se reintenta.');
    expect(textoFallaron(2, 'en')).toBe(
      '2 couldn’t move in; they stay on the waitlist and are retried.',
    );
    expect(textoFallaron(1, 'en')).toBe(
      '1 couldn’t move in; they stay on the waitlist and are retried.',
    );
  });

  it('sin fallos no sale la línea ámbar (lo de siempre)', async () => {
    simularServidor(() => ({ pasaron: 4, quedan: 0, siguiente: null, motivo: null, fallaron: 0 }));
    render(<PasarEspera zonaId="VE-ZU-MARACAIBO" idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a los que esperan' }));
    expect(await screen.findByTestId('pasaron-espera')).toHaveClass('ok');
    expect(screen.queryByTestId('fallaron-espera')).toBeNull();
  });

  it('al abrir una zona o guardar un área, lo que respondió el servidor también dice los que fallaron', () => {
    render(
      <PasarEspera
        zonaId="VE-ZU-MARACAIBO"
        idioma="es"
        conBoton={false}
        inicial={{ pasaron: 5, quedan: 0, siguiente: null, motivo: null, fallaron: 1 }}
      />,
    );
    expect(screen.getByTestId('fallaron-espera')).toHaveTextContent(
      '1 no pudo pasar; sigue en espera y se reintenta.',
    );
  });

  it('una zona apagada lo dice en palabras, sin verde', async () => {
    simularServidor(() => ({ pasaron: 0, quedan: 0, siguiente: null, motivo: 'zona_cerrada' }));
    render(<PasarEspera zonaId="VE-ZU-MARACAIBO" idioma="es" />);
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a los que esperan' }));
    const aviso = await screen.findByTestId('pasaron-espera');
    expect(aviso).toHaveTextContent('Esta zona está apagada');
    expect(aviso).not.toHaveClass('ok');
  });
});

describe('C-REGISTRO-TODO-EL-PAIS (parte C): «Poner su ciudad» desde la ficha', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('usa la pieza común del registro (catálogo real) y manda el lugar del contrato con su motivo', async () => {
    const llamadas = simularServidor((l) => ({
      lugar: (l.cuerpo as { lugar: unknown }).lugar,
      zona: null,
      enEspera: true,
      lugarEscrito: 'Maracaibo, Zulia',
    }));
    const falso = globalThis.fetch;
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      Promise.resolve(respuestaCatalogo(String(url)) ?? falso(url, init)),
    );
    const alGuardar = vi.fn();
    render(<PonerCiudadCuenta id="u9" idioma="es" alCerrar={() => {}} alGuardar={alGuardar} />);
    const guardar = screen.getByRole('button', { name: 'Guardar su ciudad' });
    expect(guardar).toBeDisabled();
    await elegirCiudad('maracaibo', 'Maracaibo');
    // Sin motivo no se guarda (el servidor lo exige para la auditoría).
    expect(guardar).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText('Motivo (queda en el registro)'),
      'Lo dijo por el chat de soporte',
    );
    await userEvent.click(guardar);
    await waitFor(() => expect(alGuardar).toHaveBeenCalled());
    expect(alGuardar).toHaveBeenCalledWith(
      'Listo. Quedó en la lista de espera de Maracaibo, Zulia.',
    );
    const put = llamadas.find((l) => l.metodo === 'PUT');
    expect(put).toMatchObject({
      url: '/datos/admin/usuarios/u9/lugar',
      cuerpo: {
        motivo: 'Lo dijo por el chat de soporte',
        lugar: { pais: 'VE', estado: 'V', ciudad: 'Maracaibo' },
      },
    });
  });

  it('el selector propio del panel ya no existe: una sola pieza para todos', () => {
    const archivos = import.meta.glob('./SelectorLugarPanel.tsx');
    expect(Object.keys(archivos)).toEqual([]);
  });
});
