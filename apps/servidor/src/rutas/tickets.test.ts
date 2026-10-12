import { afterEach, describe, expect, it } from 'vitest';
import { usarTransporteCorreo } from '../correo';
import { mundo } from '../pruebas/ayuda';

type Enviado = {
  from: { address: string };
  to: { address: string }[];
  subject: string;
  text: string;
};
function buzon() {
  const enviados: Enviado[] = [];
  usarTransporteCorreo(async (_url, init) => {
    enviados.push(JSON.parse(String(init.body)) as Enviado);
    return new Response(JSON.stringify({ success: true, message_id: 'm', rebotados: [] }), {
      status: 200,
    });
  });
  return enviados;
}
const para = (xs: Enviado[], correo: string) =>
  xs.filter((x) => x.to.some((t) => t.address === correo));
const ENV = {
  YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x'),
  ADMIN_CORREOS: 'jefe@ejemplo.com',
  ADMIN_SEMILLA: 'semilla-de-prueba-larga-123456',
};
const FRANQUICIA = {
  nombre: 'Marta Socia',
  correo: 'marta@ejemplo.com',
  telefono: '+57 300 000 0000',
  pais: 'Colombia',
  ciudad: 'Medellín',
  empresa: 'Inversiones Ejemplo',
  capital: '150k-500k',
  experiencia: 'Tengo dos restaurantes.',
  cuando: '3-meses',
  mensaje: 'Me interesa Medellín.',
};

describe('tickets (C-TICKETS)', () => {
  afterEach(() => usarTransporteCorreo(null));

  it('la franquicia abre un ticket: correo a la persona con su enlace y aviso al equipo con el superadmin', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    const r = await m.llamar('POST', '/datos/franquicias', FRANQUICIA);
    expect(r.estado).toBe(201);
    expect(r.datos.enlace).toMatch(/^\/t\/[A-Za-z0-9_-]{40,}$/);
    const aPersona = para(enviados, 'marta@ejemplo.com')[0];
    expect(aPersona?.from.address).toBe('sales@tumbite.com');
    expect(aPersona?.text).toContain(`https://tumbite.com${r.datos.enlace}`);
    const aJefe = para(enviados, 'jefe@ejemplo.com')[0];
    expect(aJefe?.from.address).toBe('no-reply@tumbite.com');
    expect(aJefe?.text).toContain('150 000 a 500 000 USD');
    expect(aJefe?.text).toMatch(/\/panel\/control-[0-9a-f]{24}\/tickets\//);
  });

  it('la conversación se lee y se responde con el enlace; sin él no existe', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    const { datos } = await m.llamar('POST', '/datos/franquicias', FRANQUICIA);
    const codigo = String(datos.enlace).slice(3);
    const leer = await m.llamar('GET', `/datos/tickets/${codigo}`);
    expect(leer.estado).toBe(200);
    expect(leer.res.headers.get('x-robots-tag')).toContain('noindex');
    expect(leer.datos.ticket.mensajes).toHaveLength(1);
    // Sin el código exacto: no existe (ni con uno inventado del mismo largo).
    expect((await m.llamar('GET', `/datos/tickets/${'a'.repeat(43)}`)).estado).toBe(404);
    expect((await m.llamar('GET', '/datos/tickets/corto')).estado).toBe(404);

    const resp = await m.llamar('POST', `/datos/tickets/${codigo}/mensajes`, {
      texto: '¿Cuánto cuesta?',
    });
    expect(resp.estado).toBe(201);
    expect(resp.datos.mensajes).toHaveLength(2);
    expect(para(enviados, 'jefe@ejemplo.com').at(-1)?.text).toContain('¿Cuánto cuesta?');
  });

  it('solo el admin ve la bandeja, responde (y la persona recibe el correo) y cierra', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    await m.llamar('POST', '/datos/franquicias', FRANQUICIA);
    const cliente = await m.cuenta('cliente');
    expect((await m.llamar('GET', '/datos/admin/tickets', undefined, cliente.token)).estado).toBe(
      403,
    );
    expect((await m.llamar('GET', '/datos/admin/ruta', undefined, cliente.token)).estado).toBe(403);

    const admin = await m.cuenta('admin');
    const ruta = await m.llamar('GET', '/datos/admin/ruta', undefined, admin.token);
    expect(ruta.datos.ruta).toMatch(/^control-[0-9a-f]{24}$/);
    const bandeja = await m.llamar('GET', '/datos/admin/tickets', undefined, admin.token);
    expect(bandeja.datos.tickets).toHaveLength(1);
    const id = bandeja.datos.tickets[0].id as string;
    const uno = await m.llamar('GET', `/datos/admin/tickets/${id}`, undefined, admin.token);
    expect(uno.datos.ticket.datos.capital).toBe('150k-500k');

    const r = await m.llamar(
      'POST',
      `/datos/admin/tickets/${id}/mensajes`,
      { texto: 'Te mando los números.' },
      admin.token,
    );
    expect(r.estado).toBe(201);
    const aMarta = para(enviados, 'marta@ejemplo.com').at(-1);
    expect(aMarta?.subject).toContain('Nueva respuesta');
    expect(aMarta?.text).toContain('Te mando los números.');
    expect(
      (await m.llamar('PATCH', `/datos/admin/tickets/${id}`, { estado: 'cerrado' }, admin.token))
        .estado,
    ).toBe(200);
  });

  it('una queja con sesión queda atada al pedido solo si el pedido es de esa persona', async () => {
    buzon();
    const m = mundo(ENV);
    const cliente = await m.cuenta('cliente');
    const ajeno = await m.llamar(
      'POST',
      '/datos/quejas',
      { texto: 'La comida llegó fría.', pedidoId: crypto.randomUUID() },
      cliente.token,
    );
    expect(ajeno.estado).toBe(404);
    const sinPedido = await m.llamar(
      'POST',
      '/datos/quejas',
      { texto: 'La app no me deja entrar.' },
      cliente.token,
    );
    expect(sinPedido.estado).toBe(201);
    expect((await m.llamar('POST', '/datos/quejas', { texto: 'Hola, ayuda.' })).estado).toBe(401);
  });
});
