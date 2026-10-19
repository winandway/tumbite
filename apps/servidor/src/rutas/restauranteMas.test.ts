import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fechaLocal } from '@tumbite/compartido';
import { RESTAURANTE_BASE, llevarA, mundo } from '../pruebas/ayuda';

/** Auditoría final, puntos 19 a 21: reseñas con respuesta, orden del menú, festivos y equipo (C-RESTAURANTE-MAS). */
async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ id: 'pi_x', client_secret: 'x' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante', 'Rosa Dueña');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const platos: string[] = [];
  for (const [n, cat] of [
    ['Cubano', 'Sándwiches'],
    ['Media noche', 'Sándwiches'],
    ['Jugo', 'Bebidas'],
  ] as const) {
    const p = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: n, precioCentavos: 1000, categoria: cat },
      dueno.token,
    );
    platos.push(p.datos.plato.id as string);
  }
  await m.abrir(dueno.token);
  return { m, dueno, admin, cliente, rid, platos };
}

describe('el restaurante como los grandes (C-RESTAURANTE-MAS)', () => {
  it('reseñas: el restaurante las lista con el nombre de pila, responde, y el cliente ve la respuesta en su pedido', async () => {
    const e = await escenario();
    const p = await e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: e.rid,
        lineas: [{ platoId: e.platos[0], cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '300 Calle',
        lat: 25.775,
        lng: -80.195,
      },
      e.cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    await llevarA(e.m.DB, id, 'entregado');
    await e.m.llamar(
      'POST',
      `/datos/pedidos/${id}/calificar`,
      { estrellasRestaurante: 5, comentario: 'Delicioso' },
      e.cliente.token,
    );
    const lista = await e.m.llamar(
      'GET',
      '/datos/mi-restaurante/resenas',
      undefined,
      e.dueno.token,
    );
    expect(lista.datos).toMatchObject({ promedio: 5, total: 1, respondidas: 0 });
    expect(lista.datos.resenas[0]).toMatchObject({
      pedidoId: id,
      cliente: 'Ana',
      estrellas: 5,
      comentario: 'Delicioso',
      respuesta: null,
    });
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/mi-restaurante/resenas/${id}/responder`,
          { texto: '¡Gracias, Ana!' },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
    const seg = await e.m.llamar(
      'GET',
      `/datos/pedidos/${id}/seguimiento`,
      undefined,
      e.cliente.token,
    );
    expect(seg.datos.pedido.resena).toMatchObject({
      estrellas: 5,
      comentario: 'Delicioso',
      respuesta: '¡Gracias, Ana!',
    });
    expect(
      (await e.m.llamar('GET', '/datos/mi-restaurante/resenas', undefined, e.dueno.token)).datos
        .respondidas,
    ).toBe(1); // El cliente cambia sus estrellas después: la respuesta del restaurante no se pierde.
    await e.m.llamar(
      'POST',
      `/datos/pedidos/${id}/calificar`,
      { estrellasRestaurante: 4, comentario: 'Muy bueno' },
      e.cliente.token,
    );
    const otra = await e.m.llamar('GET', '/datos/mi-restaurante/resenas', undefined, e.dueno.token);
    expect(otra.datos.resenas[0]).toMatchObject({
      estrellas: 4,
      comentario: 'Muy bueno',
      respuesta: '¡Gracias, Ana!',
    });
  });

  it('orden: platos dentro de su categoría y categorías en el orden del restaurante, en el menú público', async () => {
    const e = await escenario();
    const orden = async () =>
      (
        (await e.m.llamar('GET', `/datos/restaurantes/${e.rid}`, undefined, e.cliente.token)).datos
          .platos as { nombreEs: string; categoria: string }[]
      ).map((x) => `${x.categoria}/${x.nombreEs}`);
    expect(await orden()).toEqual(['Bebidas/Jugo', 'Sándwiches/Cubano', 'Sándwiches/Media noche']);
    await e.m.llamar(
      'PUT',
      '/datos/mi-restaurante/orden-categorias',
      { categorias: ['Sándwiches', 'Bebidas'] },
      e.dueno.token,
    );
    await e.m.llamar(
      'PUT',
      '/datos/mi-restaurante/orden-platos',
      { ids: [e.platos[1], e.platos[0], e.platos[2]] },
      e.dueno.token,
    );
    expect(await orden()).toEqual(['Sándwiches/Media noche', 'Sándwiches/Cubano', 'Bebidas/Jugo']);
  });

  it('festivos: un cierre para hoy deja el restaurante cerrado aunque esté abierto y en horario; al quitarlo vuelve', async () => {
    const e = await escenario();
    const abierto = async () =>
      (await e.m.llamar('GET', `/datos/restaurantes/${e.rid}`, undefined, e.cliente.token)).datos
        .restaurante.abiertoAhora as boolean;
    expect(await abierto()).toBe(true);
    const hoy = fechaLocal('America/New_York');
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/mi-restaurante/cierres',
          { fecha: hoy, motivo: 'Inventario' },
          e.dueno.token,
        )
      ).estado,
    ).toBe(201);
    expect(await abierto()).toBe(false);
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/mi-restaurante/cierres',
          { fecha: '18/10/2026' },
          e.dueno.token,
        )
      ).estado,
    ).toBe(400);
    const lista = await e.m.llamar(
      'GET',
      '/datos/mi-restaurante/cierres',
      undefined,
      e.dueno.token,
    );
    expect(lista.datos.cierres).toHaveLength(1);
    await e.m.llamar(
      'DELETE',
      `/datos/mi-restaurante/cierres/${lista.datos.cierres[0].id}`,
      undefined,
      e.dueno.token,
    );
    expect(await abierto()).toBe(true);
  });

  it('equipo: el dueño agrega por correo; el miembro entra al mismo restaurante con su rol; el staff no responde reseñas ni cambia el equipo', async () => {
    const e = await escenario();
    const staff = await e.m.cuenta('restaurante', 'Beto Staff');
    expect(
      (await e.m.llamar('GET', '/datos/mi-restaurante', undefined, staff.token)).datos.restaurante,
    ).toBeNull();
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/mi-restaurante/equipo',
          { correo: 'nadie@ejemplo.com' },
          e.dueno.token,
        )
      ).estado,
    ).toBe(404);
    const correoStaff = (await e.m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(staff.id)
      .first<{ correo: string }>())!.correo;
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/mi-restaurante/equipo',
          { correo: correoStaff, rol: 'staff' },
          e.dueno.token,
        )
      ).estado,
    ).toBe(201);
    const mio = await e.m.llamar('GET', '/datos/mi-restaurante', undefined, staff.token);
    expect(mio.datos.restaurante.id).toBe(e.rid);
    expect(
      (await e.m.llamar('GET', '/datos/mi-restaurante/equipo', undefined, staff.token)).datos.miRol,
    ).toBe('staff');
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/mi-restaurante/resenas/x/responder',
          { texto: 'hola' },
          staff.token,
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/mi-restaurante/equipo',
          { correo: correoStaff },
          staff.token,
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/mi-restaurante/equipo',
          { correo: correoStaff },
          e.dueno.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await e.m.llamar(
          'DELETE',
          `/datos/mi-restaurante/equipo/${staff.id}`,
          undefined,
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (await e.m.llamar('GET', '/datos/mi-restaurante', undefined, staff.token)).datos.restaurante,
    ).toBeNull();
  });

  it('el panel tiene Reseñas, Equipo, Festivos y el reordenado del menú', () => {
    const raiz = join(__dirname, '..', '..', '..', '..');
    const leer = (x: string) => readFileSync(join(raiz, x), 'utf8');
    expect(leer('apps/panel/src/panel/PanelApp.tsx')).toContain("'/panel/reviews'");
    expect(leer('apps/panel/src/panel/PanelApp.tsx')).toContain("'/panel/team'");
    expect(leer('apps/panel/src/panel/MiRestaurante.tsx')).toContain('<Cierres');
    expect(leer('apps/panel/src/panel/Menu.tsx')).toContain("'/datos/mi-restaurante/orden-platos'");
    expect(leer('apps/panel/src/panel/Menu.tsx')).toContain(
      "'/datos/mi-restaurante/orden-categorias'",
    );
  });
});
