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
