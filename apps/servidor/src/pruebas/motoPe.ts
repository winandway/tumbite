import { expect, vi } from 'vitest';
import { CIUDAD_ICA as ICA } from '@tumbite/compartido';
import { acreditarRecargaStripe } from '../internacional/recargas';
import { mundo } from './ayuda';
import { conductorListoEn } from './motoVe';

/**
 * Ayudas de prueba de Divoox en Ica, Perú (19 nov 2026): Ica abierta en pruebas con la comisión en
 * soles aprobada SOLO en la base de la prueba, un conductor peruano aprobado por la API, que recarga
 * su saldo con tarjeta en soles (Stripe simulado), y el pasajero que pide con Yape, Plin o efectivo.
 */
export const ORIGEN_ICA = { lat: ICA.lat, lng: ICA.lng, direccion: 'Plaza de Armas de Ica' };
export const HUACACHINA = { lat: -14.0875, lng: -75.7633, direccion: 'Laguna de Huacachina' };
/** Recarga mínima con tarjeta de las pruebas: 30 soles (la cuota fija de Stripe se come una menor). */
export const RECARGA_TARJETA_MIN_PE = 3000;

export async function escenarioPe(host = 'staging.tumbite.com') {
  /** Lo que el servidor le mandó a Stripe (simulado), para comprobar moneda y montos. */
  const aStripe: { url: string; cuerpo: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    aStripe.push({ url: String(url), cuerpo: decodeURIComponent(String(init?.body ?? '')) });
    return new Response(
      JSON.stringify({
        id: 'cs_test_x',
        url: 'https://checkout.stripe.com/c/pay/cs_test_x',
        client_secret: 'pi_x_secret',
      }),
      { status: 200 },
    );
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' }, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Ica');
  return { m, admin, cliente, aStripe };
}
export type EscenarioPe = Awaited<ReturnType<typeof escenarioPe>>;

/** Solo en la base de la prueba: en producción la comisión la aprueba Richard. */
export const aprobarComisionPe = (e: EscenarioPe) =>
  e.m.DB.prepare(
    "UPDATE politicas_financieras SET revision_legal_aprobada = 1 WHERE pais = 'PE' AND moneda = 'PEN'",
  ).run();

export const abrirIca = (e: EscenarioPe, servicio: 'moto' | 'carro' = 'moto') =>
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

export const encenderRecargaTarjetaPe = (e: EscenarioPe) =>
  e.m.llamar(
    'PUT',
    '/datos/admin/paises/PE',
    { recargasStripeActivas: true, recargaStripeMin: RECARGA_TARJETA_MIN_PE },
    e.admin.token,
  );

/** El conductor recarga con tarjeta: la página de pago alojada y el aviso de Stripe que acredita. */
export async function recargarConTarjetaPe(
  e: EscenarioPe,
  c: { yo: (m: string, r: string, cuerpo?: unknown) => Promise<{ estado: number; datos: any }> },
  monto: number,
) {
  const r = await c.yo('POST', '/datos/repartidor/recargas/stripe', { monto, alojada: true });
  if (r.estado !== 201) return r;
  await acreditarRecargaStripe(e.m.DB, {
    id: `pi_${String(r.datos.recargaId).slice(0, 8)}`,
    amount_received: monto,
    currency: 'pen',
    metadata: { recarga_id: r.datos.recargaId },
  });
  return r;
}

/** Conductor de Ica aprobado, con saldo en soles (recargado con tarjeta), conectado en la plaza. */
export async function conductorListoPe(e: EscenarioPe, saldo: number, nombre = 'Conductor Ica') {
  const c = await conductorListoEn(e, { zonaId: ICA.id, origen: ORIGEN_ICA, saldo: 0, nombre });
  if (saldo > 0) {
    expect((await encenderRecargaTarjetaPe(e)).estado).toBe(200);
    expect((await recargarConTarjetaPe(e, c, saldo)).estado).toBe(201);
  }
  return c;
}

export async function cargarCuentaCelularPe(
  c: Awaited<ReturnType<typeof conductorListoPe>>,
  tipo: 'yape' | 'plin' = 'yape',
) {
  const cuenta = await c.yo('POST', '/datos/repartidor/cuentas-cobro', {
    clave: 'clave-segura-1',
    tipo,
    titular: 'Titular de ejemplo',
    identificador: '900 000 000',
  });
  expect(cuenta.estado, JSON.stringify(cuenta.datos)).toBe(201);
  await c.equipo('PATCH', `/datos/admin/cuentas-cobro/${cuenta.datos.cuenta.id}`);
  return cuenta.datos.cuenta.id as string;
}

export async function pedirEnIca(
  e: EscenarioPe,
  metodoPago: 'efectivo' | 'yape' | 'plin',
  servicio: 'moto' | 'carro' = 'moto',
) {
  const cot = await e.m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    { servicio, origen: ORIGEN_ICA, destino: HUACACHINA },
    e.cliente.token,
  );
  expect(cot.estado, JSON.stringify(cot.datos)).toBe(201);
  const v = await e.m.llamar(
    'POST',
    '/datos/viajes',
    { cotizacionId: cot.datos.cotizacion.id, metodoPago },
    e.cliente.token,
  );
  expect(v.estado, JSON.stringify(v.datos)).toBe(201);
  return { id: v.datos.viaje.id as string, total: cot.datos.cotizacion.total as number };
}
