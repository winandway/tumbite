import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLUS_INICIAL } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { avisoPlus, leerPlus } from './plus';
import {
  TARJETAS_INICIAL,
  apartarSaldo,
  avisoTarjetaRegalo,
  leerTarjetas,
  saldoRegalo,
} from './tarjetasRegalo';
import {
  acreditarRecargaStripe,
  anularCodigo,
  crearRecargaStripe,
  emitirCodigo,
  fondearPunto,
} from './internacional/recargas';
import {
  autorizacionViaje,
  capturarCobroViaje,
  propinaViaje,
  soltarCobroViaje,
} from './viajesCobro';

/**
 * COB-5 · Divoox Plus (C-PLUS): los caminos de error que el recorrido feliz no toca. Stripe
 * SIMULADO en modo prueba; ningún cobro real. EE. UU.
 */

afterEach(() => vi.unstubAllGlobals());

const AJUSTES = { centavosMes: 999, minimoSubtotal: 0, servicioDescuentoPct: 50 };

function stripeSimulado(sinSecreto = false) {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    llamadas.push(String(url));
    if (/\/v1\/subscriptions$/.test(url))
      return Response.json({
        id: 'sub_1',
        latest_invoice: sinSecreto ? {} : { confirmation_secret: { client_secret: 'pi_secret' } },
      });
    return Response.json({ id: 'cus_1', client_secret: 'x' });
  });
  return llamadas;
}

async function preparar(env: Record<string, string> = { STRIPE_SECRET_KEY: 'sk_test_x' }) {
  const m = mundo(env);
  const admin = await m.cuenta('admin', 'Soporte Plus');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  return { m, admin, cliente };
}

describe('C-PLUS · caminos de error de Divoox Plus (COB-5)', () => {
  it('ajustes ilegibles en la base: Plus queda apagado, nunca cobra con datos rotos', async () => {
    const { m } = await preparar();
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    await m.DB.prepare("INSERT INTO config (clave, valor) VALUES ('plus', '{roto')").run();
    expect(await leerPlus(m.DB)).toEqual(PLUS_INICIAL);
    expect(errores).toHaveBeenCalled();
    errores.mockRestore();
  });

  it('el superadmin lee los ajustes; el cliente no', async () => {
    const { m, admin, cliente } = await preparar();
    const a = await m.llamar('GET', '/datos/admin/plus', undefined, admin.token);
    expect(a.estado).toBe(200);
    expect(a.datos.centavosMes).toBe(PLUS_INICIAL.centavosMes);
    expect((await m.llamar('GET', '/datos/admin/plus', undefined, cliente.token)).estado).toBe(403);
  });

  it('sin Stripe configurado no se suscribe ni cancela', async () => {
    const { m, cliente } = await preparar({ STRIPE_SECRET_KEY: '' });
    await m.DB.prepare("INSERT INTO config (clave, valor) VALUES ('plus', ?)")
      .bind(JSON.stringify(AJUSTES))
      .run();
    expect((await m.llamar('POST', '/datos/plus/suscribirse', {}, cliente.token)).estado).toBe(409);
    await m.DB.prepare(
      "INSERT INTO suscripciones_plus (usuario_id, stripe_suscripcion, estado) VALUES (?, 'sub_x', 'activa')",
    )
      .bind(cliente.id)
      .run();
    expect((await m.llamar('POST', '/datos/plus/cancelar', {}, cliente.token)).estado).toBe(409);
  });

  it('si Stripe no devuelve el cobro, avisa con 503 y no deja una suscripción a medias', async () => {
    const { m, admin, cliente } = await preparar();
    stripeSimulado(true);
    await m.llamar('PUT', '/datos/admin/plus', AJUSTES, admin.token);
    expect((await m.llamar('POST', '/datos/plus/suscribirse', {}, cliente.token)).estado).toBe(503);
    const fila = await m.DB.prepare('SELECT 1 FROM suscripciones_plus WHERE usuario_id = ?')
      .bind(cliente.id)
      .first();
    expect(fila).toBeNull();
  });

  it('quien ya tiene Plus no paga dos veces; quien no lo tiene no puede cancelarlo', async () => {
    const { m, admin, cliente } = await preparar();
    const llamadas = stripeSimulado();
    await m.llamar('PUT', '/datos/admin/plus', AJUSTES, admin.token);
    expect((await m.llamar('POST', '/datos/plus/cancelar', {}, cliente.token)).estado).toBe(404);
    expect((await m.llamar('POST', '/datos/plus/suscribirse', {}, cliente.token)).estado).toBe(200);
    // Ya tenía cliente de Stripe: la segunda vez no se crea otro.
    const clientes = llamadas.filter((u) => u.endsWith('/v1/customers')).length;
    expect(clientes).toBe(1);
    await m.DB.prepare(
      "UPDATE suscripciones_plus SET estado = 'activa', vence_en = datetime('now', '+30 days') WHERE usuario_id = ?",
    )
      .bind(cliente.id)
      .run();
    expect((await m.llamar('POST', '/datos/plus/suscribirse', {}, cliente.token)).estado).toBe(409);
  });

  it('avisos de Stripe que no son de Plus o vienen incompletos no activan nada', async () => {
    const { m, cliente } = await preparar();
    await m.DB.prepare(
      "INSERT INTO suscripciones_plus (usuario_id, stripe_suscripcion, estado) VALUES (?, 'sub_9', 'pendiente')",
    )
      .bind(cliente.id)
      .run();
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await avisoPlus(m.DB, 'invoice.paid', { id: 'in_1' })).toBe(false);
    expect(
      await avisoPlus(m.DB, 'invoice.paid', {
        parent: { subscription_details: { subscription: 'sub_9' } },
        lines: { data: [] },
      }),
    ).toBe(false);
    errores.mockRestore();
    const fila = await m.DB.prepare('SELECT estado FROM suscripciones_plus WHERE usuario_id = ?')
      .bind(cliente.id)
      .first<{ estado: string }>();
    expect(fila?.estado).toBe('pendiente');
  });
});

describe('C-TARJETAS-REGALO · caminos de error de las tarjetas de regalo (COB-5)', () => {
  const ENCENDIDAS = { activas: true, minimo: 1500, maximo: 50000 };

  it('ajustes ilegibles: quedan apagadas; el superadmin los lee; montos de cero no apartan saldo', async () => {
    const { m, admin, cliente } = await preparar();
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    await m.DB.prepare(
      "INSERT INTO config (clave, valor) VALUES ('tarjetas_regalo', '{roto')",
    ).run();
    expect(await leerTarjetas(m.DB)).toEqual(TARJETAS_INICIAL);
    errores.mockRestore();
    const a = await m.llamar('GET', '/datos/admin/tarjetas-regalo', undefined, admin.token);
    expect(a.estado).toBe(200);
    expect(await apartarSaldo(m.DB, 'pedido-x', cliente.id, 0)).toBe(false);
  });

  it('comprar: apagadas, fuera de rango y sin Stripe se rechazan', async () => {
    const { m, admin, cliente } = await preparar({ STRIPE_SECRET_KEY: '' });
    const comprar = (centavos: number) =>
      m.llamar(
        'POST',
        '/datos/tarjetas-regalo',
        { centavos, paraCorreo: 'regalo@ejemplo.com' },
        cliente.token,
      );
    expect((await comprar(2000)).estado).toBe(409);
    await m.llamar('PUT', '/datos/admin/tarjetas-regalo', ENCENDIDAS, admin.token);
    expect((await comprar(100)).estado).toBe(400);
    expect((await comprar(60000)).estado).toBe(400);
    expect((await comprar(2000)).estado).toBe(409);
  });

  it('canjear: apagadas o código inexistente no dan saldo', async () => {
    const { m, admin, cliente } = await preparar();
    const canjear = () =>
      m.llamar('POST', '/datos/tarjetas-regalo/canjear', { codigo: 'ABCD-1234' }, cliente.token);
    expect((await canjear()).estado).toBe(409);
    await m.llamar('PUT', '/datos/admin/tarjetas-regalo', ENCENDIDAS, admin.token);
    expect((await canjear()).estado).toBe(404);
    expect(await saldoRegalo(m.DB, cliente.id)).toBe(0);
  });

  it('avisos de Stripe: de otra cosa, de una tarjeta desconocida o repetidos no mandan dos códigos', async () => {
    const { m } = await preparar();
    const env = { DB: m.DB, ...m.extra, STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    expect(await avisoTarjetaRegalo(env, m.DB, 'payment_intent.succeeded', { metadata: {} })).toBe(
      false,
    );
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await avisoTarjetaRegalo(env, m.DB, 'payment_intent.succeeded', {
        metadata: { tarjeta_regalo_id: 'no-existe' },
      }),
    ).toBe(true);
    expect(errores).toHaveBeenCalledWith(
      'tarjeta de regalo: aviso sin tarjeta conocida',
      'no-existe',
    );
    errores.mockRestore();
  });
});

describe('C-VIAJE-COBRO · cobro de viajes con tarjeta: avisos y fallos (COB-5)', () => {
  async function cobro(m: ReturnType<typeof mundo>, estado: string) {
    await m.DB.prepare('PRAGMA foreign_keys = OFF').run();
    await m.DB.prepare(
      "INSERT INTO cobros_viaje (operacion_id, stripe_pago, autorizado, capturado, propina, estado) VALUES ('op1', 'pi_v1', 1200, 0, 0, ?)",
    )
      .bind(estado)
      .run();
  }

  it('un aviso sin viaje o que no cuadra con el viaje no autoriza nada', async () => {
    const { m } = await preparar();
    expect(await autorizacionViaje(m.DB, { id: 'pi_v1', metadata: {} })).toBeNull();
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await autorizacionViaje(m.DB, {
        id: 'pi_otro',
        amount_capturable: 1200,
        metadata: { viaje_id: 'op-desconocida' },
      }),
    ).toBeNull();
    expect(errores).toHaveBeenCalled();
    errores.mockRestore();
  });

  it('capturar: sin autorización no cobra; sin Stripe avisa con 503 y no marca nada cobrado', async () => {
    const { m } = await preparar({ STRIPE_SECRET_KEY: '' });
    const env = { DB: m.DB, ...m.extra, STRIPE_SECRET_KEY: '' } as never;
    expect(await capturarCobroViaje(env, m.DB, 'op1', 'cond1', 1000)).toBe(0);
    await cobro(m, 'autorizado');
    await expect(capturarCobroViaje(env, m.DB, 'op1', 'cond1', 1000)).rejects.toMatchObject({
      estado: 503,
    });
    const f = await m.DB.prepare(
      "SELECT estado FROM cobros_viaje WHERE operacion_id = 'op1'",
    ).first<{ estado: string }>();
    expect(f?.estado).toBe('autorizado');
  });

  it('soltar: sin cobro abierto o sin Stripe no hace nada', async () => {
    const { m } = await preparar({ STRIPE_SECRET_KEY: '' });
    const env = { DB: m.DB, ...m.extra, STRIPE_SECRET_KEY: '' } as never;
    expect(await soltarCobroViaje(env, m.DB, 'op1', 0)).toBe(0);
    await cobro(m, 'autorizado');
    expect(await soltarCobroViaje(env, m.DB, 'op1', 0)).toBe(0);
  });
});

describe('C-RECARGAS-PUNTO · recargas internacionales: puntos y códigos que no existen (COB-5)', () => {
  it('fondear, emitir y anular sobre un punto o código inexistente dan 404 sin tocar el libro', async () => {
    const { m } = await preparar();
    await expect(
      fondearPunto(m.DB, { puntoId: 'no', monto: 100, comprobante: 'x', autorId: 'a' }),
    ).rejects.toMatchObject({ estado: 404 });
    await expect(
      emitirCodigo(m.DB, { puntoId: 'no', monto: 100, emitidoPor: 'a' }),
    ).rejects.toMatchObject({ estado: 404 });
    await expect(
      anularCodigo(m.DB, { codigoId: 'no', puntoId: null, autorId: 'a' }),
    ).rejects.toMatchObject({ estado: 404 });
    const libro = await m.DB.prepare('SELECT COUNT(*) AS n FROM libro').first<{ n: number }>();
    expect(libro?.n).toBe(0);
  });

  it('recarga con tarjeta apagada en el país se rechaza; un aviso sin recarga no acredita', async () => {
    const { m, cliente } = await preparar();
    await expect(
      crearRecargaStripe(m.DB, {
        repartidorId: cliente.id,
        pais: 'VE',
        moneda: 'VES',
        monto: 1000,
      }),
    ).rejects.toMatchObject({ estado: 409 });
    expect(await acreditarRecargaStripe(m.DB, { metadata: {} })).toBe(false);
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await acreditarRecargaStripe(m.DB, { metadata: { recarga_id: 'no-existe' } })).toBe(
      false,
    );
    errores.mockRestore();
  });
});

describe('C-VIAJE-COBRO · propina con tarjeta después del viaje (COB-5)', () => {
  async function viaje(
    m: ReturnType<typeof mundo>,
    clienteId: string,
    o: { estadoGeneral?: string; cobro?: string; propina?: number; diasAtras?: number } = {},
  ) {
    await m.DB.prepare('PRAGMA foreign_keys = OFF').run();
    await m.DB.prepare(
      "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, vehiculo_id, zona_id, estado_general) VALUES ('op9', 'moto', 'viaje_pasajero', ?, 'cond9', 'v9', 'US-FL-MIAMI', ?)",
    )
      .bind(clienteId, o.estadoGeneral ?? 'terminada')
      .run();
    await m.DB.prepare(
      `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, pin_recogida, distancia_m_real, terminado_en)
       VALUES ('op9', 'terminado', 'conductor', 'k', 25.7, -80.2, 'A', 25.8, -80.1, 'B', '1234', 4200, datetime('now', ?))`,
    )
      .bind(`-${o.diasAtras ?? 0} days`)
      .run();
    await m.DB.prepare(
      "INSERT INTO cobros_viaje (operacion_id, stripe_pago, autorizado, capturado, propina, estado) VALUES ('op9', 'pi_v9', 1200, 1200, ?, ?)",
    )
      .bind(o.propina ?? 0, o.cobro ?? 'capturado')
      .run();
  }
  const ENV_PRUEBA = (m: ReturnType<typeof mundo>, llave = 'sk_test_x') =>
    ({ DB: m.DB, ...m.extra, STRIPE_SECRET_KEY: llave }) as never;

  it('sin viaje con tarjeta, sin terminar, con propina ya dejada o pasada la semana: no cobra', async () => {
    const { m, cliente } = await preparar();
    const env = ENV_PRUEBA(m);
    await expect(propinaViaje(env, m.DB, cliente.id, 'op9', 300)).rejects.toMatchObject({
      estado: 409,
    });
    await viaje(m, cliente.id, { estadoGeneral: 'en_curso' });
    await expect(propinaViaje(env, m.DB, cliente.id, 'op9', 300)).rejects.toMatchObject({
      estado: 409,
    });
    await m.DB.prepare(
      "UPDATE operaciones SET estado_general = 'terminada' WHERE id = 'op9'",
    ).run();
    await m.DB.prepare("UPDATE cobros_viaje SET propina = 200 WHERE operacion_id = 'op9'").run();
    await expect(propinaViaje(env, m.DB, cliente.id, 'op9', 300)).rejects.toMatchObject({
      estado: 409,
    });
    await m.DB.prepare("UPDATE cobros_viaje SET propina = 0 WHERE operacion_id = 'op9'").run();
    await m.DB.prepare(
      "UPDATE viajes SET terminado_en = datetime('now', '-8 days') WHERE operacion_id = 'op9'",
    ).run();
    await expect(propinaViaje(env, m.DB, cliente.id, 'op9', 300)).rejects.toMatchObject({
      estado: 409,
    });
  });

  it('sin Stripe, sin tarjeta guardada o con el cobro rechazado: avisa y no anota propina', async () => {
    const { m, cliente } = await preparar();
    await viaje(m, cliente.id);
    await expect(
      propinaViaje(ENV_PRUEBA(m, ''), m.DB, cliente.id, 'op9', 300),
    ).rejects.toMatchObject({ estado: 422 });
    vi.stubGlobal('fetch', async () => Response.json({ id: 'pi_v9', payment_method: null }));
    await expect(propinaViaje(ENV_PRUEBA(m), m.DB, cliente.id, 'op9', 300)).rejects.toBeTruthy();
    await m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_9' WHERE id = ?")
      .bind(cliente.id)
      .run();
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? Response.json({ id: 'pi_v9', payment_method: 'pm_1' })
        : Response.json({ id: 'pi_p', status: 'requires_action' }),
    );
    await expect(propinaViaje(ENV_PRUEBA(m), m.DB, cliente.id, 'op9', 300)).rejects.toBeTruthy();
    const f = await m.DB.prepare(
      "SELECT propina FROM cobros_viaje WHERE operacion_id = 'op9'",
    ).first<{ propina: number }>();
    expect(f?.propina).toBe(0);
  });
});
