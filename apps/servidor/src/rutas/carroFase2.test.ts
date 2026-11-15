import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { reajustarReservaViaje, reservaDeViaje } from '../finanzas/conductor';
import { recalcularDinamica } from '../viajesDinamica';
import { categoriaAlAprobar } from './servicios';
import { CAMBIOS_PARADAS_MAXIMOS } from './paradasViaje';

/**
 * Divoox Carro, fase 2 (14 nov 2026, todos los países): C-CARRO-CATEGORIAS (Comfort y Premium),
 * C-CARRO-DINAMICA (tarifa dinámica por ciudad) y C-VIAJE-PARADAS (paradas intermedias).
 * Ficha: docs/investigaciones-rea/2026-11-14-carro-paradas-categorias-dinamica.md.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const PARADA = { lat: 25.775, lng: -80.16, direccion: 'Parada en la farmacia' };
const PARADA_2 = { lat: 25.78, lng: -80.15, direccion: 'Parada en el cajero' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 300, porKm: 120, porMinuto: 25, minimo: 800, porMinutoEspera: 50 };

type Mundo = ReturnType<typeof mundo>;

async function ciudad(extra: object = {}) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  await m.llamar('PUT', '/datos/admin/servicios/carro', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    '/datos/admin/servicios/carro/zonas/US-FL-MIAMI',
    { estado: 'disponible' },
    admin.token,
  );
  const tarifa = (mas: object = {}) =>
    m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'carro',
        zona: 'US-FL-MIAMI',
        tarifa: { ...TARIFA, ...extra, ...mas },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
  expect((await tarifa()).estado).toBeLessThan(300);
  const cotizar = (mas: object = {}, quien = cliente) =>
    m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: ORIGEN, destino: DESTINO, ...mas },
      quien.token,
    );
  const pedir = async (cotizacionId: string, quien = cliente) =>
    (await m.llamar('POST', '/datos/viajes', { cotizacionId, metodoPago: 'efectivo' }, quien.token))
      .datos.viaje.id as string;
  return { m, admin, cliente, tarifa, cotizar, pedir };
}

const sql = (m: Mundo, texto: string, ...v: unknown[]) =>
  m.DB.prepare(texto)
    .bind(...v)
    .run();

async function mover(m: Mundo, conductorId: string, a: { lat: number; lng: number }) {
  await sql(
    m,
    "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    a.lat,
    a.lng,
    conductorId,
  );
}

async function terminar(m: Mundo, token: string, id: string, clave: string) {
  const r = await m.crudo(`/datos/conductor/operaciones/${id}/terminar`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': clave,
    },
    body: '{}',
  });
  return { estado: r.status, datos: (await r.json()) as { totalFinal?: number; error?: string } };
}

describe('Categorías de Carro (C-CARRO-CATEGORIAS)', () => {
  it('sin factor en la ciudad la categoría no existe; con factor cuesta más y la cotización trae las opciones', async () => {
    const { tarifa, cotizar } = await ciudad();
    expect((await cotizar({ categoria: 'comfort' })).estado).toBe(409);
    expect((await cotizar({ categoria: 'premium' })).estado).toBe(409);
    await tarifa({ comfortPb: 12_500, premiumPb: 18_000 });
    const normal = (await cotizar()).datos.cotizacion;
    const comfort = (await cotizar({ categoria: 'comfort' })).datos.cotizacion;
    const premium = (await cotizar({ categoria: 'premium' })).datos.cotizacion;
    expect(comfort.categoria).toBe('comfort');
    expect(comfort.total).toBeGreaterThan(normal.total);
    expect(premium.total).toBeGreaterThan(comfort.total);
    // Las opciones salen del mismo trayecto y coinciden con cotizar cada una.
    expect(normal.opciones).toEqual([
      { categoria: 'estandar', total: normal.total },
      { categoria: 'comfort', total: comfort.total },
      { categoria: 'premium', total: premium.total },
    ]);
  });

  it('una categoría que no es de Carro no se cotiza en Moto', async () => {
    const { m, cliente } = await ciudad({ comfortPb: 12_500 });
    const r = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', categoria: 'comfort', origen: ORIGEN, destino: DESTINO },
      cliente.token,
    );
    expect(r.estado).toBe(409);
  });

  it('un viaje Comfort solo va a un carro Comfort o mejor; uno Premium, solo a Premium', async () => {
    const { m, cotizar, pedir } = await ciudad({ comfortPb: 12_500, premiumPb: 18_000 });
    const economico = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const comfort = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    await sql(m, "UPDATE vehiculos SET categoria = 'comfort' WHERE id = ?", comfort.vehiculo);
    const cot = (await cotizar({ categoria: 'premium' })).datos.cotizacion;
    const id = await pedir(cot.id);
    // Nadie tiene carro Premium: ninguno de los dos lo puede tomar.
    expect(await economico.paso(id, 'aceptar')).toBe(409);
    expect(await comfort.paso(id, 'aceptar')).toBe(409);
    const otra = await m.cuenta('cliente', 'Carla Comfort');
    const cot2 = (await cotizar({ categoria: 'comfort' }, otra)).datos.cotizacion;
    const id2 = await pedir(cot2.id, otra);
    expect(await economico.paso(id2, 'aceptar')).toBe(409);
    expect(await comfort.paso(id2, 'aceptar')).toBe(200);
  });

  it('un carro mejor recibe los viajes económicos solo si su conductor no lo apagó', async () => {
    const { m, cotizar, pedir } = await ciudad({ comfortPb: 12_500 });
    const comfort = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    await sql(m, "UPDATE vehiculos SET categoria = 'comfort' WHERE id = ?", comfort.vehiculo);
    // El conductor apaga los viajes de categorías menores desde su app.
    const r = await m.llamar(
      'PUT',
      `/datos/conductor/vehiculos/${comfort.vehiculo}/categorias-menores`,
      { acepta: false },
      comfort.token,
    );
    expect(r.estado).toBe(200);
    const id = await pedir((await cotizar()).datos.cotizacion.id);
    expect(await comfort.paso(id, 'aceptar')).toBe(409);
    await m.llamar(
      'PUT',
      `/datos/conductor/vehiculos/${comfort.vehiculo}/categorias-menores`,
      { acepta: true },
      comfort.token,
    );
    // Con el interruptor encendido, la siguiente vuelta del despacho sí se lo ofrece.
    const { repartirOperaciones } = await import('../operaciones');
    await repartirOperaciones(undefined, m.DB);
    expect(await comfort.paso(id, 'aceptar')).toBe(200);
  });

  it('al aprobar un carro se le pone la categoría que cumple, y Premium la decide el equipo', async () => {
    const hoy = new Date('2026-11-14T00:00:00Z');
    const carro = (anio: number) => ({ tipo: 'carro', anio, plazas: 4 });
    // EE. UU.: Comfort hasta 8 años; Premium hasta 6 y solo si el equipo lo dice.
    expect(categoriaAlAprobar('US', carro(2022), undefined, hoy)).toBe('comfort');
    expect(categoriaAlAprobar('US', carro(2015), undefined, hoy)).toBe('estandar');
    expect(categoriaAlAprobar('US', carro(2022), 'premium', hoy)).toBe('premium');
    expect(categoriaAlAprobar('US', carro(2022), 'estandar', hoy)).toBe('estandar');
    expect(() => categoriaAlAprobar('US', carro(2019), 'premium', hoy)).toThrow(/no cumple/);
    // Venezuela: el parque es más viejo (Comfort hasta 12 años).
    expect(categoriaAlAprobar('VE', carro(2015), undefined, hoy)).toBe('comfort');
    expect(categoriaAlAprobar('VE', carro(2010), undefined, hoy)).toBe('estandar');
    // Una moto nunca es Comfort.
    expect(categoriaAlAprobar('US', { tipo: 'moto', anio: 2024, plazas: 1 }, undefined, hoy)).toBe(
      'estandar',
    );
    expect(() =>
      categoriaAlAprobar('US', { tipo: 'moto', anio: 2024, plazas: 1 }, 'comfort', hoy),
    ).toThrow(/Solo un carro/);
  });

  it('el equipo cambia la categoría de un carro por el panel, con sus requisitos', async () => {
    const { m, admin } = await ciudad();
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const poner = (categoria: string) =>
      m.llamar(
        'PUT',
        `/datos/admin/vehiculos/${c.vehiculo}/categoria`,
        { categoria, motivo: 'Revisión del carro' },
        admin.token,
      );
    expect((await poner('premium')).datos.categoria).toBe('premium');
    await sql(m, 'UPDATE vehiculos SET anio = 2012 WHERE id = ?', c.vehiculo);
    expect((await poner('comfort')).estado).toBe(422);
    const lista = await m.llamar('GET', '/datos/conductor/vehiculos', undefined, c.token);
    expect(lista.datos.vehiculos[0].categoria).toBe('premium');
    expect(lista.datos.vehiculos[0].aceptaMenores).toBe(true);
    expect(lista.datos.requisitosCategoria.comfort.antiguedadMaxima).toBe(8);
  });
});

describe('Categorías de Carro: lo que encontró la revisión', () => {
  it('volver a aprobar un carro Premium no le quita su categoría', async () => {
    const { m, admin } = await ciudad();
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    await m.llamar(
      'PUT',
      `/datos/admin/vehiculos/${c.vehiculo}/categoria`,
      { categoria: 'premium', motivo: 'Revisión del carro' },
      admin.token,
    );
    const revisar = (cuerpo: object) =>
      m.llamar('PUT', `/datos/admin/vehiculos/${c.vehiculo}`, cuerpo, admin.token);
    expect((await revisar({ estado: 'suspendido', motivo: 'Papeles por renovar' })).estado).toBe(
      200,
    );
    expect((await revisar({ estado: 'aprobado' })).datos.categoria).toBe('premium');
    // Si con los años deja de cumplir, baja sola a la que le toque.
    await sql(m, 'UPDATE vehiculos SET anio = 2012 WHERE id = ?', c.vehiculo);
    expect((await revisar({ estado: 'aprobado' })).datos.categoria).toBe('estandar');
  });

  it('un carro Premium de seis plazas que apagó los viajes de abajo no recibe un XL', async () => {
    const { m, cotizar, pedir } = await ciudad({ xlPb: 15_000, premiumPb: 18_000 });
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    await sql(
      m,
      "UPDATE vehiculos SET plazas = 7, categoria = 'premium', acepta_menores = 0 WHERE id = ?",
      c.vehiculo,
    );
    const id = await pedir((await cotizar({ categoria: 'xl' })).datos.cotizacion.id);
    expect(await c.paso(id, 'aceptar')).toBe(409);
  });

  it('la tarifa dinámica solo la toca el equipo', async () => {
    const { m, cliente } = await ciudad({ topeDinamicoPb: 15_000 });
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    for (const token of [cliente.token, c.token]) {
      expect(
        (await m.llamar('GET', '/datos/admin/viajes/dinamica/carro/US-FL-MIAMI', undefined, token))
          .estado,
      ).toBe(403);
      expect(
        (
          await m.llamar(
            'PUT',
            '/datos/admin/viajes/dinamica/carro/US-FL-MIAMI',
            { modo: 'apagada', motivo: 'No soy del equipo' },
            token,
          )
        ).estado,
      ).toBe(403);
    }
  });
});

describe('Tarifa dinámica de Carro (C-CARRO-DINAMICA)', () => {
  const fijar = (m: Mundo, token: string, cuerpo: object) =>
    m.llamar('PUT', '/datos/admin/viajes/dinamica/carro/US-FL-MIAMI', cuerpo, token);

  it('con el tope de la ciudad en 1 (como nace) no hay recargo aunque alguien lo fije', async () => {
    const { m, admin, cotizar } = await ciudad();
    const r = await fijar(m, admin.token, {
      modo: 'manual',
      multiplicadorPb: 15_000,
      minutos: 30,
      motivo: 'Prueba',
    });
    expect(r.estado).toBe(422);
    const cot = (await cotizar()).datos.cotizacion;
    expect(cot.multiplicadorPb).toBe(10_000);
    expect(cot.desglose.dinamico).toBe(0);
  });

  it('fijada a mano dentro del tope, el pasajero la ve antes de pedir y el conductor en la oferta', async () => {
    const { m, admin, cotizar, pedir } = await ciudad({ topeDinamicoPb: 15_000 });
    const normal = (await cotizar()).datos.cotizacion;
    // Por encima del tope de la ciudad no se deja.
    expect(
      (
        await fijar(m, admin.token, {
          modo: 'manual',
          multiplicadorPb: 20_000,
          minutos: 30,
          motivo: 'Demasiado',
        })
      ).estado,
    ).toBe(422);
    const r = await fijar(m, admin.token, {
      modo: 'manual',
      multiplicadorPb: 15_000,
      minutos: 30,
      motivo: 'Concierto en el estadio',
    });
    expect(r.datos.dinamica.multiplicadorPb).toBe(15_000);
    const cot = (await cotizar()).datos.cotizacion;
    expect(cot.multiplicadorPb).toBe(15_000);
    expect(cot.desglose.dinamico).toBeGreaterThan(0);
    expect(cot.total).toBeGreaterThan(normal.total);
    // El conductor ve en la oferta que el viaje lleva tarifa dinámica.
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    await pedir(cot.id);
    const ofertas = await m.llamar(
      'GET',
      '/datos/conductor/operaciones/ofertas',
      undefined,
      c.token,
    );
    expect(ofertas.datos.ofertas[0].multiplicadorPb).toBe(15_000);
    // Apagada (emergencia): precio normal de inmediato.
    await fijar(m, admin.token, { modo: 'apagada', motivo: 'Emergencia en la ciudad' });
    const otra = await m.cuenta('cliente', 'Otra Persona');
    expect((await cotizar({}, otra)).datos.cotizacion.multiplicadorPb).toBe(10_000);
  });

  it('el tope del país manda sobre el de la ciudad', async () => {
    // EE. UU.: tope del país 2,0. Una tarifa con tope 3,0 y un 3,0 guardado a la fuerza cotiza a 2,0.
    const { m, cotizar } = await ciudad({ topeDinamicoPb: 30_000 });
    await sql(
      m,
      "INSERT INTO dinamica_zona (servicio_id, zona_id, multiplicador_pb, modo, vale_hasta) VALUES ('carro', 'US-FL-MIAMI', 30000, 'manual', datetime('now', '+1 hour'))",
    );
    expect((await cotizar()).datos.cotizacion.multiplicadorPb).toBe(20_000);
  });

  it('un recargo vencido no se cobra (si el reloj se para, se cae solo)', async () => {
    const { m, cotizar } = await ciudad({ topeDinamicoPb: 15_000 });
    await sql(
      m,
      "INSERT INTO dinamica_zona (servicio_id, zona_id, multiplicador_pb, modo, vale_hasta) VALUES ('carro', 'US-FL-MIAMI', 15000, 'auto', datetime('now', '-1 minute'))",
    );
    expect((await cotizar()).datos.cotizacion.multiplicadorPb).toBe(10_000);
  });

  it('el reloj sube el multiplicador con la demanda y escribe solo cuando cambia', async () => {
    const { m, cotizar, pedir } = await ciudad({ topeDinamicoPb: 20_000 });
    // Sin demanda: nada que escribir.
    expect((await recalcularDinamica(m.DB)).escritas).toBe(0);
    // Tres personas piden y no hay ningún conductor: demanda 3, oferta 0.
    const pedidos: { token: string; id: string }[] = [];
    for (const nombre of ['Ana Uno', 'Beto Dos', 'Caro Tres']) {
      const p = await m.cuenta('cliente', nombre);
      pedidos.push({
        token: p.token,
        id: await pedir((await cotizar({}, p)).datos.cotizacion.id, p),
      });
    }
    expect((await recalcularDinamica(m.DB)).escritas).toBe(1);
    const fila = await m.DB.prepare(
      "SELECT multiplicador_pb, demanda, oferta, modo FROM dinamica_zona WHERE servicio_id = 'carro'",
    ).first<{ multiplicador_pb: number; demanda: number; oferta: number; modo: string }>();
    expect(fila).toEqual({ multiplicador_pb: 20_000, demanda: 3, oferta: 0, modo: 'auto' });
    // La vuelta siguiente, con lo mismo, no escribe (presupuesto de escrituras).
    expect((await recalcularDinamica(m.DB)).escritas).toBe(0);
    const nuevo = await m.cuenta('cliente', 'Dani Cuatro');
    expect((await cotizar({}, nuevo)).datos.cotizacion.multiplicadorPb).toBe(20_000);
    // Se acaba la demanda: vuelve a precio normal con UNA escritura y después ninguna.
    for (const [i, p] of pedidos.entries()) {
      const r = await m.crudo(`/datos/viajes/${p.id}/cancelar`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${p.token}`,
          'content-type': 'application/json',
          'idempotency-key': `cancelar-dinamica-${i}`,
        },
        body: '{}',
      });
      expect(r.status).toBe(200);
    }
    expect((await recalcularDinamica(m.DB)).escritas).toBe(1);
    expect((await recalcularDinamica(m.DB)).escritas).toBe(0);
    const despues = await m.cuenta('cliente', 'Eva Cinco');
    expect((await cotizar({}, despues)).datos.cotizacion.multiplicadorPb).toBe(10_000);
  });

  it('una ciudad sin tarifa dinámica encendida no le cuesta nada al reloj', async () => {
    const { m, cotizar, pedir } = await ciudad();
    for (const nombre of ['Ana Uno', 'Beto Dos', 'Caro Tres']) {
      const p = await m.cuenta('cliente', nombre);
      await pedir((await cotizar({}, p)).datos.cotizacion.id, p);
    }
    expect((await recalcularDinamica(m.DB)).escritas).toBe(0);
    expect(
      await m.DB.prepare('SELECT COUNT(*) AS n FROM dinamica_zona').first<{ n: number }>(),
    ).toEqual({ n: 0 });
  });

  it('lo fijado a mano manda mientras dura y después vuelve a automático', async () => {
    const { m, admin } = await ciudad({ topeDinamicoPb: 20_000 });
    await fijar(m, admin.token, {
      modo: 'manual',
      multiplicadorPb: 12_000,
      minutos: 30,
      motivo: 'Lluvia',
    });
    expect((await recalcularDinamica(m.DB)).escritas).toBe(0);
    await sql(m, "UPDATE dinamica_zona SET vale_hasta = datetime('now', '-1 minute')");
    expect((await recalcularDinamica(m.DB)).escritas).toBe(1);
    const f = await m.DB.prepare('SELECT modo, multiplicador_pb FROM dinamica_zona').first();
    expect(f).toEqual({ modo: 'auto', multiplicador_pb: 10_000 });
    const estado = await m.llamar(
      'GET',
      '/datos/admin/viajes/dinamica/carro/US-FL-MIAMI',
      undefined,
      admin.token,
    );
    expect(estado.datos.dinamica).toMatchObject({ encendida: true, topePb: 20_000, modo: 'auto' });
  });
});

describe('Paradas de un viaje (C-VIAJE-PARADAS)', () => {
  it('una parada sube el precio; el máximo del país, la ciudad y los envíos se respetan', async () => {
    const { m, cliente, cotizar } = await ciudad();
    const directo = (await cotizar()).datos.cotizacion;
    const conParada = (await cotizar({ paradas: [PARADA] })).datos.cotizacion;
    expect(conParada.paradas).toEqual([PARADA]);
    expect(conParada.distanciaM).toBeGreaterThan(directo.distanciaM);
    expect(conParada.total).toBeGreaterThan(directo.total);
    // EE. UU.: hasta 3 paradas.
    expect((await cotizar({ paradas: [PARADA, PARADA_2, PARADA, PARADA_2] })).estado).toBe(422);
    // Una parada en otra ciudad no entra.
    const lejos = { lat: 40.7128, lng: -74.006, direccion: 'Otra ciudad' };
    expect((await cotizar({ paradas: [lejos] })).estado).toBe(422);
    // Un envío va de un punto a otro.
    const envio = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'envios', origen: ORIGEN, destino: DESTINO, paradas: [PARADA] },
      cliente.token,
    );
    expect([409, 422]).toContain(envio.estado);
  });

  it('el viaje nace con sus paradas y el conductor no termina sin hacerlas; la espera de más se cobra', async () => {
    const { m, cliente, cotizar, pedir } = await ciudad();
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const cot = (await cotizar({ paradas: [PARADA] })).datos.cotizacion;
    const id = await pedir(cot.id);
    const oferta = (
      await m.llamar('GET', '/datos/conductor/operaciones/ofertas', undefined, c.token)
    ).datos.ofertas[0];
    expect(oferta.paradas).toEqual([PARADA.direccion]);
    expect(await c.paso(id, 'aceptar')).toBe(200);
    const viaje = (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos
      .viaje;
    expect(await c.paso(id, 'llegue')).toBe(200);
    expect(await c.paso(id, 'iniciar', { pin: viaje.pin })).toBe(200);
    // Con la parada pendiente no se termina.
    expect((await terminar(m, c.token, id, 'terminar-antes-1')).estado).toBe(409);
    // Lejos de la parada no puede marcar que llegó.
    expect(await c.paso(id, 'paradas/1/llegue')).toBe(409);
    expect(await c.paso(id, 'paradas/1/seguir')).toBe(409);
    await mover(m, c.id, PARADA);
    expect(await c.paso(id, 'paradas/1/llegue')).toBe(200);
    expect(await c.paso(id, 'paradas/1/llegue')).toBe(200); // doble toque
    // Detenido en la parada tampoco se termina.
    expect((await terminar(m, c.token, id, 'terminar-antes-2')).estado).toBe(409);
    // El pasajero tardó 5 minutos: 2 gratis y 3 cobrados a 50 el minuto.
    await sql(
      m,
      "UPDATE paradas_viaje SET llego_en = datetime('now', '-300 seconds') WHERE operacion_id = ?",
      id,
    );
    expect(await c.paso(id, 'paradas/1/seguir')).toBe(200);
    const actual = (
      await m.llamar('GET', '/datos/conductor/operaciones/actual', undefined, c.token)
    ).datos.operacion;
    expect(actual.paradas).toMatchObject([{ orden: 1, estado: 'visitada' }]);
    const delPasajero = (await m.llamar('GET', `/datos/viajes/${id}`, undefined, cliente.token))
      .datos.viaje;
    expect(delPasajero.paradas).toMatchObject([{ orden: 1, estado: 'visitada' }]);
    const fin = await terminar(m, c.token, id, 'terminar-ya-1');
    expect(fin.estado).toBe(200);
    expect(fin.datos.totalFinal).toBe(cot.total + 150);
  });

  it('el pasajero agrega una parada en pleno viaje: ve el precio nuevo, lo confirma y queda', async () => {
    const { m, cliente, cotizar, pedir } = await ciudad();
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const cot = (await cotizar()).datos.cotizacion;
    const id = await pedir(cot.id);
    await c.paso(id, 'aceptar');
    const viaje = (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos
      .viaje;
    await c.paso(id, 'llegue');
    await c.paso(id, 'iniciar', { pin: viaje.pin });
    const cambiar = (cuerpo: object) =>
      m.llamar('POST', `/datos/viajes/${id}/paradas`, cuerpo, cliente.token);
    // Solo mirar el precio no cambia nada.
    const vista = (await cambiar({ paradas: [PARADA] })).datos.cambio;
    expect(vista).toMatchObject({ totalActual: cot.total, aplicado: false, permitido: true });
    expect(vista.totalNuevo).toBeGreaterThan(cot.total);
    expect(
      await m.DB.prepare('SELECT COUNT(*) AS n FROM paradas_viaje').first<{ n: number }>(),
    ).toEqual({ n: 0 });
    // Confirmar con un precio que no es el que calcula el servidor: no pasa.
    expect(
      (await cambiar({ paradas: [PARADA], confirmar: true, totalVisto: vista.totalNuevo - 1 }))
        .estado,
    ).toBe(409);
    const hecho = await cambiar({
      paradas: [PARADA],
      confirmar: true,
      totalVisto: vista.totalNuevo,
    });
    expect(hecho.datos.cambio.aplicado).toBe(true);
    expect(hecho.datos.paradas).toMatchObject([{ orden: 1, estado: 'pendiente' }]);
    // El conductor hace la parada y cobra el precio nuevo.
    await mover(m, c.id, PARADA);
    expect(await c.paso(id, 'paradas/1/llegue')).toBe(200);
    expect(await c.paso(id, 'paradas/1/seguir')).toBe(200);
    // Con una parada hecha, el pasajero agrega otra: la hecha no se toca.
    const otra = (await cambiar({ paradas: [PARADA_2] })).datos.cambio;
    await cambiar({ paradas: [PARADA_2], confirmar: true, totalVisto: otra.totalNuevo });
    const filas = await m.DB.prepare(
      'SELECT orden, estado FROM paradas_viaje WHERE operacion_id = ? ORDER BY orden',
    )
      .bind(id)
      .all();
    expect(filas.results).toEqual([
      { orden: 1, estado: 'visitada' },
      { orden: 2, estado: 'pendiente' },
    ]);
    // El conductor la salta (el pasajero ya no quiere parar): el precio baja y puede terminar.
    expect(await c.paso(id, 'paradas/2/saltar')).toBe(200);
    const fin = await terminar(m, c.token, id, 'terminar-ya-2');
    expect(fin.estado).toBe(200);
    expect(fin.datos.totalFinal).toBe(vista.totalNuevo);
    const cambios = await m.DB.prepare(
      'SELECT actor FROM cambios_viaje WHERE operacion_id = ? ORDER BY rowid',
    )
      .bind(id)
      .all();
    expect(cambios.results.map((x) => x.actor)).toEqual(['cliente', 'cliente', 'conductor']);
  });

  it('con tarjeta el precio no sube después de pedir; el viaje de otro no se toca', async () => {
    const { m, cliente, cotizar, pedir } = await ciudad();
    const id = await pedir((await cotizar()).datos.cotizacion.id);
    await sql(m, "UPDATE viajes SET metodo_pago = 'tarjeta' WHERE operacion_id = ?", id);
    const vista = await m.llamar(
      'POST',
      `/datos/viajes/${id}/paradas`,
      { paradas: [PARADA] },
      cliente.token,
    );
    expect(vista.datos.cambio).toMatchObject({ permitido: false, aplicado: false });
    expect(vista.datos.cambio.motivo).toMatch(/tarjeta/);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/viajes/${id}/paradas`,
          { paradas: [PARADA], confirmar: true },
          cliente.token,
        )
      ).estado,
    ).toBe(409);
    const intruso = await m.cuenta('cliente', 'Otra Persona');
    expect(
      (await m.llamar('POST', `/datos/viajes/${id}/paradas`, { paradas: [] }, intruso.token))
        .estado,
    ).toBe(404);
  });

  it('un viaje terminado ya no admite paradas y el máximo cuenta las ya hechas', async () => {
    const { m, cliente, cotizar, pedir } = await ciudad();
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const id = await pedir(
      (await cotizar({ paradas: [PARADA, PARADA_2, PARADA] })).datos.cotizacion.id,
    );
    await c.paso(id, 'aceptar');
    const viaje = (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos
      .viaje;
    await c.paso(id, 'llegue');
    await c.paso(id, 'iniciar', { pin: viaje.pin });
    await mover(m, c.id, PARADA);
    await c.paso(id, 'paradas/1/llegue');
    await c.paso(id, 'paradas/1/seguir');
    // Una hecha + tres nuevas pasa del máximo (3).
    const r = await m.llamar(
      'POST',
      `/datos/viajes/${id}/paradas`,
      { paradas: [PARADA_2, PARADA, PARADA_2] },
      cliente.token,
    );
    expect(r.estado).toBe(422);
    // Quita las que faltan y el conductor termina.
    const sin = (
      await m.llamar('POST', `/datos/viajes/${id}/paradas`, { paradas: [] }, cliente.token)
    ).datos.cambio;
    await m.llamar(
      'POST',
      `/datos/viajes/${id}/paradas`,
      { paradas: [], confirmar: true, totalVisto: sin.totalNuevo },
      cliente.token,
    );
    expect((await terminar(m, c.token, id, 'terminar-ya-3')).estado).toBe(200);
    expect(
      (await m.llamar('POST', `/datos/viajes/${id}/paradas`, { paradas: [PARADA] }, cliente.token))
        .estado,
    ).toBe(409);
  });

  it('un «Seguir» olvidado no le cobra horas al pasajero, y otro conductor no toca las paradas', async () => {
    const { m, cliente, cotizar, pedir } = await ciudad();
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const cot = (await cotizar({ paradas: [PARADA] })).datos.cotizacion;
    const id = await pedir(cot.id);
    await c.paso(id, 'aceptar');
    const viaje = (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos
      .viaje;
    await c.paso(id, 'llegue');
    await c.paso(id, 'iniciar', { pin: viaje.pin });
    // Otro conductor no puede marcar ni saltar las paradas de este viaje.
    const intruso = await conductorDeMoto(m, PARADA, 'US-FL-MIAMI', 'carro');
    expect(await intruso.paso(id, 'paradas/1/llegue')).toBe(404);
    expect(await intruso.paso(id, 'paradas/1/saltar')).toBe(404);
    await mover(m, c.id, PARADA);
    expect(await c.paso(id, 'paradas/1/llegue')).toBe(200);
    // Se quedó tres horas «en la parada»: se cobran 10 minutos (a 50), no tres horas.
    await sql(
      m,
      "UPDATE paradas_viaje SET llego_en = datetime('now', '-3 hours') WHERE operacion_id = ?",
      id,
    );
    expect(await c.paso(id, 'paradas/1/seguir')).toBe(200);
    expect(await c.paso(id, 'paradas/1/seguir')).toBe(200); // doble toque
    expect(await c.paso(id, 'paradas/1/saltar')).toBe(409); // ya se hizo
    const fin = await terminar(m, c.token, id, 'terminar-tope-1');
    expect(fin.datos.totalFinal).toBe(cot.total + 500);
  });

  it('el pasajero no puede cambiar las paradas sin fin', async () => {
    const { m, cliente, cotizar, pedir } = await ciudad();
    const id = await pedir((await cotizar()).datos.cotizacion.id);
    const cambiar = async (paradas: object[]) => {
      const vista = await m.llamar(
        'POST',
        `/datos/viajes/${id}/paradas`,
        { paradas },
        cliente.token,
      );
      return m.llamar(
        'POST',
        `/datos/viajes/${id}/paradas`,
        { paradas, confirmar: true, totalVisto: vista.datos.cambio.totalNuevo },
        cliente.token,
      );
    };
    for (let i = 0; i < CAMBIOS_PARADAS_MAXIMOS; i++)
      expect((await cambiar(i % 2 ? [] : [PARADA])).estado, `cambio ${i + 1}`).toBe(200);
    expect((await cambiar([PARADA])).estado).toBe(409);
  });

  it('la comisión apartada del conductor se pone al día cuando el precio cambia', async () => {
    const { m, cliente, cotizar, pedir } = await ciudad();
    await sql(
      m,
      `INSERT INTO politicas_financieras (id, nombre, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('p-us-car', 'Carro US', 'car', 'conductor', 'US', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', '2026-01-01 00:00:00', 1)`,
    );
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    await sql(
      m,
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('rec-1', ?, 'prepago', 'US', 'USD', 5000, 'recarga', 'recarga:prueba')",
      c.id,
    );
    const cot = (await cotizar()).datos.cotizacion;
    const id = await pedir(cot.id);
    expect(await c.paso(id, 'aceptar')).toBe(200);
    const antes = (await reservaDeViaje(m.DB, id, c.id)).monto;
    expect(antes).toBe(Math.round(cot.total * 0.1));
    const vista = (
      await m.llamar('POST', `/datos/viajes/${id}/paradas`, { paradas: [PARADA] }, cliente.token)
    ).datos.cambio;
    await m.llamar(
      'POST',
      `/datos/viajes/${id}/paradas`,
      { paradas: [PARADA], confirmar: true, totalVisto: vista.totalNuevo },
      cliente.token,
    );
    expect((await reservaDeViaje(m.DB, id, c.id)).monto).toBe(Math.round(vista.totalNuevo * 0.1));
    // Y si la quita, lo apartado vuelve a lo de antes.
    const sin = (
      await m.llamar('POST', `/datos/viajes/${id}/paradas`, { paradas: [] }, cliente.token)
    ).datos.cambio;
    await m.llamar(
      'POST',
      `/datos/viajes/${id}/paradas`,
      { paradas: [], confirmar: true, totalVisto: sin.totalNuevo },
      cliente.token,
    );
    expect((await reservaDeViaje(m.DB, id, c.id)).monto).toBe(antes);
    const saldo = await m.DB.prepare(
      "SELECT COALESCE(SUM(monto), 0) AS n FROM libro WHERE cuenta_id = ? AND bolsillo = 'prepago'",
    )
      .bind(c.id)
      .first<{ n: number }>();
    expect(saldo?.n).toBe(5000 - antes);
  });

  it('el reajuste de la comisión nunca deja el saldo en negativo, no se repite y no inventa reservas', async () => {
    const { m, cotizar, pedir } = await ciudad();
    await sql(
      m,
      `INSERT INTO politicas_financieras (id, nombre, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('p-us-car', 'Carro US', 'car', 'conductor', 'US', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', '2026-01-01 00:00:00', 1)`,
    );
    const c = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    const cot = (await cotizar()).datos.cotizacion;
    const comision = Math.round(cot.total * 0.1);
    // Saldo justo para la comisión del precio de ahora: nada más.
    await sql(
      m,
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('rec-2', ?, 'prepago', 'US', 'USD', ?, 'recarga', 'recarga:justa')",
      c.id,
      comision,
    );
    const id = await pedir(cot.id);
    expect(await c.paso(id, 'aceptar')).toBe(200);
    const contexto = {
      servicio: 'car' as const,
      pais: 'US',
      ciudad: 'US-FL-MIAMI',
      moneda: 'USD',
      operacionId: id,
      conductorId: c.id,
    };
    const saldo = async () =>
      (
        await m.DB.prepare(
          "SELECT COALESCE(SUM(monto), 0) AS n FROM libro WHERE cuenta_id = ? AND bolsillo = 'prepago'",
        )
          .bind(c.id)
          .first<{ n: number }>()
      )?.n;
    // El precio se duplica y no alcanza el saldo: lo apartado se queda como estaba, sin negativo.
    expect(
      await reajustarReservaViaje(m.DB, { ...contexto, valor: cot.total * 2, cambioId: 'k1' }),
    ).toBe(0);
    expect((await reservaDeViaje(m.DB, id, c.id)).monto).toBe(comision);
    expect(await saldo()).toBe(0);
    // El mismo precio: nada que mover.
    expect(
      await reajustarReservaViaje(m.DB, { ...contexto, valor: cot.total, cambioId: 'k2' }),
    ).toBe(0);
    // Baja a la mitad: la diferencia vuelve al prepago, y repetir el mismo cambio no la devuelve dos veces.
    const mitad = Math.round((cot.total / 2) * 0.1);
    expect(
      await reajustarReservaViaje(m.DB, { ...contexto, valor: cot.total / 2, cambioId: 'k3' }),
    ).toBe(mitad - comision);
    expect((await reservaDeViaje(m.DB, id, c.id)).monto).toBe(mitad);
    expect(await saldo()).toBe(comision - mitad);
    // Un conductor sin nada apartado en ese viaje no recibe ajustes.
    const otro = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    expect(
      await reajustarReservaViaje(m.DB, {
        ...contexto,
        conductorId: otro.id,
        valor: cot.total * 2,
        cambioId: 'k4',
      }),
    ).toBe(0);
    // Sin política de comisión (otra moneda) tampoco se toca.
    expect(
      await reajustarReservaViaje(m.DB, {
        ...contexto,
        moneda: 'COP',
        valor: cot.total * 2,
        cambioId: 'k5',
      }),
    ).toBe(0);
    expect(await saldo()).toBe(comision - mitad);
  });
});
