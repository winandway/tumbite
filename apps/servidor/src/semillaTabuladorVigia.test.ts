import { describe, expect, it, vi } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import {
  CLAVE_SEMILLA_TABULADOR_VIGIA,
  RECARGO_NOCHE_VIGIA_PB,
  TARIFA_APRENDIDA_VIGIA,
  TOPE_ESCRITURAS_SEMILLA_VIGIA,
  CADUCA_SEMILLA_MS,
  exigirPresupuestoSemilla,
  leerMarcaSemilla,
  saludTabuladorVigia,
  semillaPorCorrer,
  sembrarTabuladorVigia,
} from './semillaTabuladorVigia';
import { reiniciarEsquema } from './esquema';
import { rehacerQuienPaga } from './esquemaQuienPaga';
import { quienPagaViaje } from './finanzas/quienPaga';
import { TOPE_RUTAS_POR_ZONA } from './precioZona';
import { TABULADOR_EL_VIGIA } from './tabuladorElVigia';

/**
 * C-TABULADOR-VIGIA (25 nov 2026) — Venezuela. La semilla del tabulador de El Vigía: una sola vez,
 * idempotente, sin pisar lo del equipo, sin fallar si la zona todavía no existe, y con su presupuesto
 * de escrituras medido.
 */
async function abrirElVigia(e: { m: ReturnType<typeof mundo>; admin: { token: string } }) {
  {
    const { m, admin } = e;
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
  }
}

async function escenario({ abrir = true } = {}) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  if (abrir) await abrirElVigia({ m, admin });
  const contar = async () =>
    Number(
      (
        await m.DB.prepare(
          "SELECT COUNT(*) AS n FROM rutas_precio_zona WHERE zona_id = ? AND servicio_id = 'moto'",
        )
          .bind(EVG.id)
          .first<{ n: number }>()
      )?.n ?? 0,
    );
  const marca = () =>
    m.DB.prepare('SELECT valor FROM config WHERE clave = ?')
      .bind(CLAVE_SEMILLA_TABULADOR_VIGIA)
      .first<{ valor: string }>();
  const tarifa = () =>
    m.DB.prepare(
      "SELECT * FROM tarifas_viaje WHERE zona_id = ? AND servicio_id = 'moto' AND activa = 1",
    )
      .bind(EVG.id)
      .first<Record<string, unknown>>();
  return { m, admin, contar, marca, tarifa };
}

describe('C-TABULADOR-VIGIA: la semilla de El Vigía', () => {
  it('sin la zona no hace nada ni pone la marca (lo intenta en la próxima publicación)', async () => {
    const e = await escenario({ abrir: false });
    expect(await sembrarTabuladorVigia(e.m.DB)).toBeNull();
    expect(await e.marca()).toBeNull();
    expect(await e.contar()).toBe(0);
  });

  it('carga las idas, los regresos de la zona, quién paga y la tarifa aprendida, en una pasada', async () => {
    const e = await escenario();
    const antes = await e.tarifa();
    const lote = vi.spyOn(e.m.DB, 'batch');
    const r = await sembrarTabuladorVigia(e.m.DB);
    // Medido: UN solo lote, con todas las escrituras menos la marca del principio.
    expect(lote).toHaveBeenCalledTimes(1);
    expect((lote.mock.calls[0]?.[0] ?? []).length + 1).toBe(r?.escrituras);
    lote.mockRestore();
    expect(r).not.toBeNull();
    // Una ida por destino; un regreso solo para los destinos que son de la zona.
    expect(r?.rutas).toBe(TABULADOR_EL_VIGIA.length + (r?.regresos ?? 0));
    expect(r?.regresos).toBeGreaterThan(15);
    expect(r?.regresos).toBeLessThan(TABULADOR_EL_VIGIA.length);
    expect(await e.contar()).toBe(r?.rutas);
    // Todas caben en lo que mira la cotización (una lectura por zona).
    expect(r?.rutas).toBeLessThanOrEqual(TOPE_RUTAS_POR_ZONA - 40);
    // Presupuesto de la regla de la nube: un lote medido, bajo el tope.
    expect(r?.escrituras).toBe((r?.rutas ?? 0) + 5);
    expect(r?.escrituras).toBeLessThanOrEqual(TOPE_ESCRITURAS_SEMILLA_VIGIA);

    // Mérida: ida desde el casco, con su vía, en dólares, sin regreso (no es de la zona).
    const merida = await e.m.DB.prepare(
      "SELECT * FROM rutas_precio_zona WHERE zona_id = ? AND hasta_nombre = 'Mérida'",
    )
      .bind(EVG.id)
      .all<Record<string, unknown>>();
    expect(merida.results).toHaveLength(1);
    expect(merida.results[0]).toMatchObject({
      precio: 3000,
      moneda: 'USD',
      grupo: 'Vía Mérida',
      desde_nombre: 'El Vigía (casco urbano)',
      desde_radio_km: 4,
      revisar: 0,
      activa: 1,
    });
    expect(
      await e.m.DB.prepare("SELECT 1 FROM rutas_precio_zona WHERE desde_nombre = 'Mérida'").first(),
    ).toBeNull();
    // La Motoza (dentro del casco): ida y regreso, con el mismo precio.
    const motoza = await e.m.DB.prepare(
      "SELECT precio, grupo FROM rutas_precio_zona WHERE hasta_nombre = 'La Motoza' OR desde_nombre = 'La Motoza'",
    ).all<{ precio: number; grupo: string }>();
    expect(motoza.results).toEqual([
      { precio: 200, grupo: 'Carreras cortas' },
      { precio: 200, grupo: 'Carreras cortas' },
    ]);
    // Lo aproximado queda marcado para revisar.
    const revisar = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM rutas_precio_zona WHERE zona_id = ? AND revisar = 1 AND hasta_nombre <> 'El Vigía (casco urbano)'",
    )
      .bind(EVG.id)
      .first<{ n: number }>();
    expect(revisar?.n).toBe(TABULADOR_EL_VIGIA.filter((d) => d.revisar).length);

    // En El Vigía la comisión la paga el conductor (el resto de Venezuela sigue como estaba).
    const quien = await e.m.DB.prepare(
      "SELECT pais, ciudad, valor FROM quien_paga_viajes WHERE pais = 'VE' ORDER BY ciudad",
    ).all();
    expect(quien.results).toEqual([
      { pais: 'VE', ciudad: '', valor: 'cliente' },
      { pais: 'VE', ciudad: EVG.id, valor: 'conductor' },
    ]);

    // La tarifa aprendida, como versión nueva; lo demás de la tarifa de antes, igual.
    const t = await e.tarifa();
    expect(t?.id).not.toBe(antes?.id);
    expect(t).toMatchObject({
      base: TARIFA_APRENDIDA_VIGIA.base,
      por_km: TARIFA_APRENDIDA_VIGIA.porKm,
      por_minuto: 0,
      minimo: 100,
      umbral_precio_zona_pb: 0,
      recargo_noche_pb: RECARGO_NOCHE_VIGIA_PB,
      noche_desde_h: null,
      noche_hasta_h: null,
      moneda: 'USD',
      espera_gratis_s: antes?.espera_gratis_s,
      cargo_cancelacion: antes?.cargo_cancelacion,
      de_prueba: antes?.de_prueba,
    });
    const activas = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM tarifas_viaje WHERE zona_id = ? AND servicio_id = 'moto' AND activa = 1",
    )
      .bind(EVG.id)
      .first<{ n: number }>();
    expect(activas?.n).toBe(1);
    expect(JSON.parse(String((await e.marca())?.valor))).toMatchObject({ hecha: true });
  });

  it('correrla dos veces no duplica ni pisa lo que el equipo editó después', async () => {
    const e = await escenario();
    const r = await sembrarTabuladorVigia(e.m.DB);
    const n = await e.contar();
    // El equipo cambia un precio y la tarifa desde el panel.
    const lista = await e.m.llamar(
      'GET',
      `/datos/admin/viajes/precios-zona?zona=${EVG.id}&servicio=moto`,
      undefined,
      e.admin.token,
    );
    const tovar = (lista.datos.rutas as { id: string; hasta: { nombre: string } }[]).find(
      (x) => x.hasta.nombre === 'Tovar',
    );
    expect(tovar).toBeDefined();
    const editada = await e.m.llamar(
      'PUT',
      `/datos/admin/viajes/precios-zona/${tovar?.id}`,
      {
        ...(tovar as object),
        zona: EVG.id,
        servicio: 'moto',
        precio: 2200,
      },
      e.admin.token,
    );
    expect(editada.estado, JSON.stringify(editada.datos)).toBe(200);
    const panel = await e.m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: EVG.id,
        tarifa: { base: 10, porKm: 30, porMinuto: 0, minimo: 100 },
        motivo: 'Cambio del equipo',
      },
      e.admin.token,
    );
    expect(panel.estado).toBe(201);
    // Otra publicación: la semilla ya corrió.
    expect(await sembrarTabuladorVigia(e.m.DB)).toBeNull();
    expect(await e.contar()).toBe(n);
    expect(r?.rutas).toBe(n);
    expect(
      await e.m.DB.prepare('SELECT precio FROM rutas_precio_zona WHERE id = ?')
        .bind(tovar?.id)
        .first(),
    ).toEqual({ precio: 2200 });
    expect(await e.tarifa()).toMatchObject({ base: 10, por_km: 30 });
  });

  it('no duplica las rutas que el equipo ya cargó a mano ni su regla de quién paga', async () => {
    const e = await escenario();
    await e.m.DB.prepare(
      "INSERT INTO quien_paga_viajes (pais, ciudad, valor, cambiado_por) VALUES ('VE', ?, 'mitad', 'equipo')",
    )
      .bind(EVG.id)
      .run();
    const tovar = TABULADOR_EL_VIGIA.find((d) => d.nombre === 'Tovar');
    const mano = await e.m.llamar(
      'POST',
      '/datos/admin/viajes/precios-zona',
      {
        zona: EVG.id,
        servicio: 'moto',
        desde: null,
        hasta: { lat: tovar?.lat, lng: tovar?.lng, radioKm: 3, nombre: 'Tovar centro' },
        precio: 2400,
      },
      e.admin.token,
    );
    expect(mano.estado).toBe(201);
    const r = await sembrarTabuladorVigia(e.m.DB);
    expect(r?.omitidas).toBe(1);
    const aTovar = await e.m.DB.prepare(
      "SELECT hasta_nombre, precio FROM rutas_precio_zona WHERE hasta_nombre LIKE 'Tovar%'",
    ).all();
    expect(aTovar.results).toEqual([{ hasta_nombre: 'Tovar centro', precio: 2400 }]);
    expect(
      await e.m.DB.prepare('SELECT valor FROM quien_paga_viajes WHERE ciudad = ?')
        .bind(EVG.id)
        .first(),
    ).toEqual({ valor: 'mitad' });
  });

  it('corregir el punto (o «marcar como revisado») desmarca «revisar»; cambiar solo el precio, no', async () => {
    const e = await escenario();
    await sembrarTabuladorVigia(e.m.DB);
    const lista = async () =>
      (
        await e.m.llamar(
          'GET',
          `/datos/admin/viajes/precios-zona?zona=${EVG.id}&servicio=moto`,
          undefined,
          e.admin.token,
        )
      ).datos.rutas as {
        id: string;
        revisar: boolean;
        grupo: string;
        hasta: { lat: number; lng: number; radioKm: number; nombre: string };
        desde: unknown;
        precio: number;
      }[];
    const dudosas = (await lista()).filter(
      (x) => x.revisar && x.hasta.nombre !== 'El Vigía (casco urbano)',
    );
    expect(dudosas.length).toBeGreaterThan(2);
    const [a, b] = dudosas as [(typeof dudosas)[number], (typeof dudosas)[number]];
    const poner = (x: typeof a, cambio: object) =>
      e.m.llamar(
        'PUT',
        `/datos/admin/viajes/precios-zona/${x.id}`,
        {
          zona: EVG.id,
          servicio: 'moto',
          desde: x.desde,
          hasta: x.hasta,
          precio: x.precio,
          grupo: x.grupo,
          ...cambio,
        },
        e.admin.token,
      );
    // Solo el precio: sigue por revisar.
    expect((await poner(a, { precio: a.precio + 100 })).datos.ruta.revisar).toBe(true);
    // El punto corregido: listo, y la vía se queda.
    const movida = await poner(a, { hasta: { ...a.hasta, lat: a.hasta.lat + 0.001 } });
    expect(movida.datos.ruta).toMatchObject({ revisar: false, grupo: a.grupo });
    // «Marcar como revisado» sin mover nada.
    expect((await poner(b, { revisado: true })).datos.ruta.revisar).toBe(false);
  });

  it('pasar el tope de escrituras frena la semilla antes de escribir', () => {
    expect(() => exigirPresupuestoSemilla(TOPE_ESCRITURAS_SEMILLA_VIGIA)).not.toThrow();
    expect(() => exigirPresupuestoSemilla(TOPE_ESCRITURAS_SEMILLA_VIGIA + 1)).toThrow(/tope/);
  });

  it('si el lote falla, la marca queda en «error» (canario en rojo), no deja nada a medias y se reintenta', async () => {
    const e = await escenario();
    const espia = vi.spyOn(e.m.DB, 'batch').mockImplementationOnce(async () => {
      throw new Error('D1 caído');
    });
    await expect(sembrarTabuladorVigia(e.m.DB)).rejects.toThrow('D1 caído');
    espia.mockRestore();
    expect(leerMarcaSemilla((await e.marca())?.valor)?.estado).toBe('error');
    expect(await saludTabuladorVigia(e.m.DB)).toBe('error');
    expect(await e.contar()).toBe(0);
    // Y a la siguiente sí corre.
    expect((await sembrarTabuladorVigia(e.m.DB))?.rutas).toBeGreaterThan(83);
    expect(await saludTabuladorVigia(e.m.DB)).toBe('ok');
  });
});

describe('C-TABULADOR-VIGIA: el reintento real de la semilla (arranques con el mismo código)', () => {
  const pieza = async (m: ReturnType<typeof mundo>) =>
    (await m.llamar('GET', '/datos/salud')).datos.piezas.tabuladorVigia as string;

  it('la zona llega DESPUÉS de publicar: el arranque siguiente siembra sin otra publicación; el canario pasa de pendiente a ok', async () => {
    const e = await escenario({ abrir: false });
    // La migración ya corrió y dejó su huella sin la zona: nada sembrado, canario «pendiente».
    expect(await pieza(e.m)).toBe('pendiente');
    expect(await e.marca()).toBeNull();
    await abrirElVigia(e);
    // Un servidor nuevo con el MISMO código (misma huella): el reintento propio siembra.
    reiniciarEsquema();
    expect(await pieza(e.m)).toBe('ok');
    expect(await e.contar()).toBeGreaterThan(83);
    // Y el arranque siguiente no vuelve a sembrar ni a duplicar.
    const n = await e.contar();
    reiniciarEsquema();
    await pieza(e.m);
    expect(await e.contar()).toBe(n);
  });

  it('una marca «corriendo» colgada (servidor cortado a mitad) caduca y se reintenta; una reciente no', async () => {
    const e = await escenario();
    const poner = (desde: number) =>
      e.m.DB.prepare('INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)')
        .bind(
          CLAVE_SEMILLA_TABULADOR_VIGIA,
          JSON.stringify({ estado: 'corriendo', desde: new Date(desde).toISOString() }),
        )
        .run();
    await poner(Date.now() - 60_000);
    reiniciarEsquema();
    expect(await pieza(e.m)).toBe('pendiente');
    expect(await e.contar()).toBe(0);
    await poner(Date.now() - CADUCA_SEMILLA_MS - 60_000);
    expect(await saludTabuladorVigia(e.m.DB)).toBe('error');
    reiniciarEsquema();
    expect(await pieza(e.m)).toBe('ok');
    expect(await e.contar()).toBeGreaterThan(83);
    // La marca vieja de antes («corriendo» suelto) también caduca.
    expect(semillaPorCorrer(leerMarcaSemilla('corriendo'))).toBe(true);
  });

  it('una marca en «error» se reintenta en el arranque siguiente', async () => {
    const e = await escenario();
    await e.m.DB.prepare('INSERT INTO config (clave, valor) VALUES (?, ?)')
      .bind(
        CLAVE_SEMILLA_TABULADOR_VIGIA,
        JSON.stringify({ estado: 'error', error: 'D1 caído', cuando: new Date().toISOString() }),
      )
      .run();
    reiniciarEsquema();
    expect(await pieza(e.m)).toBe('ok');
  });
});

describe('C-QUIEN-PAGA-SERVICIO: en El Vigía paga el conductor SOLO en Moto', () => {
  it('Moto en El Vigía: conductor; Carro en El Vigía: sigue como el país (cliente)', async () => {
    const e = await escenario();
    await sembrarTabuladorVigia(e.m.DB);
    expect(await quienPagaViaje(e.m.DB, 'VE', EVG.id, 'moto')).toBe('conductor');
    expect(await quienPagaViaje(e.m.DB, 'VE', EVG.id, 'carro')).toBe('cliente');
    expect(await quienPagaViaje(e.m.DB, 'VE', EVG.id)).toBe('cliente');
    // El panel lo lista como «solo Moto» y cambiar la regla de la ciudad entera no lo toca.
    const lista = await e.m.llamar(
      'GET',
      '/datos/admin/finanzas/quien-paga',
      undefined,
      e.admin.token,
    );
    expect(lista.datos.reglas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pais: 'VE',
          ciudad: EVG.id,
          servicio: 'moto',
          valor: 'conductor',
        }),
      ]),
    );
    const ciudad = await e.m.llamar(
      'PUT',
      '/datos/admin/finanzas/quien-paga',
      { pais: 'VE', ciudad: EVG.id, valor: 'mitad' },
      e.admin.token,
    );
    expect(ciudad.estado).toBe(200);
    expect(await quienPagaViaje(e.m.DB, 'VE', EVG.id, 'carro')).toBe('mitad');
    expect(await quienPagaViaje(e.m.DB, 'VE', EVG.id, 'moto')).toBe('conductor');
    // «Como el resto» para Moto quita solo la regla de Moto.
    const quitar = await e.m.llamar(
      'PUT',
      '/datos/admin/finanzas/quien-paga',
      { pais: 'VE', ciudad: EVG.id, servicio: 'moto', valor: 'del_pais' },
      e.admin.token,
    );
    expect(quitar.estado).toBe(200);
    expect(await quienPagaViaje(e.m.DB, 'VE', EVG.id, 'moto')).toBe('mitad');
  });

  it('una base con la clave vieja (país, ciudad) se rehace sin perder reglas, una sola vez', async () => {
    const e = await escenario({ abrir: false });
    await e.m.DB.batch([
      e.m.DB.prepare('DROP TABLE quien_paga_viajes'),
      e.m.DB.prepare(
        `CREATE TABLE quien_paga_viajes (pais TEXT NOT NULL, ciudad TEXT NOT NULL DEFAULT '',
          valor TEXT NOT NULL CHECK (valor IN ('conductor', 'cliente', 'mitad')), cambiado_por TEXT,
          cambiado_en TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (pais, ciudad))`,
      ),
      e.m.DB.prepare(
        "INSERT INTO quien_paga_viajes (pais, ciudad, valor) VALUES ('VE', '', 'cliente'), ('VE', 'VE-X', 'mitad')",
      ),
    ]);
    expect(await rehacerQuienPaga(e.m.DB)).toBe(true);
    expect(await rehacerQuienPaga(e.m.DB)).toBe(false);
    const filas = await e.m.DB.prepare(
      'SELECT pais, ciudad, servicio, valor FROM quien_paga_viajes ORDER BY ciudad',
    ).all();
    expect(filas.results).toEqual([
      { pais: 'VE', ciudad: '', servicio: '', valor: 'cliente' },
      { pais: 'VE', ciudad: 'VE-X', servicio: '', valor: 'mitad' },
    ]);
    // Ya admite una regla de un solo servicio en la misma ciudad.
    await e.m.DB.prepare(
      "INSERT INTO quien_paga_viajes (pais, ciudad, servicio, valor) VALUES ('VE', 'VE-X', 'moto', 'conductor')",
    ).run();
    expect(await quienPagaViaje(e.m.DB, 'VE', 'VE-X', 'moto')).toBe('conductor');
    expect(await quienPagaViaje(e.m.DB, 'VE', 'VE-X', 'carro')).toBe('mitad');
  });
});
