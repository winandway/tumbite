import { expect } from 'vitest';
import type { Env } from '../env';
import { abrirComida, escenarioVe, restauranteVe } from './comidaVe';

/**
 * C-COMIDA-PAGO-RESTAURANTE (22 nov 2026) — Venezuela. El armado de las pruebas del pago directo al
 * restaurante: Comida abierta en El Vigía con la bandera, tasa de 250, un restaurante con su cuenta
 * de cobro, y las llamadas del circuito (pedir, aceptar, ofertas, tomar, pagar, confirmar, listo).
 * Lo usan comidaPagoRestaurante.test.ts y comidaQuienPagaQue.test.ts (C-COMIDA-VE-QUIEN-PAGA).
 */
export const CASA = { lat: 8.6235, lng: -71.649 };
export const CUENTA_RESTAURANTE = {
  clave: 'clave-segura-1',
  banco: 'Banco de ejemplo',
  telefono: '04140000000',
  documento: 'J-000000001',
  titular: 'Restaurante de ejemplo',
};

/**
 * `comisionEnvioPb`: la comisión de Divoox sobre el envío que se le aparta al conductor
 * (C-COMIDA-VE-QUIEN-PAGA; de fábrica 0). Las pruebas de cancelación la ponen para seguir cubriendo
 * que lo apartado vuelve a su saldo.
 */
export async function mundoPago(conCuenta = true, op: { comisionEnvioPb?: number } = {}) {
  const e = await escenarioVe();
  expect((await abrirComida(e, {}, { pagoRestaurante: true })).estado).toBe(201);
  await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 250 }, e.admin.token);
  if (op.comisionEnvioPb != null)
    expect(
      (
        await e.m.llamar(
          'PUT',
          '/datos/admin/paises/VE',
          { comidaComisionEnvioPb: op.comisionEnvioPb },
          e.admin.token,
        )
      ).estado,
    ).toBe(200);
  const r = await restauranteVe(e);
  if (conCuenta) {
    const cu = await e.m.llamar(
      'POST',
      '/datos/restaurante/cuenta-cobro',
      CUENTA_RESTAURANTE,
      r.dueno.token,
    );
    expect(cu.estado).toBe(201);
  }
  const env = { DB: e.m.DB, ...e.m.extra } as unknown as Env;
  const pedir = (metodoPago: 'efectivo' | 'transferencia_repartidor' = 'efectivo', cantidad = 2) =>
    e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.rid,
        lineas: [{ platoId: r.platoId, cantidad }],
        propinaCentavos: 50,
        direccion: 'Calle de ejemplo 1',
        ...CASA,
        metodoPago,
      },
      e.cliente.token,
    );
  async function conductor(nombre = 'Conductor de ejemplo', saldo = 1000) {
    const d = await e.m.cuenta('repartidor', nombre);
    await e.m.DB.prepare("INSERT OR IGNORE INTO kyc (usuario_id, selfie) VALUES (?, 'kyc/selfie')")
      .bind(d.id)
      .run();
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/repartidor/conectar',
          { conectado: true, lat: 8.6222, lng: -71.6508 },
          d.token,
        )
      ).estado,
    ).toBe(200);
    if (saldo > 0) {
      const punto = await e.m.llamar(
        'POST',
        '/datos/admin/puntos-venta',
        { nombre: 'Punto de ejemplo', pais: 'VE', usuarioId: e.admin.id, moneda: 'USD' },
        e.admin.token,
      );
      await e.m.llamar(
        'POST',
        `/datos/admin/puntos-venta/${punto.datos.punto.id}/fondo`,
        { monto: saldo * 2, comprobante: 'transferencia-equipo-001' },
        e.admin.token,
      );
      const codigo = await e.m.llamar(
        'POST',
        '/datos/punto-venta/codigos',
        { monto: saldo },
        e.admin.token,
      );
      const canje = await e.m.llamar(
        'POST',
        '/datos/repartidor/recargar',
        { codigo: codigo.datos.codigo },
        d.token,
      );
      expect(canje.estado).toBe(200);
    }
    return d;
  }
  const aceptarRest = (id: string) =>
    e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 20 }, r.dueno.token);
  const ofertas = async (rep: { token: string }) =>
    ((await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas ??
      []) as {
      id: string;
      adelantoLocal: number;
      enManoCobro: { monto: number } | null;
      pagoComida?: { estado: string; listoParaIr: boolean } | null;
    }[];
  const tomar = (id: string, rep: { token: string }) =>
    e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
  const reportar = (id: string, referencia: string, token = e.cliente.token) =>
    e.m.llamar('POST', `/datos/pedidos/${id}/pago-comida`, { referencia }, token);
  const responder = (id: string, llego: boolean) =>
    e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/pago-comida`, { llego }, r.dueno.token);
  const listo = (id: string) =>
    e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, r.dueno.token);
  const pago = (id: string) =>
    e.m.DB.prepare('SELECT * FROM pagos_comida WHERE pedido_id = ?')
      .bind(id)
      .first<Record<string, string | number | null>>();
  const pedido = (id: string) =>
    e.m.DB.prepare(
      'SELECT estado, total, propina, subtotal, ganancia, comision, pago_restaurante, cobro_estado, conciliacion_estado, repartidor_id FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<Record<string, string | number | null>>();
  const comisionesDe = (id: string) =>
    e.m.DB.prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(monto), 0) AS s FROM libro WHERE pedido_id = ? AND bolsillo = 'comisiones'",
    )
      .bind(id)
      .first<{ n: number; s: number }>();
  const caso = (referencia: string) =>
    e.m.DB.prepare('SELECT estado FROM incidencias_dinero WHERE referencia = ?')
      .bind(referencia)
      .first<{ estado: string }>();
  /** Pedido creado, aceptado por el restaurante y tomado por el conductor: el cliente ya puede pagar. */
  async function hastaPorPagar(rep?: { id: string; token: string }) {
    const c = rep ?? (await conductor());
    const p = await pedir();
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    expect((await aceptarRest(id)).estado).toBe(200);
    expect((await ofertas(c)).map((o) => o.id)).toContain(id);
    expect((await tomar(id, c)).estado).toBe(200);
    return { id, rep: c };
  }
  return {
    e,
    r,
    env,
    pedir,
    conductor,
    aceptarRest,
    ofertas,
    tomar,
    reportar,
    responder,
    listo,
    pago,
    pedido,
    comisionesDe,
    caso,
    hastaPorPagar,
  };
}
