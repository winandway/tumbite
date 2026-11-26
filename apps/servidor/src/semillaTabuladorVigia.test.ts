import { describe, expect, it, vi } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import {
  CLAVE_SEMILLA_TABULADOR_VIGIA,
  RECARGO_NOCHE_VIGIA_PB,
  TARIFA_APRENDIDA_VIGIA,
  TOPE_ESCRITURAS_SEMILLA_VIGIA,
  exigirPresupuestoSemilla,
  sembrarTabuladorVigia,
} from './semillaTabuladorVigia';
import { TOPE_RUTAS_POR_ZONA } from './precioZona';
import { TABULADOR_EL_VIGIA } from './tabuladorElVigia';

/**
 * C-TABULADOR-VIGIA (25 nov 2026) — Venezuela. La semilla del tabulador de El Vigía: una sola vez,
 * idempotente, sin pisar lo del equipo, sin fallar si la zona todavía no existe, y con su presupuesto
 * de escrituras medido.
 */
async function escenario({ abrir = true } = {}) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  if (abrir) {
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

  it('si el lote falla, suelta la marca y no deja nada a medias', async () => {
    const e = await escenario();
    const batch = e.m.DB.batch.bind(e.m.DB);
    const espia = vi.spyOn(e.m.DB, 'batch').mockImplementationOnce(async () => {
      throw new Error('D1 caído');
    });
    await expect(sembrarTabuladorVigia(e.m.DB)).rejects.toThrow('D1 caído');
    espia.mockRestore();
    expect(await e.marca()).toBeNull();
    expect(await e.contar()).toBe(0);
    void batch;
    // Y a la siguiente sí corre.
    expect((await sembrarTabuladorVigia(e.m.DB))?.rutas).toBeGreaterThan(83);
  });
});
