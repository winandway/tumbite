import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperLineas } from './SuperLineas';

// C-LIDER-INVITADO en el panel: si el líder no tiene cuenta, se ofrece invitarlo sin perder lo escrito.
describe('C-LIDER-INVITADO en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('al crear una línea con un líder sin cuenta ofrece «Invitar al líder» y manda la invitación', async () => {
    const creadas: Record<string, unknown>[] = [];
    let invitados: { id: string; nombre: string; tipo: string; lider: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const ruta = String(url);
      const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status });
      if (init?.method === 'POST' && ruta.endsWith('/datos/admin/lineas')) {
        const cuerpo = JSON.parse(String(init.body)) as Record<string, unknown>;
        creadas.push(cuerpo);
        if (!cuerpo.invitar)
          return json(
            { error: 'Nadie en Divoox Driver tiene ese correo o celular.', campo: 'lider' },
            404,
          );
        invitados = [
          { id: 'i1', nombre: 'Línea Ejemplo', tipo: 'mototaxi', lider: '+10000000000' },
        ];
        return json(
          { linea: null, invitacion: { id: 'i1', enlace: 'https://ejemplo.com/driver' } },
          201,
        );
      }
      if (ruta.includes('/lineas-invitaciones'))
        return json({ invitaciones: invitados, enlace: 'https://ejemplo.com/driver' });
      if (ruta.includes('/lineas-solicitudes')) return json({ solicitudes: [] });
      return json({ lineas: [], zonas: [{ id: 'Z1', nombre: 'Ciudad Ejemplo' }], sinLinea: [] });
    });
    render(<SuperLineas idioma="es" />);
    const caja = await screen.findByTestId('lineas-crear');
    const campos = caja.querySelectorAll('input');
    await userEvent.type(campos[0]!, 'Línea Ejemplo');
    await userEvent.type(campos[1]!, '+10000000000');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la línea' }));
    const aviso = await screen.findByTestId('lineas-invitar-lider');
    expect(aviso.textContent).toMatch(/todavía no tiene cuenta/);
    // Lo escrito sigue en pantalla mientras se decide.
    expect((campos[0] as HTMLInputElement).value).toBe('Línea Ejemplo');
    await userEvent.click(screen.getByRole('button', { name: 'Invitar al líder' }));
    await waitFor(() => expect(creadas.at(-1)?.invitar).toBe(true));
    expect(creadas.at(-1)?.nombre).toBe('Línea Ejemplo');
    expect((await screen.findByTestId('lineas-enlace-lider')).textContent).toBe(
      'https://ejemplo.com/driver',
    );
    expect(screen.getByTestId('lineas-invitados').textContent).toContain('Línea Ejemplo');
  });
});

// C-CONTACTO2-EDITABLE en el panel: el segundo contacto se corrige desde los tres puntos, sin perder lo escrito.
describe('C-CONTACTO2-EDITABLE en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const invitado = {
    id: 'i1',
    nombre: 'Línea Ejemplo',
    tipo: 'mototaxi',
    lider: '+10000000000',
    contacto2Nombre: 'Contacto Provisional',
    contacto2Telefono: '•••• 0202',
  };
  function servidor(cambios: { ruta: string; cuerpo: Record<string, unknown> }[]) {
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const ruta = String(url);
      const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status });
      if (init?.method === 'PATCH') {
        cambios.push({ ruta, cuerpo: JSON.parse(String(init.body)) as Record<string, unknown> });
        return json({ ok: true });
      }
      if (ruta.includes('/lineas-invitaciones'))
        return json({ invitaciones: [invitado], enlace: 'https://ejemplo.com/driver' });
      if (ruta.includes('/lineas-solicitudes')) return json({ solicitudes: [] });
      return json({ lineas: [], zonas: [{ id: 'Z1', nombre: 'Ciudad Ejemplo' }], sinLinea: [] });
    });
  }

  it('«Crear una línea» avisa si en la casilla del nombre se escribe un teléfono', async () => {
    servidor([]);
    render(<SuperLineas idioma="es" />);
    const caja = await screen.findByTestId('lineas-crear');
    const campos = caja.querySelectorAll('input');
    await userEvent.type(campos[2]!, '+1 305 555 0202');
    expect((await screen.findByTestId('lineas-aviso-contacto2')).textContent).toBe(
      'Aquí va el nombre de la persona, no su celular.',
    );
  });

  it('un líder invitado: tres puntos → «Editar contactos de emergencia», guarda y lo escrito no se pierde', async () => {
    const cambios: { ruta: string; cuerpo: Record<string, unknown> }[] = [];
    servidor(cambios);
    const { unmount } = render(<SuperLineas idioma="es" />);
    await screen.findByTestId('lineas-invitados');
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar contactos de emergencia' }));
    let form = await screen.findByTestId('lineas-editar-contacto2');
    const [nombre, tel] = Array.from(form.querySelectorAll('input'));
    await userEvent.clear(nombre!);
    await userEvent.type(nombre!, 'Marta Definitiva');
    await userEvent.type(tel!, '+13055550404');
    await new Promise((r) => setTimeout(r, 700));
    // Se cierra la ventana y se vuelve: lo escrito sigue ahí.
    unmount();
    render(<SuperLineas idioma="es" />);
    await screen.findByTestId('lineas-invitados');
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar contactos de emergencia' }));
    form = await screen.findByTestId('lineas-editar-contacto2');
    expect((form.querySelectorAll('input')[0] as HTMLInputElement).value).toBe('Marta Definitiva');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar el contacto' }));
    await waitFor(() => expect(cambios).toHaveLength(1));
    expect(cambios[0]!.ruta).toContain('/datos/admin/lineas-invitaciones/i1/contacto2');
    expect(cambios[0]!.cuerpo).toEqual({
      contacto2Nombre: 'Marta Definitiva',
      contacto2Telefono: '+13055550404',
    });
  });
});
