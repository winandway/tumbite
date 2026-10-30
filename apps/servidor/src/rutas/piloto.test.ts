import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { esParticipante } from './piloto';

// C-PILOTO (30 oct 2026): la lista de participantes del piloto en producción controlada.
describe('C-PILOTO: participantes del piloto', () => {
  const correoDe = async (m: ReturnType<typeof mundo>, id: string) =>
    (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
        .bind(id)
        .first<{ correo: string }>()
    )?.correo ?? '';

  it('el equipo agrega a una persona por su correo, la ve en la lista y queda el registro', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const rep = await m.cuenta('repartidor');
    expect(await esParticipante(m.DB, rep.id)).toBe(false);
    const alta = await m.llamar(
      'POST',
      '/datos/admin/piloto',
      { correo: (await correoDe(m, rep.id)).toUpperCase(), nota: 'Grupo de WhatsApp' },
      admin.token,
    );
    expect(alta.estado).toBe(200);
    expect(await esParticipante(m.DB, rep.id)).toBe(true);
    const lista = await m.llamar('GET', '/datos/admin/piloto', undefined, admin.token);
    expect(lista.datos.participantes).toEqual([
      expect.objectContaining({ usuarioId: rep.id, rol: 'repartidor', nota: 'Grupo de WhatsApp' }),
    ]);
    expect(lista.datos.eventos[0]).toMatchObject({ usuarioId: rep.id, accion: 'alta' });
  });

  it('agregar dos veces no duplica ni ensucia el registro; quitar lo deja anotado', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const cli = await m.cuenta('cliente');
    const correo = await correoDe(m, cli.id);
    await m.llamar('POST', '/datos/admin/piloto', { correo }, admin.token);
    await m.llamar('POST', '/datos/admin/piloto', { correo }, admin.token);
    const baja = await m.llamar('DELETE', `/datos/admin/piloto/${cli.id}`, undefined, admin.token);
    expect(baja.estado).toBe(200);
    expect(await esParticipante(m.DB, cli.id)).toBe(false);
    const { datos } = await m.llamar('GET', '/datos/admin/piloto', undefined, admin.token);
    expect(datos.participantes).toEqual([]);
    expect(datos.eventos.map((e: { accion: string }) => e.accion)).toEqual(['baja', 'alta']);
  });

  it('un correo que no tiene cuenta da un mensaje claro', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const r = await m.llamar(
      'POST',
      '/datos/admin/piloto',
      { correo: 'nadie@ejemplo.com' },
      admin.token,
    );
    expect(r.estado).toBe(404);
    expect(r.datos.error).toMatch(/account|cuenta/i);
  });

  it('solo el equipo puede ver o cambiar la lista', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor');
    expect((await m.llamar('GET', '/datos/admin/piloto', undefined, rep.token)).estado).toBe(403);
    expect(
      (await m.llamar('POST', '/datos/admin/piloto', { correo: 'x@ejemplo.com' }, rep.token))
        .estado,
    ).toBe(403);
  });
});

// C-PILOTO-SERVICIOS (30 oct 2026): un servicio «solo piloto» lo ven y usan solo los participantes.
describe('C-PILOTO-SERVICIOS: servicios encendidos solo para el piloto', () => {
  const MIAMI = 'lat=25.7617&lng=-80.1918';
  const estadoDe = async (m: ReturnType<typeof mundo>, servicio: string, token?: string) =>
    (
      (await m.llamar('GET', `/datos/servicios?${MIAMI}`, undefined, token)).datos.servicios as {
        id: string;
        estado: string;
      }[]
    ).find((s) => s.id === servicio)?.estado;

  it('Mercado en piloto: el participante lo ve abierto y puede ver tiendas; los demás, «muy pronto»', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const dentro = await m.cuenta('cliente');
    const fuera = await m.cuenta('cliente');
    const correo = (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
        .bind(dentro.id)
        .first<{ correo: string }>()
    )?.correo;
    await m.llamar('POST', '/datos/admin/piloto', { correo }, admin.token);
    expect(await estadoDe(m, 'mercado', dentro.token)).toBe('proximamente');
    const on = await m.llamar(
      'PUT',
      '/datos/admin/piloto/servicios',
      { servicio: 'mercado', zona: 'US-FL-MIAMI', piloto: true },
      admin.token,
    );
    expect(on.estado).toBe(200);
    expect(await estadoDe(m, 'mercado', dentro.token)).toBe('disponible');
    expect(await estadoDe(m, 'mercado', fuera.token)).toBe('proximamente');
    expect(await estadoDe(m, 'mercado')).toBe('proximamente');
    const tiendasDentro = await m.llamar(
      'GET',
      `/datos/tiendas?servicio=mercado&${MIAMI}`,
      undefined,
      dentro.token,
    );
    expect(tiendasDentro.estado).toBe(200);
    const tiendasFuera = await m.llamar(
      'GET',
      `/datos/tiendas?servicio=mercado&${MIAMI}`,
      undefined,
      fuera.token,
    );
    expect(tiendasFuera.estado).toBe(404);
    // Apagarlo vuelve a cerrarlo también para el participante.
    await m.llamar(
      'PUT',
      '/datos/admin/piloto/servicios',
      { servicio: 'mercado', zona: 'US-FL-MIAMI', piloto: false },
      admin.token,
    );
    expect(await estadoDe(m, 'mercado', dentro.token)).toBe('proximamente');
  });

  it('Moto y Carro no se pueden poner en piloto (llevan pasajeros: falta lo legal y el seguro)', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    for (const servicio of ['moto', 'carro']) {
      const r = await m.llamar(
        'PUT',
        '/datos/admin/piloto/servicios',
        { servicio, zona: 'US-FL-MIAMI', piloto: true },
        admin.token,
      );
      expect(r.estado).toBe(409);
    }
  });

  it('la lista de servicios del piloto muestra cuáles se pueden encender y cuáles lo están', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    await m.llamar(
      'PUT',
      '/datos/admin/piloto/servicios',
      { servicio: 'envios', zona: 'US-FL-MIAMI', piloto: true },
      admin.token,
    );
    const r = await m.llamar('GET', '/datos/admin/piloto/servicios', undefined, admin.token);
    expect(r.estado).toBe(200);
    const ids = (r.datos.servicios as { id: string }[]).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['envios', 'mercado', 'farmacia', 'licores']));
    expect(ids).not.toContain('moto');
    expect(r.datos.encendidos).toEqual([{ servicio: 'envios', zona: 'US-FL-MIAMI' }]);
  });
});
