import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';
import { repartirOperaciones } from './operaciones';
import {
  PASOS_CONDUCTOR,
  PASOS_PASAJERO,
  type DatosAvisoViaje,
  textoAvisoViaje,
} from './avisosViaje';

/**
 * C-AVISOS-VIAJE (24 nov 2026) — todos los países. El pasajero de Moto, Carro y Envíos no recibía
 * NINGÚN aviso de su viaje con la app cerrada y su campana quedaba vacía. Ahora cada paso le avisa
 * (y al conductor, si el pasajero cancela), UNA vez por viaje y por paso, y queda en su campana.
 */
afterEach(() => vi.unstubAllGlobals());

function sinExpo() {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('exp.host')) {
      const n = (JSON.parse(String(init?.body)) as unknown[]).length;
      return new Response(
        JSON.stringify({ data: Array.from({ length: n }, () => ({ status: 'ok' })) }),
        { status: 200 },
      );
    }
    return new Response('{}', { status: 200 });
  });
}

const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

async function escenario() {
  sinExpo();
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
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'carro',
      zona: 'US-FL-MIAMI',
      tarifa: { base: 300, porKm: 120, porMinuto: 25, minimo: 800 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  const cond = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
  const cot = (
    await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
      cliente.token,
    )
  ).datos.cotizacion;
  const id = (
    await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo' },
      cliente.token,
    )
  ).datos.viaje.id as string;
  const avisos = async (usuario: string, paso: string) =>
    (
      await m.DB.prepare(
        `SELECT titulo_es, cuerpo_es, titulo_en, cuerpo_en, datos_json FROM avisos_enviados
          WHERE usuario_id = ? AND json_extract(datos_json, '$.tipo') = 'viaje'
            AND json_extract(datos_json, '$.paso') = ?`,
      )
        .bind(usuario, paso)
        .all<{
          titulo_es: string;
          cuerpo_es: string;
          titulo_en: string;
          cuerpo_en: string;
          datos_json: string;
        }>()
    ).results;
  const pin = async () =>
    (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos.viaje.pin as
      string | null;
  return { m, cliente, cond, id, avisos, pin };
}

describe('C-AVISOS-VIAJE · el pasajero recibe cada paso de su viaje', () => {
  it('aceptó (con nombre, vehículo y placa), llegó, empezó y terminó: uno por paso, sin repetir', async () => {
    const { m, cliente, cond, id, avisos, pin } = await escenario();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const [acepto] = await avisos(cliente.id, 'aceptado');
    expect(acepto?.titulo_es).toBe('Tu conductor aceptó y va por ti');
    expect(acepto?.cuerpo_es).toContain('Conductor');
    expect(acepto?.cuerpo_es).toContain('Toyota Corolla');
    const placa = (
      await m.DB.prepare('SELECT placa FROM vehiculos WHERE id = ?')
        .bind(cond.vehiculo)
        .first<{ placa: string }>()
    )?.placa;
    expect(acepto?.cuerpo_es).toContain(`placa ${placa}`);
    expect(acepto?.titulo_en).toBe('Your driver accepted and is on the way');
    expect(JSON.parse(String(acepto?.datos_json))).toEqual({
      tipo: 'viaje',
      viajeId: id,
      paso: 'aceptado',
      servicio: 'carro',
    });

    expect(await cond.paso(id, 'llegue')).toBe(200);
    // Un reintento del mismo paso (respuesta perdida, doble toque) no repite el aviso.
    expect(await cond.paso(id, 'llegue')).toBe(200);
    expect(await avisos(cliente.id, 'llego')).toHaveLength(1);
    expect((await avisos(cliente.id, 'llego'))[0]?.titulo_es).toBe('Tu conductor llegó');

    const p = await pin();
    expect(await cond.paso(id, 'iniciar', p ? { pin: p } : {})).toBe(200);
    expect((await avisos(cliente.id, 'en_curso'))[0]?.titulo_es).toBe('Empezó tu viaje');

    expect(await cond.paso(id, 'terminar')).toBe(200);
    expect(await cond.paso(id, 'terminar')).toBe(200);
    const fin = await avisos(cliente.id, 'terminado');
    expect(fin).toHaveLength(1);
    expect(fin[0]?.titulo_es).toBe('Viaje terminado');
    expect(fin[0]?.cuerpo_es).toMatch(/calificar/);
    expect(await avisos(cliente.id, 'aceptado')).toHaveLength(1);
  });

  it('la campana del cliente los trae sin leer y va a cero al abrirla', async () => {
    const { m, cliente, cond, id } = await escenario();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    const antes = (
      await m.llamar('GET', '/datos/mis-avisos?historial=1', undefined, cliente.token, {
        'x-idioma': 'es',
      })
    ).datos;
    const deViaje = (antes.avisos as Record<string, any>[]).filter(
      (a) => a.tipo === 'aviso' && a.datos?.tipo === 'viaje',
    );
    expect(deViaje.map((a) => a.titulo)).toEqual(
      expect.arrayContaining(['Tu conductor aceptó y va por ti', 'Tu conductor llegó']),
    );
    expect(deViaje.every((a) => a.leido === false)).toBe(true);
    expect(Number(antes.sinLeer)).toBeGreaterThanOrEqual(2);
    const masNuevo = (antes.avisos as { en: string }[])[0]?.en;
    await m.llamar(
      'POST',
      '/datos/campana/visto',
      { campana: 'cliente', hasta: masNuevo },
      cliente.token,
    );
    const despues = (
      await m.llamar('GET', '/datos/mis-avisos?historial=1', undefined, cliente.token)
    ).datos;
    expect(despues.sinLeer).toBe(0);
  });

  it('el conductor suelta el viaje: «Tu conductor canceló, buscamos otro»', async () => {
    const { cliente, cond, id, avisos } = await escenario();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await cond.paso(id, 'liberar', { motivo: 'prueba' })).toBe(200);
    const [a] = await avisos(cliente.id, 'liberado');
    expect(a?.titulo_es).toBe('Tu conductor canceló, buscamos otro');
    expect(a?.titulo_en).toMatch(/canceled/);
  });

  it('el conductor pierde la señal: el pasajero sabe que le buscamos otro', async () => {
    const { m, cliente, cond, id, avisos } = await escenario();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    await m.DB.prepare(
      "UPDATE repartidores SET ubicacion_en = datetime('now', '-30 minutes') WHERE usuario_id = ?",
    )
      .bind(cond.id)
      .run();
    await m.DB.prepare(
      "UPDATE viajes SET asignado_en = datetime('now', '-30 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    await repartirOperaciones(m.extra as unknown as Env, m.DB);
    expect((await avisos(cliente.id, 'sin_senal'))[0]?.titulo_es).toBe(
      'Te buscamos otro conductor',
    );
  });

  it('nadie acepta a tiempo: «No encontramos conductor»', async () => {
    const { m, cliente, id, avisos } = await escenario();
    await m.DB.prepare(
      "UPDATE eventos_operacion SET creado_en = datetime('now', '-2 hours') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    await m.DB.prepare(
      "UPDATE operaciones SET creado_en = datetime('now', '-2 hours') WHERE id = ?",
    )
      .bind(id)
      .run();
    await repartirOperaciones(m.extra as unknown as Env, m.DB);
    expect((await avisos(cliente.id, 'sin_conductor'))[0]?.titulo_es).toBe(
      'No encontramos conductor',
    );
  });

  it('el pasajero no sale: «Tu conductor no te encontró»', async () => {
    const { m, cliente, cond, id, avisos } = await escenario();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(await cond.paso(id, 'llegue')).toBe(200);
    await m.DB.prepare(
      "UPDATE viajes SET llego_en = datetime('now', '-30 minutes') WHERE operacion_id = ?",
    )
      .bind(id)
      .run();
    expect(await cond.paso(id, 'no-se-presento')).toBe(200);
    expect((await avisos(cliente.id, 'no_show'))[0]?.titulo_es).toBe('Tu conductor no te encontró');
  });
});

describe('C-AVISOS-VIAJE · el conductor sabe que el pasajero canceló', () => {
  it('cancelar con conductor asignado le avisa a él, una vez', async () => {
    const { m, cliente, cond, id, avisos } = await escenario();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    const r = await m.llamar('POST', `/datos/viajes/${id}/cancelar`, {}, cliente.token, {
      'idempotency-key': 'cancelar-prueba-1',
    });
    expect(r.estado).toBe(200);
    await m.llamar('POST', `/datos/viajes/${id}/cancelar`, {}, cliente.token, {
      'idempotency-key': 'cancelar-prueba-1',
    });
    const a = await avisos(cond.id, 'cancelado_pasajero');
    expect(a).toHaveLength(1);
    expect(a[0]?.titulo_es).toBe('El pasajero canceló el viaje');
    expect(a[0]?.titulo_en).toBe('The rider canceled the trip');
  });

  it('cancelar mientras busca conductor no le avisa a nadie (la oferta se retira sola en su pantalla)', async () => {
    const { m, cliente, cond, id, avisos } = await escenario();
    const r = await m.llamar('POST', `/datos/viajes/${id}/cancelar`, {}, cliente.token, {
      'idempotency-key': 'cancelar-prueba-1',
    });
    expect(r.estado).toBe(200);
    expect(await avisos(cond.id, 'cancelado_pasajero')).toHaveLength(0);
  });
});

describe('C-AVISOS-VIAJE · los textos', () => {
  const datos: DatosAvisoViaje = {
    envio: false,
    conductor: 'Luis',
    vehiculo: 'Toyota Corolla',
    placa: 'ABC123',
  };
  for (const paso of [...PASOS_PASAJERO, ...PASOS_CONDUCTOR])
    for (const envio of [false, true])
      for (const i of ['es', 'en'] as const)
        it(`${paso} · ${envio ? 'envío' : 'viaje'} · ${i}: dice «conductor», sin montos ni lugares`, () => {
          const t = textoAvisoViaje(paso, { ...datos, envio }, i);
          expect(t.titulo.length).toBeGreaterThan(0);
          expect(t.cuerpo.length).toBeGreaterThan(0);
          const todo = `${t.titulo} ${t.cuerpo}`;
          expect(todo).not.toMatch(/[$€]|Bs\.?\s|USD|COP|VES|PEN|S\/\s|\d+[.,]\d{2}/);
          expect(todo).not.toMatch(/\b(Miami|Novi|Vigía|Caracas|Ica|Michigan|Florida)\b/i);
          expect(todo).not.toMatch(/repartidor|rider app|courier/i);
          if (paso !== 'cancelado_pasajero')
            expect(todo).toMatch(i === 'en' ? /driver|package|ride/i : /conductor|paquete|viaje/i);
        });

  it('envíos hablan del paquete', () => {
    expect(textoAvisoViaje('aceptado', { ...datos, envio: true }, 'es').titulo).toBe(
      'Tu conductor aceptó y va por tu paquete',
    );
    expect(textoAvisoViaje('terminado', { ...datos, envio: true }, 'es').titulo).toBe(
      'Paquete entregado',
    );
    expect(textoAvisoViaje('cancelado_pasajero', { ...datos, envio: true }, 'es').titulo).toBe(
      'El cliente canceló el envío',
    );
  });

  it('sin nombre ni vehículo, el texto no queda cojo', () => {
    const t = textoAvisoViaje(
      'aceptado',
      { envio: false, conductor: '', vehiculo: '', placa: '' },
      'es',
    );
    expect(t.cuerpo).toBe('Síguelo en vivo en la app.');
    expect(
      textoAvisoViaje('llego', { envio: false, conductor: '', vehiculo: '', placa: '' }, 'en')
        .cuerpo,
    ).toBe('Head to your pickup spot.');
  });
});

/**
 * El candado: toda transición de viaje del servidor (`cambiarEstadoViaje`, `liberarViaje`,
 * `aceptarOperacion`) avisa con `avisarPasoViaje` en las líneas que la siguen, o dice por escrito por
 * qué no (`C-AVISOS-VIAJE: sin aviso — motivo`). Un paso nuevo sin aviso pone esta prueba en rojo.
 */
describe('C-AVISOS-VIAJE · candado: ningún paso del viaje queda sin aviso', () => {
  const raiz = import.meta.dirname;
  const archivos: string[] = [];
  const recorrer = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) {
        if (n !== 'pruebas' && n !== 'node_modules') recorrer(p);
      } else if (/\.ts$/.test(n) && !/\.test\.ts$/.test(n)) archivos.push(p);
    }
  };
  recorrer(raiz);
  const llamadas: { archivo: string; linea: number; ventana: string }[] = [];
  for (const a of archivos) {
    const lineas = readFileSync(a, 'utf8').split('\n');
    lineas.forEach((l, n) => {
      if (/\b(cambiarEstadoViaje|liberarViaje|aceptarOperacion)\(/.test(l) && !/function /.test(l))
        llamadas.push({
          archivo: a.slice(raiz.length + 1),
          linea: n + 1,
          ventana: lineas.slice(Math.max(0, n - 3), n + 45).join('\n'),
        });
    });
  }

  it('hay transiciones que revisar (la búsqueda no quedó vacía)', () => {
    expect(llamadas.length).toBeGreaterThanOrEqual(8);
  });

  it('cada transición avisa o dice por qué no', () => {
    const sinAviso = llamadas
      .filter(
        (x) =>
          !/avisarPasoViaje\(|C-AVISOS-VIAJE: sin aviso —|avisarProgramadoSinConductor\(/.test(
            x.ventana,
          ),
      )
      .map((x) => `${x.archivo}:${x.linea}`);
    expect(sinAviso).toEqual([]);
  });

  it('los pasos del conductor (llegué, iniciar, terminar, no se presentó) tienen su aviso', () => {
    const s = readFileSync(join(raiz, 'rutas', 'viajes.ts'), 'utf8');
    for (const [ruta, paso] of [
      ['llegue', 'llego'],
      ['iniciar', 'en_curso'],
      ['terminar', 'terminado'],
      ['no-se-presento', 'no_show'],
    ])
      expect(s).toContain(`['${ruta}', '${paso}']`);
  });
});
