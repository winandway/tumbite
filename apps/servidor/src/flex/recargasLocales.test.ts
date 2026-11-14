import { describe, expect, it } from 'vitest';
import { FOTO_PRUEBA, mundo } from '../pruebas/ayuda';
import { B, empresa, envios, k, llamar, ruta, vincular, type M } from '../pruebas/flex';

/**
 * C-FLEX-RECARGA-LOCAL (Flex Fase 7, 13 nov 2026). País: Venezuela (El Vigía, estado Mérida); sirve
 * para cualquier país sin Stripe. Circuito completo por la API, en local y sin Stripe: la empresa
 * declara un pago móvil con su comprobante, el equipo lo acredita UNA vez (o lo rechaza con motivo)
 * y ese saldo paga la comisión de una ruta.
 */
const CONFIG_VE = {
  activas: true,
  minimo: 500,
  maximo: 200_000,
  metodos: ['pago_movil', 'transferencia', 'zelle', 'efectivo'],
  instruccionesEs: 'Paga a la cuenta de Divoox indicada por soporte.',
  instruccionesEn: 'Pay to the Divoox account given by support.',
};

async function subirComprobante(m: M, e: { id: string; dueno: { token: string } }) {
  const res = await m.crudo(`${B}/empresas/${e.id}/billetera/recargas-locales/comprobante`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${e.dueno.token}`,
      'content-type': 'image/webp',
      'cf-connecting-ip': `10.6.${k().length % 250}.9`,
    },
    body: FOTO_PRUEBA as BodyInit,
  });
  return { estado: res.status, datos: (await res.json()) as any };
}

async function escenario(encender = true) {
  // Sin STRIPE_SECRET_KEY: este circuito no pasa por Stripe.
  const m = mundo();
  const admin = await m.cuenta('admin');
  const e = await empresa(m, 'Encomiendas El Vigía');
  await m.DB.prepare("UPDATE empresas SET pais = 'VE' WHERE id = ?").bind(e.id).run();
  if (encender)
    expect(
      (await llamar(m, 'PUT', `${B}/admin/recargas-locales/config/VE`, CONFIG_VE, admin.token))
        .estado,
    ).toBe(200);
  return { m, admin, e };
}

async function declarar(
  m: M,
  e: { id: string; dueno: { token: string } },
  cuerpo: Record<string, unknown> = {},
  clave = k(),
) {
  const foto = await subirComprobante(m, e);
  expect(foto.estado).toBe(201);
  return llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/billetera/recargas-locales`,
    {
      monto: 5000,
      metodo: 'pago_movil',
      referencia: '00123456789',
      banco: 'Banco de prueba',
      fechaPago: '2026-11-13',
      comprobanteId: foto.datos.comprobanteId,
      ...cuerpo,
    },
    e.dueno.token,
    { 'idempotency-key': clave },
  );
}

const saldo = async (m: M, e: { id: string; dueno: { token: string } }) =>
  (await llamar(m, 'GET', `${B}/empresas/${e.id}/billetera`, undefined, e.dueno.token)).datos.saldo;

describe('C-FLEX-RECARGA-LOCAL · recargas con pago local verificadas por Divoox', () => {
  it('apagado de fábrica: sin la orden del superadmin no se puede declarar nada', async () => {
    const { m, e } = await escenario(false);
    const foto = await subirComprobante(m, e);
    expect(foto.estado).toBe(409);
    const cfg = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/billetera/recargas-locales`,
      undefined,
      e.dueno.token,
    );
    expect(cfg.datos.config.activas).toBe(false);
  });

  it('se acredita UNA sola vez aunque se toque dos veces, y queda en el libro, el comprobante y la auditoría', async () => {
    const { m, admin, e } = await escenario();
    const clave = k();
    const d = await declarar(m, e, {}, clave);
    expect(d.estado).toBe(201);
    expect(d.datos.recarga).toMatchObject({
      estado: 'pendiente',
      monto: 5000,
      metodo: 'pago_movil',
    });
    // La misma clave no declara dos veces; la misma referencia con otra clave tampoco.
    expect((await declarar(m, e, {}, clave)).datos.recarga.id).toBe(d.datos.recarga.id);
    expect((await declarar(m, e)).estado).toBe(409);
    expect((await saldo(m, e)).disponible).toBe(0);

    const rid = d.datos.recarga.id;
    const cola = await llamar(m, 'GET', `${B}/admin/recargas-locales`, undefined, admin.token);
    expect(cola.datos.recargas.map((r: any) => r.id)).toEqual([rid]);
    const img = await m.crudo(`${B}/admin/recargas-locales/${rid}/comprobante`, {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(img.status).toBe(200);
    // La empresa no ve la cola ni acredita.
    expect(
      (await llamar(m, 'POST', `${B}/admin/recargas-locales/${rid}/acreditar`, {}, e.dueno.token))
        .estado,
    ).toBe(403);

    const [a1, a2] = await Promise.all([
      llamar(m, 'POST', `${B}/admin/recargas-locales/${rid}/acreditar`, {}, admin.token),
      llamar(m, 'POST', `${B}/admin/recargas-locales/${rid}/acreditar`, {}, admin.token),
    ]);
    expect([a1.estado, a2.estado].sort()).toEqual([200, 409]);
    const a3 = await llamar(
      m,
      'POST',
      `${B}/admin/recargas-locales/${rid}/acreditar`,
      {},
      admin.token,
    );
    expect(a3.estado).toBe(409);
    expect((await saldo(m, e)).disponible).toBe(5000);
    const libro = await m.DB.prepare(
      "SELECT COUNT(*) AS n, SUM(monto) AS s FROM libro WHERE referencia LIKE 'recarga_local:%'",
    ).first<{ n: number; s: number }>();
    expect(libro).toEqual({ n: 1, s: 5000 });
    const comp = await m.DB.prepare('SELECT tipo, monto FROM comprobantes WHERE referencia = ?')
      .bind(`recarga_local:${rid}`)
      .all();
    expect(comp.results).toEqual([{ tipo: 'recarga', monto: 5000 }]);
    const aud = await m.DB.prepare(
      'SELECT accion FROM finanzas_auditoria WHERE objeto = ? ORDER BY id',
    )
      .bind(rid)
      .all<{ accion: string }>();
    expect(aud.results.map((x) => x.accion)).toEqual([
      'recarga_local.declarar',
      'recarga_local.acreditar',
    ]);
  });

  it('rechazada con motivo: no suma nada, no se puede acreditar después y la empresa ve el motivo', async () => {
    const { m, admin, e } = await escenario();
    const d = await declarar(m, e, { referencia: 'REF-999' });
    const rid = d.datos.recarga.id;
    const corto = await llamar(
      m,
      'POST',
      `${B}/admin/recargas-locales/${rid}/rechazar`,
      { motivo: 'no' },
      admin.token,
    );
    expect(corto.estado).toBe(400);
    const r = await llamar(
      m,
      'POST',
      `${B}/admin/recargas-locales/${rid}/rechazar`,
      { motivo: 'La referencia no aparece en el banco.' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    expect(
      (await llamar(m, 'POST', `${B}/admin/recargas-locales/${rid}/acreditar`, {}, admin.token))
        .estado,
    ).toBe(409);
    expect((await saldo(m, e)).disponible).toBe(0);
    const lista = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/billetera/recargas-locales`,
      undefined,
      e.dueno.token,
    );
    expect(lista.datos.recargas[0]).toMatchObject({
      estado: 'rechazada',
      motivo: 'La referencia no aparece en el banco.',
    });
    // Rechazada, la misma referencia se puede volver a declarar (con la foto correcta).
    expect((await declarar(m, e, { referencia: 'REF-999' })).estado).toBe(201);
  });

  it('valida método, límites, foto y quién declara', async () => {
    const { m, e } = await escenario();
    expect((await declarar(m, e, { monto: 100 })).estado).toBe(422);
    expect((await declarar(m, e, { metodo: 'cripto' })).estado).toBe(400);
    const sinFoto = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/billetera/recargas-locales`,
      {
        monto: 5000,
        metodo: 'zelle',
        referencia: 'ZL-1',
        comprobanteId: '00000000-0000-4000-8000-000000000000',
      },
      e.dueno.token,
    );
    expect(sinFoto.estado).toBe(422);
    const otra = await empresa(m, 'Otra');
    expect((await subirComprobante(m, { id: e.id, dueno: otra.dueno })).estado).toBe(404);
  });

  it('el saldo acreditado paga la comisión de una ruta (Venezuela, sin Stripe)', async () => {
    const { m, admin, e } = await escenario();
    const pol = await llamar(
      m,
      'POST',
      '/datos/admin/finanzas/politicas',
      {
        nombre: 'Flex Venezuela',
        servicio: 'flex',
        tipoCuenta: 'empresa',
        pais: 'VE',
        modalidad: 'prepago',
        moneda: 'USD',
        regla: { tipo: 'por_paquete', monto: 25 },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
    expect(pol.estado).toBe(201);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const rutaId = await ruta(m, e, await envios(m, e, 4));
    const asignar = () =>
      llamar(
        m,
        'POST',
        `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
        { conductorId: cond.id },
        e.dueno.token,
      );
    // Sin saldo la ruta no sale.
    expect((await asignar()).estado).not.toBe(200);
    const d = await declarar(m, e, { monto: 1000, referencia: 'PM-777' });
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/admin/recargas-locales/${d.datos.recarga.id}/acreditar`,
          {},
          admin.token,
        )
      ).estado,
    ).toBe(200);
    expect((await asignar()).estado).toBe(200);
    expect(await saldo(m, e)).toMatchObject({ disponible: 900, reservado: 100 });
  });
});
