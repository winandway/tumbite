import { describe, expect, it } from 'vitest';
import { CIUDAD_ICA as ICA, TARIFA_MOTO_PERU } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { cuentasCobroViejas, rehacerCuentasCobro } from '../esquemaCuentasCobro';
import { esPaisConnect } from '../connectPaises';
import {
  RECARGA_TARJETA_MIN_PE,
  abrirIca as abrirIcaPe,
  aprobarComisionPe,
  cargarCuentaCelularPe,
  conductorListoPe,
  encenderRecargaTarjetaPe,
  escenarioPe,
  pedirEnIca,
  recargarConTarjetaPe,
} from '../pruebas/motoPe';

/**
 * C-PERFIL-PERU y C-PAGO-A-CELULAR (19 nov 2026) — Perú. Ica se abre con el mismo paso del panel que
 * las ciudades de Venezuela, cotiza en soles y ofrece efectivo, Yape y Plin. La comisión del prepago
 * en soles nace SIN aprobar: la confirma Richard. Ficha: docs/investigaciones-rea/2026-11-19-ica-peru.md.
 */
const ORIGEN = { lat: ICA.lat, lng: ICA.lng, direccion: 'Plaza de Armas de Ica' };
const HUACACHINA = { lat: -14.0875, lng: -75.7633, direccion: 'Laguna de Huacachina' };

async function escenario(host = 'staging.tumbite.com') {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Ica');
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenario>>;

const abrirIca = (e: E, servicio: 'moto' | 'carro' = 'moto') =>
  e.m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio,
      zona: {
        id: ICA.id,
        nombre: ICA.nombre,
        lat: ICA.lat,
        lng: ICA.lng,
        radioKm: ICA.radioKm,
        zonaHoraria: ICA.zonaHoraria,
      },
      motivo: 'Ciudad de pruebas de Perú',
    },
    e.admin.token,
  );

const aprobarComision = (e: E) =>
  e.m.DB.prepare(
    "UPDATE politicas_financieras SET revision_legal_aprobada = 1 WHERE pais = 'PE' AND moneda = 'PEN'",
  ).run();

describe('C-PERFIL-PERU: Ica se abre en soles, con Yape y Plin', () => {
  it('la comisión en soles está sembrada al 8 % y sin aprobar: la confirma Richard', async () => {
    const e = await escenario();
    const { results } = await e.m.DB.prepare(
      "SELECT servicio, moneda, regla_json, revision_legal_aprobada AS ok FROM politicas_financieras WHERE pais = 'PE' ORDER BY servicio",
    ).all<{ servicio: string; moneda: string; regla_json: string; ok: number }>();
    expect(results.map((r) => r.servicio)).toEqual(['car', 'express', 'ride']);
    for (const r of results) {
      expect(r.moneda).toBe('PEN');
      expect(JSON.parse(r.regla_json)).toEqual({ tipo: 'porcentaje', pb: 800 });
      expect(r.ok).toBe(0);
    }
  });

  it('abre Ica en soles con la tarifa de mercado, hora de Lima, y cotiza con Yape y Plin', async () => {
    const e = await escenario();
    await aprobarComision(e);
    const r = await abrirIca(e);
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const z = await e.m.DB.prepare('SELECT pais, moneda, zona_horaria FROM zonas WHERE id = ?')
      .bind(ICA.id)
      .first<{ pais: string; moneda: string; zona_horaria: string }>();
    expect(z).toEqual({ pais: 'PE', moneda: 'PEN', zona_horaria: 'America/Lima' });
    const cot = await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: HUACACHINA },
      e.cliente.token,
    );
    expect(cot.estado, JSON.stringify(cot.datos)).toBe(201);
    const c = cot.datos.cotizacion;
    expect(c.moneda).toBe('PEN');
    expect(c.metodosPago).toEqual(['efectivo', 'yape', 'plin']);
    expect(c.total).toBeGreaterThanOrEqual(TARIFA_MOTO_PERU.minimo);
    // Redondea a 10 céntimos, como se paga en la calle.
    expect(c.total % 10).toBe(0);
    // Solo soles: nada de la doble moneda de Venezuela.
    expect(c.referencia ?? null).toBeNull();
    expect(c.tasaLocal ?? null).toBeNull();
    // El pasajero pide con Yape; con pago móvil (Venezuela) o tarjeta no se puede en Perú.
    for (const metodoPago of ['pago_movil', 'tarjeta']) {
      const no = await e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: c.id, metodoPago },
        e.cliente.token,
      );
      expect(no.estado).toBe(422);
    }
    const v = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: c.id, metodoPago: 'yape' },
      e.cliente.token,
    );
    expect(v.estado, JSON.stringify(v.datos)).toBe(201);
    const vista = await e.m.llamar(
      'GET',
      `/datos/viajes/${v.datos.viaje.id}`,
      undefined,
      e.cliente.token,
    );
    expect(vista.datos.viaje.metodoPago).toBe('yape');
    expect(vista.datos.viaje.pagoMovil).toEqual({ datos: null, confirmado: null });
  });

  it('en producción abrir Ica no enciende Moto: la compuerta del país nace cerrada', async () => {
    const e = await escenario('divoox.com');
    await aprobarComision(e);
    await abrirIca(e);
    const cot = await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: HUACACHINA },
      e.cliente.token,
    );
    expect(cot.estado).not.toBe(201);
  });
});

describe('C-PAGO-A-CELULAR: las cuentas de cobro aceptan Yape y Plin', () => {
  it('una tabla vieja se rehace una sola vez sin perder filas ni su historial', async () => {
    const { m } = await escenario();
    const rep = await m.cuenta('repartidor', 'Conductor Ica');
    await m.DB.batch([
      m.DB.prepare('PRAGMA defer_foreign_keys = ON'),
      m.DB.prepare('DROP TABLE cuentas_cobro'),
      m.DB.prepare(
        `CREATE TABLE cuentas_cobro (
          id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id), pais TEXT NOT NULL,
          moneda TEXT NOT NULL,
          tipo TEXT NOT NULL CHECK (tipo IN ('banco', 'nequi', 'daviplata', 'pago_movil', 'zelle', 'otro')),
          banco TEXT NOT NULL DEFAULT '', titular TEXT NOT NULL, identificador TEXT NOT NULL,
          verificacion TEXT NOT NULL DEFAULT 'declarada' CHECK (verificacion IN ('declarada', 'confirmada')),
          activa INTEGER NOT NULL DEFAULT 1, activa_desde TEXT NOT NULL DEFAULT (datetime('now')),
          creado_en TEXT NOT NULL DEFAULT (datetime('now')))`,
      ),
    ]);
    await m.DB.prepare(
      "INSERT INTO cuentas_cobro (id, usuario_id, pais, moneda, tipo, titular, identificador) VALUES ('c-vieja', ?, 'VE', 'USD', 'pago_movil', 'Titular de ejemplo', '0412-0000000')",
    )
      .bind(rep.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO cuentas_cobro_historial (id, cuenta_id, usuario_id, cambio) VALUES ('h-1', 'c-vieja', ?, 'creada')",
    )
      .bind(rep.id)
      .run();
    const yapeAntes = m.DB.prepare(
      "INSERT INTO cuentas_cobro (id, usuario_id, pais, moneda, tipo, titular, identificador) VALUES ('c-yape', ?, 'PE', 'PEN', 'yape', 'Titular de ejemplo', '900000000')",
    ).bind(rep.id);
    await expect(yapeAntes.run()).rejects.toThrow();
    expect(await rehacerCuentasCobro(m.DB)).toBe(true);
    expect(await rehacerCuentasCobro(m.DB)).toBe(false);
    const sql = await m.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE name = 'cuentas_cobro'",
    ).first<{ sql: string }>();
    expect(cuentasCobroViejas(sql?.sql ?? null)).toBe(false);
    const vieja = await m.DB.prepare("SELECT tipo FROM cuentas_cobro WHERE id = 'c-vieja'").first();
    expect(vieja).toEqual({ tipo: 'pago_movil' });
    const h = await m.DB.prepare(
      "SELECT cuenta_id FROM cuentas_cobro_historial WHERE id = 'h-1'",
    ).first();
    expect(h).toEqual({ cuenta_id: 'c-vieja' });
    await m.DB.prepare(
      "INSERT INTO cuentas_cobro (id, usuario_id, pais, moneda, tipo, titular, identificador) VALUES ('c-plin', ?, 'PE', 'PEN', 'plin', 'Titular de ejemplo', '900000000')",
    )
      .bind(rep.id)
      .run();
  });
});

const saldoDe = async (c: { yo: (m: string, r: string) => Promise<{ datos: any }> }) =>
  (await c.yo('GET', '/datos/repartidor/saldo-prepago')).datos;

describe('C-PAGO-A-CELULAR de punta a punta: viaje con Yape en Ica y comisión del saldo en soles', () => {
  it('el pasajero ve el Yape del conductor, el conductor confirma y el 8 % sale de su saldo en soles', async () => {
    const e = await escenarioPe();
    await aprobarComisionPe(e);
    expect((await abrirIcaPe(e)).estado).toBe(201);
    const c = await conductorListoPe(e, 5000);
    const antes = await saldoDe(c);
    expect(antes.moneda).toBe('PEN');
    expect(antes.disponible).toBe(5000);
    expect(antes.carrerasAlcanzan).toBe(Math.floor(5000 / antes.comisionTipica));
    await cargarCuentaCelularPe(c, 'yape');
    const v = await pedirEnIca(e, 'yape');
    const comision = Math.round((v.total * 8) / 100);
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await saldoDe(c)).reservado).toBe(comision);
    const vista = await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token);
    expect(vista.datos.viaje.metodoPago).toBe('yape');
    expect(vista.datos.viaje.pagoMovil.datos).toEqual({
      tipo: 'yape',
      banco: '',
      titular: 'Titular de ejemplo',
      identificador: '900 000 000',
    });
    // Antes de que el pasajero suba, no se confirma nada.
    expect((await c.paso(v.id, 'pago-movil', { recibido: true })).estado).toBe(409);
    expect((await c.paso(v.id, 'llegue')).estado).toBe(200);
    expect((await c.paso(v.id, 'iniciar', { pin: vista.datos.viaje.pin })).estado).toBe(200);
    const ok = await c.paso(v.id, 'pago-movil', { recibido: true, referencia: '123456' });
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(200);
    expect(ok.datos.estado).toBe('recibido');
    expect((await c.paso(v.id, 'terminar')).estado).toBe(200);
    const despues = await saldoDe(c);
    expect(despues.disponible).toBe(5000 - comision);
    expect(despues.reservado).toBe(0);
    const divoox = await e.m.DB.prepare(
      "SELECT COALESCE(SUM(monto), 0) AS s FROM libro WHERE bolsillo = 'comisiones' AND pais = 'PE' AND moneda = 'PEN'",
    ).first<{ s: number }>();
    expect(divoox?.s).toBe(comision);
    // Nada de Perú quedó anotado en dólares.
    const enDolares = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM libro WHERE pais = 'PE' AND moneda <> 'PEN'",
    ).first<{ n: number }>();
    expect(enDolares?.n).toBe(0);
  });

  it('sin billetera cargada no recibe viajes con Yape o Plin; con Yape recibe también los de Plin; y «no me llegó» abre un caso en soles', async () => {
    const e = await escenarioPe();
    await aprobarComisionPe(e);
    await abrirIcaPe(e);
    // Este conductor no cargó ninguna billetera: un viaje con Plin no le llega.
    const sinCuenta = await conductorListoPe(e, 5000, 'Conductor sin billetera');
    const v = await pedirEnIca(e, 'plin');
    const ofertas = await sinCuenta.yo('GET', '/datos/conductor/operaciones/ofertas');
    expect(ofertas.datos.ofertas.some((o: { operacionId: string }) => o.operacionId === v.id)).toBe(
      false,
    );
    // Yape y Plin se envían entre sí con el número: quien tiene Yape recibe el viaje con Plin.
    const conPlin = await conductorListoPe(e, 5000, 'Conductor con Yape');
    await cargarCuentaCelularPe(conPlin, 'yape');
    await e.m.DB.prepare("UPDATE ofertas_operacion SET estado = 'vencida' WHERE operacion_id = ?")
      .bind(v.id)
      .run();
    await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect((await conPlin.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await conPlin.paso(v.id, 'llegue')).estado).toBe(200);
    const vista = (await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token))
      .datos.viaje;
    // El pasajero ve que el número es de Yape, aunque él pague desde Plin.
    expect(vista.metodoPago).toBe('plin');
    expect(vista.pagoMovil.datos.tipo).toBe('yape');
    const pin = vista.pin;
    expect((await conPlin.paso(v.id, 'iniciar', { pin })).estado).toBe(200);
    const no = await conPlin.paso(v.id, 'pago-movil', { recibido: false });
    expect(no.estado, JSON.stringify(no.datos)).toBe(200);
    const caso = await e.m.DB.prepare(
      "SELECT tipo, monto_esperado, moneda, pais FROM incidencias_dinero WHERE referencia = 'pago-movil-viaje:' || ?",
    )
      .bind(v.id)
      .first<{ tipo: string; monto_esperado: number; moneda: string; pais: string }>();
    expect(caso).toEqual({
      tipo: 'pago_movil_viaje',
      monto_esperado: v.total,
      moneda: 'PEN',
      pais: 'PE',
    });
  });
});

describe('C-CUENTA-COBRO-CONDUCTOR: el conductor carga su Yape o su Plin', () => {
  it('su app sabe que en Perú se cobra por Yape y Plin, y la billetera pide un celular peruano', async () => {
    const e = await escenarioPe();
    await aprobarComisionPe(e);
    await abrirIcaPe(e);
    const c = await conductorListoPe(e, 0);
    expect((await saldoDe(c)).cuentasACelular).toEqual(['yape', 'plin']);
    const mala = await c.yo('POST', '/datos/repartidor/cuentas-cobro', {
      clave: 'clave-segura-1',
      tipo: 'yape',
      titular: 'Titular de ejemplo',
      identificador: '0412-0000000',
    });
    expect(mala.estado).toBe(422);
    expect(mala.datos.campo).toBe('identificador');
    await cargarCuentaCelularPe(c, 'plin');
    const lista = await c.yo('GET', '/datos/repartidor/cuentas-cobro');
    expect(lista.datos.cuentas[0]).toMatchObject({ tipo: 'plin', activa: true, vigente: true });
  });
});

describe('C-RECARGA-TARJETA-MINIMO y C-RECARGA-TARJETA-ALOJADA: el conductor de Ica recarga con tarjeta en soles', () => {
  it('nace apagada; encendida cobra en soles por la página de pago y se acredita una sola vez', async () => {
    const e = await escenarioPe();
    await aprobarComisionPe(e);
    await abrirIcaPe(e);
    const c = await conductorListoPe(e, 0);
    // Apagada de fábrica.
    const apagada = await c.yo('POST', '/datos/repartidor/recargas/stripe', {
      monto: 3000,
      alojada: true,
    });
    expect(apagada.estado).toBe(409);
    expect((await encenderRecargaTarjetaPe(e)).estado).toBe(200);
    const s = await saldoDe(c);
    expect(s.recargasStripe).toBe(true);
    expect(s.recargaTarjetaMin).toBe(RECARGA_TARJETA_MIN_PE);
    // Por debajo del mínimo con tarjeta no se abre ningún cobro (la cuota fija se la comería).
    const chica = await c.yo('POST', '/datos/repartidor/recargas/stripe', {
      monto: 1000,
      alojada: true,
    });
    expect(chica.estado).toBe(409);
    e.aStripe.length = 0;
    const r = await recargarConTarjetaPe(e, c, 3000);
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    expect(r.datos.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const enviado = e.aStripe.find((x) => x.url.endsWith('/v1/checkout/sessions'));
    expect(enviado?.cuerpo).toContain('line_items[0][price_data][currency]=pen');
    expect(enviado?.cuerpo).toContain('line_items[0][price_data][unit_amount]=3000');
    expect(enviado?.cuerpo).toContain(
      `payment_intent_data[metadata][recarga_id]=${r.datos.recargaId}`,
    );
    // La sesión dice que es una recarga: su aviso de «sesión completada» no es un pedido perdido.
    expect(enviado?.cuerpo).toContain('metadata[tipo]=recarga');
    expect((await saldoDe(c)).disponible).toBe(3000);
    // El mismo aviso otra vez no acredita dos veces.
    const { acreditarRecargaStripe } = await import('../internacional/recargas');
    await acreditarRecargaStripe(e.m.DB, {
      id: 'pi_repetido',
      amount_received: 3000,
      currency: 'pen',
      metadata: { recarga_id: r.datos.recargaId },
    });
    expect((await saldoDe(c)).disponible).toBe(3000);
  });

  it('sin la comisión aprobada, la recarga con tarjeta de Perú no se puede encender', async () => {
    const e = await escenarioPe();
    const r = await encenderRecargaTarjetaPe(e);
    expect(r.estado).toBe(409);
  });
});

describe('C-CONNECT-PAIS: Perú no usa Stripe Connect', () => {
  it('Stripe no paga a bancos de Perú por Connect: el país no está y nunca se llama a Stripe', () => {
    // Leído el 19 nov 2026 en docs.stripe.com/connect/cross-border-payouts (ficha de Ica, sección 3.3).
    expect(esPaisConnect('PE')).toBe(false);
    expect(esPaisConnect('US')).toBe(true);
  });
});

describe('C-ZONA-POR-PAIS: el formulario «Zonas» ya no deja una ciudad de Perú en dólares', () => {
  it('una ciudad nueva de Perú nace en soles con hora de Lima, y editarla no le cambia la moneda', async () => {
    const e = await escenarioPe();
    const zona = { id: 'PE-ICA-PISCO', nombre: 'Pisco', pais: 'PE', lat: -13.71, lng: -76.203 };
    const r = await e.m.llamar('PUT', '/datos/admin/zonas', zona, e.admin.token);
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    const leer = () =>
      e.m.DB.prepare('SELECT moneda, zona_horaria AS hora FROM zonas WHERE id = ?')
        .bind(zona.id)
        .first<{ moneda: string; hora: string }>();
    expect(await leer()).toEqual({ moneda: 'PEN', hora: 'America/Lima' });
    // Una zona guardada a mano en otra moneda no se pisa al editar el nombre.
    await e.m.DB.prepare("UPDATE zonas SET moneda = 'USD' WHERE id = ?").bind(zona.id).run();
    await e.m.llamar(
      'PUT',
      '/datos/admin/zonas',
      { ...zona, nombre: 'Pisco centro' },
      e.admin.token,
    );
    expect((await leer())?.moneda).toBe('USD');
    // Y Estados Unidos sigue naciendo en dólares con su hora de siempre.
    await e.m.llamar(
      'PUT',
      '/datos/admin/zonas',
      { id: 'US-MI-NOVI2', nombre: 'Novi', pais: 'US', lat: 42.48, lng: -83.47 },
      e.admin.token,
    );
    const us = await e.m.DB.prepare(
      "SELECT moneda, zona_horaria AS hora FROM zonas WHERE id = 'US-MI-NOVI2'",
    ).first();
    expect(us).toEqual({ moneda: 'USD', hora: 'America/New_York' });
  });
});

describe('C-TOPES-SALDO-MONEDA: los topes de carga de saldo van en la moneda de la ciudad', () => {
  it('en Ica el equipo puede cargar hasta 200 soles de una vez (no 50), y ni un céntimo más', async () => {
    const e = await escenarioPe();
    await aprobarComisionPe(e);
    await abrirIcaPe(e);
    const c = await conductorListoPe(e, 0);
    const lista = await e.m.llamar(
      'GET',
      `/datos/admin/conductores-ciudad?zona=${ICA.id}`,
      undefined,
      e.admin.token,
    );
    expect(lista.datos.topes.cargaMaxima).toBe(20_000);
    const cargar = (monto: number) =>
      e.m.llamar(
        'POST',
        `/datos/admin/conductores-ciudad/${c.rep.id}/saldo`,
        { monto, motivo: 'Carga de prueba' },
        e.admin.token,
      );
    expect((await cargar(20_001)).estado).toBe(400);
    // Por encima del tope en dólares (5.000) y dentro del de soles: ya no se rechaza por el tope.
    expect((await cargar(6_000)).estado).not.toBe(400);
  });
});
