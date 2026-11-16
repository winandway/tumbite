import { describe, expect, it } from 'vitest';
import { ayer, conciliar, saludDinero } from './conciliacion';
import { conciliarViajes } from './conciliacionViajes';
import { mundo } from './pruebas/ayuda';

/**
 * C-CONCILIACION-VIAJES (16 nov 2026, todos los países). Hasta hoy la conciliación diaria solo cubría los
 * pedidos: si un viaje cobrado con tarjeta no llegaba entero al conductor, o se quedaba con la
 * autorización abierta, nadie lo veía. Cada prueba siembra un viaje con tarjeta y rompe UNA regla.
 */
const ZONA = 'US-FL-MIAMI';

type Mundo = ReturnType<typeof mundo>;

async function viaje(
  m: Mundo,
  op: string,
  dia: string,
  o: {
    estado?: string;
    cobro?: 'autorizado' | 'capturado' | 'anulado';
    autorizado?: number;
    capturado?: number | null;
    propina?: number;
    abonado?: number | null;
    propinaAbonada?: number;
    total?: number;
  } = {},
) {
  const cliente = await m.cuenta('cliente', `Pasajero ${op}`);
  const cond = await m.cuenta('repartidor', `Conductor ${op}`);
  const estado = o.estado ?? 'terminado';
  const general = estado === 'terminado' ? 'terminada' : 'cancelada';
  await m.DB.prepare(
    "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, zona_id, estado_general) VALUES (?, 'moto', 'viaje_pasajero', ?, ?, ?, ?)",
  )
    .bind(op, cliente.id, cond.id, ZONA, general)
    .run();
  await m.DB.prepare(
    `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion,
       destino_lat, destino_lng, destino_direccion, pin_recogida, metodo_pago, total_final_centavos, terminado_en)
     VALUES (?, ?, 'sistema', ?, 25.76, -80.19, 'Origen de prueba', 25.78, -80.2, 'Destino de prueba', '4321', 'tarjeta', ?, ?)`,
  )
    .bind(op, estado, `alta:${op}`, o.total ?? 1200, `${dia} 15:00:00`)
    .run();
  const estadoCobro = o.cobro ?? 'capturado';
  await m.DB.prepare(
    `INSERT INTO cobros_viaje (operacion_id, stripe_pago, autorizado, capturado, propina, estado, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      op,
      `pi_${op}`,
      o.autorizado ?? 1200,
      estadoCobro === 'capturado' ? (o.capturado ?? 1200) : null,
      o.propina ?? 0,
      estadoCobro,
      `${dia} 14:00:00`,
      `${dia} 15:01:00`,
    )
    .run();
  const abonado = o.abonado === undefined ? (o.capturado ?? 1200) : o.abonado;
  if (estadoCobro === 'capturado' && abonado !== null)
    await m.DB.prepare(
      "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia, creado_en) VALUES (?, ?, ?, 'entrega', ?, ?)",
    )
      .bind(`mov-e-${op}`, cond.id, abonado, `viaje-tarjeta-${op}`, `${dia} 15:01:00`)
      .run();
  if ((o.propina ?? 0) > 0 || o.propinaAbonada)
    await m.DB.prepare(
      "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia, creado_en) VALUES (?, ?, ?, 'propina', ?, ?)",
    )
      .bind(
        `mov-p-${op}`,
        cond.id,
        o.propinaAbonada ?? o.propina ?? 0,
        `propina-viaje-${op}`,
        `${dia} 15:02:00`,
      )
      .run();
}

describe('C-CONCILIACION-VIAJES', () => {
  it('un viaje con tarjeta cobrado y abonado entero cuadra', async () => {
    const m = mundo();
    const dia = ayer();
    await viaje(m, 'op-ok', dia, { propina: 200 });
    const r = await conciliarViajes(m.DB, dia);
    expect(r.cuadra).toBe(true);
    expect(r.viajes).toBe(1);
    expect(r.capturado).toBe(1200);
    expect(r.detalle.cuadraViajes).toBe('sí');
  });

  it('un día sin viajes con tarjeta cuadra (y no inventa diferencias)', async () => {
    const m = mundo();
    const r = await conciliarViajes(m.DB, ayer());
    expect(r.cuadra).toBe(true);
    expect(r.viajes).toBe(0);
  });

  it('lo cobrado que no llegó entero al conductor NO cuadra', async () => {
    const m = mundo();
    const dia = ayer();
    await viaje(m, 'op-corto', dia, { abonado: 900 });
    const r = await conciliarViajes(m.DB, dia);
    expect(r.cuadra).toBe(false);
    expect(String(r.detalle.viajesDiferencias)).toContain('op-corto');
  });

  it('un cobro sin abono al conductor NO cuadra', async () => {
    const m = mundo();
    const dia = ayer();
    await viaje(m, 'op-sin-abono', dia, { abonado: null });
    expect((await conciliarViajes(m.DB, dia)).cuadra).toBe(false);
  });

  it('una propina cobrada y no abonada NO cuadra', async () => {
    const m = mundo();
    const dia = ayer();
    await viaje(m, 'op-propina', dia, { propina: 300, propinaAbonada: 0 });
    // El movimiento de propina se siembra con 0 para que exista la fila pero no el dinero.
    const r = await conciliarViajes(m.DB, dia);
    expect(r.cuadra).toBe(false);
    expect(String(r.detalle.viajesDiferencias)).toContain('propina');
  });

  it('capturar más de lo autorizado NO cuadra', async () => {
    const m = mundo();
    const dia = ayer();
    await viaje(m, 'op-de-mas', dia, { autorizado: 1000, capturado: 1200 });
    expect((await conciliarViajes(m.DB, dia)).cuadra).toBe(false);
  });

  it('un viaje cancelado con la autorización todavía abierta NO cuadra (plata retenida al pasajero)', async () => {
    const m = mundo();
    const dia = ayer();
    await viaje(m, 'op-colgado', dia, { estado: 'cancelado', cobro: 'autorizado' });
    const r = await conciliarViajes(m.DB, dia);
    expect(r.cuadra).toBe(false);
    expect(String(r.detalle.viajesDiferencias)).toContain('autorización');
  });

  it('un viaje cancelado con la autorización anulada cuadra', async () => {
    const m = mundo();
    const dia = ayer();
    await viaje(m, 'op-anulado', dia, { estado: 'cancelado', cobro: 'anulado' });
    expect((await conciliarViajes(m.DB, dia)).cuadra).toBe(true);
  });

  it('un viaje con tarjeta que terminó sin que se capturara el cobro NO cuadra (se prestó gratis)', async () => {
    const m = mundo();
    const dia = ayer();
    // Terminó, pero la captura falló y la autorización sigue abierta.
    await viaje(m, 'op-gratis', dia, { cobro: 'autorizado' });
    const r = await conciliarViajes(m.DB, dia);
    expect(r.cuadra).toBe(false);
    expect(String(r.detalle.viajesDiferencias)).toContain('op-gratis');
  });

  it('la conciliación diaria incluye los viajes: un viaje descuadrado pone el día y la salud en rojo', async () => {
    const m = mundo();
    await m.cuenta('admin', 'Soporte Divoox');
    const dia = ayer();
    await viaje(m, 'op-rojo', dia, { abonado: 100 });
    const r = await conciliar(m.DB, dia);
    expect(r.cuadra).toBe(false);
    expect(r.detalle.cuadraViajes).toBe('NO');
    expect(await saludDinero(m.DB)).toBe('error');
  });

  it('con los viajes bien cobrados el día cuadra y la salud queda en verde', async () => {
    const m = mundo();
    await m.cuenta('admin', 'Soporte Divoox');
    const dia = ayer();
    await viaje(m, 'op-verde', dia, { propina: 100 });
    const r = await conciliar(m.DB, dia);
    expect(r.cuadra).toBe(true);
    expect(await saludDinero(m.DB)).toBe('ok');
  });
});
