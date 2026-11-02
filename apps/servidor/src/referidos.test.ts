import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { premiarReferidoDelPedido } from './referidos';
import { saldoRegalo } from './tarjetasRegalo';

/** C-REFERIDOS (CLI-7, 2 nov 2026): «Invita a un amigo», apagado y en cero hasta que Richard fije el dinero. */
async function pedidoDe(m: ReturnType<typeof mundo>, clienteId: string, estado = 'pagado') {
  const id = crypto.randomUUID();
  await m.DB.prepare('PRAGMA foreign_keys = OFF').run();
  await m.DB.prepare(
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion)
     VALUES (?, ?, 'r', ?, '[]', 1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, 'basico', 'Calle')`,
  )
    .bind(id, clienteId, estado)
    .run();
  await m.DB.prepare('PRAGMA foreign_keys = ON').run();
  return id;
}

describe('invitar a un amigo (C-REFERIDOS)', () => {
  it('nace apagado y en cero; no se enciende sin montos', async () => {
    const m = mundo();
    const ana = await m.cuenta('cliente', 'Ana Invita');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('GET', '/datos/referidos', undefined, ana.token);
    expect(r.datos).toMatchObject({
      activos: false,
      paraAmigo: 0,
      paraQuienInvita: 0,
      codigo: null,
    });
    const ajustes = (await m.llamar('GET', '/datos/admin/referidos', undefined, admin.token)).datos;
    expect(ajustes).toMatchObject({
      activos: false,
      paraAmigo: 0,
      paraQuienInvita: 0,
      invitados: 0,
    });
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/referidos',
          { activos: true, paraAmigo: 0, paraQuienInvita: 0 },
          admin.token,
        )
      ).estado,
    ).toBe(400);
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/referidos',
          { activos: true, paraAmigo: 500, paraQuienInvita: 500 },
          ana.token,
        )
      ).estado,
    ).toBe(403);
    expect(
      (await m.llamar('POST', '/datos/referidos/canjear', { codigo: 'ANAXXXX' }, ana.token)).estado,
    ).toBe(409);
  });

  it('el amigo recibe su crédito al usar el código; quien invitó, al entregarse el primer pedido', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    await m.llamar(
      'PUT',
      '/datos/admin/referidos',
      { activos: true, paraAmigo: 500, paraQuienInvita: 700 },
      admin.token,
    );
    const ana = await m.cuenta('cliente', 'Ana Invita');
    const bea = await m.cuenta('cliente', 'Bea Nueva');
    const carlos = await m.cuenta('cliente', 'Carlos Viejo');
    const { codigo } = (await m.llamar('GET', '/datos/referidos', undefined, ana.token)).datos;
    expect(codigo).toMatch(/^ANA[A-Z2-9]{4}$/);
    // El mismo código siempre.
    expect((await m.llamar('GET', '/datos/referidos', undefined, ana.token)).datos.codigo).toBe(
      codigo,
    );
    const canjear = (u: { token: string }, c: string) =>
      m.llamar('POST', '/datos/referidos/canjear', { codigo: c }, u.token);
    expect((await canjear(ana, codigo)).estado).toBe(409);
    expect((await canjear(bea, 'NOEXISTE1')).estado).toBe(404);
    await pedidoDe(m, carlos.id);
    expect((await canjear(carlos, codigo)).estado).toBe(409);
    const ok = await canjear(bea, codigo.toLowerCase());
    expect(ok.estado).toBe(201);
    expect(ok.datos.credito).toBe(500);
    expect(await saldoRegalo(m.DB, bea.id)).toBe(500);
    expect((await canjear(bea, codigo)).estado).toBe(409);
    expect(
      (await m.llamar('GET', '/datos/referidos', undefined, bea.token)).datos.yaUsoUnCodigo,
    ).toBe(true);
    // Primer pedido de Bea entregado: Ana recibe lo suyo, una sola vez.
    const p = await pedidoDe(m, bea.id, 'entregado');
    await premiarReferidoDelPedido(m.DB, p);
    await premiarReferidoDelPedido(m.DB, p);
    expect(await saldoRegalo(m.DB, ana.id)).toBe(700);
    expect((await m.llamar('GET', '/datos/referidos', undefined, ana.token)).datos).toMatchObject({
      invitados: 1,
      premiados: 1,
    });
  });

  it('las dos formas de entregar un pedido le avisan a los referidos', () => {
    const s = readFileSync(join(__dirname, 'rutas', 'operacion.ts'), 'utf8');
    expect(s.match(/await premiarReferidoDelPedido\(db, id\)/g)).toHaveLength(2);
  });
});
