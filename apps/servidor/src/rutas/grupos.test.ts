import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

// C-PEDIDO-GRUPO: el anfitrión comparte, cada uno agrega lo suyo, el anfitrión cierra y paga.
describe('C-PEDIDO-GRUPO', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('de punta a punta: crear, agregar, quitar, cerrar con precio de hoy y no dejar agregar más', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const dueno = await m.cuenta('restaurante');
    const ana = await m.cuenta('cliente', 'Ana López');
    const beto = await m.cuenta('cliente', 'Beto Ruiz');
    const caro = await m.cuenta('cliente', 'Caro Díaz');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const plato = async (nombreEs: string, precioCentavos: number) =>
      (
        await m.llamar(
          'POST',
          '/datos/mi-restaurante/platos',
          { nombreEs, precioCentavos },
          dueno.token,
        )
      ).datos.plato.id as string;
    const cubano = await plato('Cubano', 1500);
    const flan = await plato('Flan', 500);
    const g = await m.llamar('POST', '/datos/grupos', { restauranteId: rid }, ana.token);
    expect(g.estado).toBe(201);
    const codigo = g.datos.codigo as string;
    expect(codigo.length).toBeGreaterThanOrEqual(20);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/grupos/${codigo}/items`,
          { platoId: cubano, cantidad: 1 },
          ana.token,
        )
      ).estado,
    ).toBe(201);
    const deBeto = await m.llamar(
      'POST',
      `/datos/grupos/${codigo}/items`,
      { platoId: flan, cantidad: 2 },
      beto.token,
    );
    expect(deBeto.estado).toBe(201);
    // Caro no puede quitar lo de Beto; Ana (anfitriona) sí puede quitar cualquiera, pero no lo hace.
    expect(
      (
        await m.llamar(
          'DELETE',
          `/datos/grupos/${codigo}/items/${deBeto.datos.id}`,
          undefined,
          caro.token,
        )
      ).estado,
    ).toBe(403);
    const visto = await m.llamar('GET', `/datos/grupos/${codigo}`, undefined, beto.token);
    expect(visto.datos.grupo).toMatchObject({ estado: 'abierto', soyAnfitrion: false });
    expect(
      visto.datos.grupo.items.map((i: { persona: string; mio: boolean }) => [i.persona, i.mio]),
    ).toEqual([
      ['Ana', false],
      ['Beto', true],
    ]);
    // Solo la anfitriona cierra; el cubano subió de precio.
    expect((await m.llamar('POST', `/datos/grupos/${codigo}/cerrar`, {}, beto.token)).estado).toBe(
      403,
    );
    await m.DB.prepare('UPDATE platos SET precio_centavos = 1600 WHERE id = ?').bind(cubano).run();
    const cierre = await m.llamar('POST', `/datos/grupos/${codigo}/cerrar`, {}, ana.token);
    expect(cierre.estado).toBe(200);
    expect(cierre.datos.lineas).toEqual([
      expect.objectContaining({ platoId: cubano, cantidad: 1, precioCentavos: 1600 }),
      expect.objectContaining({ platoId: flan, cantidad: 2, precioCentavos: 500 }),
    ]);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/grupos/${codigo}/items`,
          { platoId: flan, cantidad: 1 },
          caro.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (await m.llamar('GET', '/datos/grupos/codigo-inventado-123456', undefined, caro.token))
        .estado,
    ).toBe(404);
  });
});
