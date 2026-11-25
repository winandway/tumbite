import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { conPrecioZona } from './precioZona';
import { cotizarViaje } from '@tumbite/compartido';

/**
 * C-PRECIO-ZONA (24 nov 2026, Richard) — todos los países, Moto, Carro y Envíos. En los pueblos se
 * cobra un precio fijo acostumbrado entre lugares cercanos: el equipo lo escribe como una ruta y el
 * pasajero paga el MENOR entre ese precio y el calculado, si la diferencia pasa del umbral (10 %).
 */
const ZONA = 'US-FL-MIAMI';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Lugar de llegada' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };
const HASTA = { lat: 25.79, lng: -80.13, radioKm: 1, nombre: 'Plaza de llegada' };

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  for (const servicio of ['moto', 'carro', 'envios']) {
    await m.llamar(
      'PUT',
      `/datos/admin/servicios/${servicio}`,
      { estado: 'disponible' },
      admin.token,
    );
    await m.llamar(
      'PUT',
      `/datos/admin/servicios/${servicio}/zonas/${ZONA}`,
      { estado: 'disponible' },
      admin.token,
    );
    const r = await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      { servicio, zona: ZONA, tarifa: TARIFA, motivo: 'Tarifa de prueba' },
      admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  }
  const cotizar = (cuerpo: object = {}) =>
    m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO, tarifaServicio: true, ...cuerpo },
      cliente.token,
    );
  const agregar = (cuerpo: object) =>
    m.llamar(
      'POST',
      '/datos/admin/viajes/precios-zona',
      { zona: ZONA, servicio: 'moto', desde: null, hasta: HASTA, ...cuerpo },
      admin.token,
    );
  const normal = await cotizar();
  expect(normal.estado, JSON.stringify(normal.datos)).toBe(201);
  const calculado = Number(normal.datos.cotizacion.total);
  return { m, admin, cliente, cotizar, agregar, calculado };
}

describe('C-PRECIO-ZONA · precio fijo de la zona (etiquetas de ruta)', () => {
  it('ruta con precio menor: el pasajero paga el de la zona y la cotización lo marca', async () => {
    const { m, cotizar, agregar, calculado } = await escenario();
    const precio = Math.round(calculado * 0.7);
    const r = await agregar({ precio });
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const c = await cotizar();
    expect(c.estado).toBe(201);
    expect(c.datos.cotizacion.precioZona).toBe(true);
    expect(c.datos.cotizacion.lugarZona).toBe('Plaza de llegada');
    expect(c.datos.cotizacion.total).toBe(precio);
    expect(c.datos.cotizacion.desglose.calculado).toBe(calculado);
    // La cotización guardada (la que viaja al pedir, la comisión y el cobro) lleva el MISMO número.
    const q = await m.DB.prepare('SELECT total, desglose_json FROM cotizaciones_viaje WHERE id = ?')
      .bind(c.datos.cotizacion.id)
      .first<{ total: number; desglose_json: string }>();
    expect(q?.total).toBe(precio);
    expect(JSON.parse(String(q?.desglose_json)).precioZona).toBe(precio);
  });

  it('precio parecido (menos del 10 % de diferencia): queda el calculado normal', async () => {
    const { cotizar, agregar, calculado } = await escenario();
    expect((await agregar({ precio: Math.round(calculado * 0.95) })).estado).toBe(201);
    const c = await cotizar();
    expect(c.datos.cotizacion.precioZona).toBe(false);
    expect(c.datos.cotizacion.total).toBe(calculado);
  });

  it('el umbral se cambia por ciudad en la tarifa', async () => {
    const { m, admin, cotizar, agregar, calculado } = await escenario();
    await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: ZONA,
        tarifa: { ...TARIFA, umbralPrecioZonaPb: 200 },
        motivo: 'Umbral del 2 %',
      },
      admin.token,
    );
    const precio = Math.round(calculado * 0.95);
    await agregar({ precio });
    const c = await cotizar();
    expect(c.datos.cotizacion.precioZona).toBe(true);
    expect(c.datos.cotizacion.total).toBe(precio);
  });

  it('ruta apagada: no aplica', async () => {
    const { m, admin, cotizar, agregar, calculado } = await escenario();
    const r = await agregar({ precio: Math.round(calculado * 0.5) });
    const apagar = await m.llamar(
      'POST',
      `/datos/admin/viajes/precios-zona/${String(r.datos.ruta.id)}/apagar`,
      {},
      admin.token,
    );
    expect(apagar.estado).toBe(200);
    expect(apagar.datos.ruta.activa).toBe(false);
    const c = await cotizar();
    expect(c.datos.cotizacion.precioZona).toBe(false);
    expect(c.datos.cotizacion.total).toBe(calculado);
    const a = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE accion LIKE 'viaje.precio_zona.%'",
    ).first<{ n: number }>();
    expect(a?.n).toBe(2);
  });

  it('otro servicio: la ruta de Moto no le pone precio a Carro ni a Envíos', async () => {
    const { cotizar, agregar, calculado } = await escenario();
    await agregar({ precio: Math.round(calculado * 0.5) });
    for (const servicio of ['carro', 'envios']) {
      const c = await cotizar({ servicio });
      expect(c.estado, JSON.stringify(c.datos)).toBe(201);
      expect(c.datos.cotizacion.precioZona).toBe(false);
    }
  });

  it('fuera del radio del destino o con paradas: no aplica', async () => {
    const { cotizar, agregar, calculado } = await escenario();
    await agregar({ precio: Math.round(calculado * 0.5) });
    const lejos = await cotizar({ destino: { lat: 25.83, lng: -80.2, direccion: 'Otro lugar' } });
    expect(lejos.datos.cotizacion.precioZona).toBe(false);
    const conParada = await cotizar({
      paradas: [{ lat: 25.77, lng: -80.16, direccion: 'Una parada' }],
    });
    expect(conParada.datos.cotizacion.precioZona).toBe(false);
  });

  it('desde un punto con radio: solo si la recogida cae ahí', async () => {
    const { cotizar, agregar, calculado } = await escenario();
    await agregar({
      precio: Math.round(calculado * 0.5),
      desde: { lat: 25.7, lng: -80.3, radioKm: 1, nombre: 'Otro punto' },
    });
    expect((await cotizar()).datos.cotizacion.precioZona).toBe(false);
    await agregar({
      precio: Math.round(calculado * 0.6),
      desde: { lat: 25.7617, lng: -80.1918, radioKm: 1, nombre: 'Salida' },
    });
    expect((await cotizar()).datos.cotizacion.total).toBe(Math.round(calculado * 0.6));
  });

  it('ida y vuelta: se ofrece, y al elegirla la vuelta es una parada y el viaje vuelve al inicio', async () => {
    const { m, cotizar, agregar, calculado } = await escenario();
    const ida = Math.round(calculado * 0.5);
    const vuelta = Math.round(calculado * 0.9);
    await agregar({ precio: ida, precioIdaVuelta: vuelta });
    const c = await cotizar();
    expect(c.datos.cotizacion.total).toBe(ida);
    expect(c.datos.cotizacion.ofertaIdaVuelta).toEqual({ total: vuelta });
    const iv = await cotizar({ idaVuelta: true });
    expect(iv.estado, JSON.stringify(iv.datos)).toBe(201);
    expect(iv.datos.cotizacion.idaVuelta).toBe(true);
    expect(iv.datos.cotizacion.precioZona).toBe(true);
    expect(iv.datos.cotizacion.total).toBe(vuelta);
    expect(iv.datos.cotizacion.paradas).toHaveLength(1);
    const q = await m.DB.prepare(
      'SELECT destino_lat, destino_lng, paradas_json, total FROM cotizaciones_viaje WHERE id = ?',
    )
      .bind(iv.datos.cotizacion.id)
      .first<{ destino_lat: number; destino_lng: number; paradas_json: string; total: number }>();
    expect(q?.destino_lat).toBe(ORIGEN.lat);
    expect(q?.destino_lng).toBe(ORIGEN.lng);
    expect(JSON.parse(String(q?.paradas_json))[0].lat).toBe(DESTINO.lat);
    expect(q?.total).toBe(vuelta);
  });

  it('ida y vuelta sin precio en la ruta, o en Envíos: no se puede pedir', async () => {
    const { cotizar, agregar, calculado } = await escenario();
    expect((await cotizar({ idaVuelta: true })).estado).toBe(422);
    await agregar({ precio: Math.round(calculado * 0.5) });
    const sin = await cotizar({ idaVuelta: true });
    expect(sin.estado).toBe(422);
    expect(sin.datos.error).toMatch(/ida y vuelta|round-trip/);
    expect((await cotizar()).datos.cotizacion.ofertaIdaVuelta).toBeNull();
    const envio = await agregar({
      servicio: 'envios',
      precio: Math.round(calculado * 0.5),
      precioIdaVuelta: calculado,
    });
    expect(envio.estado).toBe(422);
  });

  it('editar una ruta cambia el precio de las cotizaciones nuevas y queda en la auditoría', async () => {
    const { m, admin, cotizar, agregar, calculado } = await escenario();
    const r = await agregar({ precio: Math.round(calculado * 0.5) });
    const editar = await m.llamar(
      'PUT',
      `/datos/admin/viajes/precios-zona/${String(r.datos.ruta.id)}`,
      {
        zona: ZONA,
        servicio: 'moto',
        desde: null,
        hasta: HASTA,
        precio: Math.round(calculado * 0.6),
      },
      admin.token,
    );
    expect(editar.estado, JSON.stringify(editar.datos)).toBe(200);
    expect((await cotizar()).datos.cotizacion.total).toBe(Math.round(calculado * 0.6));
    const lista = await m.llamar(
      'GET',
      `/datos/admin/viajes/precios-zona?zona=${ZONA}`,
      undefined,
      admin.token,
    );
    expect(lista.datos.rutas).toHaveLength(1);
  });

  it('solo el equipo (admin) maneja las rutas', async () => {
    const { m, cliente } = await escenario();
    const r = await m.llamar('GET', '/datos/admin/viajes/precios-zona', undefined, cliente.token);
    expect(r.estado).toBe(403);
  });

  it('la regla del menor con umbral, en números', () => {
    const t = {
      base: 0,
      porKm: 100,
      porMinuto: 0,
      minimo: 0,
      esperaGratisS: 0,
      porMinutoEspera: 0,
      cancelacionGratisS: 0,
      cargoCancelacion: 0,
      cargoNoSePresento: 0,
      topeDinamicoPb: 10_000,
      redondeo: 1,
      cargoFijo: 0,
      factorCallePb: 13_000,
      velocidadKmh: 24,
      esperaParadaGratisS: 120,
    };
    const calc = cotizarViaje(t, { distanciaM: 700, duracionS: 60 });
    expect(calc.total).toBe(70);
    expect(conPrecioZona(calc, 50, undefined, { id: 'r' }).total).toBe(50);
    expect(conPrecioZona(calc, 65, undefined, { id: 'r' }).total).toBe(70);
    expect(conPrecioZona(calc, 90, undefined, { id: 'r' }).total).toBe(70);
  });
});
