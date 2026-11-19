import { describe, expect, it } from 'vitest';
import { CIUDAD_ICA as ICA, TARIFA_MOTO_PERU } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { cuentasCobroViejas, rehacerCuentasCobro } from '../esquemaCuentasCobro';

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
