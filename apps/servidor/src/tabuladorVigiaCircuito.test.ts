import { describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG, type DesgloseViaje, horaLocal } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';
import { TOPE_RUTAS_POR_ZONA, conPrecioZona } from './precioZona';

/**
 * Lecturas (filas) que puede gastar una cotización de Moto en El Vigía con sus rutas (medido: 171,
 * con las 126 rutas; el tope deja lugar a las que agregue el equipo hasta TOPE_RUTAS_POR_ZONA).
 */
const PRESUPUESTO_LECTURAS_COTIZAR = 250;
import { saludLibro } from './internacional/libro';
import { medidorDeLecturas } from './pruebas/lecturas';
import { exigirNocheDeLaReserva } from './rutas/viajesPasajero';
import { sembrarTabuladorVigia } from './semillaTabuladorVigia';
import { TABULADOR_EL_VIGIA } from './tabuladorElVigia';

/**
 * C-TABULADOR-VIGIA y C-RECARGO-NOCHE (25 nov 2026, Richard) — Venezuela, El Vigía, Moto. Por la API,
 * como las apps: el pasajero paga el precio de la hoja de la calle (nunca más), de noche un 30 % más,
 * sin tarifa de servicio encima; Divoox saca su 10 % del saldo prepago del conductor; el libro cuadra.
 * Sin llave de Google en las pruebas: la distancia sale de la fórmula (línea recta × 1,3).
 */
const CENTRO = { lat: EVG.lat, lng: EVG.lng, direccion: 'Plaza Bolívar de El Vigía' };
const lugar = (nombre: string) => {
  const d = TABULADOR_EL_VIGIA.find((x) => x.nombre === nombre);
  if (!d) throw new Error(nombre);
  return { lat: d.lat, lng: d.lng, direccion: nombre };
};

async function escenario({ medir = false } = {}) {
  let medidor: ReturnType<typeof medidorDeLecturas> | null = null;
  const m = mundo(
    {},
    {
      host: 'staging.tumbite.com',
      ...(medir ? { envolver: (db: D1Database) => (medidor = medidorDeLecturas(db)).db } : {}),
    },
  );
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero El Vigía');
  const r = await m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'moto',
      zona: {
        id: EVG.id,
        nombre: EVG.nombre,
        lat: EVG.lat,
        lng: EVG.lng,
        radioKm: EVG.radioKm,
        zonaHoraria: EVG.zonaHoraria,
      },
      motivo: 'El Vigía para Moto',
    },
    admin.token,
  );
  expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  expect(await sembrarTabuladorVigia(m.DB)).not.toBeNull();
  /**
   * La noche se fija alrededor de la hora REAL de Venezuela, para que la prueba no dependa de cuándo
   * corre: «de noche» = la noche empieza en esta hora; «de día» = empieza dentro de dos horas.
   */
  const fijarNoche = async (deNoche: boolean, enHoras = 0) => {
    const h = (horaLocal(new Date(), EVG.zonaHoraria) + enHoras) % 24;
    const desde = deNoche ? h : (h + 2) % 24;
    await m.DB.prepare(
      "UPDATE tarifas_viaje SET noche_desde_h = ?, noche_hasta_h = ? WHERE zona_id = ? AND servicio_id = 'moto' AND activa = 1",
    )
      .bind(desde, (desde + 2) % 24, EVG.id)
      .run();
  };
  const cotizar = async (destino: { lat: number; lng: number; direccion: string }, extra = {}) => {
    const c = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      // La app de hoy manda tarifaServicio: true (sabe mostrar la tarifa de servicio aparte).
      { servicio: 'moto', origen: CENTRO, destino, tarifaServicio: true, ...extra },
      cliente.token,
    );
    expect(c.estado, JSON.stringify(c.datos)).toBe(201);
    return c.datos.cotizacion as {
      id: string;
      total: number;
      tarifaServicio: number;
      quienPaga: string;
      precioZona: boolean;
      lugarZona?: string;
      recargoNoche: { pb: number; monto: number } | null;
      desglose: DesgloseViaje;
    };
  };
  return { m, admin, cliente, fijarNoche, cotizar, medidor: () => medidor };
}
type E = Awaited<ReturnType<typeof escenario>>;

/** El equipo de Divoox como punto de venta: compra saldo, emite un código y el conductor lo canjea. */
async function recargar(e: E, token: string, monto: number) {
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, e.admin.token);
  expect(
    (await equipo('PUT', '/datos/admin/paises/VE', { recargasPuntoVentaActivas: true })).estado,
  ).toBe(200);
  const punto = await equipo('POST', '/datos/admin/puntos-venta', {
    nombre: 'Equipo Divoox El Vigía',
    pais: 'VE',
    moneda: 'USD',
    usuarioId: e.admin.id,
  });
  expect(punto.estado, JSON.stringify(punto.datos)).toBe(201);
  const id = punto.datos.punto.id as string;
  expect(
    (
      await equipo('POST', `/datos/admin/puntos-venta/${id}/fondo`, {
        monto,
        comprobante: 'pago-1',
      })
    ).estado,
  ).toBe(200);
  const codigo = await equipo('POST', '/datos/punto-venta/codigos', { monto });
  expect(codigo.estado).toBe(201);
  const canje = await e.m.llamar(
    'POST',
    '/datos/repartidor/recargar',
    { codigo: codigo.datos.codigo },
    token,
  );
  expect(canje.estado, JSON.stringify(canje.datos)).toBe(200);
}

describe('C-TABULADOR-VIGIA: el precio en El Vigía', () => {
  it('el pasajero paga el precio de la hoja, sin tarifa de servicio encima (la comisión la paga el conductor)', async () => {
    const e = await escenario();
    await e.fijarNoche(false);
    const c = await e.cotizar(lugar('KM 9'));
    expect(c.precioZona).toBe(true);
    expect(c.lugarZona).toBe('KM 9');
    expect(c.total).toBe(300);
    expect(c.tarifaServicio).toBe(0);
    expect(c.quienPaga).toBe('conductor');
    expect(c.recargoNoche).toBeNull();
    // Lo que habría salido por km (la tarifa aprendida) era más caro: manda la hoja.
    expect(Number(c.desglose.calculado)).toBeGreaterThan(300);
  });

  it('el fijo nunca sube el precio: si lo calculado es más barato, gana lo calculado', async () => {
    const e = await escenario();
    await e.fijarNoche(false);
    // La Motoza está a menos de 1 km del centro: por km sale el mínimo (1 $) y la hoja dice 2 $.
    const c = await e.cotizar(lugar('La Motoza'));
    expect(c.precioZona).toBe(false);
    expect(c.total).toBe(100);
  });

  it('con el umbral en 0, el fijo gana aunque sea apenas más barato; vacío sigue siendo el 10 %', () => {
    const calc = { ...base(), total: 310 };
    expect(conPrecioZona(calc, 300, 0, { id: 'r' }).total).toBe(300);
    expect(conPrecioZona(calc, 300, undefined, { id: 'r' }).total).toBe(310);
    expect(conPrecioZona(calc, 320, 0, { id: 'r' }).total).toBe(310);
    expect(conPrecioZona({ ...base(), total: 300 }, 300, 0, { id: 'r' }).total).toBe(300);
  });

  it('de noche: el precio de la hoja más el 30 %, con su línea; lo calculado también sube', async () => {
    const e = await escenario();
    await e.fijarNoche(true);
    const c = await e.cotizar(lugar('KM 9'));
    expect(c.total).toBe(390);
    expect(c.recargoNoche).toEqual({ pb: 3000, monto: 90 });
    expect(c.desglose.precioZona).toBe(300);
    expect(c.desglose.recargoNoche).toBe(90);
    expect(c.tarifaServicio).toBe(0);
    // Primero el más bajo de día (1 $ calculado), después el recargo: 1,30 $, nunca la hoja × 1,3.
    const corto = await e.cotizar(lugar('La Motoza'));
    expect(corto.total).toBe(130);
    expect(corto.precioZona).toBe(false);
  });

  it('app nueva: la reserva se cotiza con SU hora; si se pide para otra franja, hay que volver a cotizar', async () => {
    const e = await escenario();
    // Ahora es de día y dentro de 3 horas es de noche.
    await e.fijarNoche(true, 3);
    const noche = new Date(Date.now() + 3 * 3_600_000 + 5 * 60_000).toISOString();
    const dia = new Date(Date.now() + 3_600_000).toISOString();
    const deNoche = await e.cotizar(lugar('KM 9'), { programadoPara: noche });
    expect(deNoche.total).toBe(390);
    expect(deNoche.desglose.horaPrecio).toBe(noche);
    const mal = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: deNoche.id, metodoPago: 'efectivo', programadoPara: dia },
      e.cliente.token,
    );
    expect(mal.estado).toBe(409);
    expect(mal.datos.campo).toBe('cotizacionId');
    expect(String(mal.datos.error)).toMatch(/tarifa nocturna|night fare/);
    const bien = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: deNoche.id, metodoPago: 'efectivo', programadoPara: noche },
      e.cliente.token,
    );
    expect(bien.estado, JSON.stringify(bien.datos)).toBe(201);
  });

  it('app de la tienda (cotiza sin hora): la reserva de noche se crea con el precio que vio, sin 409', async () => {
    const e = await escenario();
    await e.fijarNoche(true, 3);
    const noche = new Date(Date.now() + 3 * 3_600_000 + 5 * 60_000).toISOString();
    const vieja = await e.cotizar(lugar('KM 9'));
    expect(vieja.total).toBe(300);
    expect(vieja.desglose.horaPrecio).toBeUndefined();
    const r = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: vieja.id, metodoPago: 'efectivo', programadoPara: noche },
      e.cliente.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const q = await e.m.DB.prepare('SELECT total FROM cotizaciones_viaje WHERE id = ?')
      .bind(vieja.id)
      .first<{ total: number }>();
    expect(q?.total).toBe(300);
  });

  it('cotizado a las 20:59 y pedido a las 21:05 sin reserva: se cobra lo mostrado; con hora declarada de día y pedido de noche, se vuelve a cotizar', () => {
    const tarifa = JSON.stringify({
      base: 0,
      porKm: 46,
      porMinuto: 0,
      minimo: 100,
      recargoNochePb: 3000,
    });
    const a = (h: number, m: number) => new Date(Date.UTC(2026, 10, 26, h + 4, m));
    const sinHora = { tarifa_json: tarifa, desglose_json: JSON.stringify({ total: 300 }) };
    expect(() => exigirNocheDeLaReserva(sinHora, null, EVG.zonaHoraria, a(21, 5))).not.toThrow();
    const conHora = {
      tarifa_json: tarifa,
      desglose_json: JSON.stringify({ total: 300, horaPrecio: a(20, 59).toISOString() }),
    };
    expect(() => exigirNocheDeLaReserva(conHora, null, EVG.zonaHoraria, a(20, 59))).not.toThrow();
    expect(() => exigirNocheDeLaReserva(conHora, null, EVG.zonaHoraria, a(21, 5))).toThrow(
      /tarifa nocturna/,
    );
    // Una ciudad sin recargo nunca lo comprueba.
    const sinRecargo = {
      ...conHora,
      tarifa_json: JSON.stringify({ base: 0, porKm: 46, porMinuto: 0, minimo: 100 }),
    };
    expect(() => exigirNocheDeLaReserva(sinRecargo, null, EVG.zonaHoraria, a(21, 5))).not.toThrow();
  });

  it('de noche, cambiar las paradas y la espera conservan el 30 % del viaje', async () => {
    const e = await escenario();
    await e.fijarNoche(true);
    const cond = await conductorDeMoto(e.m, CENTRO, EVG.id);
    await recargar(e, cond.token, 1000);
    // Un destino FUERA del tabulador (con precio de la zona no se pueden cambiar paradas).
    const fuera = { lat: 8.58, lng: -71.6, direccion: 'Destino fuera de la lista' };
    const cot = await e.cotizar(fuera);
    expect(cot.precioZona).toBe(false);
    expect(cot.recargoNoche?.pb).toBe(3000);
    const v = await e.m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo' },
      e.cliente.token,
    );
    expect(v.estado, JSON.stringify(v.datos)).toBe(201);
    const id = v.datos.viaje.id as string;
    // Aunque sea de día cuando se cambian las paradas, el viaje nació de noche.
    await e.fijarNoche(false);
    const cambio = await e.m.llamar(
      'POST',
      `/datos/viajes/${id}/paradas`,
      { paradas: [{ lat: 8.6, lng: -71.62, direccion: 'Una parada' }], confirmar: false },
      e.cliente.token,
    );
    expect(cambio.estado, JSON.stringify(cambio.datos)).toBe(200);
    const dg = cambio.datos.cambio.desglose as DesgloseViaje;
    expect(dg.recargoNochePb).toBe(3000);
    expect(dg.recargoNoche).toBe(Math.floor(((dg.total - (dg.recargoNoche ?? 0)) * 3000) / 10_000));
    expect(cambio.datos.cambio.totalNuevo).toBe(dg.total);
    // La espera: 10 minutos (3 gratis) a 0,05 por minuto = 0,35, más el 30 % = 0,45.
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    await e.m.DB.prepare(
      "UPDATE viajes SET llego_en = datetime('now', '-10 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    const pin = (await e.m.llamar('GET', `/datos/viajes/${id}`, undefined, e.cliente.token)).datos
      .viaje.pin;
    expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
    expect(await cond.paso(id, 'terminar')).toBe(200);
    const fin = await e.m.DB.prepare(
      'SELECT total_final_centavos AS t FROM viajes WHERE operacion_id = ?',
    )
      .bind(id)
      .first<{ t: number }>();
    expect(fin?.t).toBe(cot.total + 45);
  });

  it('el panel dice lo que paga el pasajero, lo de Divoox y lo que le queda al conductor, de día y de noche', async () => {
    const e = await escenario();
    const r = await e.m.llamar(
      'GET',
      `/datos/admin/viajes/precios-zona?zona=${EVG.id}&servicio=moto`,
      undefined,
      e.admin.token,
    );
    expect(r.estado).toBe(200);
    const km9 = (
      r.datos.rutas as {
        hasta: { nombre: string };
        grupo: string;
        revisar: boolean;
        reparto: unknown;
      }[]
    ).find((x) => x.hasta.nombre === 'KM 9');
    expect(km9?.grupo).toBe('Vía Táchira');
    expect(km9?.revisar).toBe(false);
    expect(km9?.reparto).toEqual({
      pasajero: 300,
      comision: 30,
      conductor: 270,
      noche: { pasajero: 390, comision: 39, conductor: 351 },
    });
  });
});

function base(): DesgloseViaje {
  return {
    base: 0,
    distancia: 0,
    tiempo: 0,
    ajusteMinimo: 0,
    dinamico: 0,
    cargoFijo: 0,
    redondeo: 0,
    total: 0,
  };
}

describe('C-TABULADOR-VIGIA: el circuito del dinero en efectivo, de punta a punta', () => {
  for (const deNoche of [false, true])
    it(`${deNoche ? 'de noche' : 'de día'}: cotizar, pedir en efectivo, aceptar, terminar; la comisión sale del prepago y el libro cuadra`, async () => {
      const e = await escenario();
      await e.fijarNoche(deNoche);
      const cond = await conductorDeMoto(e.m, CENTRO, EVG.id);
      await recargar(e, cond.token, 1000);
      const precio = deNoche ? 390 : 300;
      const comision = deNoche ? 39 : 30;

      const cot = await e.cotizar(lugar('KM 9'));
      expect(cot.total).toBe(precio);
      const v = await e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'efectivo' },
        e.cliente.token,
      );
      expect(v.estado, JSON.stringify(v.datos)).toBe(201);
      const id = v.datos.viaje.id as string;

      // El conductor ve el precio ya con la noche y lo que es suyo y de Divoox antes de aceptar.
      const ofertas = await e.m.llamar(
        'GET',
        '/datos/conductor/operaciones/ofertas',
        undefined,
        cond.token,
      );
      const oferta = (
        ofertas.datos.ofertas as {
          operacionId: string;
          gananciaCentavos: number;
          comisionDivoox: number;
          tarifaServicio: number;
        }[]
      ).find((o) => o.operacionId === id);
      expect(oferta).toMatchObject({
        gananciaCentavos: precio - comision,
        comisionDivoox: comision,
        tarifaServicio: 0,
      });

      expect(await cond.paso(id, 'aceptar')).toBe(200);
      const saldo = async () =>
        (await e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, cond.token)).datos;
      expect((await saldo()).reservado).toBe(comision);
      expect(await cond.paso(id, 'llegue')).toBe(200);
      const pin = (await e.m.llamar('GET', `/datos/viajes/${id}`, undefined, e.cliente.token)).datos
        .viaje.pin;
      expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
      expect(await cond.paso(id, 'terminar')).toBe(200);
      // Reintentar «terminar» no cobra dos veces.
      expect(await cond.paso(id, 'terminar')).toBe(200);

      const s = await saldo();
      expect(s.disponible).toBe(1000 - comision);
      expect(s.reservado).toBe(0);
      const comisiones = await e.m.DB.prepare(
        "SELECT COALESCE(SUM(monto), 0) AS s, COUNT(*) AS n FROM libro WHERE bolsillo = 'comisiones' AND pais = 'VE' AND moneda = 'USD'",
      ).first<{ s: number; n: number }>();
      expect(comisiones).toEqual({ s: comision, n: 1 });
      // El libro del viaje suma cero: lo que salió del conductor es lo que entró a Divoox.
      const { results: filas } = await e.m.DB.prepare(
        'SELECT bolsillo, monto FROM libro WHERE pedido_id = ?1 OR instr(referencia, ?1) > 0',
      )
        .bind(id)
        .all<{ bolsillo: string; monto: number }>();
      expect(filas.length).toBeGreaterThan(1);
      expect(filas.reduce((a, f) => a + f.monto, 0)).toBe(0);
      expect(
        filas.filter((f) => f.bolsillo === 'comisiones').reduce((a, f) => a + f.monto, 0),
      ).toBe(comision);
      expect(await saludLibro(e.m.DB)).toBe('ok');
      // Lo que cobró el pasajero quedó fijo en el viaje.
      const final = await e.m.DB.prepare(
        'SELECT q.total, q.desglose_json FROM viajes v JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE v.operacion_id = ?',
      )
        .bind(id)
        .first<{ total: number; desglose_json: string }>();
      expect(final?.total).toBe(precio);
      expect(JSON.parse(String(final?.desglose_json)).precioZona).toBe(300);
    });
});

describe('C-RECARGO-NOCHE: la app del pasajero', () => {
  it('dice «Tarifa nocturna» antes de pedir, cotiza la reserva con su hora y lo pone en el recibo (es/en)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const leer = (...r: string[]) =>
      readFileSync(join(import.meta.dirname, '..', '..', ...r), 'utf8');
    const pedir = leer('cliente', 'src', 'viajes', 'PedirMoto.tsx');
    expect(pedir).toContain('testID="moto-tarifa-nocturna"');
    expect(pedir).toMatch(/cotizacion\.recargoNoche \?/);
    // La reserva se cotiza con SU hora (la del pedido es la misma).
    expect(pedir.match(/\.\.\.\(cuando \? \{ programadoPara: cuando \} : \{\}\)/g)).toHaveLength(2);
    const textos = leer('cliente', 'src', 'viajes', 'textos.ts');
    expect(textos).toContain("tarifaNocturna: 'Tarifa nocturna (+{pct} %)'");
    expect(textos).toContain("tarifaNocturna: 'Night fare (+{pct}%)'");
    expect(textos).toContain("recargoNoche: 'Tarifa nocturna'");
    expect(textos).toContain("recargoNoche: 'Night fare'");
    expect(leer('cliente', 'src', 'viajes', 'MisViajes.tsx')).toContain("'recargoNoche',");
  });
});

describe('C-TABULADOR-VIGIA: lecturas por cotización con las rutas de El Vigía', () => {
  it('cotizar con ~126 rutas en la zona queda dentro del presupuesto de lecturas', async () => {
    const e = await escenario({ medir: true });
    await e.fijarNoche(false);
    await e.cotizar(lugar('KM 9'));
    const medidor = e.medidor();
    if (!medidor) throw new Error('sin medidor');
    const r = await medidor.medir(() => e.cotizar(lugar('KM 9')));
    const rutas = r.lecturas.filter((l) => l.sql.includes('FROM rutas_precio_zona'));
    // Medido el 25 nov 2026: 171 filas, 126 de ellas las rutas de la zona (una sola consulta).
    expect(rutas).toHaveLength(1);
    expect(rutas[0]?.filas ?? 0).toBeLessThanOrEqual(TOPE_RUTAS_POR_ZONA);
    expect(r.total, r.lecturas.map((l) => `${l.filas} ${l.sql}`).join('\n')).toBeLessThanOrEqual(
      PRESUPUESTO_LECTURAS_COTIZAR,
    );
  });
});
