import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG, CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { sembrarTabuladorVigia } from './semillaTabuladorVigia';
import {
  OTROS_NOMBRES_VIGIA,
  PUNTOS_CORREGIDOS_VIGIA,
  sembrarLugaresVigia,
} from './semillaLugaresVigia';
import { TABULADOR_EL_VIGIA } from './tabuladorElVigia';
import {
  PREFIJO_LUGAR_PROPIO,
  armarCiudad,
  buscarEnCiudad,
  lugaresDeLaCiudad,
  sugerenciaDeLugar,
  vaciarCacheLugares,
} from './lugaresPropios';

/**
 * C-LUGARES-PROPIOS (27 nov 2026, Richard: «¿el resto de las direcciones también fueron probadas?… si
 * alguien agrega ese nombre, lanza las coordenadas reales… en esa ciudad») — todas las ciudades, con
 * El Vigía (Venezuela) de ejemplo real. Cada destino del tabulador se encuentra por su nombre y por sus
 * otros nombres, primero; un lugar propio de una ciudad nunca sale en otra; buscar no escribe.
 */

// La lista de El Vigía como queda después de la semilla: un lugar propio por destino, atado a su ruta.
const filasVigia = () => {
  const rutas = TABULADOR_EL_VIGIA.map((d, i) => ({
    id: `r${i}`,
    servicio_id: 'moto',
    moneda: 'USD',
    desde_lat: 8.6219,
    desde_lng: -71.6506,
    desde_radio_km: 4,
    hasta_lat: d.lat,
    hasta_lng: d.lng,
    hasta_nombre: d.nombre,
    precio: d.precio,
    revisar: 0,
    grupo: d.via,
  }));
  const lugares = TABULADOR_EL_VIGIA.map((d, i) => ({
    id: `l${i}`,
    zona_id: EVG.id,
    nombre: d.nombre,
    otros_nombres: JSON.stringify(OTROS_NOMBRES_VIGIA[d.nombre] ?? []),
    lat: d.lat,
    lng: d.lng,
    ruta_id: `r${i}`,
    activo: 1,
  }));
  return { rutas, lugares };
};

/** Formas en que la gente escribe un nombre: tal cual, en minúsculas sin acentos y en mayúsculas. */
const formas = (n: string) => [
  n,
  n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  n.toUpperCase(),
];

describe('C-LUGARES-PROPIOS: cada destino del tabulador de El Vigía se encuentra primero', () => {
  const { rutas, lugares } = filasVigia();
  const { lista } = armarCiudad(lugares, rutas);

  it('por su nombre, escrito de cualquier forma (83 destinos)', () => {
    expect(TABULADOR_EL_VIGIA).toHaveLength(83);
    const fallan: string[] = [];
    for (const d of TABULADOR_EL_VIGIA)
      for (const f of formas(d.nombre))
        if (buscarEnCiudad(lista, f)[0]?.nombre !== d.nombre) fallan.push(f);
    expect(fallan).toEqual([]);
  });

  it('por cada uno de sus otros nombres', () => {
    const fallan: string[] = [];
    for (const [nombre, otros] of Object.entries(OTROS_NOMBRES_VIGIA)) {
      expect(
        TABULADOR_EL_VIGIA.some((d) => d.nombre === nombre),
        nombre,
      ).toBe(true);
      for (const o of otros)
        for (const f of formas(o))
          if (buscarEnCiudad(lista, f)[0]?.nombre !== nombre) fallan.push(`${f} → ${nombre}`);
    }
    expect(fallan).toEqual([]);
  });

  it('«km9», «KM-9», «kilómetro 9» y «Kilometro 9» son KM 9; y desde la segunda letra ya sugiere', () => {
    for (const f of ['km9', 'KM-9', 'kilómetro 9', 'Kilometro 9', 'k.m. 9'])
      expect(buscarEnCiudad(lista, f)[0]?.nombre, f).toBe('KM 9');
    expect(buscarEnCiudad(lista, 'pe').length).toBeGreaterThan(0);
  });

  it('ningún destino queda con el punto aproximado, y los 17 corregidos tienen su fuente', () => {
    expect(TABULADOR_EL_VIGIA.filter((d) => d.revisar).map((d) => d.nombre)).toEqual([]);
    expect(PUNTOS_CORREGIDOS_VIGIA).toHaveLength(17);
    for (const c of PUNTOS_CORREGIDOS_VIGIA) {
      const d = TABULADOR_EL_VIGIA.find((x) => x.nombre === c.nombre)!;
      expect(d, c.nombre).toBeDefined();
      expect([d.lat, d.lng], c.nombre).not.toEqual([c.antes.lat, c.antes.lng]);
    }
  });

  it('la sugerencia lleva el precio de la hoja de día, y con el recargo de noche', () => {
    const km9 = buscarEnCiudad(lista, 'km 9')[0]!;
    const noche = new Map([
      ['moto', { redondeo: 1, recargoNochePb: 3000, nocheDesdeH: 21, nocheHastaH: 6 }],
    ]);
    const ciudad = { nombre: 'El Vigía', zonaHoraria: 'America/Caracas' };
    const dia = sugerenciaDeLugar(km9, ciudad, noche, {
      idioma: 'es',
      ahora: new Date('2026-11-27T16:00:00Z'),
    });
    expect(dia).toMatchObject({ principal: 'KM 9', precio: 300 });
    expect(dia.secundario).toContain('3');
    const deNoche = sugerenciaDeLugar(km9, ciudad, noche, {
      idioma: 'es',
      ahora: new Date('2026-11-27T03:00:00Z'),
    });
    expect(deNoche).toMatchObject({ precio: 390 });
    // Fuera de donde empieza la ruta (el casco), el precio no se promete.
    const lejos = sugerenciaDeLugar(km9, ciudad, noche, {
      idioma: 'es',
      donde: { lat: 8.33, lng: -71.75 },
    });
    expect(lejos.precio).toBeUndefined();
  });

  it('buscar no escribe y lee la ciudad una sola vez con su caché', async () => {
    vaciarCacheLugares();
    const batch = vi.fn(async () => [{ results: lugares }, { results: rutas }, { results: [] }]);
    const db = { prepare: () => ({ bind: () => ({}) }), batch } as unknown as D1Database;
    await lugaresDeLaCiudad(db, EVG.id);
    await lugaresDeLaCiudad(db, EVG.id);
    await lugaresDeLaCiudad(db, EVG.id);
    expect(batch).toHaveBeenCalledTimes(1);
    vaciarCacheLugares();
  });
});

// ─────────────────────────── En el servidor de verdad (la base de pruebas) ───────────────────────────

type Sug = { id: string; principal?: string; texto: string; precio?: number };

async function dosCiudades() {
  vaciarCacheLugares();
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  for (const c of [EVG, CCS]) {
    const r = await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      {
        servicio: 'moto',
        zona: {
          id: c.id,
          nombre: c.nombre,
          lat: c.lat,
          lng: c.lng,
          radioKm: c.radioKm,
          zonaHoraria: c.zonaHoraria,
        },
        motivo: 'ciudad para la prueba de lugares propios',
      },
      admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  }
  expect(await sembrarTabuladorVigia(m.DB)).not.toBeNull();
  const buscar = (q: string, c: { lat: number; lng: number }) =>
    m.llamar(
      'GET',
      `/datos/lugares/sugerencias?q=${encodeURIComponent(q)}&lat=${c.lat}&lng=${c.lng}`,
    );
  return { m, admin, buscar };
}

describe('C-LUGARES-PROPIOS en el servidor', () => {
  beforeEach(() => vaciarCacheLugares());
  afterEach(() => vi.unstubAllGlobals());

  it('la semilla corrige los 17 puntos (ida y regreso), crea un lugar por destino y no corre dos veces', async () => {
    const { m } = await dosCiudades();
    const r = await sembrarLugaresVigia(m.DB);
    expect(r?.lugares).toBe(83);
    expect(await sembrarLugaresVigia(m.DB)).toBeNull();
    const { results } = await m.DB.prepare(
      'SELECT hasta_nombre, revisar FROM rutas_precio_zona WHERE zona_id = ? AND revisar = 1',
    )
      .bind(EVG.id)
      .all();
    expect(results).toEqual([]);
    const pedeca = TABULADOR_EL_VIGIA.find((d) => d.nombre === 'Pedeca')!;
    const regreso = await m.DB.prepare(
      "SELECT desde_lat, desde_lng FROM rutas_precio_zona WHERE zona_id = ? AND desde_nombre = 'Pedeca'",
    )
      .bind(EVG.id)
      .first<{ desde_lat: number; desde_lng: number }>();
    expect(regreso).toEqual({ desde_lat: pedeca.lat, desde_lng: pedeca.lng });
  });

  it('el equipo ya movió un punto en el panel: la semilla no se lo pisa', async () => {
    const { m } = await dosCiudades();
    await m.DB.prepare(
      "UPDATE rutas_precio_zona SET hasta_lat = 8.7, hasta_lng = -71.7 WHERE zona_id = ? AND hasta_nombre = 'Cañito'",
    )
      .bind(EVG.id)
      .run();
    await sembrarLugaresVigia(m.DB);
    const f = await m.DB.prepare(
      "SELECT hasta_lat, hasta_lng FROM rutas_precio_zona WHERE zona_id = ? AND hasta_nombre = 'Cañito'",
    )
      .bind(EVG.id)
      .first();
    expect(f).toEqual({ hasta_lat: 8.7, hasta_lng: -71.7 });
    const l = await m.DB.prepare(
      "SELECT lat, lng FROM lugares_propios WHERE nombre = 'Cañito'",
    ).first();
    expect(l).toEqual({ lat: 8.7, lng: -71.7 });
  });

  it('desde El Vigía, cada destino del tabulador sale primero por su nombre y por sus otros nombres, con su punto', async () => {
    const { m, buscar } = await dosCiudades();
    await sembrarLugaresVigia(m.DB);
    const fallan: string[] = [];
    const pedidos = [
      ...TABULADOR_EL_VIGIA.map((d) => [d.nombre, d.nombre] as const),
      ...Object.entries(OTROS_NOMBRES_VIGIA).flatMap(([n, otros]) =>
        otros.map((o) => [o, n] as const),
      ),
    ];
    for (const [q, nombre] of pedidos) {
      const r = await buscar(q, EVG);
      const s = (r.datos.sugerencias ?? []) as Sug[];
      if (s[0]?.principal !== nombre || !s[0].id.startsWith(PREFIJO_LUGAR_PROPIO))
        fallan.push(`${q} → ${s[0]?.principal ?? r.estado}`);
    }
    expect(fallan).toEqual([]);
    // Elegirlo da el punto real del tabulador.
    const km9 = ((await buscar('km9', EVG)).datos.sugerencias as Sug[])[0]!;
    // De día la hoja (3,00); de noche con el recargo del 30 % (3,90): depende de la hora de la prueba.
    expect([300, 390]).toContain(km9.precio);
    const p = await m.llamar('GET', `/datos/lugares/punto/${encodeURIComponent(km9.id)}`);
    const d = TABULADOR_EL_VIGIA.find((x) => x.nombre === 'KM 9')!;
    expect(p.datos).toEqual({
      punto: { lat: d.lat, lng: d.lng },
      direccion: `KM 9, ${EVG.nombre}`,
    });
  });

  it('un lugar propio de El Vigía nunca sale en otra ciudad (ni por ubicación ni por la cuenta)', async () => {
    const { m, buscar } = await dosCiudades();
    await sembrarLugaresVigia(m.DB);
    for (const q of ['KM 9', 'km9', 'Mérida', 'Pedeca', 'La Vega II']) {
      const s = ((await buscar(q, CCS)).datos.sugerencias ?? []) as Sug[];
      expect(
        s.filter((x) => x.id.startsWith('lp~') || x.id.startsWith('tab~')),
        q,
      ).toEqual([]);
    }
    const caraqueno = await m.cuenta('cliente', 'Ana Caracas');
    await m.DB.prepare('UPDATE usuarios SET zona_id = ? WHERE id = ?')
      .bind(CCS.id, caraqueno.id)
      .run();
    const r = await m.llamar(
      'GET',
      '/datos/lugares/sugerencias?q=KM%209',
      undefined,
      caraqueno.token,
    );
    expect(((r.datos.sugerencias ?? []) as Sug[]).some((x) => x.id.startsWith('lp~'))).toBe(false);
  });

  it('el panel agrega un lugar con otro nombre; moverlo mueve su ruta del tabulador y el buscador lo ve al instante', async () => {
    const { m, admin, buscar } = await dosCiudades();
    await sembrarLugaresVigia(m.DB);
    const lista = await m.llamar(
      'GET',
      `/datos/admin/lugares-propios?zona=${EVG.id}`,
      undefined,
      admin.token,
    );
    expect(lista.estado).toBe(200);
    const km9 = (lista.datos.lugares as { id: string; nombre: string; rutaId: string }[]).find(
      (l) => l.nombre === 'KM 9',
    )!;
    // Primero se busca (queda en la caché), después se mueve.
    await buscar('km 9', EVG);
    const mover = await m.llamar(
      'PUT',
      `/datos/admin/lugares-propios/${km9.id}`,
      {
        zona: EVG.id,
        nombre: 'KM 9',
        otrosNombres: ['Kilómetro 9', 'La nueve'],
        lat: 8.597,
        lng: -71.722,
        rutaId: km9.rutaId,
      },
      admin.token,
    );
    expect(mover.estado, JSON.stringify(mover.datos)).toBe(200);
    const ruta = await m.DB.prepare(
      'SELECT hasta_lat, hasta_lng FROM rutas_precio_zona WHERE id = ?',
    )
      .bind(km9.rutaId)
      .first();
    expect(ruta).toEqual({ hasta_lat: 8.597, hasta_lng: -71.722 });
    const s = ((await buscar('la nueve', EVG)).datos.sugerencias as Sug[])[0]!;
    expect(s.principal).toBe('KM 9');
    // Un nombre que ya es de otro lugar de la ciudad no se repite.
    const repetido = await m.llamar(
      'POST',
      '/datos/admin/lugares-propios',
      {
        zona: EVG.id,
        nombre: 'Plaza nueva',
        otrosNombres: ['km9'],
        lat: 8.62,
        lng: -71.65,
        rutaId: null,
      },
      admin.token,
    );
    expect(repetido.estado).toBe(400);
    // Apagado, ya no sale.
    await m.llamar('POST', `/datos/admin/lugares-propios/${km9.id}/apagar`, undefined, admin.token);
    const despues = ((await buscar('la nueve', EVG)).datos.sugerencias ?? []) as Sug[];
    expect(despues.some((x) => x.principal === 'KM 9' && x.id.startsWith('lp~'))).toBe(false);
  });

  it('solo el equipo administra los lugares', async () => {
    const { m } = await dosCiudades();
    const cliente = await m.cuenta('cliente', 'Luis Pasajero');
    const r = await m.llamar(
      'GET',
      `/datos/admin/lugares-propios?zona=${EVG.id}`,
      undefined,
      cliente.token,
    );
    expect(r.estado).toBe(403);
  });
});

describe('C-LUGARES-PROPIOS: el robot nocturno busca TODOS los destinos del tabulador', () => {
  it('lee los 83 destinos del mismo archivo que siembra la base, con su precio', async () => {
    // @ts-expect-error -- guion en JavaScript del robot (sin tipos)
    const robot = (await import('../../../scripts/aceptacion/destinos.mjs')) as {
      destinosDelTabulador: () => { nombre: string; precio: number }[];
    };
    expect(robot.destinosDelTabulador()).toEqual(
      TABULADOR_EL_VIGIA.map((d) => ({ nombre: d.nombre, precio: d.precio })),
    );
  });
});
