import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * Divoox Moto · Fase M1. Candados C-MOTO-SOLO-PRUEBAS (Moto se enciende solo en el sitio de
 * pruebas; en producción, nunca) y C-VIAJE-PRECIO-FIJO (tarifa versionada por ciudad y cotización
 * con precio fijo guardada en el servidor, que vence a los 5 minutos).
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };

async function escenario(host?: string) {
  const m = mundo({}, host ? { host } : {});
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  return { m, admin, cliente };
}
const enPruebas = () => escenario('staging.tumbite.com');

async function encenderMoto(e: Awaited<ReturnType<typeof escenario>>) {
  const s = await e.m.llamar(
    'PUT',
    '/datos/admin/servicios/moto',
    { estado: 'disponible' },
    e.admin.token,
  );
  const z = await e.m.llamar(
    'PUT',
    `/datos/admin/servicios/moto/zonas/${ZONA}`,
    { estado: 'disponible' },
    e.admin.token,
  );
  return { servicio: s.estado, zona: z.estado };
}
function ponerTarifa(
  e: Awaited<ReturnType<typeof escenario>>,
  tarifa = TARIFA,
  motivo = 'Tarifa de prueba',
) {
  return e.m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona: ZONA, tarifa, motivo },
    e.admin.token,
  );
}
const cotizar = (
  e: Awaited<ReturnType<typeof escenario>>,
  cuerpo: object = {},
  token = e.cliente.token,
) =>
  e.m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    { servicio: 'moto', origen: ORIGEN, destino: DESTINO, ...cuerpo },
    token,
  );

describe('C-MOTO-SOLO-PRUEBAS: Moto existe solo en el sitio de pruebas', () => {
  it('en producción (divoox.com) Moto no se enciende ni se cotiza', async () => {
    const e = await escenario('divoox.com');
    expect(await encenderMoto(e)).toEqual({ servicio: 409, zona: 409 });
    expect((await ponerTarifa(e)).estado).toBe(201);
    expect((await cotizar(e)).estado).toBe(409);
    const lista = await e.m.llamar('GET', '/datos/admin/servicios', undefined, e.admin.token);
    expect(lista.datos.implementadosEnEsteCodigo).toEqual(['comida']);
  });

  it('en el sitio de pruebas Moto se enciende y la salud sigue en verde', async () => {
    const e = await enPruebas();
    expect(await encenderMoto(e)).toEqual({ servicio: 200, zona: 200 });
    const lista = await e.m.llamar('GET', '/datos/admin/servicios', undefined, e.admin.token);
    expect(lista.datos.implementadosEnEsteCodigo).toEqual(['comida', 'moto']);
    expect((await e.m.llamar('GET', '/datos/salud')).datos.piezas.servicios).toBe('ok');
    // Carro sigue bloqueado aun en pruebas: solo se abre lo que se está construyendo.
    const carro = await e.m.llamar(
      'PUT',
      '/datos/admin/servicios/carro',
      { estado: 'disponible' },
      e.admin.token,
    );
    expect(carro.estado).toBe(409);
  });

  it('si Moto quedara encendida en una base de producción, la salud lo dice en rojo', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    // La misma base vista desde producción: la sincronización la suspende y la salud no la tolera.
    await e.m.DB.prepare(
      "UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'moto'",
    ).run();
    const { saludServicios } = await import('./servicios');
    expect(await saludServicios(e.m.DB, 'produccion')).toBe('error');
    expect(await saludServicios(e.m.DB, 'pruebas')).toBe('ok');
  });
});

describe('C-VIAJE-PRECIO-FIJO: tarifa por ciudad', () => {
  it('solo el superadmin pone tarifas, y cada cambio es una versión nueva', async () => {
    const e = await enPruebas();
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/admin/viajes/tarifas',
          { servicio: 'moto', zona: ZONA, tarifa: TARIFA, motivo: 'x x x' },
          e.cliente.token,
        )
      ).estado,
    ).toBe(403);
    const a = await ponerTarifa(e);
    expect(a.estado).toBe(201);
    expect(a.datos.tarifa).toMatchObject({
      moneda: 'USD',
      dePrueba: true,
      activa: true,
      esperaGratisS: 300,
    });
    const b = await ponerTarifa(e, { ...TARIFA, base: 200 }, 'Sube la base');
    expect(b.estado).toBe(201);
    const lista = await e.m.llamar(
      'GET',
      '/datos/admin/viajes/tarifas?servicio=moto',
      undefined,
      e.admin.token,
    );
    expect(lista.datos.tarifas).toHaveLength(2);
    expect(lista.datos.tarifas.filter((t: { activa: boolean }) => t.activa)).toHaveLength(1);
    expect(lista.datos.tarifas[0]).toMatchObject({ base: 200, activa: true });
    expect(lista.datos.tarifas[1].cerradaEn).toBeTruthy();
    const audit = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE accion = 'viaje.tarifa'",
    ).first<{ n: number }>();
    expect(audit?.n).toBe(2);
  });

  it('una tarifa con montos negativos o en una ciudad que no existe no entra', async () => {
    const e = await enPruebas();
    expect((await ponerTarifa(e, { ...TARIFA, base: -5 })).estado).toBe(400);
    const r = await e.m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      { servicio: 'moto', zona: 'US-XX-NADA', tarifa: TARIFA, motivo: 'Prueba' },
      e.admin.token,
    );
    expect(r.estado).toBe(404);
  });
});

describe('C-VIAJE-PRECIO-FIJO: cotización del pasajero', () => {
  it('devuelve el precio fijo con su desglose, guardado en el servidor por 5 minutos', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const r = await cotizar(e);
    expect(r.estado).toBe(201);
    const c = r.datos.cotizacion;
    expect(c).toMatchObject({
      servicio: 'moto',
      moneda: 'USD',
      dePrueba: true,
      zona: { id: ZONA },
    });
    const d = c.desglose;
    expect(d.base + d.distancia + d.tiempo + d.ajusteMinimo + d.dinamico).toBe(c.total);
    expect(d.distancia).toBe(Math.round((TARIFA.porKm * c.distanciaM) / 1000));
    expect(c.total).toBeGreaterThanOrEqual(TARIFA.minimo);
    const f = await e.m.DB.prepare('SELECT * FROM cotizaciones_viaje WHERE id = ?')
      .bind(c.id)
      .first<Record<string, unknown>>();
    expect(f).toMatchObject({ cliente_id: e.cliente.id, total: c.total, usada_en: null });
    const vence = new Date(`${String(f?.vence_en).replace(' ', 'T')}Z`).getTime();
    expect(vence - Date.now()).toBeGreaterThan(280_000);
    expect(vence - Date.now()).toBeLessThanOrEqual(300_000);
  });

  it('cotiza con la tarifa activa del momento (la versión nueva manda)', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const antes = (await cotizar(e)).datos.cotizacion.total as number;
    await ponerTarifa(e, { ...TARIFA, base: TARIFA.base + 1000 }, 'Sube la base');
    expect((await cotizar(e)).datos.cotizacion.total).toBe(antes + 1000);
  });

  it('sin servicio encendido o sin tarifa no hay precio', async () => {
    const e = await enPruebas();
    await ponerTarifa(e);
    expect((await cotizar(e)).estado).toBe(409);
    const f = await enPruebas();
    await encenderMoto(f);
    const sin = await cotizar(f);
    expect(sin.estado).toBe(409);
    expect(sin.datos.error).toMatch(/pricing|precio/);
  });

  it('rechaza recogidas fuera de cobertura, destinos de otra ciudad y viajes demasiado cortos', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const lejos = { lat: 4.65, lng: -74.05, direccion: 'Otra ciudad' };
    expect((await cotizar(e, { origen: lejos })).estado).toBe(409);
    expect((await cotizar(e, { destino: lejos })).estado).toBe(422);
    expect((await cotizar(e, { destino: { ...ORIGEN, direccion: 'Al lado' } })).estado).toBe(422);
    expect((await cotizar(e, { servicio: 'comida' })).estado).toBe(400);
  });

  it('solo un pasajero cotiza (un conductor o una visita sin sesión, no)', async () => {
    const e = await enPruebas();
    await encenderMoto(e);
    await ponerTarifa(e);
    const rep = await e.m.cuenta('repartidor', 'Conductor Uno');
    expect((await cotizar(e, {}, rep.token)).estado).toBe(403);
    expect(
      (
        await e.m.llamar('POST', '/datos/viajes/cotizar', {
          servicio: 'moto',
          origen: ORIGEN,
          destino: DESTINO,
        })
      ).estado,
    ).toBe(401);
  });
});
