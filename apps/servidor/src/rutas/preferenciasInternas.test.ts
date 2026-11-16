import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-FILTROS-GUARDADOS (15 nov 2026, pedido de Richard). Todos los países. Cada empleado guarda los
 * filtros de cada pantalla del superadmin; mirar no escribe y un cambio escribe una sola fila.
 */
async function escenario() {
  const m = mundo();
  const admin = await m.cuenta('admin');
  const cambios = async () =>
    Number((await m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0);
  const filas = async () =>
    Number(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM preferencias_internas').first<{ n: number }>())
        ?.n ?? 0,
    );
  return { m, admin, cambios, filas };
}

describe('C-FILTROS-GUARDADOS · filtros por empleado y pantalla', () => {
  it('guarda, devuelve y restablece; mirar no escribe y repetir lo mismo tampoco', async () => {
    const { m, admin, cambios, filas } = await escenario();
    const leer = () => m.llamar('GET', '/datos/admin/preferencias/pedidos', undefined, admin.token);
    const vacio = await leer();
    expect(vacio.datos).toEqual({ valor: {}, guardada: false, actualizadoEn: null });

    const antes = await cambios();
    await leer();
    await leer();
    expect(await cambios()).toBe(antes);

    const valor = { zona: 'US-FL-MIAMI', estado: 'cerrados', orden: 'recientes' };
    const g = await m.llamar('PUT', '/datos/admin/preferencias/pedidos', { valor }, admin.token);
    expect(g.estado).toBe(200);
    expect(await cambios()).toBe(antes + 1);
    expect(await filas()).toBe(1);
    expect((await leer()).datos).toMatchObject({ valor, guardada: true });

    // Lo mismo otra vez: cero filas escritas.
    await m.llamar('PUT', '/datos/admin/preferencias/pedidos', { valor }, admin.token);
    expect(await cambios()).toBe(antes + 1);
    // Un cambio: una fila (la misma, actualizada).
    await m.llamar(
      'PUT',
      '/datos/admin/preferencias/pedidos',
      { valor: { ...valor, estado: 'todos' } },
      admin.token,
    );
    expect(await cambios()).toBe(antes + 2);
    expect(await filas()).toBe(1);

    // Guardar filtros no se anota en el registro del equipo (sería una fila de más por cambio).
    const acciones = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM acciones_equipo WHERE ruta LIKE '/datos/admin/preferencias/%'",
    ).first<{ n: number }>();
    expect(Number(acciones?.n)).toBe(0);

    expect(
      (await m.llamar('DELETE', '/datos/admin/preferencias/pedidos', undefined, admin.token))
        .estado,
    ).toBe(200);
    expect((await leer()).datos.guardada).toBe(false);
  });

  it('nunca guarda el texto buscado ni datos personales; pantalla y tamaño acotados', async () => {
    const { m, admin } = await escenario();
    const poner = (pantalla: string, valor: unknown) =>
      m.llamar('PUT', `/datos/admin/preferencias/${pantalla}`, { valor }, admin.token);
    expect((await poner('pedidos', { q: '407f' })).estado).toBe(400);
    expect((await poner('pedidos', { telefono: '3055554821' })).estado).toBe(400);
    expect((await poner('pedidos', { zona: 'Ana Pérez' })).estado).toBe(400);
    expect((await poner('pedidos', { zona: 'x'.repeat(61) })).estado).toBe(400);
    expect((await poner('inventada', { zona: 'US-FL-MIAMI' })).estado).toBe(404);
    const grande = await m.llamar(
      'PUT',
      '/datos/admin/preferencias/pedidos',
      { valor: { zona: 'US' }, relleno: 'x'.repeat(3000) },
      admin.token,
    );
    expect(grande.estado).toBe(413);
    for (const p of ['pedidos', 'viajes', 'clientes', 'repartidores', 'tickets'])
      expect((await poner(p, { zona: 'US-FL-MIAMI' })).estado, p).toBe(200);
  });

  it('cada empleado ve los suyos; Solo lectura también guarda los suyos; nadie de fuera', async () => {
    const { m, admin } = await escenario();
    const otro = await m.cuenta('admin');
    await m.DB.prepare("INSERT INTO perfiles_internos (usuario_id, perfil) VALUES (?, 'lectura')")
      .bind(otro.id)
      .run();
    await m.llamar(
      'PUT',
      '/datos/admin/preferencias/tickets',
      { valor: { estado: 'cerrado' } },
      admin.token,
    );
    const suyo = await m.llamar('GET', '/datos/admin/preferencias/tickets', undefined, otro.token);
    expect(suyo.datos.guardada).toBe(false);
    const lectura = await m.llamar(
      'PUT',
      '/datos/admin/preferencias/tickets',
      { valor: { asignado: 'mios' } },
      otro.token,
    );
    expect(lectura.estado).toBe(200);
    // Solo lectura sigue sin poder cambiar nada del negocio.
    expect(
      (await m.llamar('PATCH', '/datos/admin/repartidores/x', { tipo: 'empleado' }, otro.token))
        .estado,
    ).toBe(403);
    const cliente = await m.cuenta('cliente');
    expect(
      (await m.llamar('GET', '/datos/admin/preferencias/tickets', undefined, cliente.token)).estado,
    ).toBe(403);
  });
});
