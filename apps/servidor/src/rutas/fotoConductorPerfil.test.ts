import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * C-FOTO-CONDUCTOR-SE-VE (24 nov 2026) — todos los países. La cara aprobada en la verificación es la
 * foto que ve el cliente, por su miniatura (nunca la original, que es evidencia de identidad), en
 * comida igual que en viajes; y el panel tiene la lista para reparar a los aprobados sin miniatura.
 */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const txt = (t: string) => [...t].map((x) => x.charCodeAt(0));
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const trozo = (tipo: string, datos: number[]) => [
  ...txt(tipo),
  ...le32(datos.length),
  ...datos,
  ...(datos.length % 2 ? [0] : []),
];
const cuerpoWebp = [
  ...txt('WEBP'),
  ...trozo('VP8X', [0, 0, 0, 0, 0xc7, 0, 0, 0x95, 0, 0]),
  ...trozo('VP8 ', [1, 2, 3, 4, 5]),
];
const WEBP = new Uint8Array([...txt('RIFF'), ...le32(cuerpoWebp.length), ...cuerpoWebp]);

async function conductorAprobado(m: ReturnType<typeof mundo>, adminToken: string) {
  const rep = await m.cuenta('repartidor', 'Rafa Repartidor');
  for (const pieza of ['doc_frente', 'selfie'])
    expect(
      (
        await m.crudo(`/datos/kyc/foto/${pieza}`, {
          method: 'POST',
          headers: { authorization: `Bearer ${rep.token}`, 'content-type': 'image/png' },
          body: PNG as BodyInit,
        })
      ).status,
    ).toBe(201);
  await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'pasaporte' }, rep.token);
  expect(
    (await m.llamar('PATCH', `/datos/admin/kyc/${rep.id}`, { estado: 'aprobado' }, adminToken))
      .estado,
  ).toBe(200);
  return rep;
}

describe('C-FOTO-CONDUCTOR-SE-VE · servidor', () => {
  it('comida: el cliente ve la miniatura de la cara aprobada, nunca la original', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const cliente = await m.cuenta('cliente');
    const rep = await conductorAprobado(m, admin.token);
    const dueno = await m.cuenta('restaurante');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    const pid = crypto.randomUUID();
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
         pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, zona_id, moneda)
       SELECT ?, ?, ?, ?, 'en_camino', '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'inicial', '', '', 'US-FL-MIAMI', 'USD'`,
    )
      .bind(pid, cliente.id, rid, rep.id)
      .run();
    const foto = () =>
      m.crudo(`/datos/pedidos/${pid}/repartidor/foto`, {
        headers: { authorization: `Bearer ${cliente.token}` },
      });
    const seguimiento = async () =>
      (await m.llamar('GET', `/datos/pedidos/${pid}/seguimiento`, undefined, cliente.token)).datos
        .pedido.repartidor.foto;
    // Sin miniatura: nada (antes salía la selfie original).
    expect((await foto()).status).toBe(404);
    expect(await seguimiento()).toBeNull();
    expect(
      (
        await m.crudo(`/datos/admin/kyc/${rep.id}/miniatura`, {
          method: 'POST',
          headers: { authorization: `Bearer ${admin.token}`, 'content-type': 'image/webp' },
          body: WEBP as BodyInit,
        })
      ).status,
    ).toBe(201);
    expect(await seguimiento()).toBe(`/datos/pedidos/${pid}/repartidor/foto`);
    const r = await foto();
    expect(r.status).toBe(200);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(WEBP);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('reparación: la lista trae solo aprobados con cara y sin miniatura, y se vacía al repararlos', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const rep = await conductorAprobado(m, admin.token);
    const pendiente = await m.cuenta('repartidor', 'Pedro Pendiente');
    await m.crudo('/datos/kyc/foto/selfie', {
      method: 'POST',
      headers: { authorization: `Bearer ${pendiente.token}`, 'content-type': 'image/png' },
      body: PNG as BodyInit,
    });
    const lista = async () =>
      (await m.llamar('GET', '/datos/admin/kyc/miniaturas-faltantes', undefined, admin.token)).datos
        .ids as string[];
    expect(await lista()).toEqual([rep.id]);
    await m.crudo(`/datos/admin/kyc/${rep.id}/miniatura`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin.token}`, 'content-type': 'image/webp' },
      body: WEBP as BodyInit,
    });
    // Idempotente: reparado, ya no vuelve (una escritura por conductor, una sola vez).
    expect(await lista()).toEqual([]);
    // Nadie de fuera del equipo la lee.
    const cliente = await m.cuenta('cliente');
    expect(
      (await m.llamar('GET', '/datos/admin/kyc/miniaturas-faltantes', undefined, cliente.token))
        .estado,
    ).toBe(403);
  });
});
