import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Acceso } from './Acceso';
import { elegirCiudad, respuestaCatalogo } from '../pruebasLugar';

/**
 * C-FLEX-CUENTA-EMPRESA (1 nov 2026): quien entra por el panel de empresas (Divoox Flex) crea una
 * cuenta de empresa (rol cliente), nunca una de restaurante. El de restaurantes sigue igual.
 */
describe('C-FLEX-CUENTA-EMPRESA', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  async function registrar(tipo?: 'empresa', conSms = false) {
    const cuerpos: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const catalogo = respuestaCatalogo(url);
      if (catalogo) return catalogo;
      if (String(url).includes('/registro')) {
        cuerpos.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({ token: 't', usuario: { id: 'u', nombre: 'Ana', rol: 'cliente' } }),
          { status: 201 },
        );
      }
      return new Response('{}', { status: 200 });
    });
    render(<Acceso idioma="es" alEntrar={() => undefined} tipo={tipo} />);
    await userEvent.click(screen.getByRole('button', { name: /Crea tu cuenta/ }));
    await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Ana Prueba');
    await elegirCiudad('mara', 'Maracaibo');
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
    // La primera casilla es la de términos; la de SMS va aparte (C-SMS-CONSENTIMIENTO).
    const [terminos, sms] = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(sms!.checked).toBe(false);
    await userEvent.click(terminos!);
    if (conSms) await userEvent.click(sms!);
    // C-REVISA-TUS-DATOS: «Continuar» lleva a revisar; la cuenta se crea con «Crear mi cuenta».
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(cuerpos).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    return cuerpos[0]!;
  }

  it('desde el panel de empresas crea una cuenta de empresa', async () => {
    expect((await registrar('empresa')).rol).toBe('cliente');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/empresa/i);
    expect(screen.queryByText('Términos para restaurantes')).toBeNull();
  });

  it('desde el panel de siempre sigue creando la de restaurante', async () => {
    expect((await registrar()).rol).toBe('restaurante');
  });

  // C-SMS-CONSENTIMIENTO (9 nov 2026, Twilio 30513): casilla propia, sin marcar, no obligatoria.
  it('la casilla de SMS va aparte, sin marcar, y solo se acepta si la persona la marca', async () => {
    const sin = await registrar();
    expect(sin.smsConsentimiento).toBe(false);
    // La casilla vive en el formulario (la revisión solo muestra los datos).
    await userEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
    const casilla = screen.getByTestId('casilla-sms');
    expect(casilla.textContent).toMatch(/mensajes de texto/);
    expect(casilla.textContent).toMatch(/STOP/);
    expect(casilla.textContent).toMatch(/no es una condición para comprar/);
    expect(casilla.querySelector('a[href="/es/privacy"]')).not.toBeNull();
    expect(casilla.querySelector('a[href="/es/terms"]')).not.toBeNull();
  });

  it('marcada, el registro manda el consentimiento con el canal web', async () => {
    localStorage.clear();
    const con = await registrar(undefined, true);
    expect(con.smsConsentimiento).toBe(true);
    expect(con.canal).toBe('web');
  });
});

/**
 * C-REVISA-TUS-DATOS (19 nov 2026, orden de Richard) — todos los países. Al crear la cuenta nada se
 * manda solo: ni con Enter en la última casilla ni al tocar «Continuar». Primero «Revisa tus datos»
 * (el correo arriba y en grande, cada dato con «Editar») y la cuenta se crea SOLO con el toque en
 * «Crear mi cuenta». Comprobado en ROJO llamando a la creación desde el formulario.
 */
describe('C-REVISA-TUS-DATOS: la cuenta se crea solo desde «Revisa tus datos»', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  function servidor() {
    const cuerpos: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
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

  async function llenar(correo = 'ana@ejemplo.com') {
    render(<Acceso idioma="es" alEntrar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Crea tu cuenta/ }));
    await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'Ana Prueba');
    await elegirCiudad('mara', 'Maracaibo');
    await userEvent.type(screen.getByLabelText('Correo'), correo);
    await userEvent.type(screen.getByLabelText('Celular'), '305-555-0100');
    await userEvent.click(screen.getAllByRole('checkbox')[0]!);
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
  }

  it('Enter en la última casilla y «Continuar» no crean la cuenta: abren la revisión', async () => {
    const cuerpos = servidor();
    await llenar();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByTestId('revisa-tus-datos')).toBeInTheDocument();
    expect(cuerpos).toHaveLength(0);
    // El correo, arriba y aparte, con su explicación; la contraseña nunca se muestra.
    expect(screen.getByTestId('revisar-correo').textContent).toBe('ana@ejemplo.com');
    expect(screen.getByText(/aquí te llegará el enlace para activarla/)).toBeTruthy();
    expect(screen.getByTestId('revisar-nombre').textContent).toBe('Ana Prueba');
    // El celular quedó en números aunque se escribió con guiones.
    expect(screen.getByTestId('revisar-telefono').textContent).toBe('3055550100');
    expect(document.body.textContent).not.toContain('clave-segura-1');
    await new Promise((r) => setTimeout(r, 50));
    expect(cuerpos).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    expect(cuerpos[0]).toMatchObject({ correo: 'ana@ejemplo.com', telefono: '3055550100' });
  });

  it('«Editar» vuelve al formulario sin perder nada, con esa casilla abierta', async () => {
    const cuerpos = servidor();
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(screen.getByTestId('editar-correo'));
    expect(screen.queryByTestId('revisa-tus-datos')).toBeNull();
    expect(screen.getByLabelText('Correo')).toHaveFocus();
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@ejemplo.com');
    expect(screen.getByLabelText('Nombre y apellido')).toHaveValue('Ana Prueba');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('clave-segura-1');
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
    expect(screen.getByLabelText('Nombre y apellido')).toHaveValue('Ana Prueba');
    expect(cuerpos).toHaveLength(0);
  });

  it('cada casilla dice su error al lado y no se pasa a revisar', async () => {
    const cuerpos = servidor();
    render(<Acceso idioma="es" alEntrar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Crea tu cuenta/ }));
    await userEvent.type(screen.getByLabelText('Correo'), 'ana.gmail.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'corta');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Escribe tu nombre.')).toBeInTheDocument();
    expect(screen.getByText('Al correo le falta la arroba (@).')).toBeInTheDocument();
    expect(screen.getByText('La contraseña lleva al menos 8 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('revisa-tus-datos')).toBeNull();
    expect(cuerpos).toHaveLength(0);
  });

  it('el dominio mal escrito se sugiere y se acepta con un toque, también al revisar', async () => {
    const cuerpos = servidor();
    await llenar('ana@gmial.con');
    expect(screen.getByRole('button', { name: '¿Quisiste decir ana@gmail.com?' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByTestId('revisar-correo').textContent).toBe('ana@gmial.con');
    await userEvent.click(screen.getByRole('button', { name: '¿Quisiste decir ana@gmail.com?' }));
    expect(screen.getByTestId('revisar-correo').textContent).toBe('ana@gmail.com');
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    expect(cuerpos[0]!.correo).toBe('ana@gmail.com');
  });

  it('en inglés, la misma revisión', async () => {
    servidor();
    render(<Acceso idioma="en" alEntrar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Create|New here/ }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Sam Taylor');
    await userEvent.click(screen.getByTestId('registro-lugar'));
    await userEvent.click(screen.getByRole('button', { name: /United States/ }));
    await userEvent.type(screen.getByTestId('selector-lugar-buscar'), 'novi');
    await userEvent.click((await screen.findAllByRole('button', { name: /^Novi/ }))[0]!);
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'safe-password-1');
    await userEvent.click(screen.getAllByRole('checkbox')[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Review your details' })).toBeInTheDocument();
    expect(screen.getByText(/the link to activate it will arrive here/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create my account' })).toBeInTheDocument();
  });
});

/**
 * C-MENSAJES-ACCESO (24 nov 2026, Richard) — todos los países. El error de entrar dice qué pasó y
 * debajo va el botón que toca: «Crear cuenta» si el correo no tiene cuenta (con el correo puesto),
 * «¿Olvidaste tu contraseña?» si la contraseña está mal. Y al tocar «Continuar» con casillas mal, junto
 * al botón se dice cuáles (C-SIN-EXITO-FALSO).
 */
describe('C-MENSAJES-ACCESO: el error de entrar trae su botón', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  function servidor(codigo: string, error: string, campo: string) {
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).includes('/entrar')
        ? new Response(JSON.stringify({ error, campo, codigo }), { status: 401 })
        : new Response('{}', { status: 200 }),
    );
  }
  async function entrar() {
    render(<Acceso idioma="es" alEntrar={() => undefined} />);
    await userEvent.type(screen.getByLabelText('Correo'), 'nadie@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  }

  it('correo sin cuenta: «No hay ninguna cuenta con ese correo» y «Crear cuenta» lleva al registro con el correo puesto', async () => {
    servidor('correo_sin_cuenta', 'No hay ninguna cuenta con ese correo.', 'correo');
    await entrar();
    expect(await screen.findByText('No hay ninguna cuenta con ese correo.')).toBeTruthy();
    expect(screen.queryByTestId('accion-olvide')).toBeNull();
    await userEvent.click(screen.getByTestId('accion-crear'));
    expect(await screen.findByLabelText('Nombre y apellido')).toBeInTheDocument();
    await waitFor(() =>
      expect((screen.getByLabelText('Correo') as HTMLInputElement).value).toBe('nadie@ejemplo.com'),
    );
  });

  it('contraseña mala: «La contraseña no es correcta» y «¿Olvidaste tu contraseña?»', async () => {
    servidor('clave_incorrecta', 'La contraseña no es correcta.', 'clave');
    await entrar();
    expect(await screen.findByText('La contraseña no es correcta.')).toBeTruthy();
    expect(screen.getByTestId('accion-olvide').textContent).toBe('¿Olvidaste tu contraseña?');
    expect(screen.queryByTestId('accion-crear')).toBeNull();
    await userEvent.click(screen.getByTestId('accion-olvide'));
    expect(window.location.pathname).toBe('/forgot-password');
  });

  it('«Continuar» con casillas mal dice cuáles junto al botón (no solo arriba, fuera de la vista)', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    render(<Acceso idioma="es" alEntrar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Crea tu cuenta/ }));
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByTestId('registro-revisar-casillas').textContent).toBe(
      'Revisa lo marcado en rojo: Nombre, Ciudad, Contraseña.',
    );
  });
});

/**
 * C-CASILLA-CON-SU-TIPO (27 nov 2026): Richard escribió su correo en «Nombre y apellido» y la app lo
 * aceptó. En el registro web, un correo en el nombre avisa debajo y no avanza.
 */
describe('C-CASILLA-CON-SU-TIPO: registro web', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('un correo escrito en el nombre muestra el aviso y no pasa a revisar', async () => {
    vi.stubGlobal('fetch', async (url: string) => respuestaCatalogo(url) ?? new Response('{}'));
    render(<Acceso idioma="es" alEntrar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Crea tu cuenta/ }));
    const nombre = screen.getByLabelText('Nombre y apellido');
    await userEvent.type(nombre, 'richard@ejemplo.com');
    await userEvent.tab();
    expect(
      await screen.findByText('Escribe tu nombre como en tu cédula, sin números ni @.'),
    ).toBeInTheDocument();
    // Lo escrito no se borra.
    expect(nombre).toHaveValue('richard@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-1');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByRole('button', { name: 'Crear mi cuenta' })).toBeNull();
  });
});
