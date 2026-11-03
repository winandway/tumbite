import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { empresa } from '../pruebas/flex';
import { conciliarFinanzas } from './reloj';
import { UMBRALES_INICIALES, leerUmbrales, pasaUmbral } from './controlDual';

/**
 * C-CONTROL-DUAL (SIG-4): el dinero hecho a mano por encima del umbral lo aprueba OTRA persona del
 * equipo (Total o Finanzas). SQLite en memoria y Stripe SIMULADO: ningún cobro real.
 */
const CLAVE = 'clave-segura-1';
let refunds = 0;
let estadoPi = 'succeeded';
beforeEach(() => {
  refunds = 0;
  estadoPi = 'succeeded';
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const ruta = new URL(url).pathname;
    if (ruta === '/v1/refunds') {
      refunds += 1;
      return Response.json({ id: `re_${refunds}`, status: 'succeeded' });
    }
    if (/^\/v1\/payment_intents\/pi_rev$/.test(ruta) && (init?.method ?? 'GET') === 'GET')
      return Response.json({ id: 'pi_rev', status: estadoPi, amount_received: 3400 });
    return Response.json({ id: 'x', status: 'succeeded' });
  });
});
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const pide = await m.cuenta('admin', 'Soporte Pide');
  const e = await empresa(m);
  const env = { DB: m.DB, ...m.extra, STRIPE_SECRET_KEY: 'sk_test_x' } as never;
  const saldo = async (token: string) =>
    (await m.llamar('GET', `/datos/admin/finanzas/empresas/${e.id}/movimientos`, undefined, token))
      .datos.saldo.disponible as number;
  const ajuste = (monto: number, token = pide.token) =>
    m.llamar(
      'POST',
      `/datos/admin/finanzas/empresas/${e.id}/ajuste`,
      { monto, motivo: 'compensación acordada', clave: CLAVE },
      token,
    );
  const aprobar = (id: string, token: string, clave = CLAVE) =>
    m.llamar('POST', `/datos/admin/aprobaciones-dinero/${id}/aprobar`, { clave }, token);
  const bandeja = (token: string) =>
    m.llamar('GET', '/datos/admin/aprobaciones-dinero', undefined, token);
  return { m, pide, e, env, saldo, ajuste, aprobar, bandeja };
}

describe('C-CONTROL-DUAL · dinero a mano con dos firmas', () => {
  it('por encima del umbral no mueve nada: queda pendiente y lo aprueba otra persona con su contraseña', async () => {
    const { m, pide, env, saldo, ajuste, aprobar, bandeja } = await escenario();
    // Bajo el umbral, como siempre: se hace de una.
    expect((await ajuste(500)).estado).toBe(200);
    expect(await saldo(pide.token)).toBe(500);

    const r = await ajuste(15_000);
    expect(r.estado).toBe(202);
    expect(r.datos.pendiente).toBe(true);
    expect(r.datos.aprobacion).toMatchObject({ monto: 15_000, moneda: 'USD' });
    // Sin otra persona que pueda aprobar: se dice, no se traba en silencio.
    expect(r.datos.aprobadores).toBe(0);
    expect(r.datos.mensaje).toMatch(/no hay otra cuenta/);
    expect(await saldo(pide.token)).toBe(500);
    // El mismo pedido dos veces no se duplica.
    expect((await ajuste(15_000)).datos.aprobacion.id).toBe(r.datos.aprobacion.id);
    const id = r.datos.aprobacion.id as string;

    // Nunca la misma persona.
    const yo = await aprobar(id, pide.token);
    expect(yo.estado).toBe(409);
    expect(yo.datos.error).toMatch(/otra persona|another team member/i);

    const jefa = await m.cuenta('admin', 'Soporte Finanzas');
    const ayuda = await m.cuenta('admin', 'Soporte Ayuda');
    expect(
      (await m.llamar('PUT', `/datos/admin/equipo/${ayuda.id}`, { perfil: 'soporte' }, jefa.token))
        .estado,
    ).toBe(200);
    // Soporte no aprueba dinero.
    const soporte = await aprobar(id, ayuda.token);
    expect(soporte.estado).toBe(403);
    expect(soporte.datos.error).toMatch(/Total o Finanzas|Full or Finance/);
    // Contraseña mala: no.
    expect((await aprobar(id, jefa.token, 'mala')).estado).toBe(403);

    const b = await bandeja(jefa.token);
    expect(b.datos.puedoAprobar).toBe(true);
    expect(b.datos.aprobadoresAparte).toBe(1);
    expect(b.datos.pendientes).toHaveLength(1);
    expect(b.datos.pendientes[0]).toMatchObject({ id, pedidoPorNombre: 'Soporte Pide' });
    expect((await bandeja(ayuda.token)).datos.puedoAprobar).toBe(false);

    const ok = await aprobar(id, jefa.token);
    expect(ok.estado).toBe(200);
    expect(ok.datos.estado).toBe('aprobada');
    expect(await saldo(pide.token)).toBe(15_500);
    // Dos veces no se ejecuta.
    expect((await aprobar(id, jefa.token)).estado).toBe(409);
    const fila = await m.DB.prepare(
      'SELECT estado, pedido_por, revisado_por FROM aprobaciones_dinero WHERE id = ?',
    )
      .bind(id)
      .first<{ estado: string; pedido_por: string; revisado_por: string }>();
    expect(fila).toMatchObject({ estado: 'aprobada', pedido_por: pide.id, revisado_por: jefa.id });
    // El libro sigue cuadrando y la conciliación no ve problemas.
    expect((await conciliarFinanzas(env, m.DB)).ok).toBe(true);
    const acciones = await m.llamar('GET', '/datos/admin/equipo/acciones', undefined, jefa.token);
    expect(JSON.stringify(acciones.datos)).toContain('/aprobaciones-dinero/');
    expect((await bandeja(jefa.token)).datos.recientes[0]).toMatchObject({
      id,
      estado: 'aprobada',
      revisadoPorNombre: 'Soporte Finanzas',
    });
  });

  it('rechazar no mueve nada; lo que ya no se puede hacer queda «fallida» con el motivo', async () => {
    const { m, pide, saldo, ajuste, aprobar } = await escenario();
    const otra = await m.cuenta('admin', 'Soporte Otra');
    const r = await ajuste(20_000);
    const id = r.datos.aprobacion.id as string;
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/aprobaciones-dinero/${id}/rechazar`,
          { nota: 'x' },
          otra.token,
        )
      ).estado,
    ).toBe(400);
    const no = await m.llamar(
      'POST',
      `/datos/admin/aprobaciones-dinero/${id}/rechazar`,
      { nota: 'No está acordado con la empresa' },
      otra.token,
    );
    expect(no.estado).toBe(200);
    expect(await saldo(pide.token)).toBe(0);
    expect((await aprobar(id, otra.token)).estado).toBe(409);
    expect((await aprobar('no-existe', otra.token)).estado).toBe(404);

    // Un descuento mayor que el saldo: queda pendiente y, al aprobar, falla con su motivo visible.
    const neg = await ajuste(-20_000);
    expect(neg.estado).toBe(202);
    const falla = await aprobar(neg.datos.aprobacion.id, otra.token);
    expect(falla.estado).toBe(409);
    const f = await m.DB.prepare('SELECT estado, error FROM aprobaciones_dinero WHERE id = ?')
      .bind(neg.datos.aprobacion.id)
      .first<{ estado: string; error: string }>();
    expect(f?.estado).toBe('fallida');
    expect(f?.error).toMatch(/negativo/);

    // Quien lo pidió puede retirar lo suyo; Soporte no rechaza lo de otro.
    const mio = await ajuste(30_000);
    const ayuda = await m.cuenta('admin', 'Soporte Ayuda');
    await m.llamar('PUT', `/datos/admin/equipo/${ayuda.id}`, { perfil: 'soporte' }, otra.token);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/aprobaciones-dinero/${mio.datos.aprobacion.id}/rechazar`,
          { nota: 'Me equivoqué de monto' },
          ayuda.token,
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/aprobaciones-dinero/${mio.datos.aprobacion.id}/rechazar`,
          { nota: 'Me equivoqué de monto' },
          pide.token,
        )
      ).estado,
    ).toBe(200);
  });

  it('el umbral nace en unos 100 dólares por moneda y solo una cuenta Total lo cambia', async () => {
    const { m, pide, ajuste, bandeja } = await escenario();
    expect((await bandeja(pide.token)).datos.umbrales).toMatchObject(UMBRALES_INICIALES);
    const fin = await m.cuenta('admin', 'Soporte Finanzas');
    await m.llamar('PUT', `/datos/admin/equipo/${fin.id}`, { perfil: 'finanzas' }, pide.token);
    const cambiar = (token: string, umbrales: Record<string, number>) =>
      m.llamar('PUT', '/datos/admin/aprobaciones-dinero/umbrales', { umbrales }, token);
    expect((await cambiar(fin.token, { USD: 100 })).estado).toBe(403);
    expect((await cambiar(pide.token, { usd: 100 })).estado).toBe(400);
    const ok = await cambiar(pide.token, { USD: 100 });
    expect(ok.estado).toBe(200);
    expect(ok.datos.umbrales).toMatchObject({ USD: 100, COP: UMBRALES_INICIALES.COP });
    expect((await ajuste(101)).estado).toBe(202);
    expect((await ajuste(100)).estado).toBe(200);
  });

  it('devolución, fondo de un punto y cobro confirmado a mano también pasan por la segunda firma', async () => {
    const { m, pide, aprobar } = await escenario();
    const otra = await m.cuenta('admin', 'Soporte Otra');
    await m.llamar(
      'PUT',
      '/datos/admin/aprobaciones-dinero/umbrales',
      { umbrales: { USD: 100 } },
      pide.token,
    );
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const rest = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, entregado_en, stripe_pago)
       VALUES ('p-rev', ?, ?, 'entregado', '[]', 3000, 0, 400, 0, 0, 3400, 300, 2700, 0, 0, 100, 'inicial', 'x', datetime('now'), 'pi_rev')`,
    )
      .bind(cliente.id, rest.datos.restaurante.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO cobros (pedido_id, capturado_en, capturado) VALUES ('p-rev', datetime('now'), 3400)",
    ).run();

    // Devolución.
    const dev = await m.llamar(
      'POST',
      '/datos/admin/pedidos/p-rev/devolver',
      { montoCentavos: 500, motivo: 'Llegó frío' },
      pide.token,
    );
    expect(dev.estado).toBe(202);
    expect(refunds).toBe(0);
    expect((await aprobar(dev.datos.aprobacion.id, otra.token)).estado).toBe(200);
    expect(refunds).toBe(1);

    // Cobro confirmado a mano: el monto es el de la liquidación.
    await m.DB.prepare(
      "INSERT INTO liquidaciones (pedido_id, estado, pi, monto, intentos, error) VALUES ('p-rev', 'revision', 'pi_rev', 3400, 6, 'card_declined')",
    ).run();
    const conf = await m.llamar(
      'POST',
      '/datos/admin/liquidaciones/p-rev/confirmar',
      {},
      pide.token,
    );
    expect(conf.estado).toBe(202);
    expect(conf.datos.aprobacion.monto).toBe(3400);
    expect((await aprobar(conf.datos.aprobacion.id, otra.token)).datos.resultado.estado).toBe(
      'capturada',
    );

    // Fondo de un punto de venta.
    const duenoPunto = await m.cuenta('cliente', 'Tienda Recargas');
    const punto = await m.llamar(
      'POST',
      '/datos/admin/puntos-venta',
      { nombre: 'Tienda Esquina', pais: 'US', usuarioId: duenoPunto.id },
      pide.token,
    );
    const pid = punto.datos.punto.id as string;
    const fondo = await m.llamar(
      'POST',
      `/datos/admin/puntos-venta/${pid}/fondo`,
      { monto: 5000, comprobante: 'pago-001' },
      pide.token,
    );
    expect(fondo.estado).toBe(202);
    const hecho = await aprobar(fondo.datos.aprobacion.id, otra.token);
    expect(hecho.estado).toBe(200);
    expect(hecho.datos.resultado.fondo).toBe(5000);
  });

  it('cobro en revisión: si Stripe no lo tiene capturado, la aprobación falla y no se inventa', async () => {
    const { m, pide, aprobar, env } = await escenario();
    estadoPi = 'requires_capture';
    const otra = await m.cuenta('admin', 'Soporte Otra');
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const rest = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, entregado_en)
       VALUES ('p-rev', ?, ?, 'entregado', '[]', 30000, 0, 400, 0, 0, 30400, 300, 2700, 0, 0, 100, 'inicial', 'x', datetime('now'))`,
    )
      .bind(cliente.id, rest.datos.restaurante.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO liquidaciones (pedido_id, estado, pi, monto, intentos, error) VALUES ('p-rev', 'revision', 'pi_rev', 30400, 6, 'card_declined')",
    ).run();
    const conf = await m.llamar(
      'POST',
      '/datos/admin/liquidaciones/p-rev/confirmar',
      {},
      pide.token,
    );
    expect(conf.estado).toBe(202);
    expect((await aprobar(conf.datos.aprobacion.id, otra.token)).estado).toBe(409);
    expect(
      (
        await m.DB.prepare("SELECT estado FROM liquidaciones WHERE pedido_id = 'p-rev'").first<{
          estado: string;
        }>()
      )?.estado,
    ).toBe('revision');
    expect((await conciliarFinanzas(env, m.DB)).ok).toBe(true);
  });

  it('umbrales: «por encima» es mayor estricto, moneda desconocida siempre pide firma y un valor dañado no apaga el control', async () => {
    expect(pasaUmbral({ USD: 100 }, 'USD', 100)).toBe(false);
    expect(pasaUmbral({ USD: 100 }, 'USD', -101)).toBe(true);
    expect(pasaUmbral({ USD: 100 }, 'EUR', 1)).toBe(true);
    const m = mundo();
    await m.DB.prepare(
      "INSERT INTO config (clave, valor) VALUES ('control_dual_umbrales', 'no es json')",
    ).run();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await leerUmbrales(m.DB)).toEqual(UMBRALES_INICIALES);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('la base no deja que quien lo pidió sea quien lo aprueba', async () => {
    const m = mundo();
    const a = await m.cuenta('admin');
    await expect(
      m.DB.prepare(
        "INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, datos, pedido_por, revisado_por, estado) VALUES ('x', 'ajuste_billetera', 'e', 1, 'USD', '{}', ?, ?, 'aprobada')",
      )
        .bind(a.id, a.id)
        .run(),
    ).rejects.toThrow();
  });
});
