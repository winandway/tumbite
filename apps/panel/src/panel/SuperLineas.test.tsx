import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuperLineas } from './SuperLineas';

// C-INVITAR-LIDER-UN-PASO en el panel: crear la línea de un líder sin cuenta lo invita en el mismo paso,
// dice si le llegó el correo y deja copiar su enlace personal o mandarlo por WhatsApp.
describe('C-INVITAR-LIDER-UN-PASO en el panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('un solo «Crear la línea»: queda invitado, con su enlace personal y WhatsApp en los tres puntos', async () => {
    const creadas: Record<string, unknown>[] = [];
    let invitados: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const ruta = String(url);
      const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status });
      if (init?.method === 'POST' && ruta.endsWith('/datos/admin/lineas')) {
        creadas.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        invitados = [
          {
            id: 'i1',
            nombre: 'Línea Ejemplo',
            tipo: 'mototaxi',
            lider: '+10000000000',
            contacto2Nombre: 'Contacto Dos',
            contacto2Telefono: '•••• 0202',
            enlace: 'https://ejemplo.com/driver/lead/EJEMPLO01EJEMPLO01EJEMPLO01EJEMP',
            correo: null,
            correoEnviadoEn: null,
          },
        ];
        return json(
          {
            linea: null,
            invitacion: { id: 'i1', enlace: String(invitados[0]!.enlace), correoEnviado: false },
          },
          201,
        );
      }
      if (ruta.includes('/lineas-invitaciones'))
        return json({ invitaciones: invitados, enlace: 'https://ejemplo.com/driver' });
      if (ruta.includes('/lineas-solicitudes')) return json({ solicitudes: [] });
      return json({ lineas: [], zonas: [{ id: 'Z1', nombre: 'Ciudad Ejemplo' }], sinLinea: [] });
    });
    const abrir = vi.fn();
    vi.stubGlobal('open', abrir);
    render(<SuperLineas idioma="es" />);
    const caja = await screen.findByTestId('lineas-crear');
    const campos = caja.querySelectorAll('input');
    await userEvent.type(campos[0]!, 'Línea Ejemplo');
    await userEvent.type(campos[1]!, '+10000000000');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la línea' }));
    // Un solo paso: nada de segundo botón, y el aviso dice qué hacer.
    expect(await screen.findByText(/quedó invitado\. Mándale su enlace por WhatsApp/)).toBeTruthy();
    expect(creadas).toHaveLength(1);
    expect(creadas[0]?.invitar).toBeUndefined();
    expect((await screen.findByTestId('lineas-enlace-lider')).textContent).toContain(
      '/driver/lead/',
    );
    expect(screen.getByTestId('lineas-invitados').textContent).toContain(
      'Sin correo: mándale el enlace por WhatsApp.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mandar por WhatsApp' }));
    expect(String(abrir.mock.calls[0]?.[0])).toMatch(/^https:\/\/wa\.me\/10000000000\?text=/);
    expect(decodeURIComponent(String(abrir.mock.calls[0]?.[0]))).toContain('/driver/lead/');
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
  // C-EDITAR-LINEA: «Editar datos» de un líder invitado: nombre, tipo, conductores y su correo.
  it('un líder invitado: tres puntos → «Editar datos» guarda nombre, tipo y el correo nuevo', async () => {
    const cambios: { ruta: string; cuerpo: Record<string, unknown> }[] = [];
    servidor(cambios);
    render(<SuperLineas idioma="es" />);
    await screen.findByTestId('lineas-invitados');
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar datos' }));
    const form = await screen.findByTestId('lineas-editar-datos');
    const [nombre, conductores, lider] = Array.from(form.querySelectorAll('input'));
    await userEvent.clear(nombre!);
    await userEvent.type(nombre!, 'Línea Ejemplo Norte');
    await userEvent.selectOptions(form.querySelector('select')!, 'taxi');
    await userEvent.type(conductores!, '30');
    await userEvent.clear(lider!);
    await userEvent.type(lider!, 'lider.nuevo@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los cambios' }));
    await waitFor(() => expect(cambios).toHaveLength(1));
    expect(cambios[0]!.ruta).toContain('/datos/admin/lineas-invitaciones/i1');
    expect(cambios[0]!.ruta).not.toContain('contacto2');
    expect(cambios[0]!.cuerpo).toEqual({
      nombre: 'Línea Ejemplo Norte',
      tipo: 'taxi',
      conductores: 30,
      lider: 'lider.nuevo@ejemplo.com',
    });
  });
});
