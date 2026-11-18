import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-REOFERTA-VENCIDA y C-OFERTA-AVISO (18 nov 2026, todos los países). Lo que encontró el robot de
 * Android en El Vigía: el servidor le ofrecía cada viaje al único conductor UNA sola vez (30 s); si
 * no la veía a tiempo, ese viaje no le volvía a llegar nunca y el pasajero se quedaba «buscando».
 * Y la oferta de viaje no llegaba al celular (solo por el tiempo real, que en producción no está).
 * Estas pruebas corren con el RELOJ PARADO: nadie llama a la tarea del reloj; solo se sondea.
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

afterEach(() => {
  vi.unstubAllGlobals();
});

async function listo() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  await m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    `/datos/admin/servicios/moto/zonas/${ZONA}`,
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'moto',
      zona: ZONA,
      tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  return { m, cliente };
}
type E = Awaited<ReturnType<typeof listo>>;

async function pedir(e: E) {
  const c = (
    await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
      e.cliente.token,
    )
  ).datos.cotizacion;
  const r = await e.m.llamar(
    'POST',
    '/datos/viajes',
    { cotizacionId: c.id, metodoPago: 'efectivo' },
    e.cliente.token,
  );
  return r.datos.viaje.id as string;
}
const ofertas = async (e: E, token: string) =>
  (await e.m.llamar('GET', '/datos/conductor/operaciones/ofertas', undefined, token)).datos
    .ofertas as { operacionId: string; segundosRestantes: number }[];

/** Hace que la oferta de ese conductor haya vencido hace `segundos`. */
async function vencer(e: E, op: string, conductor: string, segundos: number) {
  await e.m.DB.prepare(
    "UPDATE ofertas_operacion SET expira_en = datetime('now', ?) WHERE operacion_id = ? AND conductor_id = ?",
  )
    .bind(`-${segundos} seconds`, op, conductor)
    .run();
}

describe('C-REOFERTA-VENCIDA: con el reloj parado y un solo conductor en la ciudad', () => {
  it('la oferta que dejó vencer le vuelve a llegar al sondear él sus ofertas, con cuenta atrás nueva', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const op = await pedir(e);
    expect(await ofertas(e, a.token)).toHaveLength(1);
    await vencer(e, op, a.id, 40);
    const o = await ofertas(e, a.token);
    expect(o).toHaveLength(1);
    expect(o[0]?.operacionId).toBe(op);
    expect(o[0]?.segundosRestantes).toBeGreaterThanOrEqual(28);
    expect(o[0]?.segundosRestantes).toBeLessThanOrEqual(30);
    // Y la puede aceptar.
    expect(await a.paso(op, 'aceptar')).toBe(200);
  });

  it('también la mueve el sondeo del pasajero', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const op = await pedir(e);
    await vencer(e, op, a.id, 40);
    await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    const fila = await e.m.DB.prepare(
      "SELECT estado, expira_en > datetime('now') AS abierta FROM ofertas_operacion WHERE operacion_id = ? AND conductor_id = ?",
    )
      .bind(op, a.id)
      .first<{ estado: string; abierta: number }>();
    expect(fila).toEqual({ estado: 'ofrecida', abierta: 1 });
  });

  it('respeta el respiro: recién vencida no se vuelve a ofrecer en el acto (sin bucles)', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const op = await pedir(e);
    await vencer(e, op, a.id, 1);
    expect(await ofertas(e, a.token)).toHaveLength(0);
    expect(await ofertas(e, a.token)).toHaveLength(0);
  });

  it('quien la RECHAZÓ no la vuelve a recibir, y su sondeo no mueve el despacho', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const op = await pedir(e);
    expect(await a.paso(op, 'rechazar')).toBe(200);
    await e.m.DB.prepare(
      "UPDATE ofertas_operacion SET respondida_en = datetime('now', '-5 minutes'), expira_en = datetime('now', '-5 minutes') WHERE operacion_id = ?",
    )
      .bind(op)
      .run();
    expect(await ofertas(e, a.token)).toHaveLength(0);
    await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect(await ofertas(e, a.token)).toHaveLength(0);
  });

  it('primero va a quien todavía no la vio; quien la dejó vencer espera', async () => {
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    const b = await conductorDeMoto(e.m, { lat: ORIGEN.lat + 0.02, lng: ORIGEN.lng });
    const op = await pedir(e);
    expect(await ofertas(e, a.token)).toHaveLength(1);
    await vencer(e, op, a.id, 40);
    expect(await ofertas(e, a.token)).toHaveLength(0);
    expect(await ofertas(e, b.token)).toHaveLength(1);
  });
});

describe('C-OFERTA-AVISO: la oferta de viaje llega al celular del conductor', () => {
  it('cada oferta (la primera y la que vuelve) manda un aviso al teléfono', async () => {
    const avisos: { to: string; title: string; body: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('exp.host')) {
        const cuerpo = JSON.parse(String(init?.body)) as {
          to: string;
          title: string;
          body: string;
        }[];
        avisos.push(...cuerpo);
        return new Response(JSON.stringify({ data: cuerpo.map(() => ({ status: 'ok' })) }), {
          status: 200,
        });
      }
      return new Response('{}', { status: 200 });
    });
    const e = await listo();
    const a = await conductorDeMoto(e.m, ORIGEN);
    await e.m.DB.prepare(
      "INSERT INTO dispositivos (token, usuario_id, plataforma) VALUES ('ExponentPushToken[conductor]', ?, 'android')",
    )
      .bind(a.id)
      .run();
    const op = await pedir(e);
    const alConductor = () => avisos.filter((x) => x.to === 'ExponentPushToken[conductor]');
    expect(alConductor()).toHaveLength(1);
    expect(alConductor()[0]?.title).toMatch(/New ride|Viaje nuevo/);
    await vencer(e, op, a.id, 40);
    await ofertas(e, a.token);
    expect(alConductor()).toHaveLength(2);
  });
});
