import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { LugarCuenta } from '@tumbite/compartido';
import { SelectorLugar } from './SelectorLugar';
import { Acceso } from './panel/Acceso';
import { respuestaCatalogo } from './pruebasLugar';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte A (25 nov 2026) — Venezuela y Estados Unidos. El selector de la
 * web, con el catálogo de verdad. Comprobado en ROJO (anotado en CANDADOS.md): quitando el paso
 * «¿No encuentras tu pueblo?» falla la prueba del municipio; mandando el registro sin `lugar`
 * falla «cualquier ciudad elegida viaja en el registro».
 */
let pedidas: string[] = [];
beforeEach(() => {
  localStorage.clear();
  pedidas = [];
});
afterEach(() => vi.unstubAllGlobals());

function servidor() {
  const cuerpos: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    pedidas.push(String(url));
    const catalogo = respuestaCatalogo(url);
    if (catalogo) return catalogo;
    if (String(url).includes('/registro')) {
      cuerpos.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(
        JSON.stringify({ token: 't', usuario: { id: 'u', nombre: 'Ana', rol: 'restaurante' } }),
        { status: 201 },
      );
    }
    return new Response('{}', { status: 200 });
  });
  return cuerpos;
}

function Prueba({ pais }: { pais?: string }) {
  const [lugar, setLugar] = useState<LugarCuenta | null>(null);
  return (
    <>
      <SelectorLugar valor={lugar} alElegir={setLugar} idioma="es" paisSugerido={pais} />
      <output data-testid="elegido">{lugar ? JSON.stringify(lugar) : ''}</output>
    </>
  );
}
const elegido = () =>
  JSON.parse(screen.getByTestId('elegido').textContent || 'null') as LugarCuenta;

describe('C-REGISTRO-TODO-EL-PAIS: el selector de la web', () => {
  it('País → Estado → Ciudad: un pueblo que no tiene zona se elige igual (Tucaní, Mérida)', async () => {
    servidor();
    render(<Prueba />);
    await userEvent.click(screen.getByTestId('registro-lugar'));
    await userEvent.click(screen.getByRole('button', { name: /Venezuela/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Mérida' }));
    await userEvent.type(screen.getByTestId('selector-lugar-buscar'), 'tucani');
    await userEvent.click((await screen.findAllByRole('button', { name: /^Tucaní/ }))[0]!);
    expect(elegido()).toMatchObject({
      pais: 'VE',
      estado: 'L',
      ciudad: 'Tucaní',
      lugarId: 'gn:3625963',
    });
    expect(screen.getByTestId('registro-lugar').textContent).toContain('Tucaní, Mérida');
  });

  it('el buscador directo sugiere desde la primera letra, sin acentos, y rellena estado y ciudad', async () => {
    servidor();
    render(<Prueba pais="US" />);
    await userEvent.click(screen.getByTestId('registro-lugar'));
    // Con el país sugerido, arranca en el estado con el buscador arriba.
    await userEvent.type(screen.getByTestId('selector-lugar-buscar'), 's');
    expect((await screen.findAllByTestId(/^selector-lugar-ciudad-/)).length).toBeGreaterThan(3);
    await userEvent.type(screen.getByTestId('selector-lugar-buscar'), 'an jose');
    const fila = (await screen.findAllByTestId(/^selector-lugar-ciudad-/))[0]!;
    expect(fila.textContent).toMatch(/^San Jose/);
    expect(fila.textContent).toContain('California (CA)');
    // Lo que coincidió va resaltado.
    expect(fila.querySelector('mark')?.textContent).toBe('San Jose');
    await userEvent.click(fila);
    expect(elegido()).toMatchObject({ pais: 'US', estado: 'CA', ciudad: 'San Jose' });
  });

  it('Gilroy, Nueva York y Novi: ciudades de la gente que no podía registrarse', async () => {
    servidor();
    render(<Prueba pais="US" />);
    for (const [estado, texto, ciudad] of [
      ['California (CA)', 'gil', 'Gilroy'],
      ['New York (NY)', 'new york', 'New York City'],
      ['Michigan (MI)', 'novi', 'Novi'],
    ] as const) {
      await userEvent.click(screen.getByTestId('registro-lugar'));
      await userEvent.click(screen.getByRole('button', { name: estado }));
      await userEvent.type(screen.getByTestId('selector-lugar-buscar'), texto);
      await userEvent.click(
        (await screen.findAllByRole('button', { name: (n) => n.startsWith(ciudad) }))[0]!,
      );
      expect(elegido().ciudad).toBe(ciudad);
    }
  });

  it('«¿No encuentras tu pueblo?»: elige su municipio y queda en su ciudad principal', async () => {
    servidor();
    render(<Prueba pais="VE" />);
    await userEvent.click(screen.getByTestId('registro-lugar'));
    await userEvent.click(screen.getByRole('button', { name: 'Zulia' }));
    await userEvent.type(screen.getByTestId('selector-lugar-buscar'), 'pueblo que no existe');
    expect(
      await screen.findByText(/No encontramos «pueblo que no existe» en este estado/),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: /No encuentras tu pueblo\? Elige tu municipio/ }),
    );
    await userEvent.type(screen.getByTestId('selector-lugar-buscar'), 'mara');
    await userEvent.click(screen.getByRole('button', { name: /^Maracaibo/ }));
    expect(elegido()).toMatchObject({ estado: 'V', municipio: 'Maracaibo', ciudad: 'Maracaibo' });
  });

  it('se navega con el teclado y Escape cierra', async () => {
    servidor();
    render(<Prueba pais="VE" />);
    await userEvent.click(screen.getByTestId('registro-lugar'));
    await userEvent.type(screen.getByTestId('selector-lugar-buscar'), 'merida');
    await screen.findAllByTestId(/^selector-lugar-ciudad-/);
    await userEvent.keyboard('{Enter}');
    expect(elegido().ciudad).toBe('Mérida');
    await userEvent.click(screen.getByTestId('registro-lugar'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sin el catálogo lo dice en palabras y ofrece reintentar', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }));
    render(<Prueba pais="VE" />);
    await userEvent.click(screen.getByTestId('registro-lugar'));
    await userEvent.click(screen.getByRole('button', { name: 'Lara' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar la lista');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('C-REGISTRO-TODO-EL-PAIS: el registro web', () => {
  it('cualquier ciudad elegida viaja en el registro, y nada pregunta por zonas antes', async () => {
    const cuerpos = servidor();
    render(<Acceso idioma="es" alEntrar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Crea tu cuenta/ }));
    await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Ana Prueba');
    await userEvent.click(screen.getByTestId('registro-lugar'));
    await userEvent.click(screen.getByRole('button', { name: /Venezuela/ }));
    await userEvent.type(screen.getByTestId('selector-lugar-buscar'), 'cara');
    await userEvent.click((await screen.findAllByRole('button', { name: /^Caracas/ }))[0]!);
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
    await userEvent.click(screen.getAllByRole('checkbox')[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    // «Revisa tus datos» dice dónde.
    expect(screen.getByTestId('revisar-lugar').textContent).toBe('Caracas, Distrito Capital');
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    expect(cuerpos[0]!.lugar).toMatchObject({ pais: 'VE', estado: 'A', ciudad: 'Caracas' });
    // El selector es de dónde VIVE: nunca lee las zonas abiertas ni la disponibilidad.
    expect(
      pedidas.filter((u) => /zonas|disponibilidad|conductor\/(papeles|ciudad)/.test(u)),
    ).toEqual([]);
  });

  it('C-REGISTRO-OTRO-PAIS: quien vive en otro país toca «Otro país» y se registra igual, sin lugar', async () => {
    const cuerpos = servidor();
    render(<Acceso idioma="es" alEntrar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Crea tu cuenta/ }));
    await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Ana Prueba');
    await userEvent.click(screen.getByTestId('registro-lugar'));
    await userEvent.click(screen.getByTestId('selector-lugar-pais-otro'));
    expect(screen.getByTestId('registro-lugar').textContent).toContain('Otro país');
    expect(screen.getByText('Te ubicamos en tu ciudad con tu ubicación.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
    await userEvent.click(screen.getAllByRole('checkbox')[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByTestId('revisar-lugar').textContent).toBe('Otro país');
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    // Al servidor no va ningún lugar: la ciudad sale de su ubicación, como antes del selector.
    expect(cuerpos[0]!.lugar).toBeUndefined();
  });

  it('sin ciudad no se pasa a revisar, y lo dice al lado de la casilla', async () => {
    servidor();
    render(<Acceso idioma="en" alEntrar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Create|New here/ }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Sam Taylor');
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'safe-password-1');
    await userEvent.click(screen.getAllByRole('checkbox')[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Choose where you live.')).toBeInTheDocument();
    expect(screen.queryByTestId('revisa-tus-datos')).toBeNull();
  });
});
